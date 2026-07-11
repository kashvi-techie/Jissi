import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  Brain,
  CalendarCheck2,
  CalendarClock,
  Clock,
  Home,
  Languages,
  MessageCircle,
  MessageSquare,
  PanelLeft,
  Repeat,
  Settings,
  Sparkles,
  Target,
  Trophy,
  User,
  Users,
} from 'lucide-react-native';
import type { LucideIcon } from 'lucide-react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { SpeechState } from '@/services/speech/types';
import { TTSService } from '@/services/voice';
import { ProactiveExperience, ProactiveSuggestion } from '@/services/proactive';
import { OnboardingService } from '@/services/onboarding';
import { LifeDecision, LifeEngine } from '@/services/life';
import type { LifeActionType } from '@/services/life';
import { PlannerEngine } from '@/services/planner';
import { EmotionEngine } from '@/services/emotion';
import type { EmotionState } from '@/services/emotion';
import { ContextEngine } from '@/services/context';
import { BehaviorEngine } from '@/services/behavior';
import { TimelineService } from '@/services/timeline';
import { DelightService, DelightAchievement, DelightSnapshot } from '@/services/delight';
import { AssistantState } from '@/hooks/useConversation';
import { useConversationMode } from '@/hooks/useConversationMode';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { VoiceWave } from '@/components/VoiceWave';
import { TalkView } from '@/components/TalkView';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { AppText, GlassSurface, PressableScale, Screen, VoiceButton, VoiceButtonState } from '@/components/ui';
import { ConversationTimeline } from '@/components/ConversationTimeline';
import { AchievementToast, DailyQuoteCard } from '@/components/delight/DelightSurfaces';
import { AmbientPresence, PresenceField } from '@/components/presence/PresenceEngine';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const WIDE_BREAKPOINT = 900;

type Phase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'tool_execution' | 'offline' | 'error';
type HomeSuggestion =
  | { kind: 'life'; decision: LifeDecision; title: string; message: string; action: LifeDecision['action'] }
  | { kind: 'proactive'; suggestion: ProactiveSuggestion; title: string; message: string; action: ProactiveSuggestion['action'] };

function computePhase(s: SpeechState, a: AssistantState, supported: boolean): Phase {
  if (!supported) return 'offline';
  if (s === 'error') return 'error';
  if (a === 'thinking') return 'thinking';
  if (a === 'speaking') return 'speaking';
  if (s === 'listening') return 'listening';
  if (s === 'processing') return 'tool_execution';
  return 'idle';
}

