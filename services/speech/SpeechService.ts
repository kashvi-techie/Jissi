import { Platform } from 'react-native';
import Voice, {
  SpeechResultsEvent,
  SpeechErrorEvent,
} from '@react-native-voice/voice';

export type SpeechState = 'idle' | 'listening' | 'processing' | 'error';

export interface SpeechRecognitionCallbacks {
  onSpeechStart?: () => void;
  onSpeechEnd?: () => void;
  onSpeechResults?: (results: string[]) => void;
  onSpeechPartialResults?: (partials: string[]) => void;
  onSpeechError?: (error: string) => void;
  onVolumeChanged?: (volume: number) => void;
}

interface WebSpeechRecognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}

declare global {
  interface Window {
    SpeechRecognition: new () => WebSpeechRecognition;
    webkitSpeechRecognition: new () => WebSpeechRecognition;
  }
}

let voiceAvailable = false;

try {
  if (Platform.OS !== 'web' && Voice) {
    voiceAvailable = true;
  }
} catch {
  voiceAvailable = false;
}

class SpeechServiceImpl {
  private isInitialized = false;
  private isListening = false;
  private callbacks: SpeechRecognitionCallbacks = {};
  private webRecognition: WebSpeechRecognition | null = null;
  private nativeAvailable = voiceAvailable;

  async initialize(callbacks: SpeechRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;

    if (Platform.OS === 'web') {
      await this.initializeWeb();
    } else if (this.nativeAvailable && Voice) {
      await this.initializeNative();
    } else {
      console.warn('Native speech recognition not available - running in compatibility mode');
    }

    this.isInitialized = true;
  }

  private async initializeWeb(): Promise<void> {
    if (typeof window === 'undefined') return;

    const SpeechRecognitionClass = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognitionClass) {
      console.warn('Web Speech API not available');
      return;
    }

    this.webRecognition = new SpeechRecognitionClass();
    this.webRecognition.continuous = true;
    this.webRecognition.interimResults = true;
    this.webRecognition.lang = 'en-US';
    this.webRecognition.maxAlternatives = 1;

    this.webRecognition.onstart = () => {
      this.isListening = true;
      this.callbacks.onSpeechStart?.();
    };

    this.webRecognition.onend = () => {
      this.isListening = false;
      this.callbacks.onSpeechEnd?.();
    };

    this.webRecognition.onresult = (event: any) => {
      const results = event.results;
      const finalResults: string[] = [];
      const partialResults: string[] = [];

      for (let i = event.resultIndex; i < results.length; i++) {
        const result = results[i];
        if (result.isFinal) {
          finalResults.push(result[0].transcript);
        } else {
          partialResults.push(result[0].transcript);
        }
      }

      if (finalResults.length > 0) {
        this.callbacks.onSpeechResults?.(finalResults);
      }
      if (partialResults.length > 0) {
        this.callbacks.onSpeechPartialResults?.(partialResults);
      }
    };

    this.webRecognition.onerror = (event: any) => {
      this.callbacks.onSpeechError?.(event.error);
    };
  }

  private async initializeNative(): Promise<void> {
    if (!Voice) {
      console.warn('Voice module not available');
      return;
    }

    Voice.onSpeechStart = () => {
      this.isListening = true;
      this.callbacks.onSpeechStart?.();
    };

    Voice.onSpeechEnd = () => {
      this.isListening = false;
      this.callbacks.onSpeechEnd?.();
    };

    Voice.onSpeechResults = (event: SpeechResultsEvent) => {
      if (event.value && event.value.length > 0) {
        this.callbacks.onSpeechResults?.(event.value);
      }
    };

    Voice.onSpeechPartialResults = (event: SpeechResultsEvent) => {
      if (event.value && event.value.length > 0) {
        this.callbacks.onSpeechPartialResults?.(event.value);
      }
    };

    Voice.onSpeechError = (event: SpeechErrorEvent) => {
      const errorMessage = event.error?.message || event.error?.code || 'Unknown speech error';
      this.callbacks.onSpeechError?.(errorMessage);
    };

    Voice.onSpeechVolumeChanged = (event: any) => {
      if (event.value !== undefined) {
        this.callbacks.onVolumeChanged?.(event.value);
      }
    };
  }

  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition);
    }
    return this.nativeAvailable;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async startListening(locale: string = 'en-US'): Promise<void> {
    console.log('[MICDBG] SpeechService.startListening. platform =', Platform.OS, 'isInitialized =', this.isInitialized, 'nativeAvailable =', this.nativeAvailable);
    if (!this.isInitialized) {
      throw new Error('SpeechService not initialized. Call initialize() first.');
    }

    if (this.isListening) {
      return;
    }

    try {
      if (Platform.OS === 'web') {
        this.webRecognition?.start();
      } else if (this.nativeAvailable && Voice) {
        await Voice.start(locale);
      } else {
        throw new Error('Speech recognition not available on this device');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start listening';
      this.callbacks.onSpeechError?.(message);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if (!this.isListening) return;

    try {
      if (Platform.OS === 'web') {
        this.webRecognition?.stop();
      } else if (this.nativeAvailable && Voice) {
        await Voice.stop();
      }
      this.isListening = false;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to stop listening';
      this.callbacks.onSpeechError?.(message);
    }
  }

  async cancelListening(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        this.webRecognition?.abort();
      } else if (this.nativeAvailable && Voice) {
        await Voice.cancel();
      }
      this.isListening = false;
    } catch (error) {
      // Silent fail on cancel
    }
  }

  async destroy(): Promise<void> {
    try {
      if (Platform.OS !== 'web' && this.nativeAvailable && Voice) {
        await Voice.destroy();
      } else {
        this.webRecognition?.abort();
        this.webRecognition = null;
      }
    } catch (error) {
      // Silent fail on destroy
    }
    this.isInitialized = false;
    this.isListening = false;
  }

  async getAllLocales(): Promise<string[]> {
    return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'zh-CN', 'ja-JP', 'ko-KR'];
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return this.isSupported();
    }
    if (!this.nativeAvailable || !Voice) {
      return false;
    }
    try {
      const available = await Voice.isAvailable();
      return available === 1;
    } catch {
      return false;
    }
  }
}

export const SpeechService = new SpeechServiceImpl();
