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
    console.log('[FLOWDBG 10] TTSService.speak. textLen=', text ? text.length : 0);
    if (!text || text.trim().length === 0) {
      return;
    }

    this.currentText = text;

    if (this.currentState === 'speaking') {
      await this.stop();
    }

    // Web: expo-speech's web output is unreliable — utterances get silently
    // dropped (text replies show but no audio). Talk to the browser's
    // SpeechSynthesis directly (proven to produce audio) and pick a female
    // voice to match JISSI.
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      'speechSynthesis' in window
    ) {
      return this.speakWeb(text, options);
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

  /** Cached browser voice (female, English) so we don't re-scan every utterance. */
  private webVoice: SpeechSynthesisVoice | null = null;

  /** Best-effort pick of a female English voice from the browser's voice list. */
  private pickWebVoice(): SpeechSynthesisVoice | null {
    if (this.webVoice) return this.webVoice;
    const all = window.speechSynthesis.getVoices();
    if (!all || all.length === 0) return null; // voices not loaded yet
    const en = all.filter((v) => /^en/i.test(v.lang));
    const pool = en.length ? en : all;
    const female =
      /(female|zira|samantha|victoria|susan|karen|moira|tessa|fiona|serena|allison|ava|joanna|salli|kimberly|amy|emma|jenny|aria|libby|sonia|google us english|google uk english female)/i;
    this.webVoice =
      pool.find((v) => female.test(v.name)) ||
      pool.find((v) => /google us english/i.test(v.name)) ||
      pool[0] ||
      null;
    return this.webVoice;
  }

  /** Speak via the browser's native SpeechSynthesis (web only). Resolves when the
   *  utterance ends, errors, or a length-scaled safety timeout fires — so the
   *  caller's `await` never hangs even if the browser drops the end event. */
  private speakWeb(text: string, options?: TTSOptions): Promise<void> {
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;

      // Voices load asynchronously; if they aren't ready, wait once then retry.
      if (!this.webVoice && synth.getVoices().length === 0) {
        const retry = () => {
          synth.onvoiceschanged = null;
          this.speakWeb(text, options).then(resolve);
        };
        synth.onvoiceschanged = retry;
        setTimeout(() => {
          if (synth.onvoiceschanged) retry(); // some browsers never fire the event
        }, 500);
        return;
      }

      try {
        synth.cancel(); // clear any stuck/queued utterance
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.config.language || 'en-US';
        u.rate = options?.rate ?? this.config.rate ?? 1.0;
        u.pitch = options?.pitch ?? this.config.pitch ?? 1.0;
        const voice = this.pickWebVoice();
        if (voice) u.voice = voice;

        let settled = false;
        const finish = (errored: boolean) => {
          if (settled) return;
          settled = true;
          this.setState(errored ? 'error' : 'idle');
          if (errored) options?.onError?.('TTS error');
          else options?.onDone?.();
          resolve();
        };

        u.onstart = () => this.setState('speaking');
        u.onend = () => finish(false);
        u.onerror = () => finish(true);

        this.setState('speaking');
        options?.onStart?.();
        synth.speak(u);

        // Safety net for the known Chrome quirk where end/error never fire.
        const ms = Math.min(30000, 1500 + text.length * 90);
        setTimeout(() => finish(false), ms);
      } catch {
        this.setState('error');
        resolve();
      }
    });
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
