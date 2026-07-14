import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  BookOpen,
  Brain,
  CalendarCheck2,
  GitBranch,
  Home,
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
import { ProactiveEngine, ProactiveExperience, ProactiveSuggestion } from '@/services/proactive';
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
import { DailyBriefEngine, DailyBrief } from '@/services/daily';
import { RelationshipService, RelationshipProfile } from '@/services/relationships';
import { ExplainabilityService } from '@/services/explainability';
import { AssistantState } from '@/hooks/useConversation';
import { useConversationMode } from '@/hooks/useConversationMode';
import { OrbState } from '@/components/orb/PlasmaOrb';
import { OrbEngine } from '@/components/orb/OrbEngine';
import { VoiceWave } from '@/components/VoiceWave';
import { TalkView } from '@/components/TalkView';
import { DailyBriefCard } from '@/components/daily/DailyBriefCard';
import { VoiceOverlay } from '@/components/VoiceOverlay';
import { AppText, GlassSurface, PressableScale, Screen, VoiceButton, VoiceButtonState } from '@/components/ui';
import { ConversationTimeline } from '@/components/ConversationTimeline';
import { AchievementToast, DailyQuoteCard } from '@/components/delight/DelightSurfaces';
import { AmbientPresence, LivingAvatar } from '@/components/presence/PresenceEngine';
import { useTheme } from '@/theme';
import { Fonts } from '@/theme/typography';
import { Radii, Spacing } from '@/theme/tokens';

const WIDE_BREAKPOINT = 900;
const thinkingPhrases = [
  'Thinking...',
  'Let me figure that out...',
  'One second...',
  'Looking through what I know...',
  'Connecting the pieces...',
];

type Phase = 'idle' | 'listening' | 'processing' | 'thinking' | 'speaking' | 'tool_execution' | 'offline' | 'error';
type HomeSuggestion =
  | { kind: 'life'; decision: LifeDecision; title: string; message: string; explanation: string; action: LifeDecision['action'] }
  | { kind: 'proactive'; suggestion: ProactiveSuggestion; title: string; message: string; explanation: string; action: ProactiveSuggestion['action'] };

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

interface MobileDashboard {
  greeting: string;
  greetingSubtext: string;
  goalTitle: string;
  progressLabel: string;
  moodLabel: string;
  focusLabel: string;
  behaviorLabel: string;
  relationshipLabel: string;
  lifeLabel: string;
  achievementLabel: string;
  timelineLabel: string;
  quickThought: string;
  cards: DashboardCard[];
}

interface DashboardCard {
  id: string;
  label: string;
  title: string;
  body: string;
  icon: LucideIcon;
  route?: string;
}

function greetingFor(name?: string): string {
  const hour = new Date().getHours();
  const part = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : hour < 21 ? 'Good Evening' : 'Good Night';
  return name ? `${part} ${name}` : part;
}

