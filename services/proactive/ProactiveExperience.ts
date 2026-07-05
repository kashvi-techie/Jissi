import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { ContextEngine } from '@/services/context';
import { EmotionEngine } from '@/services/emotion';
import { PlannerEngine } from '@/services/planner';
import { memoryStore } from '@/services/tools/memory/MemoryStore';
import {
  ProactiveConfig,
  ProactiveFeedback,
  ProactiveHistoryEntry,
  ProactiveInterruptionState,
  ProactiveSnapshot,
  ProactiveSource,
  ProactiveSuggestion,
} from './types';

const HISTORY_KEY = '@jissi/proactive/history';
const CONFIG_KEY = '@jissi/proactive/config';
const MAX_HISTORY = 300;
const DEFAULT_CONFIG: ProactiveConfig = {
  threshold: 0.85,
  cooldownHours: 4,
};

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function addHours(hours: number): string {
  return new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();
}

function signatureFor(suggestion: Pick<ProactiveSuggestion, 'source' | 'title' | 'action'>): string {
  const action = suggestion.action.type === 'prompt' ? suggestion.action.prompt : suggestion.action.type;
  return `${suggestion.source}:${suggestion.title}:${action}`.toLowerCase();
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

async function removeKey(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

function blockReason(state?: ProactiveInterruptionState): string | undefined {
  if (!state) return undefined;
  if (state.userTalking) return 'User is currently talking.';
  if (state.voiceActive) return 'Voice interaction is active.';
  if (state.musicActive) return 'Music is active.';
  if (state.phoneCallActive) return 'Phone call is active.';
  if (state.navigationActive) return 'Navigation is active.';
  return undefined;
}

function feedbackAdjustment(history: ProactiveHistoryEntry[], signature: string): number {
  return history
    .filter((entry) => entry.signature === signature)
    .slice(0, 8)
    .reduce((sum, entry) => {
      if (entry.feedback === 'accepted') return sum + 0.06;
      if (entry.feedback === 'rejected') return sum - 0.18;
      return sum - 0.08;
    }, 0);
}

function isCoolingDown(history: ProactiveHistoryEntry[], signature: string, config: ProactiveConfig): boolean {
  const newest = history.find((entry) => entry.signature === signature);
  if (!newest) return false;
  const cooldownMs = config.cooldownHours * 60 * 60 * 1000;
  return Date.now() - new Date(newest.timestamp).getTime() < cooldownMs;
}

function tuneSuggestion(suggestion: ProactiveSuggestion, history: ProactiveHistoryEntry[]): ProactiveSuggestion {
  const signature = signatureFor(suggestion);
  return {
    ...suggestion,
    confidence: clamp(suggestion.confidence + feedbackAdjustment(history, signature)),
  };
}

function uniqueBySignature(suggestions: ProactiveSuggestion[]): ProactiveSuggestion[] {
  const seen = new Set<string>();
  return suggestions.filter((suggestion) => {
    const signature = signatureFor(suggestion);
    if (seen.has(signature)) return false;
    seen.add(signature);
    return true;
  });
}

class ProactiveExperienceImpl {
  async getSuggestions(state?: ProactiveInterruptionState): Promise<ProactiveSuggestion[]> {
    const [config, history] = await Promise.all([this.getConfig(), this.getHistory()]);
    const blocked = blockReason(state);
    if (blocked) return [];

    const candidates = await this.collectCandidates();
    return uniqueBySignature(candidates)
      .map((suggestion) => tuneSuggestion(suggestion, history))
      .filter((suggestion) => suggestion.confidence >= config.threshold)
      .filter((suggestion) => !isCoolingDown(history, signatureFor(suggestion), config))
      .sort((a, b) => a.priority - b.priority || b.confidence - a.confidence)
      .slice(0, 5);
  }

  async getSnapshot(state?: ProactiveInterruptionState): Promise<ProactiveSnapshot> {
    const [config, history] = await Promise.all([this.getConfig(), this.getHistory()]);
    const blockedReason = blockReason(state);
    return {
      suggestions: blockedReason ? [] : await this.getSuggestions(state),
      history,
      config,
      blockedReason,
    };
  }

  async recordFeedback(suggestion: ProactiveSuggestion, feedback: ProactiveFeedback): Promise<void> {
    const history = await this.getHistory();
    const signature = signatureFor(suggestion);
    const delta = feedback === 'accepted' ? 0.06 : feedback === 'rejected' ? -0.18 : -0.08;
    const confidenceAfter = clamp(suggestion.confidence + delta);
    const entry: ProactiveHistoryEntry = {
      id: id('prohist'),
      suggestionId: suggestion.id,
      signature,
      source: suggestion.source,
      feedback,
      confidenceBefore: suggestion.confidence,
      confidenceAfter,
      timestamp: new Date().toISOString(),
      reason: feedback === 'accepted'
        ? 'User accepted the proactive suggestion.'
        : feedback === 'rejected'
          ? 'User rejected the proactive suggestion.'
          : 'Suggestion expired or was dismissed without action.',
    };
    await writeJson(HISTORY_KEY, [entry, ...history].slice(0, MAX_HISTORY));
  }

  async updateConfig(config: Partial<ProactiveConfig>): Promise<ProactiveConfig> {
    const current = await this.getConfig();
    const next = {
      ...current,
      ...config,
      threshold: clamp(config.threshold ?? current.threshold),
      cooldownHours: Math.max(1, config.cooldownHours ?? current.cooldownHours),
    };
    await writeJson(CONFIG_KEY, next);
    return next;
  }

  async getConfig(): Promise<ProactiveConfig> {
    return readJson<ProactiveConfig>(CONFIG_KEY, DEFAULT_CONFIG);
  }

  async getHistory(): Promise<ProactiveHistoryEntry[]> {
    return readJson<ProactiveHistoryEntry[]>(HISTORY_KEY, []);
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  async clearData(): Promise<void> {
    await removeKey(HISTORY_KEY);
    await removeKey(CONFIG_KEY);
  }

  private async collectCandidates(): Promise<ProactiveSuggestion[]> {
    const [behavior, planner, emotion, context, memoryCount] = await Promise.all([
      BehaviorEngine.getPredictions().catch(() => []),
      PlannerEngine.getSnapshot().catch(() => null),
      EmotionEngine.getCurrentEmotion().catch(() => null),
      ContextEngine.getCurrentContext().catch(() => null),
      memoryStore.count().catch(() => 0),
    ]);
    const suggestions: ProactiveSuggestion[] = [];

    behavior.forEach((prediction) => {
      suggestions.push({
        id: id('pro'),
        source: 'behavior',
        title: 'Routine detected',
        message: this.humanize(prediction.suggestion),
        reason: prediction.reason,
        confidence: prediction.confidence,
        priority: prediction.confidence > 0.92 ? 1 : 2,
        expiry: addHours(2),
        action: { type: 'prompt', prompt: prediction.suggestion },
      });
    });

    planner?.agenda.items.forEach((item) => {
      const priorityBoost = item.priority === 1 ? 0.08 : item.priority === 2 ? 0.03 : 0;
      suggestions.push({
        id: id('pro'),
        source: 'planner',
        title: item.title,
        message: `I noticed "${item.title}" is a useful next step for ${item.goalTitle}. Would you like to start with that?`,
        reason: item.reason,
        confidence: clamp(0.8 + priorityBoost),
        priority: item.priority,
        expiry: addHours(8),
        action: { type: 'prompt', prompt: `Help me work on ${item.title}` },
      });
    });

    if (emotion && (emotion.state === 'tired' || emotion.state === 'stressed' || emotion.state === 'frustrated') && emotion.confidence >= 0.85) {
      suggestions.push({
        id: id('pro'),
        source: 'emotion',
        title: emotion.state === 'tired' ? 'Gentle break' : 'Reset moment',
        message: emotion.state === 'tired'
          ? 'I noticed this may be a low-energy moment. Would you like a lighter plan or a short break?'
          : 'I noticed a bit of friction in the flow. Would you like me to help simplify the next step?',
        reason: emotion.reasons.join(' '),
        confidence: emotion.confidence,
        priority: 2,
        expiry: addHours(1),
        action: { type: 'prompt', prompt: emotion.state === 'tired' ? 'Help me make a lighter plan for now' : 'Help me simplify the next step' },
      });
    }

    if (context?.task && context.task.confidence >= 0.85) {
      suggestions.push({
        id: id('pro'),
        source: 'context',
        title: `Resume ${context.task.label}`,
        message: `I noticed ${context.task.label.toLowerCase()} is still active. Would you like to continue from there?`,
        reason: context.task.evidence[0] ?? `Active task context is ${context.task.label}.`,
        confidence: context.task.confidence,
        priority: 2,
        expiry: addHours(3),
        action: { type: 'prompt', prompt: `Continue ${context.task.label}` },
      });
    }

    if (memoryCount >= 5) {
      suggestions.push({
        id: id('pro'),
        source: 'memory',
        title: 'Personalized check-in',
        message: 'I have enough saved preferences to make this more personal. Would you like a quick tailored check-in?',
        reason: `${memoryCount} local memory entries are available.`,
        confidence: clamp(0.72 + memoryCount / 100),
        priority: 3,
        expiry: addHours(12),
        action: { type: 'prompt', prompt: 'Give me a personalized check-in based on what you know locally' },
      });
    }

    return suggestions;
  }

  private humanize(message: string): string {
    if (/^this looks|^this feels|^you often/i.test(message)) return message;
    return `I noticed a pattern here. ${message}`;
  }
}

export const ProactiveExperience = new ProactiveExperienceImpl();
