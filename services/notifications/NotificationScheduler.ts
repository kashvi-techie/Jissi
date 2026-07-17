import { Platform } from 'react-native';
import { NotificationHistory } from './NotificationHistory';
import type {
  JissiNotificationPayload,
  JissiNotificationRecord,
  JissiSnoozeOption,
  NotificationScheduleResult,
  QuietHoursWindow,
} from './NotificationTypes';

type ExpoNotificationsModule = {
  getPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  requestPermissionsAsync?: () => Promise<{ status?: string; granted?: boolean }>;
  scheduleNotificationAsync?: (request: unknown) => Promise<string>;
  cancelScheduledNotificationAsync?: (id: string) => Promise<void>;
  setNotificationHandler?: (handler: unknown) => void;
  addNotificationReceivedListener?: (listener: (event: unknown) => void) => { remove?: () => void };
  addNotificationResponseReceivedListener?: (listener: (event: unknown) => void) => { remove?: () => void };
};

declare const require: (name: string) => unknown;

function loadExpoNotifications(): { module: ExpoNotificationsModule | null; reason: string | null } {
  if (Platform.OS === 'web') {
    return { module: null, reason: 'Expo local notifications require a native Android or iOS runtime.' };
  }
  try {
    return { module: require('expo-notifications') as ExpoNotificationsModule, reason: null };
  } catch {
    return { module: null, reason: 'expo-notifications is not installed in this build.' };
  }
}

function createId(prefix = 'jissi-notification'): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isWithinQuietHours(date: Date, quietHours: QuietHoursWindow): boolean {
  if (!quietHours.enabled) return false;
  const hour = date.getHours();
  if (quietHours.startHour === quietHours.endHour) return true;
  if (quietHours.startHour < quietHours.endHour) {
    return hour >= quietHours.startHour && hour < quietHours.endHour;
  }
  return hour >= quietHours.startHour || hour < quietHours.endHour;
}

function moveAfterQuietHours(date: Date, quietHours: QuietHoursWindow): Date {
  const next = new Date(date);
  next.setHours(quietHours.endHour, 0, 0, 0);
  if (next <= date) next.setDate(next.getDate() + 1);
  return next;
}

function snoozeDate(from: Date, option: JissiSnoozeOption): Date {
  const next = new Date(from);
  if (option === '10_min') next.setMinutes(next.getMinutes() + 10);
  if (option === '30_min') next.setMinutes(next.getMinutes() + 30);
  if (option === '1_hour') next.setHours(next.getHours() + 1);
  if (option === 'tomorrow') next.setDate(next.getDate() + 1);
  return next;
}

class NotificationSchedulerImpl {
  private listenersInstalled = false;
  private native = loadExpoNotifications();

  getNativeStatus(): { available: boolean; reason: string | null } {
    this.native = loadExpoNotifications();
    return { available: Boolean(this.native.module), reason: this.native.reason };
  }

