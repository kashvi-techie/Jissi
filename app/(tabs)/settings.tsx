import React, { useState } from 'react';
import { ScrollView, StyleSheet, Switch, useWindowDimensions, View } from 'react-native';
import { Bell, Brain, FlaskConical, Gauge, Lock, Mic, Palette, Sparkles } from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import { Screen, GlassSurface, AppText, PressableScale } from '@/components/ui';
import { useTheme, useThemeMode } from '@/theme';
import { Radii, Spacing } from '@/theme/tokens';
import { HapticsService } from '@/services/haptics';

const SPEEDS = ['Calm', 'Natural', 'Fast'];
const WARMTH = ['Soft', 'Balanced', 'Bright'];
const STYLES = ['Concise', 'Natural', 'Detailed'];
const HUMOR = ['None', 'Light', 'Playful'];

export default function SettingsScreen() {
  const theme = useTheme();
  const { mode, toggle } = useThemeMode();
  const { width } = useWindowDimensions();
  const isWide = width >= 900;
  const [voiceSpeed, setVoiceSpeed] = useState('Natural');
  const [voiceWarmth, setVoiceWarmth] = useState('Balanced');
  const [style, setStyle] = useState('Natural');
  const [humor, setHumor] = useState('Light');
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [notifications, setNotifications] = useState(false);
  const [experimental, setExperimental] = useState(false);

  const hapticToggle = () => HapticsService.play('toggle');

  return (
    <Screen>
      <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <GlassSurface intensity={36} radius={Radii.circle} style={styles.badge}>
            <Sparkles size={30} color={theme.colors.textSecondary} strokeWidth={1.5} />
          </GlassSurface>
          <View style={styles.headerText}>
            <AppText variant="headline" color="primary">
              Settings
            </AppText>
            <AppText variant="body" color="muted">
              Tune JISSI's voice, personality and companion feel.
            </AppText>
          </View>
        </View>

        <SettingsBlock title="Voice" detail="Speech presentation only. AI logic stays unchanged." icon={Mic}>
          <Segmented label="Voice speed" value={voiceSpeed} options={SPEEDS} onChange={setVoiceSpeed} />
          <Segmented label="Voice warmth" value={voiceWarmth} options={WARMTH} onChange={setVoiceWarmth} />
        </SettingsBlock>

        <SettingsBlock title="Personality" detail="Local tone controls for future companion responses." icon={Sparkles}>
          <Segmented label="Conversation style" value={style} options={STYLES} onChange={setStyle} />
          <Segmented label="Humor level" value={humor} options={HUMOR} onChange={setHumor} />
        </SettingsBlock>

        <SettingsBlock title="Memory and privacy" detail="Ready for deeper controls as memory grows." icon={Lock}>
          <ToggleRow
            icon={Brain}
            title="Memory"
            detail="Allow JISSI to use saved preferences."
            value={memoryEnabled}
            onValueChange={(next) => {
              hapticToggle();
              setMemoryEnabled(next);
            }}
          />
        </SettingsBlock>

        <SettingsBlock title="Experience" detail="Premium interaction controls." icon={Palette}>
          <ToggleRow
            icon={Bell}
            title="Notifications"
            detail="Future proactive nudges and reminders."
            value={notifications}
            onValueChange={(next) => {
              hapticToggle();
              setNotifications(next);
            }}
          />
          <ToggleRow
            icon={Palette}
            title="Theme"
            detail={mode === 'dark' ? 'Dark mode active' : 'Light mode active'}
            value={mode === 'dark'}
            onValueChange={() => {
              hapticToggle();
              toggle();
            }}
          />
          <ToggleRow
            icon={FlaskConical}
            title="Experimental features"
            detail="Future AI settings, beta tools and companion labs."
            value={experimental}
            onValueChange={(next) => {
              hapticToggle();
              setExperimental(next);
            }}
          />
        </SettingsBlock>
      </ScrollView>
    </Screen>
  );
}

function SettingsBlock({
  title,
  detail,
  icon: Icon,
  children,
}: {
  title: string;
  detail: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  const theme = useTheme();
  return (
    <GlassSurface intensity={32} radius={Radii.xl} style={styles.block}>
      <View style={styles.blockHeader}>
        <View style={[styles.icon, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={18} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.headerText}>
          <AppText variant="bodyStrong" color="primary">
            {title}
          </AppText>
          <AppText variant="caption" color="muted">
            {detail}
          </AppText>
        </View>
      </View>
      <View style={styles.blockBody}>{children}</View>
    </GlassSurface>
  );
}

function Segmented({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.control}>
      <AppText variant="caption" color="muted" uppercase>
        {label}
      </AppText>
      <View style={styles.segmentRow}>
        {options.map((option) => {
          const selected = option === value;
          return (
            <PressableScale
              key={option}
              onPress={() => {
                HapticsService.play('toggle');
                onChange(option);
              }}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${option}`}
              style={styles.segmentWrap}
            >
              <View
                style={[
                  styles.segment,
                  {
                    backgroundColor: selected ? theme.colors.accentSoft : theme.colors.fill,
                    borderColor: selected ? theme.colors.accent : theme.colors.hairline,
                  },
                ]}
              >
                <AppText variant="caption" color={selected ? 'accent' : 'secondary'} numberOfLines={1}>
                  {option}
                </AppText>
              </View>
            </PressableScale>
          );
        })}
      </View>
    </View>
  );
}

function ToggleRow({
  title,
  detail,
  value,
  onValueChange,
  icon: Icon,
}: {
  title: string;
  detail: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  icon: LucideIcon;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <Icon size={18} color={theme.colors.textSecondary} strokeWidth={1.8} />
      <View style={styles.toggleText}>
        <AppText variant="bodyStrong" color="primary">
          {title}
        </AppText>
        <AppText variant="caption" color="muted">
          {detail}
        </AppText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.colors.fill, true: theme.colors.accentSoft }}
        thumbColor={value ? theme.colors.accent : theme.colors.textMuted}
        accessibilityLabel={`${title} toggle`}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.gutter, paddingTop: Spacing.xxxl, paddingBottom: 120, gap: Spacing.lg },
  contentWide: { maxWidth: 820, alignSelf: 'center', width: '100%' },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  headerText: { flex: 1, gap: Spacing.xs },
  badge: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  block: { padding: Spacing.lg, gap: Spacing.lg },
  blockHeader: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  blockBody: { gap: Spacing.lg },
  icon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  control: { gap: Spacing.sm },
  segmentRow: { flexDirection: 'row', gap: Spacing.sm },
  segmentWrap: { flex: 1 },
  segment: {
    minHeight: 44,
    borderRadius: Radii.md,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.sm,
  },
  toggleRow: { minHeight: 56, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  toggleText: { flex: 1, gap: Spacing.xs },
});