function titleFromKey(value?: string): string {
  if (!value) return 'Ready';
  return value
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function emotionLabel(state?: EmotionState): string {
  if (!state || state === 'neutral') return 'Balanced';
  return titleFromKey(state);
}

function emotionCopy(state?: EmotionState): string {
  switch (state) {
    case 'focused':
      return 'Quiet focus mode. JISSI will keep things crisp.';
    case 'relaxed':
      return 'Calm pace today, with gentle suggestions only.';
    case 'curious':
      return 'You seem ready to explore and learn deeply.';
    case 'excited':
      return 'High energy today. Let us use it well.';
    case 'stressed':
      return 'A softer pace may help you move without pressure.';
    case 'confused':
      return 'Step-by-step answers will work best right now.';
    case 'tired':
      return 'Gentle mode. Smaller steps, less noise.';
    case 'lonely':
      return 'JISSI will keep the conversation warmer today.';
    case 'frustrated':
      return 'Let us simplify the next step together.';
    default:
      return 'A steady companion mode for today.';
  }
}

function relativeDay(value?: string): string {
  if (!value) return 'Recently';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Recently';
  const today = new Date();
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
  const startDate = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const days = Math.round((startToday - startDate) / (24 * 60 * 60 * 1000));
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}

function relationshipSpotlight(relationships: RelationshipProfile[], fallbackCount: number): DashboardCard {
  const person = relationships[0];
  if (person) {
    const day = relativeDay(person.lastDiscussed);
    return {
      id: 'relationship',
      label: 'Relationship Spotlight',
      title: person.name,
      body: day === 'Today'
        ? `${titleFromKey(person.relationship)} in your circle. You talked about them today.`
        : `You have not talked about ${person.name} since ${day.toLowerCase()}.`,
      icon: Users,
      route: '/relationship-debug',
    };
  }
  return {
    id: 'relationship',
    label: 'Relationship Spotlight',
    title: fallbackCount ? `${fallbackCount} people noticed` : 'Your people will appear here',
    body: fallbackCount ? 'JISSI has relationship context ready for future greetings.' : 'Introduce a teacher, friend or mentor and JISSI will remember the relationship locally.',
    icon: Users,
    route: '/relationship-debug',
  };
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
    mode,
    voiceConfidence,
    lastHeardAt,
    conversationDurationMs,
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
    greetingSubtext: 'Your AI that grows with you.',
    goalTitle: 'Choose a goal',
    progressLabel: '0% today',
    moodLabel: 'Neutral',
    focusLabel: 'Ready',
    behaviorLabel: 'No routine yet',
    relationshipLabel: 'No people yet',
    lifeLabel: 'Listening for patterns',
    achievementLabel: 'No achievement yet',
    timelineLabel: 'Timeline is warming up',
    quickThought: 'Your story starts today.',
    cards: [],
  });
  const [delight, setDelight] = useState<DelightSnapshot | null>(null);
  const [dailyBrief, setDailyBrief] = useState<DailyBrief | null>(null);
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
    const loadDailyBrief = async () => {
      const brief = await DailyBriefEngine.getBriefToShow().catch(() => null);
      if (!cancelled) setDailyBrief(brief);
    };
    loadDailyBrief();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDashboard = async () => {
      const [profile, planner, emotion, context, behavior, timeline, delightSnapshot, relationships] = await Promise.all([
        OnboardingService.getProfile(),
        PlannerEngine.getSnapshot().catch(() => null),
        EmotionEngine.getCurrentEmotion().catch(() => null),
        ContextEngine.getCurrentContext().catch(() => null),
        BehaviorEngine.getSnapshot().catch(() => null),
        TimelineService.getSnapshot().catch(() => null),
        DelightService.getSnapshot().catch(() => null),
        RelationshipService.getProfiles().catch(() => []),
      ]);
      if (cancelled) return;
      const activeGoal = planner?.goals.find((goal) => goal.status !== 'completed') ?? planner?.goals[0];
      const currentTask = activeGoal?.milestones
        .flatMap((milestone) => milestone.tasks)
        .find((task) => task.status !== 'completed');
      const routine = behavior?.routines[0];
      const activeRoutine = context?.routine.active[0];
      const latestTimeline = timeline?.events[0];
      const recentAchievement = delightSnapshot?.achievements[0]?.title ?? timeline?.events.find((event) => event.filter === 'achievements')?.title;
      const completedGoals = planner?.goals.filter((goal) => goal.status === 'completed').length ?? timeline?.stats.completedGoals ?? 0;
      const peopleCount = relationships.length || context?.relationships.length || 0;
      const todayFocus: DashboardCard = activeGoal ? {
        id: 'today-focus',
        label: "Today's Focus",
        title: activeGoal.title,
        body: currentTask ? currentTask.title : `${activeGoal.progress.completionPercent}% complete. Continue the next small step.`,
        icon: Target,
        route: '/planner-debug',
      } : routine ? {
        id: 'today-focus',
        label: "Today's Focus",
        title: routine.label,
        body: routine.reason,
        icon: Repeat,
        route: '/behavior-debug',
      } : suggestion ? {
        id: 'today-focus',
        label: "Today's Focus",
        title: suggestion.title,
        body: suggestion.message,
        icon: MessageCircle,
      } : {
        id: 'today-focus',
        label: "Today's Focus",
        title: 'Your story starts today',
        body: 'Add one goal or start one conversation and JISSI will shape the dashboard around it.',
        icon: Sparkles,
      };
      const continueJourney: DashboardCard = {
        id: 'continue',
        label: 'Continue Journey',
        title: activeGoal ? `Continue ${activeGoal.title}` : profile?.goal ? `Continue ${profile.goal}` : 'Choose your first journey',
        body: activeGoal ? `${activeGoal.progress.completedTasks}/${activeGoal.progress.totalTasks} tasks completed` : 'A single goal is enough for JISSI to begin building momentum.',
        icon: CalendarCheck2,
        route: '/planner-debug',
      };
      const relationshipCard = relationshipSpotlight(relationships, context?.relationships.length ?? 0);
      const achievementCard: DashboardCard = {
        id: 'achievement',
        label: 'Achievement',
        title: recentAchievement ?? (activeGoal?.progress.currentStreak ? `${activeGoal.progress.currentStreak} day streak` : 'Your first win is waiting'),
        body: recentAchievement ? 'A recent moment from your journey.' : 'Finish one task or milestone and JISSI will celebrate it here.',
        icon: Trophy,
        route: '/timeline',
      };
      const timelineCard: DashboardCard = {
        id: 'recent-memory',
        label: 'Recent Memory',
        title: latestTimeline ? `${relativeDay(latestTimeline.timestamp)}: ${latestTimeline.title}` : 'Your story is waiting to be written',
        body: latestTimeline?.description ?? 'Milestones, habits and important memories will appear here automatically.',
        icon: BookOpen,
        route: '/timeline',
      };
      const moodCard: DashboardCard = {
        id: 'mood',
        label: 'Mood',
        title: emotionLabel(emotion?.state),
        body: emotionCopy(emotion?.state),
        icon: Sparkles,
        route: '/emotion-debug',
      };
      const quickThought = routine
        ? `You usually ${routine.label.toLowerCase()} around this time.`
        : completedGoals
          ? `You have completed ${completedGoals} goal${completedGoals === 1 ? '' : 's'} so far.`
          : timeline?.events.length
            ? 'Your journey is starting to take shape.'
            : 'Your story starts today.';
      const thoughtCard: DashboardCard = {
        id: 'thought',
        label: 'Companion Thought',
        title: quickThought,
        body: suggestion?.message ?? 'Built locally from your planner, routines and timeline.',
        icon: Sparkles,
      };
      const cards = [
        todayFocus,
        continueJourney,
        timelineCard,
        thoughtCard,
      ];
      setDelight(delightSnapshot);
      setPresenceEmotion(emotion?.state ?? 'neutral');
      if (delightSnapshot?.newlyUnlocked[0]) {
        setCelebration(delightSnapshot.newlyUnlocked[0]);
      }
      setDashboard({
        greeting: delightSnapshot?.welcome ?? greetingFor(profile?.nickname || profile?.name),
        greetingSubtext: suggestion?.title ?? (activeGoal ? "You've been making great progress lately." : 'Your AI that grows with you.'),
        goalTitle: activeGoal?.title ?? profile?.goal ?? 'Choose a goal',
        progressLabel: activeGoal ? `${activeGoal.progress.completionPercent}% complete` : `${planner?.agenda.items.length ?? 0} tasks today`,
        moodLabel: emotionLabel(emotion?.state),
        focusLabel: todayFocus.title,
        behaviorLabel: routine?.label ?? activeRoutine?.suggestion ?? 'No routine yet',
        relationshipLabel: peopleCount ? `${peopleCount} people in your circle` : 'No people yet',
        lifeLabel: suggestion?.title ?? 'No nudge right now',
        achievementLabel: recentAchievement ?? 'No achievement yet',
        timelineLabel: latestTimeline?.title ?? (timeline ? `${timeline.events.length} journey events` : 'Timeline is warming up'),
        quickThought,
        cards,
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
            explanation: ExplainabilityService.explainLifeDecision(lifeDecision),
            action: lifeDecision.action,
          });
        }
        return;
      }
      const suggestions = await ProactiveEngine.getLegacySuggestions(interruptionState);
      const proactive = suggestions[0];
      if (!cancelled) {
        setSuggestion(proactive ? {
          kind: 'proactive',
          suggestion: proactive,
          title: proactive.title,
          message: proactive.message,
          explanation: ExplainabilityService.explainProactiveSuggestion(proactive),
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
      await ProactiveEngine.recordLegacy(suggestion.suggestion, 'accepted');
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
      await ProactiveEngine.recordLegacy(suggestion.suggestion, 'dismissed');
    }
    setSuggestion(null);
  };
  const remindLaterSuggestion = async () => {
    if (!suggestion) return;
    if (suggestion.kind === 'life') {
      await LifeEngine.markShown(suggestion.decision);
    } else {
      await ProactiveEngine.recordLegacy(suggestion.suggestion, 'remind_later');
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
          currentMode={mode}
          voiceConfidence={voiceConfidence}
          lastHeardAt={lastHeardAt}
          conversationDurationMs={conversationDurationMs}
          dailyBrief={dailyBrief}
          suggestion={suggestion}
          delight={delight}
          emotionState={presenceEmotion}
          lifeAction={lifeAction}
          onAcceptSuggestion={acceptSuggestion}
          onDismissSuggestion={dismissSuggestion}
          onRemindLaterSuggestion={remindLaterSuggestion}
          onMic={() => {
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onTalk={() => {
            setTalkOpen(true);
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onPrompt={openTopic}
          onDailyBriefAction={openTopic}
          onNavigate={(route) => router.push(route as never)}
        />
      ) : (
        <TalkView
          orbState={phaseToOrb(phase)}
          voiceState={phaseToVoice(phase, isSupported)}
          status={statusShort(phase, isSupported)}
          transcript={voiceTranscript}
          messages={messages}
          currentMode={mode}
          voiceConfidence={voiceConfidence}
          lastHeardAt={lastHeardAt}
          conversationDurationMs={conversationDurationMs}
          onMic={() => {
            TTSService.unlockWeb();
            if (isSupported) toggle();
          }}
          onStop={stop}
          onBack={stop}
          onMessage={goHistory}
          greeting={dashboard.greeting}
          greetingSubtext={dashboard.greetingSubtext}
          goalTitle={dashboard.goalTitle}
          progressLabel={dashboard.progressLabel}
          moodLabel={dashboard.moodLabel}
          focusLabel={dashboard.focusLabel}
          dashboardCards={dashboard.cards}
          dailyBrief={dailyBrief}
          onDailyBriefAction={openTopic}
          emotionState={presenceEmotion}
          lifeAction={lifeAction}
          onPlanner={() => router.push('/planner-debug' as never)}
          onTimeline={() => router.push('/timeline' as never)}
          onLifeGraph={() => router.push('/(tabs)/life-graph' as never)}
          onMemory={() => router.push('/(tabs)/profile' as never)}
          onRelationships={() => router.push('/relationship-debug' as never)}
          onSettings={() => router.push('/(tabs)/settings' as never)}
        />
      )}

      {!isWide && suggestion ? (
        <View style={styles.mobileSuggestion}>
          <ProactiveCard suggestion={suggestion} onAccept={acceptSuggestion} onDismiss={dismissSuggestion} onRemindLater={remindLaterSuggestion} compact />
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
          currentMode={mode}
          voiceConfidence={voiceConfidence}
          lastHeardAt={lastHeardAt}
          conversationDurationMs={conversationDurationMs}
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
  currentMode,
  voiceConfidence,
  lastHeardAt,
  conversationDurationMs,
  dailyBrief,
  suggestion,
  delight,
  emotionState,
  lifeAction,
  onAcceptSuggestion,
  onDismissSuggestion,
  onRemindLaterSuggestion,
  onMic,
  onTalk,
  onPrompt,
  onDailyBriefAction,
  onNavigate,
}: {
  dashboard: MobileDashboard;
  phase: Phase;
  orbState: OrbState;
  voiceState: VoiceButtonState;
  status: string;
  transcript: string;
  messages: ReturnType<typeof useConversationMode>['messages'];
  currentMode: string;
  voiceConfidence: number;
  lastHeardAt: string | null;
  conversationDurationMs: number;
  dailyBrief: DailyBrief | null;
  suggestion: HomeSuggestion | null;
  delight: DelightSnapshot | null;
  emotionState: EmotionState;
  lifeAction?: LifeActionType;
  onAcceptSuggestion: () => void;
  onDismissSuggestion: () => void;
  onRemindLaterSuggestion: () => void;
  onMic: () => void;
  onTalk: () => void;
  onPrompt: (text: string) => void;
  onDailyBriefAction: (text: string) => void;
  onNavigate: (route: string) => void;
}) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);
  const [showMoreInsights, setShowMoreInsights] = useState(false);
  const [phraseIndex, setPhraseIndex] = useState(0);
  const isActive = orbState === 'listening' || orbState === 'speaking' || orbState === 'tool_execution';
  const isThinking = phase === 'thinking' || phase === 'processing' || phase === 'tool_execution';
  const dashboardCards = useMemo(() => dashboard.cards, [dashboard.cards]);
  const findCard = (id: string) => dashboardCards.find((card) => card.id === id);
  const focusCard = findCard('today-focus');
  const continueCard = findCard('continue');
  const memoryCard = findCard('recent-memory');
  const thoughtCard = findCard('thought');
  const rightCards = useMemo(() => [focusCard, continueCard, thoughtCard].filter((card): card is DashboardCard => !!card), [focusCard, continueCard, thoughtCard]);
  const belowFoldCards = useMemo(() => [continueCard, focusCard, memoryCard].filter((card): card is DashboardCard => !!card), [continueCard, focusCard, memoryCard]);
  const recentAssistant = [...messages].reverse().find((message) => message.role === 'assistant')?.content;
  const navItems: { label: string; icon: LucideIcon; route?: string; onPress?: () => void }[] = [
    { label: 'Home', icon: Home },
    { label: 'Planner', icon: CalendarCheck2, route: '/planner-debug' },
    { label: 'Timeline', icon: BookOpen, route: '/timeline' },
    { label: 'Life Graph', icon: GitBranch, route: '/(tabs)/life-graph' },
    { label: 'People', icon: Users, route: '/relationship-debug' },
    { label: 'Settings', icon: Settings, route: '/(tabs)/settings' },
  ];
  const quickActions: { label: string; prompt: string; icon: LucideIcon }[] = [
    { label: 'Continue yesterday', prompt: 'Continue where we stopped yesterday', icon: Repeat },
    { label: 'Plan my day', prompt: 'Help me plan my day', icon: CalendarCheck2 },
    { label: 'Talk', prompt: 'Let us talk', icon: MessageSquare },
    { label: 'Remember something', prompt: 'Remember something important', icon: BookOpen },
    { label: 'Reflect', prompt: 'Help me reflect on today', icon: Sparkles },
  ];

  useEffect(() => {
    if (!isThinking) {
      setPhraseIndex(0);
      return;
    }
    const timer = setInterval(() => setPhraseIndex((index) => (index + 1) % thinkingPhrases.length), 1600);
    return () => clearInterval(timer);
  }, [isThinking]);

  const companionText = isThinking
    ? thinkingPhrases[phraseIndex]
    : phase === 'listening'
      ? transcript || "I'm listening."
      : phase === 'speaking'
        ? 'Speaking... tap Talk to interrupt.'
        : transcript || dashboard.greetingSubtext || dashboard.quickThought;

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

      <ScrollView style={styles.desktopCenterScroll} contentContainerStyle={styles.desktopCenterContent} showsVerticalScrollIndicator={false}>
        <View style={styles.desktopHero}>
          <Animated.View entering={FadeInUp.delay(40).duration(440)} style={styles.heroCopy}>
            <AppText style={styles.desktopGreeting} color="primary">
              {dashboard.greeting.endsWith('.') ? dashboard.greeting : `${dashboard.greeting}.`}
            </AppText>
            <AppText style={styles.desktopSubtitle} color="muted">
              Ready whenever you are.
            </AppText>
          </Animated.View>

          <Animated.View entering={FadeInUp.delay(120).duration(520)} style={styles.desktopOrbStage}>
            <LivingAvatar state={orbState} emotion={emotionState} lifeAction={lifeAction} size={292}>
              <VoiceWave active={isActive} size={304} intensity={phase === 'speaking' ? 1.12 : phase === 'listening' ? 0.88 : 0.56} />
              <OrbEngine state={orbState} size={292} />
            </LivingAvatar>
          </Animated.View>

          <AppText style={styles.desktopCompanion} color="muted">
            {companionText}
          </AppText>
          {isThinking ? <TypingIndicator /> : null}
          <DesktopPresenceMeta
            mode={currentMode}
            confidence={voiceConfidence}
            lastHeardAt={lastHeardAt}
            durationMs={conversationDurationMs}
          />

          <View style={styles.heroCtas}>
            <PressableScale onPress={onTalk} accessibilityRole="button" accessibilityLabel="Tap to Talk" style={styles.primaryTalkWrap}>
              <GlassSurface intensity={44} radius={Radii.pill} strong style={styles.primaryTalk}>
                <VoiceButton state={voiceState} onPress={onMic} size={62} />
                <View style={styles.primaryTalkCopy}>
                  <AppText variant="bodyStrong" color="primary">
                    Tap to Talk
                  </AppText>
                  <AppText variant="caption" color="muted">
                    {status}
                  </AppText>
                </View>
              </GlassSurface>
            </PressableScale>
            <PressableScale onPress={() => onPrompt('I want to type instead')} accessibilityRole="button" accessibilityLabel="Type instead" style={styles.secondaryCta}>
              <AppText variant="bodyStrong" color="secondary">
                Type instead
              </AppText>
            </PressableScale>
          </View>

          <View style={styles.quickActionRow}>
            {quickActions.map((action, index) => (
              <DesktopQuickAction key={action.label} card={action} delay={220 + index * 35} onPress={() => onPrompt(action.prompt)} />
            ))}
          </View>

          {dailyBrief ? <DailyBriefCard brief={dailyBrief} onAction={onDailyBriefAction} /> : null}
        </View>

        <View style={styles.belowFold}>
          {belowFoldCards.map((card, index) => (
            <View key={card.id} style={styles.belowCardWrap}>
              <InsightCard
                icon={card.icon}
                label={card.label}
                title={card.title}
                value={card.body}
                delay={80 + index * 60}
                onPress={card.route ? () => onNavigate(card.route as string) : undefined}
              />
            </View>
          ))}
          <View style={styles.belowCardWrap}>
            <InsightCard
              icon={MessageSquare}
              label="Conversation"
              title={recentAssistant ? 'Latest reply' : 'No conversation yet'}
              value={recentAssistant ?? 'Start with one thought and JISSI will keep the thread warm.'}
              delay={280}
              onPress={() => onNavigate('/(tabs)/history')}
            />
          </View>
        </View>
      </ScrollView>

      <View style={styles.rightPanel}>
        <GlassSurface intensity={32} radius={Radii.xxl} style={styles.rightPanelSurface}>
          <View style={styles.rightPanelHeader}>
            <AppText variant="title" color="primary">
              Companion
            </AppText>
            <AppText variant="caption" color="muted">
              Quiet context, only what matters.
            </AppText>
          </View>
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.rightPanelScroll}>
            {rightCards.map((card, index) => (
              <InsightCard
                key={card.id}
                icon={card.icon}
                label={card.label}
                title={card.title}
                value={card.body}
                delay={80 + index * 40}
                onPress={card.route ? () => onNavigate(card.route as string) : undefined}
              />
            ))}
            {delight?.quote ? <DailyQuoteCard quote={delight.quote} /> : null}
            {suggestion ? (
              <ProactiveCard suggestion={suggestion} onAccept={onAcceptSuggestion} onDismiss={onDismissSuggestion} onRemindLater={onRemindLaterSuggestion} />
            ) : null}
            {dashboardCards.length > 3 ? (
              <PressableScale onPress={() => setShowMoreInsights((value) => !value)} accessibilityRole="button" accessibilityLabel="Toggle more insights">
                <GlassSurface intensity={18} radius={Radii.lg} style={styles.moreInsights}>
                  <AppText variant="caption" color="secondary">
                    {showMoreInsights ? 'Hide extra context' : 'See more'}
                  </AppText>
                </GlassSurface>
              </PressableScale>
            ) : null}
            {showMoreInsights ? dashboardCards.filter((card) => !rightCards.some((visible) => visible.id === card.id)).map((card, index) => (
              <InsightCard
                key={card.id}
                icon={card.icon}
                label={card.label}
                title={card.title}
                value={card.body}
                delay={260 + index * 40}
                onPress={card.route ? () => onNavigate(card.route as string) : undefined}
              />
            )) : null}
          </ScrollView>
        </GlassSurface>
      </View>
    </View>
  );
}

function DesktopQuickAction({ card, delay, onPress }: { card: { label: string; icon: LucideIcon }; delay: number; onPress: () => void }) {
  const theme = useTheme();
  const Icon = card.icon;
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(340)}>
      <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={card.label}>
        <GlassSurface intensity={22} radius={Radii.pill} style={styles.desktopQuickAction}>
          <Icon size={16} color={theme.colors.accent} strokeWidth={1.8} />
          <AppText variant="footnote" color="secondary" numberOfLines={1}>
            {card.label}
          </AppText>
        </GlassSurface>
      </PressableScale>
    </Animated.View>
  );
}

