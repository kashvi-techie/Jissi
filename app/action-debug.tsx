import React, { useMemo, useState } from 'react';
import { Alert, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { ShieldCheck, Smartphone } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { ActionExecutor, ActionRegistry, AndroidActionResult, AndroidActionType } from '@/services/android-actions';
import { useTheme } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';

const SAMPLE_PAYLOAD: Record<AndroidActionType, string> = {
  open_app: JSON.stringify({ packageName: 'com.android.settings', appName: 'Settings' }, null, 2),
  launch_url: JSON.stringify({ url: 'https://jissi.local' }, null, 2),
  call_contact: JSON.stringify({ phoneNumber: '+911234567890', contactName: 'Mom' }, null, 2),
  send_sms: JSON.stringify({ phoneNumber: '+911234567890', contactName: 'Mom', message: 'Reached safely.' }, null, 2),
  flashlight: '{}',
  brightness: JSON.stringify({ value: 0.7 }, null, 2),
  volume: JSON.stringify({ value: 0.5 }, null, 2),
  clipboard: JSON.stringify({ text: 'JISSI copied this locally.' }, null, 2),
  share_text: JSON.stringify({ text: 'Sharing from JISSI.' }, null, 2),
  open_settings: '{}',
  wifi_settings: '{}',
  bluetooth_settings: '{}',
  battery_settings: '{}',
};

function label(value: string): string {
  return value.replace(/_/g, ' ');
}

export default function ActionDebugScreen() {
  const theme = useTheme();
  const actions = useMemo(() => ActionRegistry.list(), []);
  const [selected, setSelected] = useState<AndroidActionType>('open_app');
  const [payloadText, setPayloadText] = useState(SAMPLE_PAYLOAD.open_app);
  const [lastResult, setLastResult] = useState<AndroidActionResult | null>(null);

  const selectedDefinition = ActionRegistry.get(selected);

  const select = (type: AndroidActionType) => {
    setSelected(type);
    setPayloadText(SAMPLE_PAYLOAD[type]);
    setLastResult(null);
  };

  const parsePayload = () => {
    try {
      return JSON.parse(payloadText || '{}');
    } catch {
      return null;
    }
  };

  const execute = async (confirmed = false) => {
    const payload = parsePayload();
    if (!payload) {
      setLastResult({
        id: 'local_parse_error',
        type: selected,
        status: 'failed',
        message: 'Payload JSON is invalid.',
        reason: 'The debug screen could not parse the payload.',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = await ActionExecutor.execute({ type: selected, payload, confirmed });
    setLastResult(result);
    if (result.status === 'pending_confirmation') {
      Alert.alert(result.confirmationPrompt ?? result.message, result.reason, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Yes', onPress: () => execute(true) },
      ]);
    }
  };

  const permission = ActionExecutor.checkPermissions({ type: selected, payload: parsePayload() ?? undefined });

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Smartphone size={28} color={theme.colors.accent} strokeWidth={1.7} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Action Debug
            </AppText>
            <AppText variant="body" color="muted">
              Android action registry, permissions, confirmation and graceful failure checks.
            </AppText>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {actions.map((action) => (
            <PressableScale key={action.type} onPress={() => select(action.type)} accessibilityRole="button" accessibilityState={{ selected: selected === action.type }}>
              <GlassSurface
                intensity={selected === action.type ? 42 : 20}
                radius={Radii.pill}
                style={[styles.chip, { borderColor: selected === action.type ? theme.colors.accent : theme.glass.border }]}
              >
                <AppText variant="caption" color={selected === action.type ? 'accent' : 'secondary'} style={styles.capitalize}>
                  {label(action.type)}
                </AppText>
              </GlassSurface>
            </PressableScale>
          ))}
        </ScrollView>

        {selectedDefinition ? (
          <GlassSurface intensity={26} radius={Radii.xl} style={styles.card}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="title" color="primary">
                  {selectedDefinition.label}
                </AppText>
                <AppText variant="caption" color="muted" style={styles.capitalize}>
                  {selectedDefinition.risk}
                </AppText>
              </View>
              <ShieldCheck size={20} color={permission.allowed ? theme.colors.accent : theme.colors.error} strokeWidth={1.8} />
            </View>
            <AppText variant="body" color="secondary">
              {selectedDefinition.description}
            </AppText>
            <Line label="Permission" value={permission.reason} />
            <Line label="Required payload" value={selectedDefinition.requiredPayload.join(', ') || 'None'} />
          </GlassSurface>
        ) : null}

        <View style={styles.section}>
          <AppText variant="title" color="primary">
            Payload JSON
          </AppText>
          <TextInput
            multiline
            value={payloadText}
            onChangeText={setPayloadText}
            placeholder="{}"
            placeholderTextColor={theme.colors.textMuted}
            style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
          />
          <PressableScale onPress={() => execute(false)} accessibilityRole="button" accessibilityLabel="Execute action" style={[styles.executeButton, { backgroundColor: theme.colors.accent }]}>
            <AppText variant="bodyStrong" color="onAccent">
              Execute
            </AppText>
          </PressableScale>
        </View>

        {lastResult ? (
          <GlassSurface intensity={26} radius={Radii.xl} style={styles.card}>
            <Line label="Status" value={lastResult.status} />
            <Line label="Message" value={lastResult.message} />
            <Line label="Reason" value={lastResult.reason} />
            <Line label="Time" value={new Date(lastResult.timestamp).toLocaleString()} />
          </GlassSurface>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Line({ label: lineLabel, value }: { label: string; value: string }) {
  return (
    <View style={styles.line}>
      <AppText variant="caption" color="muted">
        {lineLabel}
      </AppText>
      <AppText variant="caption" color="primary" style={styles.lineValue}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.xl, maxWidth: 980, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  headerText: { flex: 1, gap: Spacing.xs },
  chips: { gap: Spacing.sm, paddingRight: Spacing.gutter },
  chip: { minHeight: 40, justifyContent: 'center', paddingHorizontal: Spacing.lg },
  capitalize: { textTransform: 'capitalize' },
  card: { gap: Spacing.md, padding: Spacing.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  flex: { flex: 1, gap: Spacing.xs },
  line: { gap: Spacing.xs },
  lineValue: { flexShrink: 1 },
  section: { gap: Spacing.md },
  input: { minHeight: 154, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, padding: Spacing.md, fontFamily: 'Inter_400Regular', fontSize: 14, textAlignVertical: 'top' },
  executeButton: { minHeight: 48, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
});
