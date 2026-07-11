import { AppState, Platform } from 'react-native';
import { Audio } from 'expo-av';
import * as Speech from 'expo-speech';
import { TTSState, TTSServiceConfig, TTSOptions, DEFAULT_TTS_CONFIG } from './types';
import { sanitizeForSpeech } from './sanitizeForSpeech';
import { PronunciationService } from '@/services/pronunciation';

class TTSServiceImpl {
  private config: TTSServiceConfig = DEFAULT_TTS_CONFIG;
  private currentState: TTSState = 'idle';
  private stateListeners: Set<(state: TTSState) => void> = new Set();
  private currentText: string = '';
  private isAvailable: boolean = true;
  private speakToken = 0;
  private appStateSub = AppState.addEventListener('change', (next) => {
    if (Platform.OS !== 'web' && next !== 'active' && this.currentState === 'speaking') {
      // Android can leave audio focus in a bad state if TTS continues while the
      // Activity is paused. Stop cleanly so STT can reacquire the mic on resume.
      void this.stop();
    }
  });

  /** Conversational voice defaults — a touch slower and slightly brighter reads
   *  warmer / less robotic than a flat 1.0 / 1.0. */
  private static readonly NATURAL_RATE = 0.98;
  private static readonly NATURAL_PITCH = 1.05;

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async prepareAudioForSpeech(): Promise<void> {
    if (Platform.OS === 'web') return;
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: false,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch {
      // Best-effort: TTS may still work even if audio mode cannot be changed.
    }
  }

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

  /** Prime the browser SpeechSynthesis from within a user gesture (web only).
   *  Browsers block speech until the page has a user activation; the mic tap's
   *  activation is consumed by mic-permission/recognition and has expired by the
   *  time the reply is spoken (seconds later, after the async AI call) — so it is
   *  silently dropped. Calling this ON the mic tap unlocks the engine for the
   *  session and warms up async voice-list loading. No-op on native. */
  unlockWeb(): void {
    if (Platform.OS !== 'web' || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }
    try {
      const synth = window.speechSynthesis;
      synth.getVoices(); // kick off async voice-list loading
      synth.resume();
      const u = new SpeechSynthesisUtterance(' ');
      u.volume = 0; // inaudible — we only need the gesture to unlock the engine
      synth.speak(u);
    } catch {
      // best-effort priming — ignore failures
    }
  }

  async speak(text: string, options?: TTSOptions): Promise<void> {
    if (!text || text.trim().length === 0) {
      return;
    }

    this.currentText = text;
    const token = ++this.speakToken;

    // Speak a cleaned copy (markdown/symbols/emoji removed) so they aren't read
    // aloud. The original text stays in currentText for the UI.
    const spoken = PronunciationService.toSpeechText(this.normalizeForSpeech(sanitizeForSpeech(text)));
    if (!spoken) return;

    if (this.currentState === 'speaking') {
      await this.stop();
    }
    if (Platform.OS !== 'web') {
      try {
        await Speech.stop();
      } catch {
        // Ignore stale native TTS cleanup failures.
      }
    }
    await this.prepareAudioForSpeech();
    if (Platform.OS === 'android') {
      await this.sleep(180);
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
      return this.speakWeb(spoken, options);
    }

    // expo-speech's Speech.speak() is fire-and-forget (returns void) — awaiting it
    // resolves IMMEDIATELY, not when speech ends. So we wrap it and resolve only on
    // the onDone/onError callback (with a safety timeout). This keeps speak() from
    // returning early, so the conversation loop won't re-open the mic mid-reply and
    // let Android's recognizer steal audio focus and cut off the TTS.
    return new Promise<void>((resolve) => {
      let settled = false;
      let safety: ReturnType<typeof setTimeout> | null = null;
      const finish = (errored: boolean, errMsg?: string) => {
        if (settled) return;
        if (token !== this.speakToken) {
          settled = true;
          if (safety) clearTimeout(safety);
          resolve();
          return;
        }
        settled = true;
        if (safety) clearTimeout(safety);
        this.setState(errored ? 'error' : 'idle');
        if (errored) options?.onError?.(errMsg ?? 'TTS error');
        else options?.onDone?.();
        resolve();
      };

      this.setState('speaking');
      options?.onStart?.();

      let attempt = 0;
      const speakNative = () => {
        attempt += 1;
        Speech.speak(spoken, {
          language: options?.voice ? undefined : this.config.language,
          rate: options?.rate ?? this.config.rate ?? TTSServiceImpl.NATURAL_RATE,
          pitch: options?.pitch ?? this.config.pitch ?? TTSServiceImpl.NATURAL_PITCH,
          voice: options?.voice ?? this.config.voice,
          onStart: () => this.setState('speaking'),
          onDone: () => finish(false),
          onError: (error: any) => {
            if (Platform.OS === 'android' && attempt === 1 && token === this.speakToken) {
              // Some Android devices report a transient TTS engine error right
              // after STT releases audio focus. A single delayed retry is enough
              // to recover without duplicating speech.
              setTimeout(speakNative, 220);
              return;
            }
            finish(true, String(error));
          },
        });
      };

      try {
        speakNative();
      } catch (error) {
        finish(true, error instanceof Error ? error.message : 'Unknown TTS error');
        return;
      }

      // Safety net: if the native done/error event never fires, resolve anyway so
      // the caller's await (and the conversation loop) never hangs.
      const ms = Math.min(60000, 2000 + spoken.length * 100);
      safety = setTimeout(() => finish(false), ms);
    });
  }