function TypingIndicator() {
  return (
    <View style={styles.typingDots} accessibilityLabel="JISSI is thinking">
      <View style={styles.typingDot} />
      <View style={[styles.typingDot, styles.typingDotMid]} />
      <View style={styles.typingDot} />
    </View>
  );
}

function DesktopPresenceMeta({
  mode,
  confidence,
  lastHeardAt,
  durationMs,
}: {
  mode: string;
  confidence: number;
  lastHeardAt: string | null;
  durationMs: number;
}) {
  const confidenceLabel = confidence > 0 ? `${Math.round(confidence * 100)}%` : 'Ready';
  return (
    <GlassSurface intensity={16} radius={Radii.pill} style={styles.desktopPresenceMeta}>
      <AppText variant="footnote" color="secondary" numberOfLines={1}>
        {titleFromKey(mode)}
      </AppText>
      <View style={styles.presenceDivider} />
      <AppText variant="footnote" color="muted" numberOfLines={1}>
        Voice {confidenceLabel}
      </AppText>
      <View style={styles.presenceDivider} />
      <AppText variant="footnote" color="muted" numberOfLines={1}>
        {lastHeardAt ? `Heard ${relativeHeard(lastHeardAt)}` : formatDuration(durationMs)}
      </AppText>
    </GlassSurface>
  );
}

