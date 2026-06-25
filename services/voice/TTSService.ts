import { Platform } from 'react-native';
import * as Speech from 'expo-speech';
import { TTSState, TTSServiceConfig, TTSOptions, DEFAULT_TTS_CONFIG } from './types';

class TTSServiceImpl {
  private config: TTSServiceConfig = DEFAULT_TTS_CONFIG;
  private currentState: TTSState = 'idle';
  private stateListeners: Set<(state: TTSState) => void> = new Set();
  private currentText: string = '';
  private isAvailable: boolean = true;

  configure(config: Partial<TTSServiceConfig>): void {
    this.config = { ...this.config, ...config };
  }

  subscribeToState(callback: (state: TTSState) => void): () => void {
    this.stateListeners.add(callback);
    return () => {
      this.stateListeners.delete(callback);
    };
  }

  private setState(state: TTSState): void {
    this.currentState = state;
    this.stateListeners.forEach(cb => {
      try {
        cb(state);
      } catch (e) {
        console.error('TTS state listener error:', e);
      }
    });
  }

  getState(): TTSState {
    return this.currentState;
  }

  async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!text || text.trim().length === 0) {
      return;
    }

    this.currentText = text;

    if (this.currentState === 'speaking') {
      await this.stop();
    }

    this.setState('speaking');
    options?.onStart?.();

    try {
      await Speech.speak(text, {
        language: options?.voice ? undefined : this.config.language,
        rate: options?.rate ?? this.config.rate ?? 1.0,
        pitch: options?.pitch ?? this.config.pitch ?? 1.0,
        voice: options?.voice ?? this.config.voice,
        onStart: () => {
          this.setState('speaking');
        },
        onDone: () => {
          this.setState('idle');
          options?.onDone?.();
        },
        onError: (error: any) => {
          this.setState('error');
          options?.onError?.(String(error));
        },
      });
    } catch (error) {
      this.setState('error');
      options?.onError?.(error instanceof Error ? error.message : 'Unknown TTS error');
    }
  }

  async stop(): Promise<void> {
    try {
      await Speech.stop();
      this.setState('idle');
      this.currentText = '';
    } catch (error) {
      // Silent fail on stop
    }
  }

  async pause(): Promise<void> {
    if (Platform.OS !== 'web') {
      await Speech.pause();
      this.setState('paused');
    }
  }

  async resume(): Promise<void> {
    if (Platform.OS !== 'web') {
      await Speech.resume();
      this.setState('speaking');
    }
  }

  async speakWithInterrupt(text: string, options?: TTSOptions): Promise<void> {
    try {
      await Speech.stop();
    } catch {
      // Ignore stop errors
    }

    await this.speak(text, options);
  }

  isSpeaking(): boolean {
    return this.currentState === 'speaking';
  }

  getCurrentText(): string {
    return this.currentText;
  }

  checkAvailability(): boolean {
    if (Platform.OS === 'web') {
      return typeof Speech !== 'undefined';
    }
    return this.isAvailable;
  }

  async getAvailableVoices(): Promise<Speech.Voice[]> {
    try {
      return await Speech.getAvailableVoicesAsync();
    } catch (error) {
      return [];
    }
  }
}

export const TTSService = new TTSServiceImpl();
