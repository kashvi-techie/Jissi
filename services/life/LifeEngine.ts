import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { ContextEngine } from '@/services/context';
import { EmotionEngine } from '@/services/emotion';
import { PlannerEngine } from '@/services/planner';
import { TimelineService } from '@/services/timeline';
import {
  LifeBehaviorSignals,
  LifeCooldownEntry,
  LifeContextState,
  LifeDecision,
  LifeEmotionState,
  LifeInterruptionState,
  LifePlannerState,
  LifeSnapshot,
  LifeSource,
} from './types';

const COOLDOWN_KEY = '@jissi/life/cooldowns';
const DEFAULT_THRESHOLD = 0.84;
const DEFAULT_COOLDOWN_HOURS = 4;

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function isBlocked(state?: LifeInterruptionState): string | undefined {
  if (!state) return undefined;
  if (state.userTalking) return 'User is currently talking.';
  if (state.voiceActive) return 'Voice is active.';
  if (state.musicActive) return 'Music is active.';
  if (state.phoneCallActive) return 'Phone call is active.';
  if (state.navigationActive) return 'Navigation is active.';
  return undefined;
}

async function readJson<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? localStorage.getItem(key)
      : await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(key: string, value: T): Promise<void> {
  const raw = JSON.stringify(value);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, raw);
    return;
  }
  await AsyncStorage.setItem(key, raw);
}

function makeDecision(input: {
  actionType: LifeDecision['actionType'];
  title: string;
  message: string;
  confidence: number;
  priority: LifeDecision['priority'];
  reason: string;
  explanation: string;
  sources: LifeSource[];
  cooldownKey: string;
  prompt?: string;
}): LifeDecision {
  return {
    id: id('life'),
    actionType: input.actionType,
    title: input.title,
    message: input.message,
    confidence: clamp(input.confidence),
    priority: input.priority,
    reason: input.reason,
    explanation: input.explanation,
    sources: input.sources,
    cooldownKey: input.cooldownKey,
    action: input.prompt ? { type: 'prompt', prompt: input.prompt } : { type: 'none' },
  };
}

function silent(reason: string, explanation: string): LifeDecision {
  return makeDecision({
    actionType: 'silent',
    title: 'Stay silent',
    message: 'No user-facing action right now.',
    confidence: 1,
    priority: 3,
    reason,
    explanation,
    sources: [],
    cooldownKey: 'silent',
  });
}

class LifeEngineImpl {
  async getDecision(state?: LifeInterruptionState): Promise<LifeDecision> {
    const snapshot = await this.getSnapshot(state);
    return snapshot.chosenAction;
  }