function phaseToOrb(p: Phase): OrbState {
  if (p === 'listening') return 'listening';
  if (p === 'tool_execution') return 'tool_execution';
  if (p === 'offline') return 'offline';
  if (p === 'error') return 'error';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function phaseToVoice(p: Phase, supported: boolean): VoiceButtonState {
  if (!supported || p === 'offline') return 'offline';
  if (p === 'listening') return 'listening';
  if (p === 'tool_execution') return 'tool_execution';
  if (p === 'error') return 'error';
  if (p === 'thinking' || p === 'processing') return 'thinking';
  if (p === 'speaking') return 'speaking';
  return 'idle';
}

function statusShort(p: Phase, supported: boolean): string {
  if (!supported) return "I'm offline right now, but I'll be ready as soon as we're connected.";
  switch (p) {
    case 'offline':
      return "I'm offline right now, but I'll be ready as soon as we're connected.";
    case 'listening':
      return 'Listening...';
    case 'tool_execution':
      return 'Using tools...';
    case 'thinking':
    case 'processing':
      return 'Thinking...';
    case 'speaking':
      return 'Speaking...';
    case 'error':
      return "I couldn't hear that. Let's try again.";
    default:
      return 'Ready';
  }
}

const PROMPT_CARDS: { text: string; icon: LucideIcon }[] = [
  { text: 'Settle a debate: how should you store bread?', icon: Sparkles },
  { text: 'Give me phrases to learn a new language', icon: Languages },
  { text: 'Help create a weekly meal plan for two', icon: CalendarClock },
  { text: 'Help me draft a response to a friend', icon: MessageCircle },
];

interface MobileDashboard {
  greeting: string;
  goalTitle: string;
  progressLabel: string;
  moodLabel: string;
  focusLabel: string;
  behaviorLabel: string;
  relationshipLabel: string;
  lifeLabel: string;
  achievementLabel: string;
  timelineLabel: string;
}

function greetingFor(name?: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';
  return name ? `${part} ${name}` : part;
}

export default function HomeScreen() {
  const {
    speechState,
    assistantState,
    transcript,
    interimTranscript,
    messages,
    error,
    isSupported,
    stop,
    toggle,
    sendPrompt,
  } = useConversationMode();

  const theme = useTheme();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isWide = width >= WIDE_BREAKPOINT;
  const [talkOpen, setTalkOpen] = useState(false);
  const [suggestion, setSuggestion] = useState<HomeSuggestion | null>(null);
  const [dashboard, setDashboard] = useState<MobileDashboard>({
    greeting: greetingFor(),
    goalTitle: 'Choose a goal',
    progressLabel: '0% today',
    moodLabel: 'Neutral',
    focusLabel: 'Ready',
    behaviorLabel: 'No routine yet',
    relationshipLabel: 'No people yet',
    lifeLabel: 'Listening for patterns',
    achievementLabel: 'No achievement yet',
    timelineLabel: 'Timeline is warming up',
  });
  const [delight, setDelight] = useState<DelightSnapshot | null>(null);
  const [celebration, setCelebration] = useState<DelightAchievement | null>(null);
  const [presenceEmotion, setPresenceEmotion] = useState<EmotionState>('neutral');

  const openTopic = (text: string) => {
    setTalkOpen(true);
    sendPrompt(text);
  };
  const closeTalk = () => {
    stop();
    setTalkOpen(false);
  };
  const goHistory = () => router.push('/(tabs)/history' as never);

  const phase = computePhase(speechState, assistantState, isSupported);
  const canSuggest = phase === 'idle' && !talkOpen;

  useEffect(() => {
    let cancelled = false;
    const checkOnboarding = async () => {
      const complete = await OnboardingService.isComplete();
      if (!cancelled && !complete) {
        router.replace('/onboarding' as never);
      }
    };
    checkOnboarding();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      const [profile, planner, emotion, context, behavior, timeline, delightSnapshot] = await Promise.all([
        OnboardingService.getProfile(),
        PlannerEngine.getSnapshot().catch(() => null),
        EmotionEngine.getCurrentEmotion().catch(() => null),
        ContextEngine.getCurrentContext().catch(() => null),
        BehaviorEngine.getSnapshot().catch(() => null),
        TimelineService.getSnapshot().catch(() => null),
        DelightService.getSnapshot().catch(() => null),
      ]);
      if (cancelled) return;
      const activeGoal = planner?.goals.find((goal) => goal.status !== 'completed') ?? planner?.goals[0];
      const recentAchievement = delightSnapshot?.achievements[0]?.title ?? timeline?.events.find((event) => event.filter === 'achievements')?.title;
      setDelight(delightSnapshot);
      setPresenceEmotion(emotion?.state ?? 'neutral');
      if (delightSnapshot?.newlyUnlocked[0]) {
        setCelebration(delightSnapshot.newlyUnlocked[0]);
      }
      setDashboard({
        greeting: delightSnapshot?.welcome ?? greetingFor(profile?.nickname || profile?.name),
        goalTitle: activeGoal?.title ?? profile?.goal ?? 'Choose a goal',
        progressLabel: activeGoal ? `${activeGoal.progress.completionPercent}% complete` : `${planner?.agenda.items.length ?? 0} tasks today`,
        moodLabel: emotion ? `${emotion.state} ${Math.round(emotion.confidence * 100)}%` : 'Neutral',
        focusLabel: context?.task?.label ?? context?.routine.active[0]?.routineType?.replace('_', ' ') ?? 'Ready',
        behaviorLabel: behavior?.routines[0] ? `${behavior.routines[0].label} ${Math.round(behavior.routines[0].confidence * 100)}%` : 'No routine yet',
        relationshipLabel: context?.relationships.length ? `${context.relationships.length} people known` : 'No people yet',
        lifeLabel: suggestion?.title ?? 'No nudge right now',
        achievementLabel: recentAchievement ?? 'No achievement yet',
        timelineLabel: timeline ? `${timeline.events.length} journey events` : 'Timeline is warming up',
      });
    };
    loadDashboard();
    return () => {
      cancelled = true;
    };
  }, [messages.length, phase, suggestion?.title]);

  useEffect(() => {
    if (!celebration) return;
    const timer = setTimeout(() => setCelebration(null), 5200);
    return () => clearTimeout(timer);
  }, [celebration]);

  useEffect(() => {
    let cancelled = false;
    const loadSuggestion = async () => {
      if (!canSuggest) {
        setSuggestion(null);
        return;
      }
      const interruptionState = {
        userTalking: speechState === 'listening' || speechState === 'processing',
        voiceActive: assistantState === 'thinking' || assistantState === 'speaking',
      };
      const lifeDecision = await LifeEngine.getDecision(interruptionState);
      if (lifeDecision.actionType !== 'silent') {
        if (!cancelled) {
          setSuggestion({
            kind: 'life',
            decision: lifeDecision,
            title: lifeDecision.title,
            message: lifeDecision.message,
            action: lifeDecision.action,
          });
        }
        return;
      }
      const suggestions = await ProactiveExperience.getSuggestions(interruptionState);
      const proactive = suggestions[0];
      if (!cancelled) {
        setSuggestion(proactive ? {
          kind: 'proactive',
          suggestion: proactive,
          title: proactive.title,
          message: proactive.message,
          action: proactive.action,
        } : null);
      }
    };
    loadSuggestion();
    return () => {
      cancelled = true;
    };
  }, [assistantState, canSuggest, speechState, talkOpen]);

  const acceptSuggestion = async () => {
    if (!suggestion) return;
    if (suggestion.kind === 'life') {
      await LifeEngine.markShown(suggestion.decision);
    } else {
      await ProactiveExperience.recordFeedback(suggestion.suggestion, 'accepted');
    }
    setSuggestion(null);
    if (suggestion.action.type === 'prompt') {
      openTopic(suggestion.action.prompt);
    } else if (suggestion.action.type === 'open_debug') {
      router.push(suggestion.action.route as never);
    }
  };

  const dismissSuggestion = async () => {
    if (!suggestion) return;
    if (suggestion.kind === 'life') {
      await LifeEngine.markShown(suggestion.decision);
    } else {
      await ProactiveExperience.recordFeedback(suggestion.suggestion, 'ignored');
    }
    setSuggestion(null);
  };
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')?.content ?? '';
  const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant')?.content ?? '';
  const friendlyError = error ? "I couldn't hear that. Let's try again." : '';
  const lifeAction: LifeActionType | undefined = suggestion?.kind === 'life' ? suggestion.decision.actionType : undefined;
  const voiceTranscript =
    phase === 'listening'
      ? interimTranscript || transcript || lastUser
      : phase === 'speaking'
        ? lastAssistant
        : phase === 'thinking' || phase === 'processing' || phase === 'tool_execution'
          ? lastUser
          : friendlyError || lastAssistant || lastUser;

  return (
    <Screen>
      {isWide ? (
        <DesktopExperience
          dashboard={dashboard}
          phase={phase}
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          suggestion={suggestion}
          delight={delight}
          emotionState={presenceEmotion}
          lifeAction={lifeAction}
          onAcceptSuggestion={acceptSuggestion}
          onDismissSuggestion={dismissSuggestion}
          onMic={() => {
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onPrompt={openTopic}
          onNavigate={(route) => router.push(route as never)}
        />
      ) : (
        <TalkView
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          onMic={() => {
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onStop={stop}
          onBack={stop}
          onMessage={goHistory}
          greeting={dashboard.greeting}
          goalTitle={dashboard.goalTitle}
          progressLabel={dashboard.progressLabel}
          moodLabel={dashboard.moodLabel}
          focusLabel={dashboard.focusLabel}
          emotionState={presenceEmotion}
          lifeAction={lifeAction}
          onPlanner={() => router.push('/planner-debug' as never)}
          onTimeline={() => router.push('/timeline' as never)}
          onMemory={() => router.push('/(tabs)/profile' as never)}
          onSettings={() => router.push('/(tabs)/settings' as never)}
        />
      )}

      {!isWide && suggestion ? (
        <View style={styles.mobileSuggestion}>
          <ProactiveCard suggestion={suggestion} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} compact />
        </View>
      ) : null}

      {isWide ? (
        <VoiceOverlay
          visible={talkOpen}
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          onMic={() => {
            TTSService.unlockWeb();
            toggle();
          }}
          onStop={stop}
          onBack={closeTalk}
          onMessage={goHistory}
        />
      ) : null}

      {celebration ? <AchievementToast achievement={celebration} /> : null}
    </Screen>
  );
}

function DesktopExperience({
  dashboard,
  phase,
  orbState,
  voiceState,
  status,
  transcript,
  messages,
  suggestion,
  delight,
  emotionState,
  lifeAction,
  onAcceptSuggestion,
  onDismissSuggestion,
  onMic,
  onPrompt,
  onNavigate,
}: {
  dashboard: MobileDashboard;
  phase: Phase;
  orbState: OrbState;
  voiceState: VoiceButtonState;
  status: string;
  transcript: string;
  messages: ReturnType<typeof useConversationMode>['messages'];
  suggestion: HomeSuggestion | null;
  delight: DelightSnapshot | null;
  emotionState: EmotionState;
  lifeAction?: LifeActionType;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  onMic: () => void;
  onPrompt: (text: string) => void;
  onNavigate: (route: string) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const isActive = orbState === 'listening' || orbState === 'speaking' || orbState === 'tool_execution';
  const isThinking = orbState === 'thinking' || orbState === 'tool_execution';
  const navItems: { label: string; icon: LucideIcon; route?: string; onPress?: () => void }[] = [
    { label: 'Home', icon: Home },
    { label: 'Chat', icon: MessageSquare, onPress: () => onPrompt('Let us talk') },
    { label: 'Timeline', icon: BookOpen, route: '/timeline' },
    { label: 'Planner', icon: CalendarCheck2, route: '/planner-debug' },
    { label: 'Memory', icon: Brain, route: '/(tabs)/profile' },
    { label: 'Profile', icon: User, route: '/(tabs)/profile' },
    { label: 'Settings', icon: Settings, route: '/(tabs)/settings' },
  ];

  return (
    <View style={styles.desktopRoot}>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(2,8,18,0)', 'rgba(9,90,132,0.18)', 'rgba(97,50,184,0.14)', 'rgba(0,0,0,0)']}
        locations={[0, 0.32, 0.72, 1]}
        start={{ x: 0.02, y: 0 }}
        end={{ x: 0.96, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View pointerEvents="none" style={styles.desktopVignette} />
      <AmbientPresence emotion={emotionState} lifeAction={lifeAction} />
      <PressableScale
        onHoverIn={() => setExpanded(true)}
        onHoverOut={() => setExpanded(false)}
        accessibilityRole="button"
        style={[styles.sidebarWrap, expanded && styles.sidebarExpanded]}
      >
        <GlassSurface intensity={34} radius={Radii.xxl} style={styles.sidebar}>
          <View style={styles.sidebarBrand}>
            <View style={[styles.brandMark, { backgroundColor: theme.colors.accentSoft }]}>
              <Sparkles size={18} color={theme.colors.accent} strokeWidth={1.8} />
            </View>
            {expanded ? (
              <AppText variant="bodyStrong" color="primary">
                JISSI OS
              </AppText>
            ) : null}
          </View>
          <View style={styles.navList}>
            {navItems.map((item) => (
              <DesktopNavItem
                key={item.label}
                label={item.label}
                icon={item.icon}
                expanded={expanded}
                active={item.label === 'Home'}
                onPress={item.onPress ?? (() => item.route && onNavigate(item.route))}
              />
            ))}
          </View>
          <PanelLeft size={18} color={theme.colors.textMuted} strokeWidth={1.7} />
        </GlassSurface>
      </PressableScale>

      <View style={styles.desktopCenter}>
        <Animated.View entering={FadeInUp.delay(40).duration(420)} style={styles.desktopHero}>
          <AppText style={styles.desktopGreeting} color="primary">
            {dashboard.greeting}
          </AppText>
          <AppText style={styles.desktopSubtitle} color="muted">
            Your AI companion that grows with you.
          </AppText>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).duration(480)} style={styles.desktopOrbStage}>
          <PresenceField state={orbState} emotion={emotionState} lifeAction={lifeAction} size={320}>
            <VoiceWave active={isActive} size={330} intensity={phase === 'speaking' ? 1.25 : phase === 'listening' ? 0.95 : 0.72} />
            <OrbEngine state={orbState} size={320} />
          </PresenceField>
        </Animated.View>

        <AppText variant="caption" color="accent" style={styles.desktopStatus}>
          {status}
        </AppText>

        {transcript ? (
          <Animated.View entering={FadeInUp.duration(280)} style={styles.desktopTranscript}>
            <AppText style={styles.desktopTranscriptText} color="primary">
              {transcript}
            </AppText>
          </Animated.View>
        ) : null}

        <View style={styles.desktopConversation}>
          <ConversationTimeline messages={messages} thinking={isThinking} />
        </View>

        <View style={styles.desktopPromptRow}>
          {PROMPT_CARDS.map((card, index) => (
            <DesktopPrompt key={card.text} card={card} delay={index * 70} onPress={() => onPrompt(card.text)} />
          ))}
        </View>

        <GlassSurface intensity={38} radius={Radii.pill} strong style={styles.desktopInput}>
          <View style={styles.desktopInputText}>
            <AppText variant="bodyStrong" color="primary">
              Ask, plan, remember, create
            </AppText>
            <AppText variant="caption" color="muted">
              Type coming soon. Voice is ready now.
            </AppText>
          </View>
          <VoiceButton state={voiceState} onPress={onMic} size={70} />
        </GlassSurface>
      </View>

      <View style={styles.rightPanel}>
        <GlassSurface intensity={32} radius={Radii.xxl} style={styles.rightPanelSurface}>
          <View style={styles.rightPanelHeader}>
            <AppText variant="title" color="primary">
              Today
            </AppText>
            <AppText variant="caption" color="muted">
              Live from JISSI
            </AppText>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightPanelScroll}>
            {delight?.quote ? <DailyQuoteCard quote={delight.quote} /> : null}
            <InsightCard icon={Target} label="Today's Goal" value={dashboard.goalTitle} delay={80} />
            <InsightCard icon={CalendarCheck2} label="Planner Progress" value={dashboard.progressLabel} delay={120} />
            <InsightCard icon={Sparkles} label="Emotion" value={dashboard.moodLabel} delay={160} />
            <InsightCard icon={Repeat} label="Behavior" value={dashboard.behaviorLabel} delay={200} />
            <InsightCard icon={Users} label="Relationship Summary" value={dashboard.relationshipLabel} delay={240} />
            <InsightCard icon={MessageCircle} label="Life Suggestion" value={suggestion?.title ?? dashboard.lifeLabel} delay={280} />
            <InsightCard icon={Trophy} label="Recent Achievement" value={dashboard.achievementLabel} delay={320} />
            <InsightCard icon={Clock} label="Current Routine" value={dashboard.focusLabel} delay={360} />
            <InsightCard icon={BookOpen} label="Timeline Preview" value={dashboard.timelineLabel} delay={400} />
            {suggestion ? (
              <ProactiveCard suggestion={suggestion} onAccept={onAcceptSuggestion} onDismiss={onDismissSuggestion} />
            ) : null}
          </ScrollView>
        </GlassSurface>
      </View>
    </View>
  );
}

function DesktopNavItem({
  label,
  icon: Icon,
  expanded,
  active,
  onPress,
}: {
  label: string;
  icon: LucideIcon;
  expanded: boolean;
  active?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  return (
    <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={label} style={styles.navButton}>
      <View style={[styles.navInner, active && { backgroundColor: theme.colors.accentSoft }]}>
        <Icon size={19} color={active ? theme.colors.accent : theme.colors.textMuted} strokeWidth={1.8} />
        {expanded ? (
          <AppText variant="caption" color={active ? 'accent' : 'secondary'} numberOfLines={1}>
            {label}
          </AppText>
        ) : null}
      </View>
    </PressableScale>
  );
}

function DesktopPrompt({ card, delay, onPress }: { card: { text: string; icon: LucideIcon }; delay: number; onPress: () => void }) {
  const theme = useTheme();
  const Icon = card.icon;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(360)} style={styles.desktopPromptWrap}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={card.text}>
        <GlassSurface intensity={24} radius={Radii.xl} style={styles.desktopPrompt}>
          <AppText variant="caption" color="secondary" numberOfLines={2}>
            {card.text}
          </AppText>
          <Icon size={17} color={theme.colors.accent} strokeWidth={1.8} />
        </GlassSurface>
      </PressableScale>
    </Animated.View>
  );
}

function InsightCard({ icon: Icon, label, value, delay }: { icon: LucideIcon; label: string; value: string; delay: number }) {
  const theme = useTheme();
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(360)}>
      <GlassSurface intensity={20} radius={Radii.lg} style={styles.insightCard}>
        <View style={[styles.insightIcon, { backgroundColor: theme.colors.accentSoft }]}>
          <Icon size={16} color={theme.colors.accent} strokeWidth={1.8} />
        </View>
        <View style={styles.insightText}>
          <AppText variant="footnote" color="muted" numberOfLines={1}>
            {label}
          </AppText>
          <AppText variant="caption" color="primary" numberOfLines={2}>
            {value}
          </AppText>
        </View>
      </GlassSurface>
    </Animated.View>
  );
}

