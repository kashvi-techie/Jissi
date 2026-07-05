import { useState, useEffect, useRef, useCallback } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useSpeechRecognition } from './useSpeechRecognition';
import { useConversation, AssistantState } from './useConversation';
import { SpeechState } from '@/services/speech/types';
import { AIMessage } from '@/services/ai';
import { HapticsService } from '@/services/haptics';

/**
 * Continuous Conversation Mode.
 *
 * Coordinates the two single-responsibility hooks (useSpeechRecognition +
 * useConversation) into a hands-free loop:
 *
 *   listen → end-of-speech → AI → TTS → (cooldown) → listen → …
 *
 * This hook owns ONLY the coordination state machine. STT and the
 * conversation/TTS pipeline stay fully encapsulated in their own hooks, so the
 * existing hooks/services separation is preserved — nothing below this layer
 * changed.
 */
export type ConversationMode = 'idle' | 'listening' | 'processing' | 'speaking' | 'waiting';

/** Cooldown after TTS before re-opening the mic. Lets the audio output settle so
 *  the tail of the spoken reply is never captured as user speech. */
const RESTART_DELAY_MS = 600;
/** Backoff before retrying after a recoverable STT failure. */
const RECOVERY_DELAY_MS = 800;
/** Give up the loop after this many consecutive non-silence failures. */
const MAX_CONSECUTIVE_ERRORS = 3;

function computeMode(
  active: boolean,
  speechState: SpeechState,
  assistantState: AssistantState,
  isListening: boolean
): ConversationMode {
  if (!active) return 'idle';
  if (assistantState === 'speaking') return 'speaking';
  if (assistantState === 'thinking' || speechState === 'processing') return 'processing';
  if (isListening || speechState === 'listening') return 'listening';
  return 'waiting';
}

export interface UseConversationModeResult {
  mode: ConversationMode;
  isActive: boolean;
  isListening: boolean;
  isSupported: boolean;
  speechState: SpeechState;
  assistantState: AssistantState;
  transcript: string;
  interimTranscript: string;
  messages: AIMessage[];
  error: string | null;
  toggle: () => void;
  start: () => void;
  stop: () => void;
  /** Seed the conversation with a text prompt (e.g. a suggestion card) and start
   *  a hands-free session around that topic. */
  sendPrompt: (text: string) => void;
}

export function useConversationMode(): UseConversationModeResult {
  const speech = useSpeechRecognition();
  const convo = useConversation();

  const {
    state: speechState,
    transcript,
    interimTranscript,
    intentResult,
    isListening,
    isSupported,
    startListening,
    stopListening,
    clearTranscript,
    error: speechError,
  } = speech;
  const {
    state: assistantState,
    messages,
    processInput,
    stopSpeaking,
    error: conversationError,
  } = convo;

  const error = speechError || conversationError;

  const [isActive, setIsActive] = useState(false);
  const isActiveRef = useRef(false);
  const prevTranscriptRef = useRef('');
  const prevAssistantRef = useRef<AssistantState>(assistantState);
  const restartTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const errorCountRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (restartTimerRef.current) {
      clearTimeout(restartTimerRef.current);
      restartTimerRef.current = null;
    }
  }, []);

  /** Open the mic for a fresh turn: reset the transcript + de-dupe guard so even
   *  a phrase repeated across turns is still processed. */
  const beginListening = useCallback(() => {
    prevTranscriptRef.current = '';
    clearTranscript();
    HapticsService.play('listen_start');
    startListening();
  }, [clearTranscript, startListening]);

  const stopConversation = useCallback(() => {
    isActiveRef.current = false;
    setIsActive(false);
    clearTimer();
    stopListening();
    stopSpeaking();
    HapticsService.play('listen_stop');
  }, [clearTimer, stopListening, stopSpeaking]);

  const startConversation = useCallback(() => {
    if (!isSupported || isActiveRef.current) return;
    isActiveRef.current = true;
    setIsActive(true);
    errorCountRef.current = 0;
    beginListening();
  }, [isSupported, beginListening]);

  const toggle = useCallback(() => {
    if (isActiveRef.current) stopConversation();
    else startConversation();
  }, [startConversation, stopConversation]);

  /** Start a session seeded with a text prompt (suggestion card). The continuous
   *  loop then auto-reopens the mic after the assistant replies, so the topic
   *  flows naturally into a hands-free conversation. */
  const sendPrompt = useCallback(
    (text: string) => {
      const t = text.trim();
      if (!t) return;
      isActiveRef.current = true;
      setIsActive(true);
      errorCountRef.current = 0;
      prevTranscriptRef.current = '';
      clearTimer();
      processInput(t);
    },
    [clearTimer, processInput]
  );

  const scheduleRestart = useCallback(
    (delay: number) => {
      clearTimer();
      restartTimerRef.current = setTimeout(() => {
        restartTimerRef.current = null;
        if (isActiveRef.current) beginListening();
      }, delay);
    },
    [clearTimer, beginListening]
  );

  // ── Hand-off: a final transcript with both machines idle → process exactly once.
  useEffect(() => {
    if (!isActiveRef.current) return;
    if (
      transcript &&
      transcript.trim().length > 0 &&
      speechState === 'idle' &&
      assistantState === 'idle' &&
      prevTranscriptRef.current !== transcript
    ) {
      prevTranscriptRef.current = transcript;
      errorCountRef.current = 0;
      // Close the mic during processing + TTS so the spoken reply can never be
      // captured as user speech.
      stopListening();
      processInput(transcript, intentResult);
    }
  }, [transcript, speechState, assistantState, intentResult, processInput, stopListening]);

  // ── Auto-restart after the assistant finishes a turn (speaking/thinking → idle).
  useEffect(() => {
    const prev = prevAssistantRef.current;
    prevAssistantRef.current = assistantState;
    if (!isActiveRef.current) return;
    if (prev !== 'idle' && assistantState === 'idle') {
      if (prev === 'speaking') HapticsService.play('reply');
      scheduleRestart(RESTART_DELAY_MS);
    }
  }, [assistantState, scheduleRestart]);

  // ── Recovery: recoverable STT error → retry; fatal → stop.
  useEffect(() => {
    if (!isActiveRef.current) return;
    if (speechState !== 'error' || !speechError) return;

    if (/permission|denied|not-allowed/i.test(speechError)) {
      HapticsService.play('error');
      stopConversation(); // fatal — needs user action, don't loop
      return;
    }
    // Benign silence ("No speech detected") keeps the loop going per spec
    // (continue until the user manually stops). Other failures count toward a cap.
    const benignSilence = /no speech|no match|timeout/i.test(speechError);
    if (!benignSilence) {
      errorCountRef.current += 1;
      if (errorCountRef.current > MAX_CONSECUTIVE_ERRORS) {
        HapticsService.play('error');
        stopConversation();
        return;
      }
    }
    scheduleRestart(RECOVERY_DELAY_MS);
  }, [speechState, speechError, scheduleRestart, stopConversation]);

  // ── AppState: leaving the foreground safely halts the loop.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next !== 'active' && isActiveRef.current) {
        stopConversation();
      }
    });
    return () => sub.remove();
  }, [stopConversation]);

  // Clear any pending restart on unmount.
  useEffect(() => () => clearTimer(), [clearTimer]);

  const mode = computeMode(isActive, speechState, assistantState, isListening);

  return {
    mode,
    isActive,
    isListening,
    isSupported,
    speechState,
    assistantState,
    transcript,
    interimTranscript,
    messages,
    error,
    toggle,
    start: startConversation,
    stop: stopConversation,
    sendPrompt,
  };
}
