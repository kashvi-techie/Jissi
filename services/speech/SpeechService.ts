import { Platform, AppState, AppStateStatus } from 'react-native';
import type {
  ExpoSpeechRecognitionResultEvent,
  ExpoSpeechRecognitionErrorEvent,
} from 'expo-speech-recognition';

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

// ── Native engine: expo-speech-recognition ──────────────────────────────────
// Loaded via require() inside try/catch so the app DEGRADES GRACEFULLY in Expo
// Go (where the native module is absent) instead of crashing at import. In a
// Development Build the native module is present and require() succeeds. The
// payload TYPES are `import type` only (erased at compile time → no runtime
// import), so they never trigger the native lookup.
type EventSub = { remove: () => void };
type ESRStartOptions = {
  lang?: string;
  interimResults?: boolean;
  continuous?: boolean;
  requiresOnDeviceRecognition?: boolean;
};
interface ESRModule {
  start: (options: ESRStartOptions) => void;
  stop: () => void;
  abort: () => void;
  isRecognitionAvailable: () => boolean;
  requestPermissionsAsync: () => Promise<{ granted: boolean }>;
  getPermissionsAsync: () => Promise<{ granted: boolean }>;
  addListener: <E>(event: string, listener: (ev: E) => void) => EventSub;
}

let ExpoSpeechRecognition: ESRModule | null = null;
try {
  if (Platform.OS !== 'web') {
    ExpoSpeechRecognition = require('expo-speech-recognition').ExpoSpeechRecognitionModule as ESRModule;
  }
} catch {
  // Native module not bundled (e.g. Expo Go) — isSupported() will report false.
  ExpoSpeechRecognition = null;
}

class SpeechServiceImpl {
  private isInitialized = false;
  private isListening = false;
  private callbacks: SpeechRecognitionCallbacks = {};
  private webRecognition: WebSpeechRecognition | null = null;
  private nativeAvailable = ExpoSpeechRecognition != null;
  private subscriptions: EventSub[] = [];
  private appStateSub: EventSub | null = null;

