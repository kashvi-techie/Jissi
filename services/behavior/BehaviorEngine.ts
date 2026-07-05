import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  BehaviorCategory,
  BehaviorContext,
  BehaviorEvent,
  BehaviorFeedback,
  BehaviorPrediction,
  BehaviorRoutine,
  BehaviorSnapshot,
  RoutineType,
} from './types';

const EVENTS_KEY = '@jissi/behavior/events';
const ROUTINES_KEY = '@jissi/behavior/routines';
const MAX_EVENTS = 500;
const ROUTINE_THRESHOLD = 0.72;
const TWO_WEEKS_MS = 14 * 24 * 60 * 60 * 1000;

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function weekday(date: Date): number {
  return date.getDay();
}

function hourBucket(hour: number): { start: number; end: number } {
  const start = Math.floor(hour / 2) * 2;
  return { start, end: Math.min(start + 2, 24) };
}

function sameWindow(event: BehaviorEvent, routine: BehaviorRoutine): boolean {
  return event.hour >= routine.hourWindow.start && event.hour < routine.hourWindow.end;
}

function routineLabel(type: RoutineType): string {
  return type
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function inferRoutineType(event: BehaviorEvent): RoutineType {
  const text = `${event.intent ?? ''} ${String(event.metadata?.query ?? '')} ${String(event.metadata?.text ?? '')}`.toLowerCase();
  if (/code|coding|vscode|vs code|developer|programming/.test(text)) return 'coding';
  if (/study|learn|exam|notes|homework/.test(text)) return 'studying';
  if (/workout|gym|run|exercise/.test(text)) return 'workout';
  if (/sleep|bed|night/.test(text)) return 'sleep';
  if (/map|navigate|travel|route|cab|train|flight/.test(text)) return 'travel';
  if (/read|book|article/.test(text)) return 'reading';
  if (/music|playlist|song|lofi|lo-fi/.test(text) || event.category === 'music') return 'music';
  if (event.category === 'search') return 'searching';
  if (event.category === 'conversation') {
    if (event.hour >= 5 && event.hour < 11) return 'morning_routine';
    if (event.hour >= 20 || event.hour < 4) return 'night_routine';
    return 'conversation';
  }
  return event.hour >= 20 || event.hour < 4 ? 'night_routine' : 'conversation';
}

function categoryForIntent(intent?: string, metadata?: Record<string, unknown>): BehaviorCategory {
  const query = String(metadata?.query ?? metadata?.text ?? '').toLowerCase();
  if (intent === 'open_youtube' || intent === 'open_chrome' || intent === 'open_whatsapp') return 'application';
  if (intent === 'search_google') return 'search';
  if (/music|playlist|song|lofi|lo-fi/.test(query)) return 'music';
  if (/weather|forecast|temperature/.test(query)) return 'weather';
  if (/news|headlines/.test(query)) return 'news';
  if (/map|route|navigate|directions/.test(query)) return 'navigation';
  if (/remind|reminder/.test(query)) return 'reminder';
  return 'intent';
}

function suggestionForRoutine(routine: BehaviorRoutine): string {
  switch (routine.type) {
    case 'coding':
      return 'This looks like your usual coding time. Would you like me to get your coding setup or playlist ready?';
    case 'studying':
      return 'This often lines up with your study sessions. Would you like help getting into focus mode?';
    case 'music':
      return 'You often ask for music around this time. Would you like me to play something for this routine?';
    case 'travel':
      return 'This looks like a travel-planning moment. Would you like help checking routes or timing?';
    case 'morning_routine':
      return 'This feels like your morning check-in window. Would you like a quick start for the day?';
    case 'night_routine':
      return 'This feels close to your night routine. Would you like help winding things down?';
    default:
      return `This matches your ${routine.label.toLowerCase()} pattern. Would you like help with it?`;
  }
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

class BehaviorEngineImpl {
  private initialized = false;
  private events: BehaviorEvent[] = [];
  private routines: BehaviorRoutine[] = [];

  async initialize(): Promise<void> {
    if (this.initialized) return;
    const [events, routines] = await Promise.all([
      readJson<BehaviorEvent[]>(EVENTS_KEY, []),
      readJson<BehaviorRoutine[]>(ROUTINES_KEY, []),
    ]);
    this.events = events;
    this.routines = routines;
    this.initialized = true;
  }

  async recordEvent(input: {
    category: BehaviorCategory;
    intent?: string;
    metadata?: Record<string, unknown>;
    confidence?: number;
    timestamp?: Date;
  }): Promise<BehaviorEvent> {
    await this.initialize();
    const when = input.timestamp ?? new Date();
    const event: BehaviorEvent = {
      id: id('bev'),
      timestamp: when.toISOString(),
      weekday: weekday(when),
      hour: when.getHours(),
      category: input.category,
      intent: input.intent,
      metadata: input.metadata,
      confidence: clamp(input.confidence ?? 0.55),
    };

    this.events = [event, ...this.events].slice(0, MAX_EVENTS);
    await this.detectRoutines();
    await writeJson(EVENTS_KEY, this.events);
    await writeJson(ROUTINES_KEY, this.routines);
    return event;
  }

  async recordIntent(intent: string, metadata?: Record<string, unknown>): Promise<BehaviorEvent> {
    return this.recordEvent({
      category: categoryForIntent(intent, metadata),
      intent,
      metadata,
      confidence: 0.58,
    });
  }

  async detectRoutines(): Promise<BehaviorRoutine[]> {
    await this.initialize();
    const now = Date.now();
    const recent = this.events.filter((event) => now - new Date(event.timestamp).getTime() <= TWO_WEEKS_MS);
    const buckets = new Map<string, BehaviorEvent[]>();

    for (const event of recent) {
      if (event.category === 'unknown') continue;
      const routineType = inferRoutineType(event);
      const bucket = hourBucket(event.hour);
      const key = `${routineType}:${event.category}:${event.intent ?? 'any'}:${bucket.start}-${bucket.end}`;
      buckets.set(key, [...(buckets.get(key) ?? []), event]);
    }

    const next: BehaviorRoutine[] = [];
    for (const [key, bucketEvents] of buckets) {
      const [typeRaw, category, intentRaw, windowRaw] = key.split(':');
      const type = typeRaw as RoutineType;
      const [startRaw, endRaw] = windowRaw.split('-');
      const count = bucketEvents.length;
      const avgConfidence = bucketEvents.reduce((sum, event) => sum + event.confidence, 0) / count;
      const frequencyScore = clamp(count / 9);
      const consistencyScore = clamp(new Set(bucketEvents.map((event) => event.weekday)).size / 5);
      const confidence = clamp(0.48 * frequencyScore + 0.32 * avgConfidence + 0.2 * consistencyScore);
      if (count < 3 || confidence < ROUTINE_THRESHOLD) continue;

      const label = routineLabel(type);
      const hourWindow = { start: Number(startRaw), end: Number(endRaw) };
      const lastObservedAt = bucketEvents
        .map((event) => event.timestamp)
        .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0];
      const existing = this.routines.find(
        (routine) => routine.type === type && routine.category === category && routine.intent === (intentRaw === 'any' ? undefined : intentRaw) && routine.hourWindow.start === hourWindow.start
      );

      next.push({
        id: existing?.id ?? id('routine'),
        type,
        label,
        confidence,
        eventCount: count,
        category: category as BehaviorCategory,
        intent: intentRaw === 'any' ? undefined : intentRaw,
        hourWindow,
        lastObservedAt,
        createdAt: existing?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        reason: `Observed ${count} ${label.toLowerCase()} signals during the last two weeks between ${hourWindow.start}:00 and ${hourWindow.end}:00.`,
      });
    }

    this.routines = next.sort((a, b) => b.confidence - a.confidence);
    return this.routines;
  }

  async getPredictions(context: BehaviorContext = {}): Promise<BehaviorPrediction[]> {
    await this.initialize();
    const when = context.timestamp ?? new Date();
    const hour = when.getHours();
    const category = context.category;
    const intent = context.intent;

    return this.routines
      .filter((routine) => hour >= routine.hourWindow.start && hour < routine.hourWindow.end)
      .filter((routine) => !category || routine.category === category || routine.category === 'conversation')
      .filter((routine) => !intent || !routine.intent || routine.intent === intent)
      .slice(0, 5)
      .map((routine) => ({
        id: id('prediction'),
        routineId: routine.id,
        routineType: routine.type,
        suggestion: suggestionForRoutine(routine),
        confidence: routine.confidence,
        reason: routine.reason,
        createdAt: new Date().toISOString(),
      }));
  }

  async applyFeedback(routineId: string, feedback: BehaviorFeedback): Promise<void> {
    await this.initialize();
    const delta = feedback === 'accepted' ? 0.05 : feedback === 'rejected' ? -0.08 : -0.03;
    this.routines = this.routines.map((routine) =>
      routine.id === routineId
        ? { ...routine, confidence: clamp(routine.confidence + delta), updatedAt: new Date().toISOString() }
        : routine
    );
    await writeJson(ROUTINES_KEY, this.routines);
  }

  async getSnapshot(): Promise<BehaviorSnapshot> {
    await this.initialize();
    const predictions = await this.getPredictions();
    return {
      events: [...this.events],
      routines: [...this.routines],
      predictions,
    };
  }

  async exportJson(): Promise<string> {
    const snapshot = await this.getSnapshot();
    return JSON.stringify(snapshot, null, 2);
  }

  async clearData(): Promise<void> {
    this.events = [];
    this.routines = [];
    await Promise.all([removeKey(EVENTS_KEY), removeKey(ROUTINES_KEY)]);
  }
}

export const BehaviorEngine = new BehaviorEngineImpl();
