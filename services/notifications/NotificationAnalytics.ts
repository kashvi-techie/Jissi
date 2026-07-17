import { NotificationHistory } from './NotificationHistory';
import type { NotificationAnalyticsSnapshot } from './NotificationTypes';

class NotificationAnalyticsImpl {
  async snapshot(): Promise<NotificationAnalyticsSnapshot> {
    const records = await NotificationHistory.list();
    const scheduled = records.filter((item) => item.status === 'scheduled').length;
    const delivered = records.filter((item) => item.status === 'delivered').length;
    const dismissed = records.filter((item) => item.status === 'dismissed').length;
    const completed = records.filter((item) => item.status === 'completed').length;
    const snoozed = records.filter((item) => item.status === 'snoozed').length;
    const failed = records.filter((item) => item.status === 'failed').length;
    const openedRate = delivered + completed > 0 ? completed / (delivered + completed) : 0;

    return {
      scheduled,
      delivered,
      dismissed,
      completed,
      snoozed,
      failed,
      openedRate,
      lastUpdated: new Date().toISOString(),
    };
  }
}

export const NotificationAnalytics = new NotificationAnalyticsImpl();
