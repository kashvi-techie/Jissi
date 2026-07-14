import { AppState, Platform } from 'react-native';
import type { SpeechState } from '@/services/speech/types';
import { DeviceStateEngine } from '@/services/device';
import type { TTSState } from './types';

export type VoiceRuntimeState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'speaking'
  | 'interrupted'
  | 'recovering'
  | 'offline';

export type VoicePermissionState = 'unknown' | 'granted' | 'denied' | 'blocked' | 'unsupported';
export type VoiceAudioFocusState = 'unknown' | 'recording' | 'speaking' | 'released' | 'ducking' | 'interrupted';

export interface VoiceDiagnosticsSnapshot {
  runtimeState: VoiceRuntimeState;
  microphoneState: 'idle' | 'starting' | 'listening' | 'stopping' | 'error';
  permissionState: VoicePermissionState;
  speechRecognizerState: SpeechState | 'uninitialized' | 'recovering' | 'unsupported';
  ttsState: TTSState;
  audioFocus: VoiceAudioFocusState;
  conversationState: string;
  lifecycle: string;
  lastError: string | null;
  recoveryAttempts: number;
  continuousConversation: boolean;
  bargeInAvailable: boolean;
  deviceContext: string[];
  updatedAt: string;
}

const INITIAL: VoiceDiagnosticsSnapshot = {
  runtimeState: 'idle',
  microphoneState: 'idle',
  permissionState: 'unknown',
  speechRecognizerState: 'uninitialized',
  ttsState: 'idle',
  audioFocus: 'unknown',
  conversationState: 'idle',
  lifecycle: AppState.currentState,
  lastError: null,
  recoveryAttempts: 0,
  continuousConversation: false,
  bargeInAvailable: false,
  deviceContext: [],
  updatedAt: new Date().toISOString(),
};

class VoiceDiagnosticsImpl {
  private snapshot: VoiceDiagnosticsSnapshot = INITIAL;
  private listeners = new Set<(snapshot: VoiceDiagnosticsSnapshot) => void>();

  getSnapshot(): VoiceDiagnosticsSnapshot {
    return this.snapshot;
  }

  update(patch: Partial<VoiceDiagnosticsSnapshot>): VoiceDiagnosticsSnapshot {
    this.snapshot = {
      ...this.snapshot,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    this.listeners.forEach((listener) => listener(this.snapshot));
    return this.snapshot;
  }

  setRuntimeFromStates(speechState: SpeechState, ttsState: TTSState, conversationState: string, supported: boolean): void {
    void this.refreshDeviceContext();
    if (!supported) {
      this.update({ runtimeState: 'offline', speechRecognizerState: 'unsupported', conversationState });
      return;
    }
    if (speechState === 'listening') this.update({ runtimeState: 'listening', conversationState });
    else if (ttsState === 'speaking') this.update({ runtimeState: 'speaking', conversationState });
    else if (conversationState === 'processing' || conversationState === 'thinking') this.update({ runtimeState: 'thinking', conversationState });
    else if (speechState === 'error') this.update({ runtimeState: 'recovering', conversationState });
    else this.update({ runtimeState: 'idle', conversationState });
  }

  incrementRecovery(lastError?: string): void {
    this.update({
      runtimeState: 'recovering',
      speechRecognizerState: 'recovering',
      microphoneState: 'error',
      audioFocus: 'interrupted',
      lastError: lastError ?? this.snapshot.lastError,
      recoveryAttempts: this.snapshot.recoveryAttempts + 1,
    });
  }

  subscribe(listener: (snapshot: VoiceDiagnosticsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.snapshot);
    return () => this.listeners.delete(listener);
  }

  platformLabel(): string {
    return Platform.OS;
  }

  private async refreshDeviceContext(): Promise<void> {
    const context = await DeviceStateEngine.getContext().catch(() => null);
    if (!context) return;
    this.update({ deviceContext: context.facts });
  }
}

export const VoiceDiagnostics = new VoiceDiagnosticsImpl();