function ProactiveCard({
  suggestion,
  compact,
  onAccept,
  onDismiss,
}: {
  suggestion: HomeSuggestion;
  compact?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  return (
    <GlassSurface intensity={24} radius={Radii.lg} style={[styles.proactiveCard, compact && styles.proactiveCompact]}>
      <PressableScale onPress={onAccept} accessibilityRole="button" accessibilityLabel={suggestion.message} style={styles.proactiveMain}>
        <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
          {suggestion.title}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={compact ? 2 : 3}>
          {suggestion.message}
        </AppText>
      </PressableScale>
      <PressableScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss suggestion" style={styles.dismissButton}>
        <AppText variant="footnote" color="muted">
          Not now
        </AppText>
      </PressableScale>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  desktopRoot: { flex: 1, flexDirection: 'row', gap: Spacing.xl, paddingHorizontal: Spacing.xl, paddingVertical: Spacing.xl, overflow: 'hidden' },
  desktopVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  sidebarWrap: { width: 78 },
  sidebarExpanded: { width: 188 },
  sidebar: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: Spacing.lg, paddingHorizontal: Spacing.sm },
  sidebarBrand: { width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
  brandMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navList: { width: '100%', gap: Spacing.sm },
  navButton: { width: '100%' },
  navInner: { minHeight: 46, borderRadius: Radii.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm, paddingHorizontal: Spacing.md },
  desktopCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg },
  desktopHero: { alignItems: 'center', gap: Spacing.xs, marginBottom: Spacing.lg },
  desktopGreeting: { fontFamily: Fonts.bodyBold, fontSize: 44, lineHeight: 52, letterSpacing: 0, textAlign: 'center' },
  desktopSubtitle: { fontFamily: Fonts.bodyMedium, fontSize: 18, lineHeight: 26, letterSpacing: 0, textAlign: 'center' },
  desktopOrbStage: { width: 360, height: 330, alignItems: 'center', justifyContent: 'center' },
  desktopStatus: { textAlign: 'center', marginTop: -Spacing.lg, marginBottom: Spacing.md },
  desktopTranscript: { maxWidth: 680, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  desktopTranscriptText: { fontFamily: Fonts.bodyMedium, fontSize: 22, lineHeight: 32, letterSpacing: 0, textAlign: 'center' },
  desktopConversation: { width: '100%', maxWidth: 760 },
  desktopPromptRow: { width: '100%', maxWidth: 860, flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  desktopPromptWrap: { flex: 1 },
  desktopPrompt: { minHeight: 104, padding: Spacing.lg, justifyContent: 'space-between', gap: Spacing.md },
  desktopInput: { width: '100%', maxWidth: 720, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingLeft: Spacing.xl, paddingRight: Spacing.sm, marginTop: Spacing.xl },
  desktopInputText: { flex: 1, gap: Spacing.xs },
  rightPanel: { width: 340 },
  rightPanelSurface: { flex: 1, padding: Spacing.lg },
  rightPanelHeader: { gap: Spacing.xs, paddingBottom: Spacing.md },
  rightPanelScroll: { gap: Spacing.md, paddingBottom: Spacing.lg },
  insightCard: { minHeight: 70, flexDirection: 'row', alignItems: 'center', gap: Spacing.md, padding: Spacing.md },
  insightIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, gap: Spacing.xs },
  deskRoot: { flex: 1 },
  deskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 920, alignSelf: 'center', width: '100%' },
  hello: { fontFamily: Fonts.bodyBold, fontSize: 46, lineHeight: 54, letterSpacing: 0 },
  helloSub: { fontFamily: Fonts.bodyBold, fontSize: 40, lineHeight: 48, letterSpacing: 0 },
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.huge, width: '100%' },
  cardWrap: { flex: 1 },
  card: { padding: Spacing.lg, minHeight: 130, justifyContent: 'space-between' },
  proactiveCard: { width: '100%', maxWidth: 620, marginTop: Spacing.xl, padding: Spacing.md, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  proactiveCompact: { maxWidth: '100%', marginTop: 0 },
  proactiveMain: { flex: 1, gap: Spacing.xs },
  dismissButton: { minHeight: 40, paddingHorizontal: Spacing.md, alignItems: 'center', justifyContent: 'center' },
  mobileSuggestion: { position: 'absolute', left: Spacing.gutter, right: Spacing.gutter, top: Spacing.xxl },
  cardIcon: {
    alignSelf: 'flex-end',
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
});
