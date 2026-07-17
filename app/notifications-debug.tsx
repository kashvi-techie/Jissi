import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { BellRing, Clock, RefreshCw } from 'lucide-react-native';
import { AppText, GlassSurface, Screen } from '@/components/ui';
import { NotificationEngine, NotificationCenterSnapshot, JissiNotificationRecord } from '@/services/notifications';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

export default function NotificationsDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<NotificationCenterSnapshot | null>(null);
  const [message, setMessage] = useState<string>('Loading notification center...');

  const refresh = async () => {
    const next = await NotificationEngine.getCenterSnapshot();
    setSnapshot(next);
    setMessage(next.nativeAvailable ? 'Native notification module available.' : next.nativeReason ?? 'Native notification module unavailable.');
  };

  const scheduleTest = async () => {
    const result = await NotificationEngine.schedule({
      title: 'JISSI reminder',
      body: 'This is a local notification test.',
      category: 'custom_reminder',
      scheduledFor: new Date(Date.now() + 60 * 1000).toISOString(),
      dedupeKey: `debug-test:${new Date().toISOString().slice(0, 10)}`,
    });
    setMessage(result.reason ?? (result.ok ? 'Test notification scheduled.' : 'Notification scheduling failed.'));
    await refresh();
  };

  useEffect(() => {
    void refresh();
  }, []);

  const analytics = snapshot?.analytics;

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={34} radius={Radii.circle} style={styles.badge}>
            <BellRing size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText style={styles.title} color="primary">
              Notifications Debug
            </AppText>
            <AppText variant="caption" color="muted">
              Local reminders, quiet hours and delivery analytics.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={28} radius={Radii.xl} style={styles.card}>
          <Line label="Native status" value={snapshot?.nativeAvailable ? 'Available' : 'Unavailable'} />
          <Line label="Reason" value={message} />
          <Line
            label="Quiet hours"
            value={snapshot ? `${snapshot.quietHours.enabled ? 'On' : 'Off'} · ${snapshot.quietHours.startHour}:00-${snapshot.quietHours.endHour}:00` : 'Loading'}
          />
          <View style={styles.actions}>
            <Pressable onPress={refresh} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <RefreshCw size={16} color={theme.colors.textPrimary} strokeWidth={1.8} />
              <AppText variant="caption" color="primary">
                Refresh
              </AppText>
            </Pressable>
            <Pressable onPress={scheduleTest} style={({ pressed }) => [styles.action, pressed && styles.pressed]}>
              <Clock size={16} color={theme.colors.textPrimary} strokeWidth={1.8} />
              <AppText variant="caption" color="primary">
                Test in 1 min
              </AppText>
            </Pressable>
          </View>
        </GlassSurface>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="bodyStrong" color="primary">
            Analytics
          </AppText>
          <Line label="Scheduled" value={String(analytics?.scheduled ?? 0)} />
          <Line label="Delivered" value={String(analytics?.delivered ?? 0)} />
          <Line label="Dismissed" value={String(analytics?.dismissed ?? 0)} />
          <Line label="Completed" value={String(analytics?.completed ?? 0)} />
          <Line label="Snoozed" value={String(analytics?.snoozed ?? 0)} />
          <Line label="Failed" value={String(analytics?.failed ?? 0)} />
          <Line label="Opened rate" value={`${Math.round((analytics?.openedRate ?? 0) * 100)}%`} />
        </GlassSurface>

        <Section title="Scheduled" records={snapshot?.scheduled ?? []} />
        <Section title="Delivered" records={snapshot?.delivered ?? []} />
        <Section title="Completed" records={snapshot?.completed ?? []} />
        <Section title="Dismissed" records={snapshot?.dismissed ?? []} />
        <Section title="Pending / Failed / Snoozed" records={snapshot?.pending ?? []} />
      </ScrollView>
    </Screen>
  );
}

function Section({ title, records }: { title: string; records: JissiNotificationRecord[] }) {
  return (
    <View style={styles.section}>
      <AppText variant="label" color="muted" uppercase>
        {title}
      </AppText>
      {records.length === 0 ? (
        <GlassSurface intensity={18} radius={Radii.lg} style={styles.empty}>
          <AppText variant="caption" color="muted">
            Nothing here yet.
          </AppText>
        </GlassSurface>
      ) : (
        records.map((record) => (
          <GlassSurface key={record.id} intensity={18} radius={Radii.lg} style={styles.record}>
            <AppText variant="bodyStrong" color="primary">
              {record.title}
            </AppText>
            <AppText variant="caption" color="muted">
              {record.body}
            </AppText>
            <AppText variant="footnote" color="tertiary">
              {record.category} · {record.status} · {formatDate(record.scheduledFor)}
            </AppText>
            {record.failureReason ? (
              <AppText variant="footnote" color="muted">
                {record.failureReason}
              </AppText>
            ) : null}
          </GlassSurface>
        ))
      )}
    </View>
  );
}

function Line({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {label}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: 56, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.lg },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  title: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: 0 },
  card: { padding: Spacing.lg, gap: Spacing.md },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  action: {
    minHeight: 44,
    borderRadius: Radii.lg,
    paddingHorizontal: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pressed: { opacity: 0.78, transform: [{ scale: 0.98 }] },
  line: { gap: 4 },
  lineValue: { lineHeight: 21 },
  section: { gap: Spacing.md },
  empty: { padding: Spacing.md },
  record: { padding: Spacing.md, gap: Spacing.xs },
});
