import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { DailyBriefComposer } from './DailyBriefComposer';
import type { DailyBrief, DailyBriefStorage } from './DailyBriefTypes';

const STORAGE_KEY = '@jissi/daily-brief/state';
const LONG_GAP_MS = 8 * 60 * 60 * 1000;

function todayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

function readShowReason(state: DailyBriefStorage, now = new Date()): DailyBrief['showReason'] | null {
  if (state.lastShownDate === todayKey(now)) return null;
  const hour = now.getHours();
  if (!state.lastOpenedAt) return 'first_open';
  if (hour >= 5 && hour < 12) return 'morning';
  const lastOpened = new Date(state.lastOpenedAt);
  if (!Number.isNaN(lastOpened.getTime()) && now.getTime() - lastOpened.getTime() >= LONG_GAP_MS) return 'long_gap';
  return null;
}

class DailyBriefEngineImpl {
  private composer = new DailyBriefComposer();

  async getBriefToShow(): Promise<DailyBrief | null> {
    const state = await this.getState();
    const now = new Date();
    const showReason = readShowReason(state, now);
    const nextState: DailyBriefStorage = { ...state, lastOpenedAt: now.toISOString() };
    if (!showReason) {
      await this.saveState(nextState);
      return null;
    }
    const brief = await this.composer.compose(showReason);
    await this.saveState({ ...nextState, lastShownDate: brief.date });
    return brief;
  }

  async getPreview(): Promise<DailyBrief> {
    return this.composer.compose('first_open');
  }

  async getState(): Promise<DailyBriefStorage> {
    try {
      const raw = await getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) as DailyBriefStorage : {};
    } catch {
      return {};
    }
  }

  private async saveState(state: DailyBriefStorage): Promise<void> {
    await setItem(STORAGE_KEY, JSON.stringify(state));
  }
}

export const DailyBriefEngine = new DailyBriefEngineImpl();
