import { useState, useEffect, useCallback, useRef } from 'react';
import { AIService, AIMessage, AIGenerationResult } from '@/services/ai';
import { ConversationRepository, Conversation } from '@/services/conversation';
import { TTSService, TTSState } from '@/services/voice';
import { ActionService, ActionResult } from '@/services/actions';
import { IntentResult, IntentType } from '@/engine/intentEngine';

/** High-level assistant phase surfaced to the UI. */
export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

/** Public shape returned by {@link useConversation}. */
export interface UseConversationResult {
  state: AssistantState;
  currentConversation: Conversation | null;
  messages: AIMessage[];
  lastResponse: string | null;
  lastActionResult: ActionResult | null;
  error: string | null;
  isTTSAvailable: boolean;
  processInput: (input: string, intent?: IntentResult | null) => Promise<void>;
  speak: (text: string) => Promise<void>;
  stopSpeaking: () => Promise<void>;
  startNewConversation: () => Promise<void>;
  clearConversation: () => void;
}

/** Intents that map to a device action rather than an AI answer. */
const ACTION_INTENTS: IntentType[] = [
  'open_youtube',
  'open_chrome',
  'open_whatsapp',
  'search_google',
];

function isActionIntent(intent: IntentType): boolean {
  return ACTION_INTENTS.includes(intent);
}

/**
 * Conversation orchestrator hook.
 *
 * This is the "brain stem" of JISSI: it takes a recognized utterance and routes
 * it to either a device action (ActionService) or the AI (AIService/Gemini),
 * persists the exchange (ConversationRepository), and speaks the reply
 * (TTSService). The UI only consumes the resulting state.
 *
 * Decoupling notes:
 * - React state is the single source of truth for *rendering*; the repository is
 *   the durable source of truth on disk.
 * - On load we COPY + de-dupe `conversation.messages` so the repository's
 *   in-place mutations never leak into React state (which previously caused
 *   duplicate React keys).
 */