  async getSnapshot(state?: LifeInterruptionState): Promise<LifeSnapshot> {
    const blocked = isBlocked(state);
    const [behavior, planner, emotionSnapshot, context, timeline, cooldowns] = await Promise.all([
      BehaviorEngine.getSnapshot(),
      PlannerEngine.getSnapshot(),
      EmotionEngine.getSnapshot(),
      ContextEngine.getCurrentContext(),
      TimelineService.getSnapshot(),
      this.getCooldowns(),
    ]);

    const behaviorSignals: LifeBehaviorSignals = {
      routineCount: behavior.routines.length,
      predictionCount: behavior.predictions.length,
      topRoutine: behavior.routines[0]?.label,
      topPrediction: behavior.predictions[0]?.routineType,
      coffeePattern: behavior.events.slice(0, 80).some((event) => /coffee|chai|cafe/i.test(`${event.intent ?? ''} ${String(event.metadata?.query ?? '')} ${String(event.metadata?.text ?? '')}`)),
    };

    const activeGoals = planner.goals.filter((goal) => goal.status !== 'completed');
    const stalledGoal = activeGoals.find((goal) => goal.progress.completionPercent > 0 && goal.progress.completionPercent < 35 && goal.progress.consistency < 0.35);
    const recentCompletedGoal = planner.goals
      .filter((goal) => goal.status === 'completed')
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
    const plannerState: LifePlannerState = {
      activeGoals: activeGoals.length,
      completedGoals: planner.goals.length - activeGoals.length,
      pendingAgendaItems: planner.agenda.items.length,
      stalledGoal: stalledGoal?.title,
      recentCompletedGoal: recentCompletedGoal?.title,
      nextTask: planner.agenda.items[0]?.title,
    };

    const frustrationSignals = emotionSnapshot.signals.filter((signal) => signal.emotion === 'frustrated' || signal.emotion === 'stressed' || signal.emotion === 'confused').slice(0, 12).length;
    const emotionState: LifeEmotionState = {
      state: emotionSnapshot.current.state,
      confidence: emotionSnapshot.current.confidence,
      frustrationSignals,
      reason: emotionSnapshot.current.reasons[0] ?? 'No strong emotion signal.',
    };

    const contextState: LifeContextState = {
      task: context.task?.label,
      taskConfidence: context.task?.confidence,
      relationshipCount: context.relationships.length,
      dayPart: context.temporal.dayPart,
    };

    const candidates = blocked
      ? []
      : this.buildCandidates(behaviorSignals, plannerState, emotionState, contextState, timeline.stats.milestonesAchieved);
    const available = candidates
      .map((candidate) => this.applyCooldown(candidate, cooldowns))
      .filter((candidate) => candidate.confidence >= DEFAULT_THRESHOLD)
      .sort((a, b) => a.priority - b.priority || b.confidence - a.confidence);

    const chosenAction = blocked
      ? silent(blocked, 'LifeEngine never interrupts while user, voice, music, phone, or navigation activity is active.')
      : available[0] ?? silent('No candidate passed confidence threshold.', `Highest confidence was ${Math.round((candidates[0]?.confidence ?? 0) * 100)}%.`);

    return {
      behavior: behaviorSignals,
      planner: plannerState,
      emotion: emotionState,
      context: contextState,
      timeline: {
        eventCount: timeline.events.length,
        milestonesAchieved: timeline.stats.milestonesAchieved,
      },
      chosenAction,
      candidates,
      cooldowns,
    };
  }

  async markShown(decision: LifeDecision): Promise<void> {
    if (decision.actionType === 'silent') return;
    const cooldowns = await this.getCooldowns();
    const current = cooldowns.find((item) => item.key === decision.cooldownKey);
    const next: LifeCooldownEntry = {
      key: decision.cooldownKey,
      lastShownAt: new Date().toISOString(),
      cooldownUntil: addHours(DEFAULT_COOLDOWN_HOURS),
      count: (current?.count ?? 0) + 1,
    };
    await writeJson(COOLDOWN_KEY, [next, ...cooldowns.filter((item) => item.key !== decision.cooldownKey)].slice(0, 120));
  }

