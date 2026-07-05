import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  EmotionDailySummary,
  EmotionEstimate,
  EmotionInteractionInput,
  EmotionSignal,
  EmotionSnapshot,
  EmotionState,
  EmotionTrend,
} from './types';

const SIGNALS_KEY = '@jissi/emotion/signals';
const HISTORY_KEY = '@jissi/emotion/daily';
const MAX_SIGNALS = 500;
const RECENT_WINDOW_MS = 24 * 60 * 60 * 1000;

const DELIVERY_STYLE: Record<EmotionState, string> = {
  focused: 'Keep responses concise, direct, and action-oriented.',
  relaxed: 'Use an easy, natural tone with moderate detail.',
  curious: 'Offer a little more explanation and invite exploration.',
  excited: 'Match the energy warmly while staying useful.',
  stressed: 'Be calm, clear, and reduce cognitive load.',
  confused: 'Break answers into small steps and check assumptions.',
  tired: 'Use gentle wording and avoid overwhelming detail.',
  lonely: 'Sound warm and present without being dramatic.',
  frustrated: 'Acknowledge friction briefly, then give a practical next step.',
  neutral: 'Use JISSI’s normal warm conversational style.',
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function createId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function normalizeInput(input: string): string {
  return input.toLowerCase().replace(/[^\w\s]/g, '').replace(/\s+/g, ' ').trim();
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    return localStorage.getItem(key);
  }
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

async function removeItem(key: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(key);
    return;
  }
  await AsyncStorage.removeItem(key);
}

