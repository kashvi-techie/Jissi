import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { EmotionEngine } from '@/services/emotion';
import { LifeEngine } from '@/services/life';
import { MemoryConsolidationEngine } from '@/services/memory';
import { PlannerEngine } from '@/services/planner';
import { RelationshipService } from '@/services/relationships';
import { TimelineService } from '@/services/timeline';
import { DeviceStateEngine } from '@/services/device';
import type { ProactiveAction, ProactiveFeedback, ProactiveInterruptionState, ProactiveSuggestion } from './types';

export type ProactiveMomentSource = 'planner' | 'timeline' | 'memory' | 'behavior' | 'life' | 'relationship' | 'emotion' | 'device';
export type ProactiveMomentPriority = 1 | 2 | 3;
export type ProactiveMomentStatus = 'shown' | 'dismissed' | 'accepted' | 'completed' | 'remind_later' | 'ignored';

export interface ProactiveMoment {
  id: string;
  title: string;
  message: string;
  reason: string;
  confidence: number;
  priority: ProactiveMomentPriority;
  expiry: string;
  context: string;
  source: ProactiveMomentSource;
  engines: ProactiveMomentSource[];
  action: ProactiveAction;
}

export interface ProactiveMomentAnalytics {
  shown: number;
  dismissed: number;
  accepted: number;
  completed: number;
}

export interface ProactiveMomentEvent {
  id: string;
  momentId: string;
  signature: string;
  status: ProactiveMomentStatus;
  confidenceBefore: number;
  confidenceAfter: number;
  timestamp: string;
  reason: string;
}

export interface ProactiveEngineSnapshot {
  suggestions: ProactiveMoment[];
  candidates: ProactiveMoment[];
  history: ProactiveMomentEvent[];
  analytics: ProactiveMomentAnalytics;
  blockedReason?: string;
  quietContext?: string;
}

const HISTORY_KEY = '@jissi/proactive-engine/history';
const MAX_HISTORY = 300;
const CONFIDENCE_THRESHOLD = 0.72;
const DISMISS_COOLDOWN_HOURS = 8;
const REMIND_LATER_HOURS = 3;
let sequence = 0;

