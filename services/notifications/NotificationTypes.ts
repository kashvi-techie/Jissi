export type JissiNotificationCategory =
  | 'planner_reminder'
  | 'daily_brief'
  | 'birthday'
  | 'relationship_reminder'
  | 'goal_reminder'
  | 'habit_reminder'
  | 'custom_reminder';

export type JissiNotificationStatus =
  | 'pending'
  | 'scheduled'
  | 'delivered'
  | 'dismissed'
  | 'completed'
  | 'snoozed'
  | 'cancelled'
  | 'failed';

export type JissiSnoozeOption = '10_min' | '30_min' | '1_hour' | 'tomorrow';

export interface QuietHoursWindow {
  enabled: boolean;
  startHour: number;
  endHour: number;
}

export interface JissiNotificationPayload {
  title: string;
  body: string;
  category: JissiNotificationCategory;
  scheduledFor: string;
  data?: Record<string, string | number | boolean | null>;
  dedupeKey?: string;
}

export interface JissiNotificationRecord extends JissiNotificationPayload {
  id: string;
  nativeId: string | null;
  status: JissiNotificationStatus;
  createdAt: string;
  updatedAt: string;
  deliveredAt?: string;
  completedAt?: string;
  dismissedAt?: string;
  failureReason?: string;
  snoozedFromId?: string;
}

export interface NotificationScheduleResult {
  ok: boolean;
  record: JissiNotificationRecord | null;
  reason?: string;
}

export interface NotificationAnalyticsSnapshot {
  scheduled: number;
  delivered: number;
  dismissed: number;
  completed: number;
  snoozed: number;
  failed: number;
  openedRate: number;
  lastUpdated: string;
}

export interface NotificationCenterSnapshot {
  scheduled: JissiNotificationRecord[];
  delivered: JissiNotificationRecord[];
  dismissed: JissiNotificationRecord[];
  completed: JissiNotificationRecord[];
  pending: JissiNotificationRecord[];
  analytics: NotificationAnalyticsSnapshot;
  quietHours: QuietHoursWindow;
  nativeAvailable: boolean;
  nativeReason: string | null;
}
