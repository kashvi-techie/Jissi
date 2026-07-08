import React, { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeIn, FadeOut, SlideInRight, SlideOutLeft } from 'react-native-reanimated';
import { Check, Sparkles } from 'lucide-react-native';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { AppText, GlassSurface, PressableScale, Screen } from '@/components/ui';
import { OnboardingPersonality, OnboardingRole, OnboardingService } from '@/services/onboarding';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const TOTAL_STEPS = 7;
const ROLES: OnboardingRole[] = ['Student', 'Developer', 'Designer', 'Founder', 'Professional'];
const PERSONALITIES: OnboardingPersonality[] = ['Calm', 'Friendly', 'Mentor', 'Funny', 'Professional'];
const INTERESTS = ['AI', 'Coding', 'Design', 'Startups', 'Study', 'Fitness', 'Productivity', 'Interviews'];
const GOAL_EXAMPLES = ['Crack GATE', 'Build a startup', 'Learn React', 'Fitness'];

export default function OnboardingScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [nickname, setNickname] = useState('');
  const [roles, setRoles] = useState<OnboardingRole[]>([]);
  const [interests, setInterests] = useState<string[]>([]);
  const [goal, setGoal] = useState('');
  const [personality, setPersonality] = useState<OnboardingPersonality>('Friendly');
  const [saving, setSaving] = useState(false);
  const isWide = width >= 820;
  const displayName = nickname.trim() || name.trim() || 'there';
  const progress = (step + 1) / TOTAL_STEPS;

  const canContinue = useMemo(() => {
    if (step === 2) return name.trim().length >= 2;
    if (step === 3) return roles.length > 0 || interests.length > 0;
    if (step === 4) return goal.trim().length >= 2;
    if (step === 5) return !!personality;
    return true;
  }, [goal, interests.length, name, personality, roles.length, step]);

  const finish = async (skipped = false) => {
    if (saving) return;
    setSaving(true);
    await OnboardingService.complete({
      name,
      nickname,
      roles,
      interests,
      goal,
      personality,
      skipped,
    });
    router.replace('/(tabs)' as never);
  };

  const next = async () => {
    if (step >= TOTAL_STEPS - 1) {
      await finish(false);
      return;
    }
    setStep((current) => current + 1);
  };

  const skip = async () => {
    await finish(true);
  };

  const toggleRole = (role: OnboardingRole) => {
    setRoles((current) => current.includes(role) ? current.filter((item) => item !== role) : [...current, role]);
  };

  const toggleInterest = (interest: string) => {
    setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]);
  };

  return (
    <Screen padded={false}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}>
        <View pointerEvents="none" style={styles.glow} />
        <View style={styles.topBar}>
          <Progress value={progress} />
          <PressableScale onPress={skip} accessibilityRole="button" accessibilityLabel="Skip onboarding">
            <AppText variant="caption" color="muted">
              Skip
            </AppText>
          </PressableScale>
        </View>

        <ScrollView contentContainerStyle={[styles.content, isWide && styles.contentWide]} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <Animated.View
            key={step}
            entering={FadeIn.duration(220).delay(40).springify().damping(18)}
            exiting={FadeOut.duration(120)}
            style={[styles.step, isWide && styles.stepWide]}
          >
            {step === 0 ? (
              <View style={styles.centered}>
                <Animated.View entering={SlideInRight.duration(360).springify().damping(18)} exiting={SlideOutLeft.duration(160)} style={styles.orbWrap}>
                  <OrbEngine state="idle" size={Math.min(width * 0.52, 280)} />
                </Animated.View>
                <AppText style={styles.heroTitle} color="primary">
                  Meet JISSI.
                </AppText>
                <AppText style={styles.heroSubtitle} color="muted">
                  Your AI that grows with you.
                </AppText>
              </View>
            ) : null}

            {step === 1 ? (
              <View style={styles.stack}>
                <StepHeader title="JISSI learns quietly." subtitle="Built to feel helpful without feeling invasive." />
                <View style={styles.cardGrid}>
                  {[
                    'Learns your routines',
                    'Remembers your journey',
                    'Helps with goals',
                    'Everything stays on your device',
                  ].map((item, index) => (
                    <Animated.View key={item} entering={FadeIn.delay(index * 80)}>
                      <GlassSurface intensity={24} radius={Radii.lg} style={styles.featureCard}>
                        <View style={[styles.check, { backgroundColor: theme.colors.accentSoft }]}>
                          <Check size={16} color={theme.colors.accent} strokeWidth={2.2} />
                        </View>
                        <AppText variant="bodyStrong" color="primary">
                          {item}
                        </AppText>
                      </GlassSurface>
                    </Animated.View>
                  ))}
                </View>
              </View>
            ) : null}

            {step === 2 ? (
              <View style={styles.stack}>
                <StepHeader title="What should I call you?" subtitle="This stays local and helps JISSI feel personal." />
                <GlassSurface intensity={28} radius={Radii.xl} style={styles.formCard}>
                  <LabeledInput label="Name" value={name} onChangeText={setName} placeholder="Kashvi" autoCapitalize="words" />
                  <LabeledInput label="Nickname optional" value={nickname} onChangeText={setNickname} placeholder="Kash" autoCapitalize="words" />
                </GlassSurface>
              </View>
            ) : null}

            {step === 3 ? (
              <View style={styles.stack}>
                <StepHeader title="Which describes you best?" subtitle="Choose one or more, then add what you care about." />
                <ChipGroup items={ROLES} selected={roles} onToggle={toggleRole} />
                <View style={styles.divider} />
                <AppText variant="caption" color="muted">
                  Interests
                </AppText>
                <ChipGroup items={INTERESTS} selected={interests} onToggle={toggleInterest} />
              </View>
            ) : null}

            {step === 4 ? (
              <View style={styles.stack}>
                <StepHeader title="What's one goal you're working toward?" subtitle="JISSI will turn this into a local starter plan." />
                <GlassSurface intensity={28} radius={Radii.xl} style={styles.formCard}>
                  <LabeledInput label="Current goal" value={goal} onChangeText={setGoal} placeholder="Learn React" />
                  <View style={styles.examples}>
                    {GOAL_EXAMPLES.map((item) => (
                      <Chip key={item} label={item} active={goal === item} onPress={() => setGoal(item)} />
                    ))}
                  </View>
                </GlassSurface>
              </View>
            ) : null}

            {step === 5 ? (
              <View style={styles.stack}>
                <StepHeader title="Choose JISSI's personality." subtitle="You can change this later as JISSI grows with you." />
                <ChipGroup items={PERSONALITIES} selected={[personality]} onToggle={(item) => setPersonality(item as OnboardingPersonality)} single />
              </View>
            ) : null}

            {step === 6 ? (
              <View style={styles.centered}>
                <GlassSurface intensity={34} radius={Radii.xxxl} style={styles.finalCard}>
                  <Sparkles size={28} color={theme.colors.accent} strokeWidth={1.7} />
                  <AppText style={styles.finalTitle} color="primary">
                    Hi {displayName}.
                  </AppText>
                  <AppText style={styles.finalCopy} color="secondary">
                    I'm excited to learn alongside you. Your memory, goals, routines and preferences start here, privately on this device.
                  </AppText>
                  <AppText style={styles.finalCopy} color="accent">
                    Let's build something amazing.
                  </AppText>
                </GlassSurface>
              </View>
            ) : null}
          </Animated.View>
        </ScrollView>

        <View style={styles.footer}>
          {step > 0 ? (
            <PressableScale onPress={() => setStep((current) => Math.max(0, current - 1))} accessibilityRole="button" accessibilityLabel="Back" style={styles.secondaryButton}>
              <AppText variant="bodyStrong" color="muted">
                Back
              </AppText>
            </PressableScale>
          ) : <View style={styles.secondaryButton} />}
          <PressableScale
            onPress={next}
            disabled={!canContinue || saving}
            accessibilityRole="button"
            accessibilityLabel={step === 0 ? 'Get Started' : step === TOTAL_STEPS - 1 ? 'Enter JISSI' : 'Continue'}
            style={[styles.primaryButton, { opacity: canContinue && !saving ? 1 : 0.45, backgroundColor: theme.colors.accent }]}
          >
            <AppText variant="bodyStrong" color="onAccent">
              {saving ? 'Saving...' : step === 0 ? 'Get Started' : step === TOTAL_STEPS - 1 ? 'Enter JISSI' : 'Continue'}
            </AppText>
          </PressableScale>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Progress({ value }: { value: number }) {
  const theme = useTheme();
  return (
    <View style={[styles.progressTrack, { backgroundColor: theme.colors.hairline }]}>
      <Animated.View style={[styles.progressFill, { width: `${Math.round(value * 100)}%`, backgroundColor: theme.colors.accent }]} />
    </View>
  );
}