async function readSignals(): Promise<EmotionSignal[]> {
  try {
    const raw = await getItem(SIGNALS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeSignals(signals: EmotionSignal[]): Promise<void> {
  await setItem(SIGNALS_KEY, JSON.stringify(signals.slice(0, MAX_SIGNALS)));
}

async function readHistory(): Promise<EmotionDailySummary[]> {
  try {
    const raw = await getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function writeHistory(history: EmotionDailySummary[]): Promise<void> {
  await setItem(HISTORY_KEY, JSON.stringify(history.slice(0, 45)));
}

function makeSignal(
  type: EmotionSignal['type'],
  emotion: EmotionState,
  reason: string,
  confidence: number,
  metadata?: Record<string, unknown>
): EmotionSignal {
  const date = new Date();
  return {
    id: createId('emo'),
    timestamp: date.toISOString(),
    weekday: date.getDay(),
    hour: date.getHours(),
    type,
    emotion,
    weight: confidence,
    confidence,
    reason,
    metadata,
  };
}

function detectInputSignals(input: EmotionInteractionInput, previousSignals: EmotionSignal[]): EmotionSignal[] {
  const text = input.input.toLowerCase();
  const normalized = normalizeInput(input.input);
  const recentInputs = previousSignals
    .filter((signal) => signal.metadata?.normalizedInput)
    .slice(0, 12)
    .map((signal) => signal.metadata?.normalizedInput);
  const signals: EmotionSignal[] = [];
  const now = new Date();
  const hour = now.getHours();

  if (hour >= 23 || hour < 5) {
    signals.push(makeSignal('late_night_usage', 'tired', 'Late-night conversation activity.', 0.56));
  }

  if (input.taskType === 'coding' || input.taskType === 'studying' || input.taskType === 'writing' || input.taskType === 'designing') {
    signals.push(makeSignal('task_focus', 'focused', `Active ${input.taskType} task context.`, clamp(input.taskConfidence ?? 0.64), { taskType: input.taskType }));
  }

  if (/\b(why|how|explain|teach|learn|what is|what are|tell me)\b/.test(text) || text.includes('?')) {
    signals.push(makeSignal('curiosity', 'curious', 'Question pattern suggests curiosity or learning mode.', 0.58));
  }

  if (/\b(error|failed|not working|stuck|issue|problem|bug|crash|stopped|unable)\b/.test(text)) {
    signals.push(makeSignal('repeated_failure', 'frustrated', 'The user mentioned a problem or failed flow.', 0.64));
  }

  if (/\b(confused|samajh|kaise|again|repeat|unclear|doubt)\b/.test(text)) {
    signals.push(makeSignal('repeated_question', 'confused', 'The message asks for clarification or repetition.', 0.62));
  }

  if (recentInputs.includes(normalized) && normalized.length > 8) {
    signals.push(makeSignal('repeated_question', 'confused', 'Similar question repeated recently.', 0.7));
  }

  if (/[!]{1,}/.test(input.input) || /\b(amazing|great|awesome|love|excited|yes+|perfect)\b/.test(text)) {
    signals.push(makeSignal('positive_energy', 'excited', 'Message has high positive energy.', 0.54));
  }

  if (input.durationMs && input.durationMs > 20 * 60 * 1000) {
    signals.push(makeSignal('conversation_duration', 'focused', 'Long uninterrupted conversation session.', 0.66, { durationMs: input.durationMs }));
  }

  if (input.behaviorConfidence && input.behaviorConfidence > 0.75) {
    signals.push(makeSignal('behavior_confidence', 'focused', 'Behavior engine has a confident active routine.', input.behaviorConfidence));
  }

  if (input.reminderMissed) {
    signals.push(makeSignal('missed_reminder', 'stressed', 'A missed reminder was observed locally.', 0.6));
  }

  if (input.typingSpeed !== undefined) {
    signals.push(makeSignal('typing_speed', input.typingSpeed > 0.8 ? 'excited' : 'tired', 'Typing speed signal placeholder recorded locally.', 0.45, { typingSpeed: input.typingSpeed }));
  }

  if (input.voiceEnergy !== undefined) {
    signals.push(makeSignal('voice_energy', input.voiceEnergy > 0.7 ? 'excited' : 'relaxed', 'Voice energy signal placeholder recorded locally.', 0.45, { voiceEnergy: input.voiceEnergy }));
  }

  return signals.map((signal) => ({
    ...signal,
    metadata: {
      ...signal.metadata,
      intent: input.intent,
      normalizedInput: normalized,
    },
  }));
}

function scoreSignals(signals: EmotionSignal[]): Map<EmotionState, { score: number; reasons: string[]; signals: EmotionSignal[] }> {
  const now = Date.now();
  const scores = new Map<EmotionState, { score: number; reasons: string[]; signals: EmotionSignal[] }>();

  signals.forEach((signal) => {
    const age = now - new Date(signal.timestamp).getTime();
    const decay = age > RECENT_WINDOW_MS ? 0.35 : Math.max(0.45, 1 - age / RECENT_WINDOW_MS);
    const weighted = signal.weight * signal.confidence * decay;
    const current = scores.get(signal.emotion) ?? { score: 0, reasons: [], signals: [] };
    current.score += weighted;
    if (!current.reasons.includes(signal.reason)) current.reasons.push(signal.reason);
    current.signals.push(signal);
    scores.set(signal.emotion, current);
  });

  return scores;
}

function estimateFromSignals(signals: EmotionSignal[]): EmotionEstimate {
  const recent = signals.filter((signal) => Date.now() - new Date(signal.timestamp).getTime() < 7 * 24 * 60 * 60 * 1000);
  const scores = scoreSignals(recent);
  const sorted = [...scores.entries()].sort((a, b) => b[1].score - a[1].score);
  const top = sorted[0];
  const total = sorted.reduce((sum, [, value]) => sum + value.score, 0);
  const state = top?.[0] ?? 'neutral';
  const score = top?.[1].score ?? 0;
  const confidence = state === 'neutral' ? 0.4 : clamp(0.35 + (total ? score / total : 0) * 0.55);
  const relatedSignals = top?.[1].signals.slice(0, 8) ?? [];

  return {
    state,
    confidence,
    reasons: top?.[1].reasons.slice(0, 4) ?? ['No strong local emotion signals yet.'],
    signals: relatedSignals,
    deliveryStyle: DELIVERY_STYLE[state],
    wellbeingSuggestion: wellbeingSuggestion(recent),
    updatedAt: new Date().toISOString(),
  };
}

function summarizeDay(signals: EmotionSignal[], date: string): EmotionDailySummary {
  const daySignals = signals.filter((signal) => signal.timestamp.startsWith(date));
  const estimate = estimateFromSignals(daySignals);
  return {
    date,
    dominantEmotion: estimate.state,
    confidence: estimate.confidence,
    reasons: estimate.reasons,
    signalCount: daySignals.length,
  };
}

function buildTrends(history: EmotionDailySummary[]): EmotionTrend[] {
  return [
    buildTrend(history.slice(0, 7), 'last_7_days'),
    buildTrend(history.slice(0, 30), 'last_30_days'),
  ];
}

function buildTrend(history: EmotionDailySummary[], range: EmotionTrend['range']): EmotionTrend {
  if (!history.length) {
    return { range, dominantEmotion: 'neutral', confidence: 0.4, summary: 'No emotional trend has formed yet.' };
  }

  const counts = new Map<EmotionState, number>();
  history.forEach((item) => {
    counts.set(item.dominantEmotion, (counts.get(item.dominantEmotion) ?? 0) + item.confidence);
  });
  const [dominantEmotion, score] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const confidence = clamp(score / history.length);

  return {
    range,
    dominantEmotion,
    confidence,
    summary: `Mostly ${dominantEmotion} across ${history.length} recorded day${history.length === 1 ? '' : 's'}.`,
  };
}

function wellbeingSuggestion(signals: EmotionSignal[]): string | undefined {
  const lateNightCount = signals.filter((signal) => signal.type === 'late_night_usage').length;
  const frustrationCount = signals.filter((signal) => signal.emotion === 'frustrated' || signal.emotion === 'stressed').length;
  const tiredCount = signals.filter((signal) => signal.emotion === 'tired').length;

  if (lateNightCount >= 3 || tiredCount >= 4) {
    return 'Maybe keep the next reply gentle and suggest rest or water if it fits naturally.';
  }
  if (frustrationCount >= 4) {
    return 'Offer one calm next step and avoid piling on too many options.';
  }
  return undefined;
}

class EmotionEngineImpl {
  async recordInteraction(input: EmotionInteractionInput): Promise<EmotionEstimate> {
    const existing = await readSignals();
    const detected = detectInputSignals(input, existing);
    if (!detected.length) {
      const neutralSignal = makeSignal('conversation_frequency', 'neutral', 'Conversation continued without strong emotion signals.', 0.34, {
        intent: input.intent,
        normalizedInput: normalizeInput(input.input),
      });
      detected.push(neutralSignal);
    }

    const nextSignals = [...detected, ...existing].slice(0, MAX_SIGNALS);
    await writeSignals(nextSignals);
    await this.refreshDailySummary(nextSignals);
    return estimateFromSignals(nextSignals);
  }

  async recordAssistantResponse(response: string): Promise<void> {
    if (!response.trim()) return;
    const signals = await readSignals();
    await this.refreshDailySummary(signals);
  }

  async getCurrentEmotion(): Promise<EmotionEstimate> {
    return estimateFromSignals(await readSignals());
  }

  async getSnapshot(): Promise<EmotionSnapshot> {
    const signals = await readSignals();
    const history = await this.getHistory(signals);
    return {
      current: estimateFromSignals(signals),
      signals,
      history,
      trends: buildTrends(history),
    };
  }

  async getHistory(seedSignals?: EmotionSignal[]): Promise<EmotionDailySummary[]> {
    const signals = seedSignals ?? await readSignals();
    const stored = await readHistory();
    const dates = [...new Set(signals.map((signal) => dateKey(new Date(signal.timestamp))))].sort().reverse();
    const generated = dates.map((date) => summarizeDay(signals, date));
    const merged = [
      ...generated,
      ...stored.filter((summary) => !generated.some((item) => item.date === summary.date)),
    ];
    return merged.slice(0, 45);
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  async clearData(): Promise<void> {
    await removeItem(SIGNALS_KEY);
    await removeItem(HISTORY_KEY);
  }

  private async refreshDailySummary(signals: EmotionSignal[]): Promise<void> {
    const today = dateKey(new Date());
    const history = await readHistory();
    const summary = summarizeDay(signals, today);
    await writeHistory([summary, ...history.filter((item) => item.date !== today)]);
  }
}

export const EmotionEngine = new EmotionEngineImpl();
