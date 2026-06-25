import { useState, useEffect, useRef, useCallback } from 'react';
import { Platform, Alert, Linking } from 'react-native';
import { Audio } from 'expo-av';
import { SpeechService } from '@/services/speech/SpeechService';
import { SpeechState } from '@/services/speech/types';
import { detectIntent, IntentResult } from '@/engine/intentEngine';

interface SpeechRecognitionResult {
  state: SpeechState;
  transcript: string;
  interimTranscript: string;
  intentResult: IntentResult | null;
  error: string | null;
  isSupported: boolean;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearTranscript: () => void;
  requestMicrophonePermission: () => Promise<boolean>;
  hasMicrophonePermission: boolean;
}

export function useSpeechRecognition(): SpeechRecognitionResult {
  const [state, setState] = useState<SpeechState>('idle');
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [intentResult, setIntentResult] = useState<IntentResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hasMicrophonePermission, setHasMicrophonePermission] = useState(false);
  const [isListeningInternal, setIsListeningInternal] = useState(false);
  const isInitializedRef = useRef(false);

  const isSupported = SpeechService.isSupported();

  const requestMicrophonePermission = useCallback(async (): Promise<boolean> => {
    console.log('[MICDBG] requestMicrophonePermission. Platform =', Platform.OS);
    if (Platform.OS === 'web') {
      try {
        if (typeof navigator !== 'undefined' && navigator.mediaDevices?.getUserMedia) {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(track => track.stop());
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
      } else {
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
      }
    } catch {
      setError('Failed to request microphone permission.');
      return false;
    }
  }, []);

  const initializeSpeech = useCallback(async () => {
    if (isInitializedRef.current) return;
    console.log('[MICDBG] initializeSpeech -> SpeechService.initialize()');

    await SpeechService.initialize({
      onSpeechStart: () => {
        setState('listening');
        setIsListeningInternal(true);
        setError(null);
      },
      onSpeechEnd: () => {
        setState('idle');
        setIsListeningInternal(false);
      },
      onSpeechResults: (results: string[]) => {
        const finalTranscript = results[0] || '';
        setTranscript(prev => {
          const updated = prev ? prev + ' ' + finalTranscript : finalTranscript;
          setIntentResult(detectIntent(updated));
          return updated;
        });
        setInterimTranscript('');
      },
      onSpeechPartialResults: (partials: string[]) => {
        setInterimTranscript(partials[0] || '');
      },
      onSpeechError: (errorMsg: string) => {
        if (errorMsg.includes('no-speech') || errorMsg.includes('No speech')) {
          setError('No speech detected. Please try again.');
        } else if (errorMsg.includes('not-allowed') || errorMsg.includes('permission')) {
          setError('Microphone permission denied.');
        } else {
          setError(`Speech recognition error: ${errorMsg}`);
        }
        setState('error');
        setIsListeningInternal(false);
      },
    });

    isInitializedRef.current = true;
  }, []);

  useEffect(() => {
    initializeSpeech();

    return () => {
      SpeechService.destroy();
      isInitializedRef.current = false;
    };
  }, [initializeSpeech]);

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
    console.log('[MICDBG] hook.startListening entry. isSupported =', isSupported);
    if (!isSupported) {
      console.log('[MICDBG] STOP: isSupported is false');
      setError('Speech recognition is not supported on this device.');
      setState('error');
      return;
    }

    const hasPermission = await requestMicrophonePermission();
    console.log('[MICDBG] permission result =', hasPermission);
    if (!hasPermission) return;

    try {
      setError(null);
      setInterimTranscript('');
      console.log('[MICDBG] calling SpeechService.startListening');
      await SpeechService.startListening('en-US');
      console.log('[MICDBG] SpeechService.startListening returned OK');
    } catch (err) {
      console.log('[MICDBG] SpeechService.startListening threw:', err);
      setError(err instanceof Error ? err.message : 'Failed to start speech recognition.');
      setState('error');
    }
  }, [isSupported, requestMicrophonePermission]);

  const stopListening = useCallback(async () => {
    try {
      await SpeechService.stopListening();
      setState('idle');
      setInterimTranscript('');
      setIsListeningInternal(false);
    } catch {
      // Silent fail on stop
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
    isListening: isListeningInternal,
    startListening,
    stopListening,
    clearTranscript,
    requestMicrophonePermission,
    hasMicrophonePermission,
  };
}