  async initialize(callbacks: SpeechRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;

    if (Platform.OS === 'web') {
      await this.initializeWeb();
    } else if (this.nativeAvailable && ExpoSpeechRecognition) {
      this.initializeNative();
    } else {
      console.warn(
        'Native speech recognition unavailable (Expo Go?) — requires a Development Build.'
      );
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
    // Single-utterance per turn: with `continuous = true` Chrome keeps the
    // recognizer alive and never fires `onend`, so speechState never returns to
    // 'idle' and the continuous-mode hand-off (which requires idle) never runs.
    // `false` makes the browser finalize on end-of-speech → onend → idle → hand-off.
    this.webRecognition.continuous = false;
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

  private initializeNative(): void {
    if (!ExpoSpeechRecognition) return;

    // Idempotent across React remounts / Android Activity recreation: drop any
    // stale subscriptions before (re)registering so listeners never stack.
    this.removeSubscriptions();

    const mod = ExpoSpeechRecognition;
    const add = <E>(event: string, listener: (ev: E) => void) => {
      this.subscriptions.push(mod.addListener<E>(event, listener));
    };

    add<null>('start', () => {
      this.isListening = true;
      this.callbacks.onSpeechStart?.();
    });
    add<null>('end', () => {
      this.isListening = false;
      this.callbacks.onSpeechEnd?.();
    });
    add<ExpoSpeechRecognitionResultEvent>('result', (ev) => {
      const transcripts = (ev.results ?? []).map((r) => r.transcript).filter(Boolean);
      if (transcripts.length === 0) return;
      if (ev.isFinal) {
        this.callbacks.onSpeechResults?.(transcripts);
      } else {
        this.callbacks.onSpeechPartialResults?.(transcripts);
      }
    });
    add<ExpoSpeechRecognitionErrorEvent>('error', (ev) => {
      this.isListening = false;
      this.callbacks.onSpeechError?.(ev.message || ev.error || 'Unknown speech error');
    });
    add<{ value: number }>('volumechange', (ev) => {
      this.callbacks.onVolumeChanged?.(ev.value);
    });

    // Release the recognizer when the app leaves the foreground. Prevents a
    // stuck mic / dangling native session after the Activity is paused, and
    // covers Android Activity recreation while listening.
    this.appStateSub?.remove();
    this.appStateSub = AppState.addEventListener('change', this.handleAppStateChange);
  }

  private handleAppStateChange = (next: AppStateStatus): void => {
    if (next !== 'active' && this.isListening) {
      this.cancelListening();
    }
  };

  /** Requests mic + speech-recognition permission on native (no-op prompt on web). */
  private async ensureNativePermission(): Promise<boolean> {
    if (!ExpoSpeechRecognition) return false;
    try {
      const current = await ExpoSpeechRecognition.getPermissionsAsync();
      if (current.granted) return true;
      const requested = await ExpoSpeechRecognition.requestPermissionsAsync();
      return !!requested.granted;
    } catch {
      return false;
    }
  }

  isSupported(): boolean {
    if (Platform.OS === 'web') {
      return (
        typeof window !== 'undefined' &&
        !!(window.SpeechRecognition || window.webkitSpeechRecognition)
      );
    }
    return this.nativeAvailable;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async startListening(locale: string = 'en-US'): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('SpeechService not initialized. Call initialize() first.');
    }

    // Hard guard against duplicate starts; set synchronously to close the race
    // window where two rapid calls both pass the guard.
    if (this.isListening) {
      return;
    }
    this.isListening = true;

    try {
      if (Platform.OS === 'web') {
        try {
          this.webRecognition?.start();
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          if (!/already started/i.test(msg)) {
            throw e;
          }
        }
      } else if (this.nativeAvailable && ExpoSpeechRecognition) {
        const granted = await this.ensureNativePermission();
        if (!granted) {
          this.isListening = false;
          this.callbacks.onSpeechError?.('not-allowed: microphone or speech permission was denied.');
          return;
        }
        ExpoSpeechRecognition.start({ lang: locale, interimResults: true, continuous: false });
      } else {
        // Unsupported runtime (e.g. Expo Go without the native module): fail
        // gracefully — never throw a runtime error.
        this.isListening = false;
        this.callbacks.onSpeechError?.('Speech recognition is not available on this device.');
        return;
      }
    } catch (error) {
      this.isListening = false;
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
      } else if (this.nativeAvailable && ExpoSpeechRecognition) {
        ExpoSpeechRecognition.stop();
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
      } else if (this.nativeAvailable && ExpoSpeechRecognition) {
        ExpoSpeechRecognition.abort();
      }
      this.isListening = false;
    } catch {
      // Silent fail on cancel
    }
  }

  async destroy(): Promise<void> {
    try {
      if (Platform.OS === 'web') {
        this.webRecognition?.abort();
        this.webRecognition = null;
      } else if (this.nativeAvailable && ExpoSpeechRecognition) {
        try {
          ExpoSpeechRecognition.abort();
        } catch {
          // ignore — may already be inactive
        }
        this.removeSubscriptions();
        this.appStateSub?.remove();
        this.appStateSub = null;
      }
    } catch {
      // Silent fail on destroy
    }
    this.isInitialized = false;
    this.isListening = false;
  }

  private removeSubscriptions(): void {
    this.subscriptions.forEach((sub) => {
      try {
        sub.remove();
      } catch {
        // ignore
      }
    });
    this.subscriptions = [];
  }

  async getAllLocales(): Promise<string[]> {
    return ['en-US', 'en-GB', 'es-ES', 'fr-FR', 'de-DE', 'it-IT', 'pt-BR', 'zh-CN', 'ja-JP', 'ko-KR'];
  }

  async isAvailable(): Promise<boolean> {
    if (Platform.OS === 'web') {
      return this.isSupported();
    }
    if (!this.nativeAvailable || !ExpoSpeechRecognition) {
      return false;
    }
    try {
      return ExpoSpeechRecognition.isRecognitionAvailable();
    } catch {
      return false;
    }
  }
}

export const SpeechService = new SpeechServiceImpl();
