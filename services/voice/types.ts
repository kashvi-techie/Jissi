export type TTSState = 'idle' | 'speaking' | 'paused' | 'error';

export interface TTSServiceConfig {
  language?: string;
  rate?: number;
  pitch?: number;
  voice?: string;
}

export interface TTSOptions {
  rate?: number;
  pitch?: number;
  voice?: string;
  onStart?: () => void;
  onDone?: () => void;
  onError?: (error: string) => void;
}

export const DEFAULT_TTS_CONFIG: TTSServiceConfig = {
  language: 'en-US',
  rate: 1.0,
  pitch: 1.0,
};
