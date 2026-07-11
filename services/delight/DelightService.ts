import AsyncStorage from '@react-native-async-storage/async-storage';
import { ConversationRepository } from '@/services/conversation';
import { ContextEngine } from '@/services/context';
import { OnboardingService } from '@/services/onboarding';
import { PlannerEngine } from '@/services/planner';
import { ProactiveExperience } from '@/services/proactive';
import type { DelightAchievement, DelightAchievementId, DelightQuote, DelightSnapshot } from './types';

const UNLOCKED_KEY = '@jissi/delight/unlocked-achievements';

const QUOTES: DelightQuote[] = [
  { text: 'Small steps, repeated with heart, become a life you can be proud of.', author: 'JISSI' },
  { text: 'Focus is quiet confidence in motion.', author: 'JISSI' },
  { text: 'Your future is built in the minutes nobody claps for yet.', author: 'JISSI' },
  { text: 'Progress does not need drama. It needs return.', author: 'JISSI' },
  { text: 'Make today gentle, clear, and useful.', author: 'JISSI' },
  { text: 'The work you keep returning to is already shaping you.', author: 'JISSI' },
  { text: 'Momentum is just trust, practiced daily.', author: 'JISSI' },
];

const ACHIEVEMENT_COPY: Record<DelightAchievementId, Omit<DelightAchievement, 'id' | 'reason' | 'unlockedAt' | 'fresh'>> = {
  first_goal_completed: {
    title: 'First goal completed',
    description: 'You turned a plan into progress. That deserves a moment.',
  },
  seven_day_streak: {
    title: '7 day streak',
    description: 'You kept showing up for a full week.',
  },
  ten_conversations: {
    title: '10 conversations',
    description: 'JISSI is starting to understand your rhythm.',
  },
  first_proactive_suggestion_accepted: {
    title: 'First helpful nudge',
    description: 'You accepted a proactive suggestion from JISSI.',
  },
  first_relationship_remembered: {
    title: 'First relationship remembered',
    description: 'JISSI remembered someone important in your world.',
  },
};

async function readUnlocked(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(UNLOCKED_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

async function writeUnlocked(value: Record<string, string>): Promise<void> {
  await AsyncStorage.setItem(UNLOCKED_KEY, JSON.stringify(value));
}

function dayOfYear(date: Date): number {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const today = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((today - start) / 86400000);
}

function quoteForToday(): DelightQuote {
  return QUOTES[dayOfYear(new Date()) % QUOTES.length];
}

function wasYesterday(value: string | null): boolean {
  if (!value) return false;
  const date = new Date(value);
  const now = new Date();
  const yesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const time = date.getTime();
  return time >= yesterday && time < today;
}

function makeWelcome(name: string | undefined, activeGoalTitle: string | undefined, streak: number, lastConversationAt: string | null): string {
  const displayName = name?.trim();
  if (streak >= 2 && activeGoalTitle) {
    return `Your ${activeGoalTitle} streak is now ${streak} days.`;
  }
  if (activeGoalTitle) {
    return `You're making great progress on ${activeGoalTitle}.`;
  }
  if (wasYesterday(lastConversationAt)) {
    return 'I remembered where we stopped yesterday.';
  }
  return displayName ? `Welcome back ${displayName}.` : 'Welcome back.';
}

function buildAchievement(id: DelightAchievementId, reason: string, unlockedAt?: string, fresh = false): DelightAchievement {
  const copy = ACHIEVEMENT_COPY[id];
  return {
    id,
    title: copy.title,
    description: copy.description,
    reason,
    unlockedAt,
    fresh,
  };
}

class DelightServiceImpl {
  async getSnapshot(): Promise<DelightSnapshot> {
    const [profile, planner, conversationStats, context, proactiveHistory, unlocked] = await Promise.all([
      OnboardingService.getProfile().catch(() => null),
      PlannerEngine.getSnapshot().catch(() => null),
      ConversationRepository.getConversationStats().catch(() => null),
      ContextEngine.getCurrentContext().catch(() => null),
      ProactiveExperience.getHistory().catch(() => []),
      readUnlocked(),
    ]);

    const completedGoals = planner?.goals.filter((goal) => goal.status === 'completed' || goal.progress.completionPercent >= 100).length ?? 0;
    const longestStreak = Math.max(0, ...(planner?.goals.map((goal) => goal.progress.longestStreak) ?? [0]));
    const activeGoal = planner?.goals.find((goal) => goal.status !== 'completed') ?? planner?.goals[0];
    const acceptedProactive = proactiveHistory.some((entry) => entry.feedback === 'accepted');
    const relationships = context?.relationships.length ?? 0;
    const conversations = conversationStats?.conversationCount ?? 0;

    const candidates: Array<{ id: DelightAchievementId; achieved: boolean; reason: string }> = [
      { id: 'first_goal_completed', achieved: completedGoals >= 1, reason: `${completedGoals} planner goal completed.` },
      { id: 'seven_day_streak', achieved: longestStreak >= 7, reason: `Longest planner streak is ${longestStreak} days.` },
      { id: 'ten_conversations', achieved: conversations >= 10, reason: `${conversations} conversations remembered locally.` },
      { id: 'first_proactive_suggestion_accepted', achieved: acceptedProactive, reason: 'A proactive suggestion was accepted.' },
      { id: 'first_relationship_remembered', achieved: relationships >= 1, reason: `${relationships} relationship context item stored.` },
    ];

    const nextUnlocked = { ...unlocked };
    const now = new Date().toISOString();
    const newlyUnlocked: DelightAchievement[] = [];

    candidates.forEach((candidate) => {
      if (candidate.achieved && !nextUnlocked[candidate.id]) {
        nextUnlocked[candidate.id] = now;
        newlyUnlocked.push(buildAchievement(candidate.id, candidate.reason, now, true));
      }
    });

    if (newlyUnlocked.length) {
      await writeUnlocked(nextUnlocked);
    }

    const achievements = candidates
      .filter((candidate) => candidate.achieved || nextUnlocked[candidate.id])
      .map((candidate) => buildAchievement(candidate.id, candidate.reason, nextUnlocked[candidate.id], newlyUnlocked.some((item) => item.id === candidate.id)));

    return {
      welcome: makeWelcome(profile?.nickname || profile?.name, activeGoal?.title, activeGoal?.progress.currentStreak ?? 0, conversationStats?.lastConversationAt ?? null),
      quote: quoteForToday(),
      achievements,
      newlyUnlocked,
    };
  }
}

export const DelightService = new DelightServiceImpl();