function id(prefix: string): string {
  sequence += 1;
  return `${prefix}_${Date.now()}_${sequence}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function signature(moment: Pick<ProactiveMoment, 'source' | 'title' | 'action'>): string {
  const action = moment.action.type === 'prompt' ? moment.action.prompt : moment.action.type === 'open_debug' ? moment.action.route : 'none';
  return `${moment.source}:${moment.title}:${action}`.toLowerCase();
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

function quietBlock(state?: ProactiveInterruptionState, quietContext?: string): string | undefined {
  if (state?.userTalking) return 'User is currently talking.';
  if (state?.voiceActive) return 'Voice interaction is active.';
  if (state?.phoneCallActive) return 'Phone call is active.';
  if (state?.navigationActive) return 'Navigation is active.';
  if (state?.musicActive) return 'Music is active.';
  if (quietContext) return quietContext;
  return undefined;
}

function feedbackTuning(history: ProactiveMomentEvent[], sig: string): number {
  return history
    .filter((entry) => entry.signature === sig)
    .slice(0, 8)
    .reduce((score, entry) => {
      if (entry.status === 'accepted' || entry.status === 'completed') return score + 0.06;
      if (entry.status === 'dismissed') return score - 0.14;
      if (entry.status === 'remind_later') return score - 0.03;
      return score - 0.06;
    }, 0);
}

function recentDismissal(history: ProactiveMomentEvent[], sig: string): boolean {
  const latest = history.find((entry) => entry.signature === sig && (entry.status === 'dismissed' || entry.status === 'remind_later'));
  if (!latest) return false;
  const hours = latest.status === 'remind_later' ? REMIND_LATER_HOURS : DISMISS_COOLDOWN_HOURS;
  return Date.now() - new Date(latest.timestamp).getTime() < hours * 60 * 60 * 1000;
}

function analyticsFrom(history: ProactiveMomentEvent[]): ProactiveMomentAnalytics {
  return history.reduce<ProactiveMomentAnalytics>((stats, entry) => {
    if (entry.status === 'shown') stats.shown += 1;
    if (entry.status === 'dismissed') stats.dismissed += 1;
    if (entry.status === 'accepted') stats.accepted += 1;
    if (entry.status === 'completed') stats.completed += 1;
    return stats;
  }, { shown: 0, dismissed: 0, accepted: 0, completed: 0 });
}

function toLegacySuggestion(moment: ProactiveMoment): ProactiveSuggestion {
  const source = moment.source === 'relationship' || moment.source === 'life' || moment.source === 'timeline' || moment.source === 'device'
    ? 'context'
    : moment.source;
  return {
    id: moment.id,
    source,
    title: moment.title,
    message: moment.message,
    reason: moment.reason,
    confidence: moment.confidence,
    priority: moment.priority,
    expiry: moment.expiry,
    action: moment.action,
  };
}

class ProactiveEngineImpl {
  async getSuggestions(state?: ProactiveInterruptionState): Promise<ProactiveMoment[]> {
    const snapshot = await this.getSnapshot(state);
    return snapshot.suggestions;
  }

  async getLegacySuggestions(state?: ProactiveInterruptionState): Promise<ProactiveSuggestion[]> {
    return (await this.getSuggestions(state)).map(toLegacySuggestion);
  }

  async getSnapshot(state?: ProactiveInterruptionState): Promise<ProactiveEngineSnapshot> {
    const [history, candidates, quietContext] = await Promise.all([
      this.getHistory(),
      this.collectCandidates(),
      this.detectQuietContext(),
    ]);
    const blockedReason = quietBlock(state, quietContext);
    const suggestions = blockedReason ? [] : this.rank(candidates, history);
    return {
      suggestions,
      candidates,
      history,
      analytics: analyticsFrom(history),
      blockedReason,
      quietContext,
    };
  }

  async record(moment: ProactiveMoment, status: ProactiveMomentStatus): Promise<void> {
    const history = await this.getHistory();
    const sig = signature(moment);
    const delta = status === 'accepted' || status === 'completed' ? 0.06 : status === 'dismissed' ? -0.14 : status === 'remind_later' ? -0.03 : -0.06;
    const entry: ProactiveMomentEvent = {
      id: id('proactive_event'),
      momentId: moment.id,
      signature: sig,
      status,
      confidenceBefore: moment.confidence,
      confidenceAfter: clamp(moment.confidence + delta),
      timestamp: new Date().toISOString(),
      reason: this.feedbackReason(status),
    };
    await writeJson(HISTORY_KEY, [entry, ...history].slice(0, MAX_HISTORY));
  }

  async recordLegacy(suggestion: ProactiveSuggestion, feedback: ProactiveFeedback | 'completed' | 'dismissed' | 'remind_later' | 'shown'): Promise<void> {
    await this.record({
      id: suggestion.id,
      title: suggestion.title,
      message: suggestion.message,
      reason: suggestion.reason,
      confidence: suggestion.confidence,
      priority: suggestion.priority,
      expiry: suggestion.expiry,
      context: 'Legacy proactive suggestion.',
      source: suggestion.source === 'context' ? 'life' : suggestion.source,
      engines: [suggestion.source === 'context' ? 'life' : suggestion.source],
      action: suggestion.action,
    }, feedback === 'rejected' ? 'dismissed' : feedback);
  }

  async getHistory(): Promise<ProactiveMomentEvent[]> {
    return readJson<ProactiveMomentEvent[]>(HISTORY_KEY, []);
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  async clearData(): Promise<void> {
    await writeJson(HISTORY_KEY, []);
  }

  private rank(candidates: ProactiveMoment[], history: ProactiveMomentEvent[]): ProactiveMoment[] {
    const seen = new Set<string>();
    return candidates
      .map((candidate) => ({
        ...candidate,
        confidence: clamp(candidate.confidence + feedbackTuning(history, signature(candidate))),
      }))
      .filter((candidate) => new Date(candidate.expiry).getTime() > Date.now())
      .filter((candidate) => candidate.confidence >= CONFIDENCE_THRESHOLD)
      .filter((candidate) => !recentDismissal(history, signature(candidate)))
      .filter((candidate) => {
        const sig = signature(candidate);
        if (seen.has(sig)) return false;
        seen.add(sig);
        return true;
      })
      .sort((a, b) => a.priority - b.priority || b.confidence - a.confidence)
      .slice(0, 5);
  }

  private async collectCandidates(): Promise<ProactiveMoment[]> {
    const [planner, timeline, memory, behavior, life, relationships, emotion, device] = await Promise.all([
      PlannerEngine.getSnapshot().catch(() => null),
      TimelineService.getSnapshot().catch(() => null),
      MemoryConsolidationEngine.getSnapshot().catch(() => null),
      BehaviorEngine.getSnapshot().catch(() => null),
      LifeEngine.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      EmotionEngine.getCurrentEmotion().catch(() => null),
      DeviceStateEngine.getContext().catch(() => null),
    ]);
    const moments: ProactiveMoment[] = [];

    if (device?.offline) {
      moments.push({
        id: id('moment'),
        title: "I'm offline",
        message: "I can't reach online services right now, but local features are still available.",
        reason: 'Device context reports offline state from a supported runtime signal.',
        confidence: Math.max(0.82, device.confidence),
        priority: 1,
        expiry: addHours(1),
        context: device.facts.join(' '),
        source: 'device',
        engines: ['device'],
        action: { type: 'prompt', prompt: 'Show me what you can do offline' },
      });
    }

    if (device?.lowBattery) {
      moments.push({
        id: id('moment'),
        title: 'Battery is low',
        message: 'Your battery looks low. Want me to keep things lightweight?',
        reason: 'Device context reports battery level below the local low-battery threshold.',
        confidence: Math.max(0.78, device.confidence),
        priority: 2,
        expiry: addHours(1),
        context: device.facts.join(' '),
        source: 'device',
        engines: ['device'],
        action: { type: 'prompt', prompt: 'Keep this session lightweight because my battery is low' },
      });
    }

    if (device?.charging) {
      moments.push({
        id: id('moment'),
        title: 'Charger connected',
        message: "You're plugged in now. Good time for a longer focus session?",
        reason: 'Device context reports that charging is active.',
        confidence: Math.max(0.76, device.confidence),
        priority: 3,
        expiry: addHours(2),
        context: device.facts.join(' '),
        source: 'device',
        engines: ['device', 'planner'],
        action: { type: 'prompt', prompt: 'Help me start a longer focus session' },
      });
    }

    if (device?.headphonesConnected) {
      moments.push({
        id: id('moment'),
        title: 'Headphones connected',
        message: 'Want a voice-first session while your headphones are connected?',
        reason: 'Device context reports an active headphone route.',
        confidence: Math.max(0.76, device.confidence),
        priority: 3,
        expiry: addHours(2),
        context: device.facts.join(' '),
        source: 'device',
        engines: ['device'],
        action: { type: 'prompt', prompt: 'Start a voice-first session' },
      });
    }

    const nextTask = planner?.agenda.items[0];
    if (nextTask) {
      moments.push({
        id: id('moment'),
        title: "Today's focus",
        message: `Want to start "${nextTask.title}" for ${nextTask.goalTitle}?`,
        reason: nextTask.reason,
        confidence: nextTask.priority === 1 ? 0.88 : 0.8,
        priority: nextTask.priority,
        expiry: addHours(6),
        context: `Planner agenda item for ${nextTask.goalTitle}.`,
        source: 'planner',
        engines: ['planner'],
        action: { type: 'prompt', prompt: `Help me work on ${nextTask.title}` },
      });
    }

    const completedToday = planner?.history.filter((entry) => entry.type === 'task_completed' && this.isToday(entry.timestamp)).length ?? 0;
    if (completedToday >= 3) {
      moments.push({
        id: id('moment'),
        title: 'Nice momentum',
        message: `You completed ${completedToday} tasks today. Nice work.`,
        reason: `Planner history shows ${completedToday} completed tasks today.`,
        confidence: 0.9,
        priority: 2,
        expiry: addHours(10),
        context: 'Planner completion history.',
        source: 'planner',
        engines: ['planner', 'timeline'],
        action: { type: 'prompt', prompt: 'Help me reflect on what I completed today' },
      });
    }

    behavior?.predictions.forEach((prediction) => {
      moments.push({
        id: id('moment'),
        title: 'Routine moment',
        message: prediction.suggestion,
        reason: prediction.reason,
        confidence: prediction.confidence,
        priority: prediction.confidence >= 0.9 ? 1 : 2,
        expiry: addHours(2),
        context: 'Behavior routine prediction.',
        source: 'behavior',
        engines: ['behavior'],
        action: { type: 'prompt', prompt: prediction.suggestion },
      });
    });

    const focusEvent = behavior?.events.find((entry) => entry.category === 'conversation' && Date.now() - new Date(entry.timestamp).getTime() < 2.25 * 60 * 60 * 1000);
    if (focusEvent) {
      moments.push({
        id: id('moment'),
        title: 'Tiny reset',
        message: "You've been working for a while. Maybe stretch for a minute.",
        reason: 'Recent local activity suggests an extended active session.',
        confidence: 0.74,
        priority: 3,
        expiry: addHours(1),
        context: 'Behavior event recency.',
        source: 'behavior',
        engines: ['behavior', 'emotion'],
        action: { type: 'prompt', prompt: 'Give me a one minute reset break' },
      });
    }

    if (life && life.chosenAction.actionType !== 'silent') {
      moments.push({
        id: id('moment'),
        title: life.chosenAction.title,
        message: life.chosenAction.message,
        reason: life.chosenAction.reason,
        confidence: life.chosenAction.confidence,
        priority: life.chosenAction.priority,
        expiry: addHours(2),
        context: life.chosenAction.explanation,
        source: 'life',
        engines: life.chosenAction.sources.map((source) => source === 'context' ? 'life' : source as ProactiveMomentSource),
        action: life.chosenAction.action,
      });
    }

    const staleRelationship = relationships.find((profile) => Date.now() - new Date(profile.lastDiscussed).getTime() > 14 * 24 * 60 * 60 * 1000);
    if (staleRelationship) {
      moments.push({
        id: id('moment'),
        title: `Check in with ${staleRelationship.name}`,
        message: `You haven't talked about ${staleRelationship.name} in a while.`,
        reason: `${staleRelationship.name} was last discussed on ${new Date(staleRelationship.lastDiscussed).toLocaleDateString()}.`,
        confidence: 0.76,
        priority: 3,
        expiry: addHours(24),
        context: `Relationship: ${staleRelationship.relationship}.`,
        source: 'relationship',
        engines: ['relationship'],
        action: { type: 'prompt', prompt: `Remind me what I know about ${staleRelationship.name}` },
      });
    }

    if (emotion?.wellbeingSuggestion && emotion.confidence >= 0.78) {
      moments.push({
        id: id('moment'),
        title: emotion.state === 'tired' ? 'Gentle pace' : 'A softer next step',
        message: emotion.wellbeingSuggestion,
        reason: emotion.reasons.join(' '),
        confidence: emotion.confidence,
        priority: emotion.state === 'frustrated' || emotion.state === 'stressed' ? 2 : 3,
        expiry: addHours(1),
        context: `Emotion estimate: ${emotion.state}.`,
        source: 'emotion',
        engines: ['emotion', 'behavior'],
        action: { type: 'prompt', prompt: 'Help me take a lighter next step' },
      });
    }

    if (timeline?.events[0]) {
      const latest = timeline.events[0];
      moments.push({
        id: id('moment'),
        title: 'Continue the thread',
        message: `Last in your journey: ${latest.title}. Want to continue from there?`,
        reason: `Timeline latest event came from ${latest.source}.`,
        confidence: latest.confidence ?? 0.73,
        priority: 3,
        expiry: addHours(8),
        context: latest.description,
        source: 'timeline',
        engines: ['timeline'],
        action: { type: 'prompt', prompt: `Continue from ${latest.title}` },
      });
    }

    if (memory?.profile.summary && memory.rawMemoryCount >= 5) {
      moments.push({
        id: id('moment'),
        title: 'Personal context ready',
        message: 'I can use what I remember locally to make this more personal.',
        reason: `${memory.rawMemoryCount} local memories are available and consolidated.`,
        confidence: Math.min(0.88, 0.7 + memory.rawMemoryCount / 100),
        priority: 3,
        expiry: addHours(12),
        context: memory.profile.summary,
        source: 'memory',
        engines: ['memory'],
        action: { type: 'prompt', prompt: 'Give me a personal check-in from what you remember locally' },
      });
    }

    return moments;
  }

  private async detectQuietContext(): Promise<string | undefined> {
    const [behavior, emotion, device] = await Promise.all([
      BehaviorEngine.getSnapshot().catch(() => null),
      EmotionEngine.getCurrentEmotion().catch(() => null),
      DeviceStateEngine.getContext().catch(() => null),
    ]);
    if (device?.offline) return 'Device is offline.';
    const hour = new Date().getHours();
    if (hour >= 23 || hour < 6) return 'Quiet hours: likely sleep time.';
    const routine = behavior?.routines[0];
    if (routine?.type === 'sleep') return 'Sleep routine is active.';
    if (routine?.type === 'travel') return 'Travel/driving-like routine is active.';
    if (emotion?.state === 'focused' && emotion.confidence >= 0.88) return 'Focus session appears active.';
    return undefined;
  }

  private feedbackReason(status: ProactiveMomentStatus): string {
    if (status === 'shown') return 'Suggestion card was shown.';
    if (status === 'dismissed') return 'User dismissed the suggestion.';
    if (status === 'accepted') return 'User accepted the suggestion.';
    if (status === 'completed') return 'User completed the proactive action.';
    if (status === 'remind_later') return 'User asked to be reminded later.';
    return 'Suggestion was ignored.';
  }

  private isToday(value: string): boolean {
    const date = new Date(value);
    const now = new Date();
    return date.getFullYear() === now.getFullYear() && date.getMonth() === now.getMonth() && date.getDate() === now.getDate();
  }
}

export const ProactiveEngine = new ProactiveEngineImpl();
