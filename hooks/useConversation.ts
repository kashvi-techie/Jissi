import { useState, useEffect, useCallback, useRef } from 'react';
import { Platform } from 'react-native';
import { AIService, AIMessage, AIGenerationResult } from '@/services/ai';
import { ConversationRepository, Conversation } from '@/services/conversation';
import { TTSService, TTSState } from '@/services/voice';
import { ActionService, ActionResult } from '@/services/actions';
import { IntentResult, IntentType } from '@/engine/intentEngine';

export type AssistantState = 'idle' | 'listening' | 'thinking' | 'speaking';

interface UseConversationResult {
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

const ACTION_INTENTS: IntentType[] = [
  'open_youtube',
  'open_chrome',
  'open_whatsapp',
  'search_google',
];

function isActionIntent(intent: IntentType): boolean {
  return ACTION_INTENTS.includes(intent);
}

export function useConversation(): UseConversationResult {
  const [state, setState] = useState<AssistantState>('idle');
  const [currentConversation, setCurrentConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<AIMessage[]>([]);
  const [lastResponse, setLastResponse] = useState<string | null>(null);
  const [lastActionResult, setLastActionResult] = useState<ActionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ttsState, setTTSState] = useState<TTSState>('idle');

  const isInitializedRef = useRef(false);

  useEffect(() => {
    const unsubscribe = TTSService.subscribeToState(setTTSState);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (ttsState === 'speaking') {
      setState('speaking');
    } else if (state === 'speaking' && ttsState === 'idle') {
      setState('idle');
    }
  }, [ttsState, state]);

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
      // Copy the array — ConversationRepository mutates conversation.messages in
      // place (push), and sharing that reference with React state caused messages
      // to be appended twice (duplicate React keys).
      setMessages([...conversation.messages]);

      const apiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY;
      console.log('[AIDBG] useConversation init. GEMINI key present =', !!apiKey, 'len =', apiKey ? apiKey.length : 0);
      if (apiKey) {
        console.log('[AIDBG] AIService.initialize() called');
        AIService.initialize({ apiKey });
      } else {
        console.warn('[AIDBG] Gemini API key NOT found. AI disabled.');
      }
    };

    init();
  }, []);

  const processInput = useCallback(async (input: string, intent?: IntentResult | null): Promise<void> => {
    console.log('[AIDBG] processInput called. input =', JSON.stringify(input), 'intent =', intent?.intent);
    if (!input || input.trim().length === 0) return;

    setError(null);
    setLastResponse(null);
    setLastActionResult(null);

    const userMessage = await ConversationRepository.addMessage({
      conversationId: currentConversation?.id || '',
      role: 'user',
      content: input,
    });
    setMessages(prev => [...prev, userMessage]);

    if (intent && intent.intent !== 'unknown' && isActionIntent(intent.intent)) {
      setState('thinking');
      try {
        const result = await ActionService.executeFromIntent(intent.intent, intent.query);
        setLastActionResult(result);

        if (result.status === 'success') {
          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: result.message,
          });
          setMessages(prev => [...prev, assistantMessage]);
          setLastResponse(result.message);
          await TTSService.speak(result.message);
        } else {
          const assistantMessage = await ConversationRepository.addMessage({
            conversationId: currentConversation?.id || '',
            role: 'assistant',
            content: `I couldn't complete that action. ${result.error || result.message}`,
          });
          setMessages(prev => [...prev, assistantMessage]);
          await TTSService.speak(`I couldn't complete that action. ${result.error || result.message}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Action failed');
      } finally {
        setState('idle');
      }
      return;
    }

    console.log('[AIDBG] AI branch reached. AIService.isInitialized =', AIService.isInitialized());
    if (!AIService.isInitialized()) {
      console.log('[AIDBG] STOP: AIService not initialized (missing GEMINI key?)');
      setError('AI service is not available. Please check your configuration.');
      setState('idle');
      return;
    }

    setState('thinking');

    try {
      console.log('[AIDBG] calling AIService.generate()');
      const result: AIGenerationResult = await AIService.generate(input);
      console.log('[AIDBG] AIService.generate() returned. text len =', result.text ? result.text.length : 0);

      const assistantMessage = await ConversationRepository.addMessage({
        conversationId: currentConversation?.id || '',
        role: 'assistant',
        content: result.text,
      });
      setMessages(prev => [...prev, assistantMessage]);
      setLastResponse(result.text);

      await TTSService.speak(result.text);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to process your request';
      setError(errorMessage);

      const assistantMessage = await ConversationRepository.addMessage({
        conversationId: currentConversation?.id || '',
        role: 'assistant',
        content: `I apologize, but I encountered an error. ${errorMessage}`,
      });
      setMessages(prev => [...prev, assistantMessage]);
    } finally {
      setState('idle');
    }
  }, [currentConversation]);

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