function relativeHeard(value: string): string {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'recently';
  const seconds = Math.max(0, Math.round((Date.now() - timestamp) / 1000));
  if (seconds < 5) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  return `${Math.round(seconds / 60)}m ago`;
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes ? `${minutes}m ${seconds}s` : `${seconds}s`;
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

function InsightCard({
  icon: Icon,
  label,
  title,
  value,
  delay,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  title: string;
  value: string;
  delay: number;
  onPress?: () => void;
}) {
  const theme = useTheme();
  const content = (
    <GlassSurface intensity={20} radius={Radii.lg} style={styles.insightCard}>
      <View style={[styles.insightIcon, { backgroundColor: theme.colors.accentSoft }]}>
        <Icon size={16} color={theme.colors.accent} strokeWidth={1.8} />
      </View>
      <View style={styles.insightText}>
        <AppText variant="footnote" color="muted" numberOfLines={1}>
          {label}
        </AppText>
        <AppText variant="caption" color="primary" numberOfLines={1}>
          {title}
        </AppText>
        <AppText variant="footnote" color="muted" numberOfLines={2}>
          {value}
        </AppText>
      </View>
    </GlassSurface>
  );
  return (
    <Animated.View entering={FadeInUp.delay(delay).duration(360)}>
      {onPress ? (
        <PressableScale onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label}: ${title}`}>
          {content}
        </PressableScale>
      ) : content}
    </Animated.View>
  );
}

function ProactiveCard({
  suggestion,
  compact,
  onAccept,
  onDismiss,
  onRemindLater,
}: {
  suggestion: HomeSuggestion;
  compact?: boolean;
  onAccept: () => void;
  onDismiss: () => void;
  onRemindLater: () => void;
}) {
  return (
    <GlassSurface intensity={24} radius={Radii.lg} style={[styles.proactiveCard, compact && styles.proactiveCompact]}>
      <View style={styles.proactiveMain}>
        <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
          {suggestion.title}
        </AppText>
        <AppText variant="caption" color="muted" numberOfLines={compact ? 2 : 3}>
          {suggestion.message}
        </AppText>
        <AppText variant="footnote" color="tertiary" numberOfLines={compact ? 1 : 2}>
          {suggestion.explanation}
        </AppText>
        <View style={styles.proactiveActions}>
          <PressableScale onPress={onAccept} accessibilityRole="button" accessibilityLabel="Do now" style={styles.suggestionButtonPrimary}>
            <AppText variant="footnote" color="accent">Do now</AppText>
          </PressableScale>
          <PressableScale onPress={onRemindLater} accessibilityRole="button" accessibilityLabel="Remind later" style={styles.suggestionButton}>
            <AppText variant="footnote" color="secondary">Remind later</AppText>
          </PressableScale>
          <PressableScale onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss suggestion" style={styles.suggestionButton}>
            <AppText variant="footnote" color="muted">Dismiss</AppText>
          </PressableScale>
        </View>
      </View>
    </GlassSurface>
  );
}

const styles = StyleSheet.create({
  desktopRoot: { flex: 1, flexDirection: 'row', gap: 24, paddingHorizontal: 24, paddingVertical: 24, overflow: 'hidden' },
  desktopVignette: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.18)' },
  sidebarWrap: { width: 72 },
  sidebarExpanded: { width: 176 },
  sidebar: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingVertical: 24, paddingHorizontal: 8 },
  sidebarBrand: { width: '100%', minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  brandMark: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  navList: { width: '100%', gap: 8 },
  navButton: { width: '100%' },
  navInner: { minHeight: 48, borderRadius: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  desktopCenterScroll: { flex: 1, minWidth: 0 },
  desktopCenterContent: { alignItems: 'center', paddingBottom: 56 },
  desktopHero: { minHeight: 720, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 24, paddingHorizontal: 24 },
  heroCopy: { alignItems: 'center', gap: 8 },
  desktopCenter: { flex: 1, minWidth: 0, alignItems: 'center', justifyContent: 'center', paddingVertical: Spacing.lg, gap: Spacing.lg },
  desktopGreeting: { fontFamily: Fonts.bodyBold, fontSize: 48, lineHeight: 56, letterSpacing: 0, textAlign: 'center' },
  desktopSubtitle: { fontFamily: Fonts.bodyMedium, fontSize: 18, lineHeight: 26, letterSpacing: 0, textAlign: 'center' },
  desktopOrbStage: { width: 360, height: 320, alignItems: 'center', justifyContent: 'center' },
  desktopCompanion: { maxWidth: 560, fontFamily: Fonts.bodyMedium, fontSize: 17, lineHeight: 26, letterSpacing: 0, textAlign: 'center' },
  typingDots: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  typingDot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: 'rgba(255,255,255,0.56)' },
  typingDotMid: { opacity: 0.8, transform: [{ translateY: -2 }] },
  desktopPresenceMeta: { minHeight: 34, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 12 },
  presenceDivider: { width: 1, height: 12, backgroundColor: 'rgba(255,255,255,0.12)' },
  desktopStatus: { textAlign: 'center', marginTop: -Spacing.md, marginBottom: Spacing.md },
  desktopTranscript: { maxWidth: 680, paddingHorizontal: Spacing.xl, marginBottom: Spacing.md },
  desktopTranscriptText: { fontFamily: Fonts.bodyMedium, fontSize: 22, lineHeight: 32, letterSpacing: 0, textAlign: 'center' },
  desktopConversation: { width: '100%', maxWidth: 760 },
  heroCtas: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap' },
  primaryTalkWrap: { width: '100%', maxWidth: 360 },
  primaryTalk: { minHeight: 78, flexDirection: 'row', alignItems: 'center', gap: 16, paddingLeft: 8, paddingRight: 24 },
  primaryTalkCopy: { flex: 1, gap: 2 },
  secondaryCta: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, backgroundColor: 'rgba(255,255,255,0.045)' },
  quickActionRow: { maxWidth: 760, flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  desktopQuickAction: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 14 },
  belowFold: { width: '100%', maxWidth: 880, flexDirection: 'row', flexWrap: 'wrap', gap: 16, paddingTop: 32 },
  belowCardWrap: { flexGrow: 1, flexBasis: 260 },
  heroCardGrid: { width: '100%', maxWidth: 820, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.md },
  heroCardWrap: { width: '47%', minWidth: 260 },
  desktopPromptRow: { width: '100%', maxWidth: 860, flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.xl },
  desktopPromptWrap: { flex: 1 },
  desktopPrompt: { minHeight: 104, padding: Spacing.lg, justifyContent: 'space-between', gap: Spacing.md },
  desktopInput: { width: '100%', maxWidth: 720, minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: Spacing.lg, paddingLeft: Spacing.xl, paddingRight: Spacing.sm, marginTop: Spacing.xl },
  desktopInputText: { flex: 1, gap: Spacing.xs },
  rightPanel: { width: 328 },
  rightPanelSurface: { flex: 1, padding: 16 },
  rightPanelHeader: { gap: 4, paddingBottom: 16 },
  rightPanelScroll: { gap: 12, paddingBottom: 16 },
  insightCard: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 14, padding: 14 },
  moreInsights: { minHeight: 44, alignItems: 'center', justifyContent: 'center', paddingHorizontal: Spacing.md },
  insightIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  insightText: { flex: 1, gap: Spacing.xs },
  deskRoot: { flex: 1 },
  deskCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', maxWidth: 920, alignSelf: 'center', width: '100%' },
  hello: { fontFamily: Fonts.bodyBold, fontSize: 46, lineHeight: 54, letterSpacing: 0 },
  helloSub: { fontFamily: Fonts.bodyBold, fontSize: 40, lineHeight: 48, letterSpacing: 0 },
  cardRow: { flexDirection: 'row', gap: Spacing.md, marginTop: Spacing.huge, width: '100%' },
  cardWrap: { flex: 1 },
  card: { padding: Spacing.lg, minHeight: 130, justifyContent: 'space-between' },
  proactiveCard: { width: '100%', maxWidth: 620, marginTop: Spacing.xl, padding: Spacing.md, gap: Spacing.md },
  proactiveCompact: { maxWidth: '100%', marginTop: 0 },
  proactiveMain: { flex: 1, gap: Spacing.xs },
  proactiveActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingTop: 8 },
  suggestionButtonPrimary: { minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(93,220,255,0.12)' },
  suggestionButton: { minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12, backgroundColor: 'rgba(255,255,255,0.05)' },
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