  async schedule(payload: JissiNotificationPayload): Promise<NotificationScheduleResult> {
    const native = loadExpoNotifications();
    this.native = native;

    const quietHours = await NotificationHistory.getQuietHours();
    let scheduledFor = new Date(payload.scheduledFor);
    if (Number.isNaN(scheduledFor.getTime())) {
      return { ok: false, record: null, reason: 'Invalid scheduledFor date.' };
    }
    if (isWithinQuietHours(scheduledFor, quietHours)) {
      scheduledFor = moveAfterQuietHours(scheduledFor, quietHours);
    }

    const dedupeKey = payload.dedupeKey ?? `${payload.category}:${payload.title}:${scheduledFor.toISOString().slice(0, 13)}`;
    const duplicate = await NotificationHistory.findDuplicate(dedupeKey, scheduledFor.toISOString());
    if (duplicate) {
      return { ok: true, record: duplicate, reason: 'Duplicate notification already scheduled.' };
    }

    const now = new Date().toISOString();
    const record: JissiNotificationRecord = {
      ...payload,
      id: createId(),
      nativeId: null,
      status: 'pending',
      scheduledFor: scheduledFor.toISOString(),
      dedupeKey,
      createdAt: now,
      updatedAt: now,
    };

    if (!native.module?.scheduleNotificationAsync) {
      const failed: JissiNotificationRecord = {
        ...record,
        status: 'failed',
        failureReason: native.reason ?? 'Expo Notifications native scheduler is unavailable.',
      };
      await NotificationHistory.add(failed);
      return { ok: false, record: failed, reason: failed.failureReason };
    }

    const permission = await this.ensurePermission(native.module);
    if (!permission.ok) {
      const failed: JissiNotificationRecord = { ...record, status: 'failed', failureReason: permission.reason };
      await NotificationHistory.add(failed);
      return { ok: false, record: failed, reason: permission.reason };
    }

    this.installListeners();

    try {
      const nativeId = await native.module.scheduleNotificationAsync({
        content: {
          title: payload.title,
          body: payload.body,
          data: {
            ...payload.data,
            jissiNotificationId: record.id,
            category: payload.category,
            dedupeKey,
          },
        },
        trigger: { date: scheduledFor },
      });
      const scheduled: JissiNotificationRecord = { ...record, nativeId, status: 'scheduled' };
      await NotificationHistory.add(scheduled);
      return { ok: true, record: scheduled };
    } catch (error) {
      const failed: JissiNotificationRecord = {
        ...record,
        status: 'failed',
        failureReason: error instanceof Error ? error.message : 'Notification scheduling failed.',
      };
      await NotificationHistory.add(failed);
      return { ok: false, record: failed, reason: failed.failureReason };
    }
  }

  async cancel(id: string): Promise<void> {
    const records = await NotificationHistory.list();
    const record = records.find((item) => item.id === id || item.nativeId === id);
    if (record?.nativeId) {
      const native = loadExpoNotifications();
      await native.module?.cancelScheduledNotificationAsync?.(record.nativeId).catch(() => undefined);
    }
    await NotificationHistory.mark(id, 'cancelled');
  }

  async snooze(id: string, option: JissiSnoozeOption): Promise<NotificationScheduleResult> {
    const records = await NotificationHistory.list();
    const record = records.find((item) => item.id === id || item.nativeId === id);
    if (!record) return { ok: false, record: null, reason: 'Notification record not found.' };
    await this.cancel(record.id);
    await NotificationHistory.update(record.id, { status: 'snoozed' });
    return this.schedule({
      title: record.title,
      body: record.body,
      category: record.category,
      scheduledFor: snoozeDate(new Date(), option).toISOString(),
      data: record.data,
      dedupeKey: `${record.dedupeKey}:snooze:${option}:${Date.now()}`,
    });
  }

  async markCompleted(id: string): Promise<void> {
    await NotificationHistory.mark(id, 'completed');
  }

  async markDismissed(id: string): Promise<void> {
    await NotificationHistory.mark(id, 'dismissed');
  }

  private async ensurePermission(native: ExpoNotificationsModule): Promise<{ ok: boolean; reason?: string }> {
    const existing = await native.getPermissionsAsync?.().catch(() => null);
    if (existing?.granted || existing?.status === 'granted') return { ok: true };
    const requested = await native.requestPermissionsAsync?.().catch(() => null);
    if (requested?.granted || requested?.status === 'granted') return { ok: true };
    return { ok: false, reason: 'Notification permission was not granted.' };
  }

  private installListeners(): void {
    if (this.listenersInstalled) return;
    const native = loadExpoNotifications();
    if (!native.module) return;
    native.module.setNotificationHandler?.({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: false,
      }),
    });
    native.module.addNotificationReceivedListener?.((event: unknown) => {
      const id = this.extractId(event);
      if (id) void NotificationHistory.mark(id, 'delivered');
    });
    native.module.addNotificationResponseReceivedListener?.((event: unknown) => {
      const id = this.extractId(event);
      if (id) void NotificationHistory.mark(id, 'completed');
    });
    this.listenersInstalled = true;
  }

  private extractId(event: unknown): string | null {
    const value = event as {
      request?: { content?: { data?: Record<string, unknown> } };
      notification?: { request?: { content?: { data?: Record<string, unknown> } } };
    };
    const data = value.request?.content?.data ?? value.notification?.request?.content?.data;
    const id = data?.jissiNotificationId;
    return typeof id === 'string' ? id : null;
  }
}

export const NotificationScheduler = new NotificationSchedulerImpl();