  /** Light punctuation normalization for smoother pacing — collapses shouting
   *  ("!!!"→"!"), turns "..." into a single ellipsis pause, expands "&". Kept
   *  conservative so decimals/abbreviations (3.14, e.g.) stay intact. */
  private normalizeForSpeech(text: string): string {
    return text
      .replace(/\s*&\s*/g, ' and ')
      .replace(/\.{3,}/g, '…')
      .replace(/([!?])\1+/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
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
      /(female|zira|samantha|victoria|susan|karen|moira|tessa|fiona|serena|allison|ava|joanna|salli|kimberly|amy|emma|jenny|aria|libby|sonia|natasha|clara|google us english)/i;
    // Neural/online voices (Google, Microsoft "… Online (Natural)") sound far
    // less robotic and carry real intonation — prefer a female one of those.
    const natural = (v: SpeechSynthesisVoice) => /google|natural|online|neural/i.test(v.name);
    this.webVoice =
      pool.find((v) => natural(v) && female.test(v.name)) ||
      pool.find((v) => female.test(v.name)) ||
      pool.find((v) => natural(v)) ||
      pool[0] ||
      null;
    return this.webVoice;
  }

  /** Speak via the browser's native SpeechSynthesis (web only). Speaks the whole
   *  reply as ONE utterance (reliable across desktop + mobile browsers). Resolves
   *  when it ends, errors, or a length-scaled safety timeout fires — so the
   *  caller's `await` never hangs even if the browser drops the end event. */
  private speakWeb(text: string, options?: TTSOptions): Promise<void> {
    const token = this.speakToken;
    return new Promise((resolve) => {
      const synth = window.speechSynthesis;
      let settled = false;
      const finish = (errored: boolean) => {
        if (settled) return;
        if (token !== this.speakToken) {
          settled = true;
          resolve();
          return;
        }
        settled = true;
        this.setState(errored ? 'error' : 'idle');
        if (errored) options?.onError?.('TTS error');
        else options?.onDone?.();
        resolve();
      };

      try {
        synth.cancel(); // clear any stuck/queued utterance
        const u = new SpeechSynthesisUtterance(text);
        u.lang = this.config.language || 'en-US';
        u.rate = options?.rate ?? TTSServiceImpl.NATURAL_RATE;
        u.pitch = options?.pitch ?? this.config.pitch ?? TTSServiceImpl.NATURAL_PITCH;
        // Use a female/natural voice IF the list is ready; otherwise speak with the
        // browser default. Never block on voice loading — that can deadlock and
        // produce total silence.
        const voice = this.pickWebVoice();
        if (voice) u.voice = voice;

        u.onstart = () => this.setState('speaking');
        u.onend = () => finish(false);
        u.onerror = () => finish(true);

        this.setState('speaking');
        options?.onStart?.();
        synth.speak(u);
        // Chrome sometimes starts synthesis paused — nudge it to actually play.
        try { synth.resume(); } catch {}

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
      this.speakToken += 1;
      if (Platform.OS === 'web' && typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      } else {
        await Speech.stop();
      }
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
