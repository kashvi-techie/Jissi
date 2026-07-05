import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Memory interface (#6): remember / recall / forget. The default implementation
 * is a thin AsyncStorage-backed key/value store; it can later be swapped for a
 * semantic/vector store without touching the MemoryTool that uses it.
 */
export interface MemoryEntry {
  key: string;
  value: string;
}

export interface MemoryStore {
  remember(key: string, value: string): Promise<void>;
  recall(key?: string): Promise<MemoryEntry[]>;
  forget(key: string): Promise<void>;
  count(): Promise<number>;
}

const PREFIX = '@jissi/memory/';

class AsyncMemoryStore implements MemoryStore {
  async remember(key: string, value: string): Promise<void> {
    await AsyncStorage.setItem(PREFIX + key, value);
  }

  async recall(key?: string): Promise<MemoryEntry[]> {
    if (key) {
      const value = await AsyncStorage.getItem(PREFIX + key);
      return value != null ? [{ key, value }] : [];
    }
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(keys);
    return entries.map(([k, v]) => ({ key: k.slice(PREFIX.length), value: v ?? '' }));
  }

  async forget(key: string): Promise<void> {
    await AsyncStorage.removeItem(PREFIX + key);
  }

  async count(): Promise<number> {
    const keys = (await AsyncStorage.getAllKeys()).filter((k) => k.startsWith(PREFIX));
    return keys.length;
  }
}

export const memoryStore: MemoryStore = new AsyncMemoryStore();