function StepHeader({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <View style={styles.header}>
      <AppText style={styles.title} color="primary">
        {title}
      </AppText>
      <AppText style={styles.subtitle} color="muted">
        {subtitle}
      </AppText>
    </View>
  );
}

function LabeledInput({ label, ...props }: { label: string } & React.ComponentProps<typeof TextInput>) {
  const theme = useTheme();
  return (
    <View style={styles.inputGroup}>
      <AppText variant="caption" color="muted">
        {label}
      </AppText>
      <TextInput
        {...props}
        placeholderTextColor={theme.colors.textTertiary}
        style={[styles.input, { color: theme.colors.textPrimary, borderColor: theme.colors.hairline }]}
      />
    </View>
  );
}

function ChipGroup<T extends string>({
  items,
  selected,
  single,
  onToggle,
}: {
  items: T[];
  selected: string[];
  single?: boolean;
  onToggle: (item: T) => void;
}) {
  return (
    <View style={styles.chips}>
      {items.map((item) => (
        <Chip key={item} label={item} active={selected.includes(item)} onPress={() => onToggle(item)} />
      ))}
    </View>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={label}>
      <GlassSurface
        intensity={active ? 42 : 20}
        radius={Radii.pill}
        style={[
          styles.chip,
          {
            borderColor: active ? theme.colors.accent : theme.glass.border,
            backgroundColor: active ? theme.colors.accentSoft : theme.glass.fill,
          },
        ]}
      >
        <AppText variant="caption" color={active ? 'accent' : 'secondary'}>
          {label}
        </AppText>
      </GlassSurface>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  glow: {
    position: 'absolute',
    top: 80,
    alignSelf: 'center',
    width: 320,
    height: 420,
    borderRadius: 180,
    backgroundColor: 'rgba(0,120,220,0.13)',
  },
  topBar: { minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingHorizontal: Spacing.gutter, paddingTop: Spacing.lg },
  progressTrack: { flex: 1, height: 4, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 999 },
  content: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: Spacing.gutter, paddingVertical: Spacing.xl },
  contentWide: { alignItems: 'center' },
  step: { width: '100%', minHeight: 440, justifyContent: 'center' },
  stepWide: { maxWidth: 760 },
  centered: { alignItems: 'center', justifyContent: 'center', gap: Spacing.xl },
  orbWrap: { width: 300, height: 300, alignItems: 'center', justifyContent: 'center' },
  heroTitle: { fontFamily: Fonts.bodyBold, fontSize: 48, lineHeight: 56, letterSpacing: 0, textAlign: 'center' },
  heroSubtitle: { fontFamily: Fonts.bodyMedium, fontSize: 20, lineHeight: 28, letterSpacing: 0, textAlign: 'center' },
  stack: { gap: Spacing.xl },
  header: { gap: Spacing.sm },
  title: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 42, letterSpacing: 0 },
  subtitle: { fontFamily: Fonts.bodyMedium, fontSize: 17, lineHeight: 25, letterSpacing: 0 },
  cardGrid: { gap: Spacing.md },
  featureCard: { minHeight: 78, padding: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  check: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  formCard: { padding: Spacing.lg, gap: Spacing.lg },
  inputGroup: { gap: Spacing.sm },
  input: { minHeight: 54, borderWidth: StyleSheet.hairlineWidth, borderRadius: Radii.lg, paddingHorizontal: Spacing.lg, fontFamily: Fonts.bodyMedium, fontSize: 17 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.md },
  chip: { minHeight: 42, paddingHorizontal: Spacing.lg, alignItems: 'center', justifyContent: 'center' },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.08)' },
  examples: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  finalCard: { width: '100%', padding: Spacing.xxl, gap: Spacing.lg, alignItems: 'flex-start' },
  finalTitle: { fontFamily: Fonts.bodyBold, fontSize: 34, lineHeight: 40, letterSpacing: 0 },
  finalCopy: { fontFamily: Fonts.bodyMedium, fontSize: 18, lineHeight: 27, letterSpacing: 0 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.md, paddingHorizontal: Spacing.gutter, paddingBottom: Spacing.xxl, paddingTop: Spacing.md },
  secondaryButton: { minWidth: 90, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minWidth: 164, minHeight: 54, borderRadius: Radii.pill, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.xl },
});
