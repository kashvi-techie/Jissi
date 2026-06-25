export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export interface SpeechRecognitionResult {
  state: SpeechState;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  isSupported: boolean;
  isListening: boolean;
  startListening: () => Promise<void>;
  stopListening: () => Promise<void>;
  clearTranscript: () => void;
  initialize: () => Promise<void>;
  destroy: () => Promise<void>;
}

export interface SpeechConfig {
  locale: string;
  continuous: boolean;
  partialResults: boolean;
  silenceTimeoutMs: number;
}

export const DefaultSpeechConfig: SpeechConfig = {
  locale: 'en-US',
  continuous: true,
  partialResults: true,
  silenceTimeoutMs: 1500,
};
