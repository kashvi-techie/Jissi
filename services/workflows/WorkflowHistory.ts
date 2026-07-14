import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkflowRun } from './WorkflowTypes';

const HISTORY_KEY = '@jissi/workflows/history';
const MAX_HISTORY = 80;

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

class WorkflowHistoryImpl {
  async save(run: WorkflowRun): Promise<void> {
    const history = await this.list();
    await setItem(HISTORY_KEY, JSON.stringify([run, ...history.filter((item) => item.id !== run.id)].slice(0, MAX_HISTORY)));
  }

  async list(): Promise<WorkflowRun[]> {
    try {
      const raw = await getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) as WorkflowRun[] : [];
    } catch {
      return [];
    }
  }

  async clear(): Promise<void> {
    await setItem(HISTORY_KEY, JSON.stringify([]));
  }
}

export const WorkflowHistory = new WorkflowHistoryImpl();
