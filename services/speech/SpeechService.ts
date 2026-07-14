import { Platform, AppState, AppStateStatus } from 'react-native';
import { Audio } from 'expo-av';
import { VoiceDiagnostics } from '@/services/voice/VoiceDiagnostics';
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
    console.log('[STT][module] expo-speech-recognition loaded:', !!ExpoSpeechRecognition);
  }
} catch (error) {
  // Native module not bundled (e.g. Expo Go) — isSupported() will report false.
  console.log('[STT][module] expo-speech-recognition failed to load:', error instanceof Error ? error.message : String(error));
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
  private stopWaiter: (() => void) | null = null;
  private startFallbackTimer: ReturnType<typeof setTimeout> | null = null;
  private startInFlight = false;
  private stopInFlight = false;
  private startToken = 0;
  private lastNativeRecoveryAt = 0;

  private static readonly NATIVE_START_ACK_TIMEOUT_MS = 900;
  private static readonly NATIVE_STOP_ACK_TIMEOUT_MS = 900;
  private static readonly NATIVE_RECOVERY_COOLDOWN_MS = 350;

  private resolveStopWaiter(): void {
    const resolve = this.stopWaiter;
    this.stopWaiter = null;
    resolve?.();
  }

  private clearStartFallback(): void {
    if (!this.startFallbackTimer) return;
    clearTimeout(this.startFallbackTimer);
    this.startFallbackTimer = null;
  }

  private isRecoverableNativeError(message: string): boolean {
    return !/permission|denied|not-allowed|not available|app-in-background/i.test(message);
  }

  private async recoverNativeRecognizer(message: string): Promise<void> {
    if (Platform.OS === 'web' || !ExpoSpeechRecognition || !this.isRecoverableNativeError(message)) return;
    const now = Date.now();
    if (now - this.lastNativeRecoveryAt < SpeechServiceImpl.NATIVE_RECOVERY_COOLDOWN_MS) return;
    this.lastNativeRecoveryAt = now;
    VoiceDiagnostics.incrementRecovery(message);

    try {
      // Android recognizers can get wedged after audio-focus churn between STT
      // and TTS. Abort releases the stale native session so the coordinator can
      // retry without requiring an app restart.
      ExpoSpeechRecognition.abort();
    } catch {
      // The recognizer may already be inactive; recovery is best-effort.
    }
    this.clearStartFallback();
    this.isListening = false;
    this.startInFlight = false;
    this.stopInFlight = false;
    this.resolveStopWaiter();
  }

  private async prepareAudioForRecognition(): Promise<void> {
    try {
      VoiceDiagnostics.update({ audioFocus: 'recording' });
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });
    } catch {
      // Audio mode is best-effort; recognition permission/support checks still decide.
    }
  }

  async initialize(callbacks: SpeechRecognitionCallbacks): Promise<void> {
    this.callbacks = callbacks;
    VoiceDiagnostics.update({
      speechRecognizerState: this.nativeAvailable || Platform.OS === 'web' ? 'idle' : 'unsupported',
      lifecycle: AppState.currentState,
    });
    console.log('[STT][initialize] platform=', Platform.OS, 'nativeAvailable=', this.nativeAvailable, 'alreadyInitialized=', this.isInitialized);

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
      this.startInFlight = false;
      this.isListening = true;
      VoiceDiagnostics.update({ microphoneState: 'listening', speechRecognizerState: 'listening', lastError: null });
      this.callbacks.onSpeechStart?.();
    };

    this.webRecognition.onend = () => {
      this.startInFlight = false;
      this.stopInFlight = false;
      this.isListening = false;
      VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle', audioFocus: 'released' });
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
      this.startInFlight = false;
      this.stopInFlight = false;
      VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'error', lastError: event.error });
      this.callbacks.onSpeechError?.(event.error);
    };
  }

  private initializeNative(): void {
    if (!ExpoSpeechRecognition) return;
    console.log('[STT][native:init] registering listeners');

    // Idempotent across React remounts / Android Activity recreation: drop any
    // stale subscriptions before (re)registering so listeners never stack.
    this.removeSubscriptions();

    const mod = ExpoSpeechRecognition;
    const add = <E>(event: string, listener: (ev: E) => void) => {
      this.subscriptions.push(mod.addListener<E>(event, listener));
    };

    add<null>('start', () => {
      console.log('[STEP 8] native start event');
      this.clearStartFallback();
      this.startInFlight = false;
      this.isListening = true;
      VoiceDiagnostics.update({ microphoneState: 'listening', speechRecognizerState: 'listening', lastError: null });
      this.callbacks.onSpeechStart?.();
    });
    add<null>('end', () => {
      this.clearStartFallback();
      this.startInFlight = false;
      this.stopInFlight = false;
      this.isListening = false;
      this.resolveStopWaiter();
      VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle', audioFocus: 'released' });
      this.callbacks.onSpeechEnd?.();
    });
    add<ExpoSpeechRecognitionResultEvent>('result', (ev) => {
      console.log('[STEP 9] first speech result');
      const transcripts = (ev.results ?? []).map((r) => r.transcript).filter(Boolean);
      if (transcripts.length === 0) return;
      if (ev.isFinal) {
        this.callbacks.onSpeechResults?.(transcripts);
      } else {
        this.callbacks.onSpeechPartialResults?.(transcripts);
      }
    });
    add<ExpoSpeechRecognitionErrorEvent>('error', (ev) => {
      console.log('[STEP 10] error callback');
      this.clearStartFallback();
      this.startInFlight = false;
      this.stopInFlight = false;
      this.isListening = false;
      this.resolveStopWaiter();
      const message = ev.message || ev.error || 'Unknown speech error';
      VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'error', lastError: message });
      void this.recoverNativeRecognizer(message);
      this.callbacks.onSpeechError?.(message);
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
    if (next !== 'active' && (this.isListening || this.startInFlight || this.stopInFlight)) {
      VoiceDiagnostics.update({ lifecycle: next, audioFocus: 'interrupted', microphoneState: 'stopping' });
      this.cancelListening();
    } else {
      VoiceDiagnostics.update({ lifecycle: next });
    }
  };

  /** Requests mic + speech-recognition permission on native (no-op prompt on web). */
  private async ensureNativePermission(): Promise<boolean> {
    if (!ExpoSpeechRecognition) {
      console.log('[STT][permission] native module missing');
      return false;
    }
    try {
      const current = await ExpoSpeechRecognition.getPermissionsAsync();
      console.log('[STT][permission] current=', current);
      if (current.granted) {
        VoiceDiagnostics.update({ permissionState: 'granted' });
        return true;
      }
      const requested = await ExpoSpeechRecognition.requestPermissionsAsync();
      console.log('[STT][permission] requested=', requested);
      VoiceDiagnostics.update({ permissionState: requested.granted ? 'granted' : 'denied' });
      return !!requested.granted;
    } catch (error) {
      console.log('[STT][permission] failed=', error instanceof Error ? error.message : String(error));
      VoiceDiagnostics.update({ permissionState: 'unknown', lastError: error instanceof Error ? error.message : String(error) });
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
    console.log('[STT][support] platform=', Platform.OS, 'nativeAvailable=', this.nativeAvailable);
    return this.nativeAvailable;
  }

  isCurrentlyListening(): boolean {
    return this.isListening;
  }

  async startListening(locale: string = 'en-US'): Promise<void> {
    console.log('[STT][start] requested locale=', locale, 'initialized=', this.isInitialized, 'platform=', Platform.OS, 'appState=', AppState.currentState, 'isListening=', this.isListening, 'startInFlight=', this.startInFlight);
    if (!this.isInitialized) {
      throw new Error('SpeechService not initialized. Call initialize() first.');
    }

    if (Platform.OS !== 'web' && AppState.currentState !== 'active') {
      VoiceDiagnostics.update({ lastError: 'app-in-background: microphone can start only while the app is active.', lifecycle: AppState.currentState });
      this.callbacks.onSpeechError?.('app-in-background: microphone can start only while the app is active.');
      return;
    }

    // Hard guard against duplicate starts; set synchronously to close the race
    // window where two rapid calls both pass the guard.
    if (this.isListening || this.startInFlight) {
      return;
    }
    this.startInFlight = true;
    this.isListening = true;
    VoiceDiagnostics.update({ microphoneState: 'starting', speechRecognizerState: 'idle', lastError: null });
    const token = ++this.startToken;

    try {
      await this.prepareAudioForRecognition();

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
        console.log('[STT][start] permissionGranted=', granted);
        if (!granted) {
          this.isListening = false;
          this.startInFlight = false;
          VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'error', permissionState: 'denied', lastError: 'not-allowed: microphone or speech permission was denied.' });
          this.callbacks.onSpeechError?.('not-allowed: microphone or speech permission was denied.');
          return;
        }
        const recognitionAvailable = ExpoSpeechRecognition.isRecognitionAvailable();
        console.log('[STEP 6] isRecognitionAvailable', recognitionAvailable);
        console.log('[STT][start] recognitionAvailable=', recognitionAvailable);
        if (!recognitionAvailable) {
          this.isListening = false;
          this.startInFlight = false;
          VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'unsupported', lastError: 'Speech recognition is not available on this device.' });
          this.callbacks.onSpeechError?.('Speech recognition is not available on this device.');
          return;
        }
        console.log('[STT][start] calling native start()');
        console.log('[STEP 7] ExpoSpeechRecognition.start invoked');
        ExpoSpeechRecognition.start({ lang: locale, interimResults: true, continuous: false });
        this.clearStartFallback();
        this.startFallbackTimer = setTimeout(() => {
          if (this.startToken === token && this.isListening && this.startInFlight) {
            this.startInFlight = false;
            VoiceDiagnostics.update({ microphoneState: 'listening', speechRecognizerState: 'listening' });
            this.callbacks.onSpeechStart?.();
          }
        }, SpeechServiceImpl.NATIVE_START_ACK_TIMEOUT_MS);
      } else {
        // Unsupported runtime (e.g. Expo Go without the native module): fail
        // gracefully — never throw a runtime error.
        this.isListening = false;
        this.startInFlight = false;
        VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'unsupported', lastError: 'Speech recognition is not available on this device.' });
        this.callbacks.onSpeechError?.('Speech recognition is not available on this device.');
        return;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to start listening';
      await this.recoverNativeRecognizer(message);
      this.clearStartFallback();
      this.startInFlight = false;
      this.isListening = false;
      this.callbacks.onSpeechError?.(message);
      throw error;
    }
  }

  async stopListening(): Promise<void> {
    if ((!this.isListening && !this.startInFlight) || this.stopInFlight) return;
    this.stopInFlight = true;
    VoiceDiagnostics.update({ microphoneState: 'stopping' });

    try {
      if (Platform.OS === 'web') {
        this.webRecognition?.stop();
      } else if (this.nativeAvailable && ExpoSpeechRecognition) {
        const endEvent = new Promise<void>((resolve) => {
          this.stopWaiter = resolve;
          setTimeout(() => {
            if (this.stopWaiter === resolve) {
              this.resolveStopWaiter();
            }
          }, SpeechServiceImpl.NATIVE_STOP_ACK_TIMEOUT_MS);
        });
        if (this.startInFlight) {
          // If a stop arrives while native start is still acknowledging, abort is
          // safer than stop: some Android recognizers throw on stop-before-start.
          ExpoSpeechRecognition.abort();
        } else {
          ExpoSpeechRecognition.stop();
        }
        await endEvent;
      }
      this.clearStartFallback();
      this.isListening = false;
      this.startInFlight = false;
      this.stopInFlight = false;
      VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle', audioFocus: 'released' });
    } catch (error) {
      this.clearStartFallback();
      this.startInFlight = false;
      this.stopInFlight = false;
      this.resolveStopWaiter();
      const message = error instanceof Error ? error.message : 'Failed to stop listening';
      VoiceDiagnostics.update({ microphoneState: 'error', speechRecognizerState: 'error', lastError: message });
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
      this.clearStartFallback();
      this.isListening = false;
      this.startInFlight = false;
      this.stopInFlight = false;
      this.resolveStopWaiter();
      VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle', audioFocus: 'released' });
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
    this.startInFlight = false;
    this.stopInFlight = false;
    this.clearStartFallback();
    this.resolveStopWaiter();
    VoiceDiagnostics.update({ microphoneState: 'idle', speechRecognizerState: 'idle', audioFocus: 'released' });
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
