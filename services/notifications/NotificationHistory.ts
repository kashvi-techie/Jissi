import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import type { JissiNotificationRecord, JissiNotificationStatus, QuietHoursWindow } from './NotificationTypes';

const HISTORY_KEY = 'jissi:notification-history:v1';
const QUIET_HOURS_KEY = 'jissi:quiet-hours:v1';

async function read(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function write(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

class NotificationHistoryImpl {
  async list(): Promise<JissiNotificationRecord[]> {
    const raw = await read(HISTORY_KEY);
    if (!raw) return [];
    try {
      return JSON.parse(raw) as JissiNotificationRecord[];
    } catch {
      return [];
    }
  }

  async save(records: JissiNotificationRecord[]): Promise<void> {
    await write(HISTORY_KEY, JSON.stringify(records.slice(0, 250)));
  }

  async add(record: JissiNotificationRecord): Promise<JissiNotificationRecord> {
    const records = await this.list();
    const next = [record, ...records.filter((item) => item.id !== record.id)];
    await this.save(next);
    return record;
  }

  async update(id: string, patch: Partial<JissiNotificationRecord>): Promise<JissiNotificationRecord | null> {
    const records = await this.list();
    const existing = records.find((item) => item.id === id || item.nativeId === id);
    if (!existing) return null;
    const updated: JissiNotificationRecord = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await this.save(records.map((item) => (item.id === existing.id ? updated : item)));
    return updated;
  }

  async mark(id: string, status: JissiNotificationStatus): Promise<JissiNotificationRecord | null> {
    const now = new Date().toISOString();
    const patch: Partial<JissiNotificationRecord> = { status };
    if (status === 'delivered') patch.deliveredAt = now;
    if (status === 'completed') patch.completedAt = now;
    if (status === 'dismissed') patch.dismissedAt = now;
    return this.update(id, patch);
  }

  async findDuplicate(dedupeKey: string, scheduledFor: string): Promise<JissiNotificationRecord | null> {
    const targetTime = new Date(scheduledFor).getTime();
    const records = await this.list();
    return records.find((item) => {
      if (item.dedupeKey !== dedupeKey) return false;
      if (['completed', 'cancelled', 'failed', 'dismissed'].includes(item.status)) return false;
      return Math.abs(new Date(item.scheduledFor).getTime() - targetTime) < 60 * 60 * 1000;
    }) ?? null;
  }

  async getQuietHours(): Promise<QuietHoursWindow> {
    const raw = await read(QUIET_HOURS_KEY);
    if (!raw) return { enabled: true, startHour: 22, endHour: 7 };
    try {
      return JSON.parse(raw) as QuietHoursWindow;
    } catch {
      return { enabled: true, startHour: 22, endHour: 7 };
    }
  }

  async setQuietHours(window: QuietHoursWindow): Promise<void> {
    await write(QUIET_HOURS_KEY, JSON.stringify(window));
  }
}

export const NotificationHistory = new NotificationHistoryImpl();