  async getCooldowns(): Promise<LifeCooldownEntry[]> {
    const all = await readJson<LifeCooldownEntry[]>(COOLDOWN_KEY, []);
    const now = Date.now();
    return all.filter((entry) => new Date(entry.cooldownUntil).getTime() > now);
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  private buildCandidates(
    behavior: LifeBehaviorSignals,
    planner: LifePlannerState,
    emotion: LifeEmotionState,
    context: LifeContextState,
    milestonesAchieved: number
  ): LifeDecision[] {
    const candidates: LifeDecision[] = [];

    if (planner.recentCompletedGoal && milestonesAchieved > 0) {
      candidates.push(makeDecision({
        actionType: 'congratulate',
        title: 'Milestone completed',
        message: `Congratulations. You've completed ${planner.recentCompletedGoal}. Should I keep it highlighted in your Journey?`,
        confidence: 0.93,
        priority: 1,
        reason: 'Planner has a completed goal and Timeline has achieved milestones.',
        explanation: 'Goal completion plus timeline achievement is a high-confidence celebration moment.',
        sources: ['planner', 'timeline'],
        cooldownKey: `congrats:${planner.recentCompletedGoal}`,
        prompt: `Show me what I completed for ${planner.recentCompletedGoal}`,
      }));
    }

    if (emotion.frustrationSignals >= 3 && planner.stalledGoal) {
      candidates.push(makeDecision({
        actionType: 'motivate',
        title: 'Simplify the next step',
        message: `You've been stuck around ${planner.stalledGoal}. Would you like me to simplify today's task?`,
        confidence: clamp(0.72 + emotion.confidence * 0.22),
        priority: 1,
        reason: 'Repeated frustration signals and stalled planner progress.',
        explanation: 'When emotional friction and stalled progress overlap, LifeEngine suggests reducing task complexity.',
        sources: ['emotion', 'planner'],
        cooldownKey: `unstick:${planner.stalledGoal}`,
        prompt: `Simplify today's task for ${planner.stalledGoal}`,
      }));
    }

    if (behavior.coffeePattern && /coding/i.test(context.task ?? '') && (context.taskConfidence ?? 0) >= 0.75) {
      candidates.push(makeDecision({
        actionType: 'ask_question',
        title: 'Coding ritual',
        message: 'Coffee break first?',
        confidence: 0.87,
        priority: 2,
        reason: 'Coffee-related behavior pattern overlaps with active coding context.',
        explanation: 'This is a lightweight question, not an auto-action.',
        sources: ['behavior', 'context'],
        cooldownKey: 'coffee-before-coding',
        prompt: 'Help me start a focused coding session',
      }));
    }

    if (behavior.predictionCount > 0 && planner.nextTask && emotion.state === 'focused') {
      candidates.push(makeDecision({
        actionType: 'proactive_help',
        title: 'Continue your roadmap',
        message: `You're usually productive around this time. Want to continue "${planner.nextTask}"?`,
        confidence: clamp(0.78 + emotion.confidence * 0.14),
        priority: 2,
        reason: 'Behavior prediction, focused emotion, and pending planner task aligned.',
        explanation: 'LifeEngine only nudges when routine, emotional readiness, and goal work point in the same direction.',
        sources: ['behavior', 'emotion', 'planner'],
        cooldownKey: `continue:${planner.nextTask}`,
        prompt: `Help me continue ${planner.nextTask}`,
      }));
    }

    if (planner.nextTask && planner.pendingAgendaItems > 0) {
      candidates.push(makeDecision({
        actionType: 'remind',
        title: 'Today’s next step',
        message: `Your next useful step is "${planner.nextTask}". Want to work on it now?`,
        confidence: 0.84,
        priority: 3,
        reason: 'Planner has a pending agenda item.',
        explanation: 'Planner agenda is actionable, so LifeEngine can offer a gentle reminder.',
        sources: ['planner'],
        cooldownKey: `agenda:${planner.nextTask}`,
        prompt: `Help me work on ${planner.nextTask}`,
      }));
    }

    if (behavior.predictionCount > 0 && !planner.nextTask) {
      candidates.push(makeDecision({
        actionType: 'remind',
        title: 'Routine detected',
        message: `You usually do ${behavior.topPrediction?.replace('_', ' ')} around now. Would you like help getting started?`,
        confidence: 0.85,
        priority: 3,
        reason: 'Behavior Engine has a current prediction.',
        explanation: 'Routine-only nudges are lower priority and still respect cooldowns.',
        sources: ['behavior'],
        cooldownKey: `routine:${behavior.topPrediction}`,
        prompt: `Help me with my ${behavior.topPrediction?.replace('_', ' ')} routine`,
      }));
    }

    return candidates.sort((a, b) => b.confidence - a.confidence);
  }

  private applyCooldown(decision: LifeDecision, cooldowns: LifeCooldownEntry[]): LifeDecision {
    const cooldown = cooldowns.find((entry) => entry.key === decision.cooldownKey);
    if (!cooldown) return decision;
    return {
      ...decision,
      confidence: clamp(decision.confidence - 0.22),
      cooldownUntil: cooldown.cooldownUntil,
      reason: `${decision.reason} Cooldown active until ${new Date(cooldown.cooldownUntil).toLocaleTimeString()}.`,
    };
  }
}

export const LifeEngine = new LifeEngineImpl();
