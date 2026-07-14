import React, { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Battery, CheckCircle2, Download, Play, RefreshCw, Trash2, XCircle } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { CapabilityId, CapabilityManager, CapabilityResult, CapabilitySnapshot } from '@/services/capabilities';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const EMPTY: CapabilitySnapshot = { registered: [], history: [] };

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

function statusColor(status: string, theme: ReturnType<typeof useTheme>): string {
  if (status === 'supported') return theme.colors.accent;
  if (status === 'permission_required') return '#F6C85F';
  return theme.colors.error;
}

export default function CapabilitiesDebugScreen() {
  const theme = useTheme();
  const [snapshot, setSnapshot] = useState<CapabilitySnapshot>(EMPTY);
  const [selectedId, setSelectedId] = useState<CapabilityId>('network_status');
  const [payloadText, setPayloadText] = useState('');
  const [lastResult, setLastResult] = useState<CapabilityResult | null>(null);
  const [exportText, setExportText] = useState('');

  const load = useCallback(async () => {
    setSnapshot(await CapabilityManager.snapshot());
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const execute = async () => {
    let payload: Record<string, unknown> | undefined;
    try {
      payload = payloadText.trim() ? JSON.parse(payloadText) : undefined;
    } catch {
      Alert.alert('Invalid payload JSON', 'Fix the payload before executing.');
      return;
    }
    const result = await CapabilityManager.execute(selectedId, { payload, confirmed: true });
    setLastResult(result);
    await load();
  };

  const clear = async () => {
    await CapabilityManager.clearAnalytics();
    setLastResult(null);
    setExportText('');
    await load();
  };

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Battery size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Capabilities Debug
            </AppText>
            <AppText variant="body" color="muted">
              Registered platform capabilities, permissions, availability, platform support and last execution.
            </AppText>
          </View>
        </View>

        <GlassSurface intensity={24} radius={Radii.xl} style={styles.card}>
          <AppText variant="title" color="primary">
            Execute capability
          </AppText>
          <TextInput
            value={selectedId}
            onChangeText={(value) => setSelectedId(value as CapabilityId)}
            placeholder="maps"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <TextInput
            multiline
            value={payloadText}
            onChangeText={setPayloadText}
            placeholder={'{"phoneNumber":"+911234567890"}'}
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.payload, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <View style={styles.actions}>
            <DebugButton label="Execute" icon={Play} onPress={execute} />
            <DebugButton label="Refresh" icon={RefreshCw} onPress={load} />
            <DebugButton label="Export" icon={Download} onPress={async () => setExportText(JSON.stringify(await CapabilityManager.snapshot(), null, 2))} />
            <DebugButton label="Clear" icon={Trash2} onPress={clear} destructive />
          </View>
        </GlassSurface>

        {lastResult ? (
          <GlassSurface intensity={26} radius={Radii.xl} style={styles.card}>
            <View style={styles.row}>
              {lastResult.status === 'supported' ? (
                <CheckCircle2 size={20} color={theme.colors.accent} strokeWidth={1.8} />
              ) : (
                <XCircle size={20} color={statusColor(lastResult.status, theme)} strokeWidth={1.8} />
              )}
              <View style={styles.flex}>
                <AppText variant="title" color="primary">
                  Last execution
                </AppText>
                <AppText variant="caption" color="muted">
                  {lastResult.message}
                </AppText>
              </View>
            </View>
            <Line label="Capability" value={label(lastResult.capabilityId)} />
            <Line label="Status" value={label(lastResult.status)} />
            <Line label="Reason" value={lastResult.reason} />
            <Line label="Duration" value={`${lastResult.durationMs}ms`} />
          </GlassSurface>
        ) : null}

        <Section title="Registered capabilities" count={snapshot.registered.length}>
          {snapshot.registered.map((item) => (
            <PressableScale key={item.id} onPress={() => setSelectedId(item.id)} accessibilityRole="button" accessibilityLabel={item.displayName}>
              <GlassSurface intensity={22} radius={Radii.lg} style={styles.capabilityCard}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: statusColor(item.availability.status, theme) }]} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" color="primary">
                      {item.displayName}
                    </AppText>
                    <AppText variant="caption" color="muted">
                      {item.description}
                    </AppText>
                  </View>
                  <AppText variant="caption" color="secondary" style={styles.capitalize}>
                    {label(item.availability.status)}
                  </AppText>
                </View>
                <Line label="Permission state" value={label(item.permissionState)} />
                <Line label="Supported platforms" value={item.supportedPlatforms.join(', ')} />
                <Line label="Availability" value={item.availability.reason} />
                <Line label="Validation" value={item.validation.reason} />
                <Line label="Execution time" value={item.lastExecution ? `${item.lastExecution.durationMs}ms` : 'Never'} />
                <Line label="Last success" value={item.lastSuccess ? `${new Date(item.lastSuccess.timestamp).toLocaleString()} · ${item.lastSuccess.reason}` : 'None'} />
                <Line label="Last failure" value={item.lastFailure ? `${label(item.lastFailure.status)} · ${item.lastFailure.reason}` : 'None'} />
                <Line label="Platform notes" value={item.platformNotes ?? 'No extra notes.'} />
              </GlassSurface>
            </PressableScale>
          ))}
        </Section>

        {exportText ? (
          <TextInput
            multiline
            editable={false}
            value={exportText}
            style={[styles.exportBox, { color: theme.colors.textSecondary, borderColor: theme.colors.hairline }]}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function DebugButton({ label: buttonLabel, icon: Icon, destructive, onPress }: { label: string; icon: typeof Play; destructive?: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={buttonLabel} style={[styles.button, { backgroundColor: destructive ? 'rgba(255,92,92,0.11)' : theme.colors.accentSoft }]}>
      <Icon size={16} color={destructive ? theme.colors.error : theme.colors.accent} strokeWidth={1.9} />
      <AppText variant="caption" color={destructive ? theme.colors.error : 'accent'}>
        {buttonLabel}
      </AppText>
    </PressableScale>
  );
}

function Section({ title, count, children }: { title: string; count?: number; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText variant="title" color="primary">
          {title}
        </AppText>
        {count !== undefined ? (
          <AppText variant="caption" color="muted">
            {count}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function Line({ label: lineLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="footnote" color="muted">
        {lineLabel}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { width: '100%', maxWidth: 980, alignSelf: 'center', paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' },
  card: { gap: Spacing.md, padding: Spacing.lg },
  input: { minHeight: 48, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, paddingHorizontal: Spacing.md, fontSize: 15 },
  payload: { minHeight: 110, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 13, textAlignVertical: 'top' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  button: { minHeight: 42, borderRadius: Radii.pill, flexDirection: 'row', alignItems: 'center', gap: Spacing.xs, paddingHorizontal: Spacing.md },
  section: { gap: Spacing.md },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  capabilityCard: { gap: Spacing.sm, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  line: { gap: 4 },
  lineValue: { flexShrink: 1 },
  capitalize: { textTransform: 'capitalize' },
  exportBox: { minHeight: 260, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontSize: 12, textAlignVertical: 'top' },
});
