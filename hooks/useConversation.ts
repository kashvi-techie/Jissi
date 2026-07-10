import { useState, useEffect, useCallback, useRef } from 'react';
import { AIService, AIMessage, AIGenerationResult } from '@/services/ai';
import { ConversationRepository, Conversation } from '@/services/conversation';
import { TTSService, TTSState } from '@/services/voice';
import { ActionService, ActionResult } from '@/services/actions';
import { SocialGreetingService } from '@/services/social';
import { PersonalityService } from '@/services/personality';
import { ContextEngine } from '@/services/context';
import { PlannerEngine } from '@/services/planner';
import { DecisionEngine } from '@/services/decision';
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
 * it to either a device action (ActionService) or the AI (AIService),
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
  // duplicate AI/action call) while one is already being processed.
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

      // Initialize the AI service once at startup. It depends ONLY on OpenRouter
      // (the provider reads EXPO_PUBLIC_OPENROUTER_API_KEY itself); no other env
      // variable gates initialization.
      AIService.initialize();
      console.log('[AI] startup init — isInitialized =', AIService.isInitialized());
    };

    init();
  }, []);

  /**
   * Core pipeline: persist the user message, then either execute a device
   * action or generate an AI reply, then speak the result.
   */
  const processInput = useCallback(
    async (input: string, intent?: IntentResult | null): Promise<void> => {
      if (!input || input.trim().length === 0) return;

      // Single-flight: ignore new input while a request is already in flight.
      // With the hand-off's transcript de-dupe (index.tsx prevTranscriptRef) this
      // guarantees exactly one AI/action request per user utterance.
      if (isProcessingRef.current) {
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
      await ContextEngine.observe({ input, intent });
      const decision = await DecisionEngine.decide({ input, intent });

      if (decision.action === 'relationship_response' && intent?.intent === 'social_greeting') {
        setState('thinking');
        try {
          const replyText = SocialGreetingService.generate({
            relationship: intent.entities?.relationship,
            name: intent.entities?.name,
            gender: intent.entities?.gender,
            rawText: input,
          });

          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: replyText,
          });
          setMessages((prev) => [...prev, assistantMessage]);
          setLastResponse(replyText);
          await ContextEngine.rememberAssistantResponse(replyText);
          await TTSService.speak(replyText);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Social greeting failed');
        } finally {
          setState('idle');
        }
        return;
      }

      // ── Branch 1: device action ──────────────────────────────────────────
      const plannerResult = decision.action === 'planner_update'
        ? await PlannerEngine.handleConversationInput(input)
        : null;
      if (plannerResult) {
        setState('thinking');
        try {
          const replyText = PersonalityService.warmShortReply(plannerResult.reply);
          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: replyText,
          });
          setMessages((prev) => [...prev, assistantMessage]);
          setLastResponse(replyText);
          await ContextEngine.rememberAssistantResponse(replyText);
          await TTSService.speak(replyText);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Planner failed');
        } finally {
          setState('idle');
        }
        return;
      }

      if (intent && intent.intent !== 'unknown' && isActionIntent(intent.intent)) {
        setState('thinking');
        try {
          const result = await ActionService.executeFromIntent(intent.intent, intent.query);
          setLastActionResult(result);

          const baseReplyText =
            result.status === 'success'
              ? result.message
              : `I couldn't complete that action. ${result.error || result.message}`;
          const replyText = PersonalityService.warmShortReply(baseReplyText);

          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: replyText,
          });
          setMessages((prev) => [...prev, assistantMessage]);
          if (result.status === 'success') setLastResponse(replyText);
          await ContextEngine.rememberAssistantResponse(replyText);
          await TTSService.speak(replyText);
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Action failed');
        } finally {
          setState('idle');
        }
        return;
      }

      // ── Branch 2: AI answer ──────────────────────────────────────────────
      if (!AIService.isInitialized()) {
        console.log('[AI] not initialized — AI service unavailable (check EXPO_PUBLIC_OPENROUTER_API_KEY)');
        setError('AI service is not available. Please check your configuration.');
        setState('idle');
        return;
      }

      setState('thinking');
      try {
        const contextualPrompt = await ContextEngine.buildPromptContext(input);
        const result: AIGenerationResult = await AIService.generate(contextualPrompt);

        const assistantMessage = await ConversationRepository.addMessage({
          conversationId: currentConversation?.id || '',
          role: 'assistant',
          content: result.text,
        });
        setMessages((prev) => [...prev, assistantMessage]);
        setLastResponse(result.text);
        await ContextEngine.rememberAssistantResponse(result.text);

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
