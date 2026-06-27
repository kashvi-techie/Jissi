import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { SpeechService } from '@/services/speech/SpeechService';
import { SpeechState } from '@/services/speech/types';
import { detectIntent, IntentResult } from '@/engine/intentEngine';

/**
 * Public shape returned by {@link useSpeechRecognition}.
 */
export interface UseSpeechRecognitionResult {
  /** Current speech-recognition state machine value. */
  state: SpeechState;
  /** Final, committed transcript (accumulates across utterances). */
  transcript: string;
  /** In-progress (not yet final) transcript shown live while speaking. */
  interimTranscript: string;
  /** Intent detected from the latest final transcript. */
  intentResult: IntentResult | null;
  /** Human-readable error, or null. */
  error: string | null;
  /** Whether speech recognition is available on this platform/runtime. */
  isSupported: boolean;
  /** Whether the microphone is actively listening. */
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearTranscript: () => void;
  requestMicrophonePermission: () => Promise<boolean>;
  hasMicrophonePermission: boolean;
}

/**
 * Speech-to-text hook.
 *
 * Owns the microphone lifecycle and exposes the live transcript plus the intent
 * detected from it. All platform differences (native `expo-speech-recognition`
 * vs the browser Web Speech API) are encapsulated inside {@link SpeechService},
 * so this hook stays platform-agnostic.
 *
 * State is intentionally local to the consuming screen — there is no shared
 * mutable state here, which keeps the hook decoupled and easy to reason about.
 */
export function useSpeechRecognition(): UseSpeechRecognitionResult {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [isListening, setIsListening] = useState(false);

  // Guards the one-time SpeechService initialization (survives React re-renders
  // and StrictMode double-invocation without re-initializing).
  const isInitializedRef = useRef(false);

  const isSupported = SpeechService.isSupported();

  /**
   * Requests microphone permission for the current platform.
   * - Web: uses `getUserMedia` (triggers the browser prompt).
   * - Native: uses `expo-av`'s permission API, with a settings deep-link fallback.
   */
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          setHasMicrophonePermission(true);
          return true;
        }
      } catch {
        setError('Microphone permission denied. Please allow microphone access in your browser settings.');
        return false;
      }
      return true;
    }

    try {
      const { status } = await Audio.requestPermissionsAsync();
      if (status === 'granted') {
        setHasMicrophonePermission(true);
        return true;
      }

      setError('Microphone permission is required for voice recognition.');
      Alert.alert(
        'Microphone Permission Required',
        'JISSI needs microphone access to recognize your voice commands.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    } catch {
      setError('Failed to request microphone permission.');
      return false;
    }
  }, []);

  /**
   * Registers SpeechService callbacks exactly once. Each callback maps a
   * low-level speech event onto this hook's React state.
   */
  const initializeSpeech = useCallback(async () => {
    if (isInitializedRef.current) return;

    await SpeechService.initialize({
      onSpeechStart: () => {
        console.log('[FLOWDBG 1] SpeechService: recognition started');
        setState('listening');
        setIsListening(true);
        setError(null);
      },
      onSpeechEnd: () => {
        setState('idle');
        setIsListening(false);
      },
      onSpeechResults: (results: string[]) => {
        const finalChunk = results[0] || '';
        console.log('[FLOWDBG 2] transcript chunk:', JSON.stringify(finalChunk));
        console.log(`[REQDBG] transcript received (final chunk) ts=${Date.now()} chunkLen=${finalChunk.length}`);
        // Accumulate the final transcript and recompute the intent from the
        // full text. Functional update keeps this correct across re-renders.
        setTranscript((prev) => {
          const updated = prev ? `${prev} ${finalChunk}` : finalChunk;
          const intent = detectIntent(updated);
          console.log('[FLOWDBG 3] intent detected:', intent.intent, 'query=', intent.query);
          setIntentResult(intent);
          return updated;
        });
        setInterimTranscript('');
      },
      onSpeechPartialResults: (partials: string[]) => {
        setInterimTranscript(partials[0] || '');
      },
      onSpeechError: (message: string) => {
        if (message.includes('no-speech') || message.includes('No speech')) {
          setError('No speech detected. Please try again.');
        } else if (message.includes('not-allowed') || message.includes('permission')) {
          setError('Microphone permission denied.');
        } else {
          setError(`Speech recognition error: ${message}`);
        }
        setState('error');
        setIsListening(false);
      },
    });

    isInitializedRef.current = true;
  }, []);

  // Initialize on mount; tear down on unmount.
  useEffect(() => {
    initializeSpeech();
    return () => {
      SpeechService.destroy();
      isInitializedRef.current = false;
    };
  }, [initializeSpeech]);

  // Reflect the platform's current permission status on mount.
  useEffect(() => {
    const checkInitialPermission = async () => {
      if (Platform.OS === 'web') {
        setHasMicrophonePermission(true);
        return;
      }
      try {
        const { status } = await Audio.getPermissionsAsync();
        setHasMicrophonePermission(status === 'granted');
      } catch {
        setHasMicrophonePermission(false);
      }
    };
    checkInitialPermission();
  }, []);

  const startListening = useCallback(async () => {
    if (!isSupported) {
      setError('Speech recognition is not supported on this device.');
      setState('error');
      return;
    }

    const granted = await requestMicrophonePermission();
    if (!granted) return;

    try {
      setError(null);
      setInterimTranscript('');
      await SpeechService.startListening('en-US');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition.');
      setState('error');
    }
  }, [isSupported, requestMicrophonePermission]);

  const stopListening = useCallback(async () => {
    try {
      await SpeechService.stopListening();
      setState('idle');
      setInterimTranscript('');
      setIsListening(false);
    } catch {
      // Stopping should never throw fatally; ignore.
    }
  }, []);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setIntentResult(null);
    setError(null);
    setState('idle');
  }, []);

  return {
    state,
    transcript,
    interimTranscript,
    intentResult,
    error,
    isSupported,
    isListening,
    startListening,
    stopListening,
    clearTranscript,
    requestMicrophonePermission,
    hasMicrophonePermission,
  };
}
