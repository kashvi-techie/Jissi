import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CapabilityAnalyticsEntry } from './CapabilityTypes';

const HISTORY_KEY = '@jissi/capabilities/history';
const MAX_HISTORY = 120;
let sequence = 0;

function id(): string {
  sequence += 1;
  return `capability_history_${Date.now()}_${sequence}`;
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

class CapabilityAnalyticsImpl {
  async record(entry: Omit<CapabilityAnalyticsEntry, 'id'>): Promise<CapabilityAnalyticsEntry> {
    const next: CapabilityAnalyticsEntry = { id: id(), ...entry };
    const history = await this.getHistory();
    await setItem(HISTORY_KEY, JSON.stringify([next, ...history].slice(0, MAX_HISTORY)));
    return next;
  }

  async getHistory(): Promise<CapabilityAnalyticsEntry[]> {
    try {
      const raw = await getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) as CapabilityAnalyticsEntry[] : [];
    } catch {
      return [];
    }
  }

  async lastFor(capabilityId: CapabilityAnalyticsEntry['capabilityId']): Promise<CapabilityAnalyticsEntry | undefined> {
    return (await this.getHistory()).find((entry) => entry.capabilityId === capabilityId);
  }

  async clear(): Promise<void> {
    await setItem(HISTORY_KEY, JSON.stringify([]));
  }
}

export const CapabilityAnalytics = new CapabilityAnalyticsImpl();
