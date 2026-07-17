import { NotificationAnalytics } from './NotificationAnalytics';
import { NotificationHistory } from './NotificationHistory';
import { NotificationScheduler } from './NotificationScheduler';
import type {
  JissiNotificationPayload,
  JissiNotificationRecord,
  JissiSnoozeOption,
  NotificationCenterSnapshot,
  NotificationScheduleResult,
  QuietHoursWindow,
} from './NotificationTypes';

function richBody(category: JissiNotificationPayload['category'], body: string): string {
  if (category === 'daily_brief') {
    return body.includes('Tap to see your Daily Brief') ? body : `${body}\n\nTap to see your Daily Brief.`;
  }
  return body;
}

class NotificationEngineImpl {
  async schedule(payload: JissiNotificationPayload): Promise<NotificationScheduleResult> {
    return NotificationScheduler.schedule({
      ...payload,
      body: richBody(payload.category, payload.body),
    });
  }

  async scheduleDailyBrief(date: Date, importantCount = 0): Promise<NotificationScheduleResult> {
    const body = importantCount > 0
      ? `You have ${importantCount} important ${importantCount === 1 ? 'thing' : 'things'} today.`
      : 'Your day is ready when you are.';
    return this.schedule({
      title: 'Good morning',
      body,
      category: 'daily_brief',
      scheduledFor: date.toISOString(),
      dedupeKey: `daily_brief:${date.toISOString().slice(0, 10)}`,
    });
  }

  async snooze(id: string, option: JissiSnoozeOption): Promise<NotificationScheduleResult> {
    return NotificationScheduler.snooze(id, option);
  }

  async cancel(id: string): Promise<void> {
    await NotificationScheduler.cancel(id);
  }

  async markCompleted(id: string): Promise<void> {
    await NotificationScheduler.markCompleted(id);
  }

  async markDismissed(id: string): Promise<void> {
    await NotificationScheduler.markDismissed(id);
  }

  async setQuietHours(window: QuietHoursWindow): Promise<void> {
    await NotificationHistory.setQuietHours(window);
  }

  async getCenterSnapshot(): Promise<NotificationCenterSnapshot> {
    const [records, analytics, quietHours] = await Promise.all([
      NotificationHistory.list(),
      NotificationAnalytics.snapshot(),
      NotificationHistory.getQuietHours(),
    ]);
    const native = NotificationScheduler.getNativeStatus();
    const byStatus = (status: JissiNotificationRecord['status']) => records.filter((item) => item.status === status);

    return {
      scheduled: byStatus('scheduled'),
      delivered: byStatus('delivered'),
      dismissed: byStatus('dismissed'),
      completed: byStatus('completed'),
      pending: records.filter((item) => item.status === 'pending' || item.status === 'snoozed' || item.status === 'failed'),
      analytics,
      quietHours,
      nativeAvailable: native.available,
      nativeReason: native.reason,
    };
  }
}

export const NotificationEngine = new NotificationEngineImpl();
