import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { SpeechService } from '@/services/speech/SpeechService';
import { VoiceDiagnostics } from '@/services/voice';
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
  const mountedRef = useRef(true);
  const startRequestRef = useRef(0);

  const isSupported = SpeechService.isSupported();

  /**
   * Requests microphone permission for the current platform.
   * - Web: uses `getUserMedia` (triggers the browser prompt).
   * - Native: uses `expo-av`'s permission API, with a settings deep-link fallback.
   */
  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    console.log('[STEP 4] permission check');
    console.log('[STT][hook:permission] request start platform=', Platform.OS);
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach((track) => track.stop());
          if (mountedRef.current) setHasMicrophonePermission(true);
          VoiceDiagnostics.update({ permissionState: 'granted' });
          console.log('[STT][hook:permission] web granted');
          return true;
        }
      } catch (error) {
        console.log('[STT][hook:permission] web denied=', error instanceof Error ? error.message : String(error));
        if (mountedRef.current) setError('Microphone permission denied. Please allow microphone access in your browser settings.');
        VoiceDiagnostics.update({ permissionState: 'denied', lastError: 'Microphone permission denied. Please allow microphone access in your browser settings.' });
        return false;
      }
      return true;
    }

    try {
      const { status, canAskAgain } = await Audio.requestPermissionsAsync();
      console.log('[STT][hook:permission] expo-av status=', status, 'canAskAgain=', canAskAgain);
      if (status === 'granted') {
        if (mountedRef.current) setHasMicrophonePermission(true);
        VoiceDiagnostics.update({ permissionState: 'granted' });
        return true;
      }

      if (!mountedRef.current) return false;
      setHasMicrophonePermission(false);
      VoiceDiagnostics.update({ permissionState: canAskAgain ? 'denied' : 'blocked' });
      setError(canAskAgain ? 'Microphone permission is required for voice recognition.' : 'Microphone permission is blocked. Please enable it in Settings.');
      Alert.alert(
        'Microphone Permission Required',
        canAskAgain
          ? 'JISSI needs microphone access to recognize your voice commands.'
          : 'Microphone access is blocked for this app. Please enable it in Android Settings.',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
      return false;
    } catch (error) {
      console.log('[STT][hook:permission] expo-av failed=', error instanceof Error ? error.message : String(error));
      if (mountedRef.current) setError('Failed to request microphone permission.');
      VoiceDiagnostics.update({ permissionState: 'unknown', lastError: 'Failed to request microphone permission.' });
      return false;
    }
  }, []);

  /**
   * Registers SpeechService callbacks exactly once. Each callback maps a
   * low-level speech event onto this hook's React state.
   */
  const initializeSpeech = useCallback(async () => {
    if (isInitializedRef.current) return;
    console.log('[STT][hook:init] initializeSpeech start isSupported=', isSupported);

    await SpeechService.initialize({
      onSpeechStart: () => {
        console.log('[STT][hook:event] onSpeechStart');
        if (!mountedRef.current) return;
        setState('listening');
        setIsListening(true);
        setError(null);
        VoiceDiagnostics.update({ microphoneState: 'listening', speechRecognizerState: 'listening', lastError: null });
      },
      onSpeechEnd: () => {
        console.log('[STT][hook:event] onSpeechEnd');
        if (!mountedRef.current) return;
        setState('idle');
        setIsListening(false);
        VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle' });
      },
      onSpeechResults: (results: string[]) => {
        console.log('[STT][hook:event] onSpeechResults=', results);
        if (!mountedRef.current) return;
        const finalChunk = results[0] || '';
        // Accumulate the final transcript and recompute the intent from the
        // full text. Functional update keeps this correct across re-renders.
        setTranscript((prev) => {
          const updated = prev ? `${prev} ${finalChunk}` : finalChunk;
          const intent = detectIntent(updated);
          setIntentResult(intent);
          return updated;
        });
        setInterimTranscript('');
      },
      onSpeechPartialResults: (partials: string[]) => {
        console.log('[STT][hook:event] onSpeechPartialResults=', partials);
        if (!mountedRef.current) return;
        setInterimTranscript(partials[0] || '');
      },
      onSpeechError: (message: string) => {
        console.log('[STT][hook:event] onSpeechError=', message);
        if (!mountedRef.current) return;
        setInterimTranscript('');
        if (message.includes('no-speech') || message.includes('No speech')) {
          setError('No speech detected. Please try again.');
        } else if (message.includes('not-allowed') || message.includes('permission')) {
          setError('Microphone permission denied.');
        } else if (message.includes('app-in-background')) {
          setError('Voice paused because the app is not active.');
        } else {
          setError(`Speech recognition error: ${message}`);
        }
        setState('error');
        setIsListening(false);
        VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'error', lastError: message });
      },
    });

    isInitializedRef.current = true;
    console.log('[STT][hook:init] initializeSpeech complete');
  }, []);

  // Initialize on mount; tear down on unmount.
  useEffect(() => {
    mountedRef.current = true;
    initializeSpeech();
    return () => {
      mountedRef.current = false;
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
        if (mountedRef.current) setHasMicrophonePermission(status === 'granted');
        VoiceDiagnostics.update({ permissionState: status === 'granted' ? 'granted' : 'unknown' });
      } catch {
        if (mountedRef.current) setHasMicrophonePermission(false);
      }
    };
    checkInitialPermission();
  }, []);

  const startListening = useCallback(async () => {
    const requestId = ++startRequestRef.current;
    console.log('[STEP 3] startListening called');
    console.log('[STEP 5] isSupported', isSupported);
    console.log('[STT][hook:start] requestId=', requestId, 'isSupported=', isSupported);
    if (!isSupported) {
        setError('Speech recognition is not supported on this device.');
        setState('error');
        VoiceDiagnostics.update({ runtimeState: 'offline', speechRecognizerState: 'unsupported', lastError: 'Speech recognition is not supported on this device.' });
        return;
    }

    const granted = await requestMicrophonePermission();
    console.log('[STT][hook:start] permission result=', granted, 'mounted=', mountedRef.current, 'currentRequest=', startRequestRef.current);
    if (!mountedRef.current || requestId !== startRequestRef.current) return;
    if (!granted) return;

    try {
      setError(null);
      setInterimTranscript('');
      console.log('[STT][hook:start] calling SpeechService.startListening');
      await SpeechService.startListening('en-US');
      console.log('[STT][hook:start] SpeechService.startListening returned');
    } catch (err) {
      console.log('[STT][hook:start] SpeechService.startListening threw=', err instanceof Error ? err.message : String(err));
      if (!mountedRef.current || requestId !== startRequestRef.current) return;
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition.');
      setState('error');
    }
  }, [isSupported, requestMicrophonePermission]);

  const stopListening = useCallback(async () => {
    startRequestRef.current += 1;
    try {
      await SpeechService.stopListening();
      if (!mountedRef.current) return;
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