export function useConversation(): UseConversationResult {
  const [state, setState] = useState<AssistantState>('idle');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsState, setTTSState] = useState<TTSState>('idle');

  const isInitializedRef = useRef(false);
  // Single-flight lock: prevents a second overlapping request (and thus a
  // duplicate Gemini/action call) while one is already being processed.
  const isProcessingRef = useRef(false);

  // Bridge the external TTSService state machine into React.
  useEffect(() => {
    const unsubscribe = TTSService.subscribeToState(setTTSState);
    return () => unsubscribe();
  }, []);

  // Keep the public phase in sync with TTS playback.
  useEffect(() => {
    if (ttsState === 'speaking') {
      setState('speaking');
    } else if (state === 'speaking' && ttsState === 'idle') {
      setState('idle');
    }
  }, [ttsState, state]);

  // One-time bootstrap: load/create the conversation and initialize the AI.
  useEffect(() => {
    const init = async () => {
      if (isInitializedRef.current) return;
      isInitializedRef.current = true;

      await ConversationRepository.initialize();

      let conversation = await ConversationRepository.getCurrentConversation();
      if (!conversation) {
        conversation = await ConversationRepository.createConversation();
      }
      setCurrentConversation(conversation);

      // De-dupe by id on load: the repository mutates `conversation.messages` in
      // place, and older sessions may have persisted duplicates. Copying here
      // decouples React state from that array and prevents duplicate React keys.
      const seenIds = new Set<string>();
      const uniqueMessages = conversation.messages.filter((m) => {
        if (seenIds.has(m.id)) return false;
        seenIds.add(m.id);
        return true;
      });
      setMessages(uniqueMessages);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      console.log('[FLOWDBG init] GEMINI key present =', !!apiKey, 'len =', apiKey ? apiKey.length : 0);
      if (apiKey) {
        AIService.initialize({ apiKey });
        console.log('[FLOWDBG init] AIService.initialize done. isInitialized =', AIService.isInitialized());
      } else {
        console.warn('[FLOWDBG init] Gemini API key NOT found. AI disabled.');
      }
    };

    init();
  }, []);

  /**
   * Core pipeline: persist the user message, then either execute a device
   * action or generate an AI reply, then speak the result.
   */
  const processInput = useCallback(
    async (input: string, intent?: IntentResult | null): Promise<void> => {
      // TEMP (Phase 2.3) correlation id for this user message across the pipeline.
      const reqId = `pi_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      console.log('[FLOWDBG 5] processInput entry. input=', JSON.stringify(input), 'intent=', intent?.intent);
      console.log(`[REQDBG] processInput ENTER reqId=${reqId} ts=${Date.now()}`);
      if (!input || input.trim().length === 0) return;

      // Single-flight: ignore new input while a request is already in flight.
      // With the hand-off's transcript de-dupe (index.tsx prevTranscriptRef) this
      // guarantees exactly one Gemini/action request per user utterance.
      if (isProcessingRef.current) {
        console.log(`[REQDBG] processInput IGNORED reqId=${reqId} — a request is already in flight`);
        return;
      }
      isProcessingRef.current = true;

      // try/finally guarantees the lock is released on EVERY exit path: the
      // action-branch early return, the not-initialized return, normal
      // completion, and any thrown error.
      try {
      setError(null);
      setLastResponse(null);
      setLastActionResult(null);

      const userMessage = await ConversationRepository.addMessage({
        conversationId: currentConversation?.id || '',
        role: 'user',
        content: input,
      });
      // Functional update + the load-time copy guarantee no duplication here.
      setMessages((prev) => [...prev, userMessage]);

      // ── Branch 1: device action ──────────────────────────────────────────
      if (intent && intent.intent !== 'unknown' && isActionIntent(intent.intent)) {
        setState('thinking');
        try {
          const result = await ActionService.executeFromIntent(intent.intent, intent.query);
          setLastActionResult(result);

          const replyText =
            result.status === 'success'
              ? result.message
              : `I couldn't complete that action. ${result.error || result.message}`;

          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: replyText,
          });
          setMessages((prev) => [...prev, assistantMessage]);
          if (result.status === 'success') setLastResponse(replyText);
          await TTSService.speak(replyText);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Action failed');
        } finally {
          setState('idle');
        }
        return;
      }

      // ── Branch 2: AI answer ──────────────────────────────────────────────
      console.log('[FLOWDBG 6] AI branch. AIService.isInitialized =', AIService.isInitialized());
      if (!AIService.isInitialized()) {
        console.log('[FLOWDBG STOP] AIService NOT initialized — chain stops here (missing GEMINI key).');
        setError('AI service is not available. Please check your configuration.');
        setState('idle');
        return;
      }

      setState('thinking');
      try {
        console.log('[FLOWDBG 6b] calling AIService.generate()');
        const result: AIGenerationResult = await AIService.generate(input);
        console.log('[FLOWDBG 8b] generate returned. finishReason=', result.finishReason, 'textLen=', result.text ? result.text.length : 0);

        const assistantMessage = await ConversationRepository.addMessage({
          conversationId: currentConversation?.id || '',
          role: 'assistant',
          content: result.text,
        });
        setMessages((prev) => [...prev, assistantMessage]);
        setLastResponse(result.text);
        console.log('[FLOWDBG 9] assistant message created. id=', assistantMessage.id);

        await TTSService.speak(result.text);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to process your request';
        setError(message);

        const assistantMessage = await ConversationRepository.addMessage({
          conversationId: currentConversation?.id || '',
          role: 'assistant',
          content: `I apologize, but I encountered an error. ${message}`,
        });
        setMessages((prev) => [...prev, assistantMessage]);
      } finally {
        setState('idle');
      }
      } finally {
        isProcessingRef.current = false;
        console.log(`[REQDBG] processInput EXIT reqId=${reqId} ts=${Date.now()}`);
      }
    },
    [currentConversation]
  );

  const speak = useCallback(async (text: string): Promise<void> => {
    await TTSService.speak(text);
  }, []);

  const stopSpeaking = useCallback(async (): Promise<void> => {
    await TTSService.stop();
  }, []);

  const startNewConversation = useCallback(async (): Promise<void> => {
    const conversation = await ConversationRepository.createConversation();
    setCurrentConversation(conversation);
    setMessages([]);
    setLastResponse(null);
    setLastActionResult(null);
    setError(null);
    AIService.startNewChat();
  }, []);

  const clearConversation = useCallback((): void => {
    setMessages([]);
    setLastResponse(null);
    setLastActionResult(null);
    setError(null);
  }, []);

  return {
    state,
    currentConversation,
    messages,
    lastResponse,
    lastActionResult,
    error,
    isTTSAvailable: TTSService.checkAvailability(),
    processInput,
    speak,
    stopSpeaking,
    startNewConversation,
    clearConversation,
  };
}
