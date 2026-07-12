import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import { PlannerEngine } from '@/services/planner';
import { RelationshipService } from '@/services/relationships';
import { TimelineService } from '@/services/timeline';
import { memoryStore, MemoryEntry } from '@/services/tools/memory/MemoryStore';
import type {
  ConsolidatedMemory,
  ConsolidatedMemoryCategory,
  MemoryConsolidationSnapshot,
  UserProfileSnapshot,
} from './types';

const SNAPSHOT_KEY = '@jissi/memory/consolidation-snapshot';
const DERIVED_PREFIXES = ['consolidation:', 'relationships:index', 'relationships:profile:'];

function now(): string {
  return new Date().toISOString();
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

function titleCase(value: string): string {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');
}

function normalizeText(value: string): string {
  return value
    .toLowerCase()
    .replace(/\b(i|me|my|mine|jissi|remember|that|really|very|also|please)\b/g, ' ')
    .replace(/\b(like|likes|love|loves|enjoy|enjoys|prefer|prefers)\b/g, 'like')
    .replace(/\b(want to|wants to|goal is|trying to|working on)\b/g, 'goal')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function compactKey(value: string): string {
  const normalized = normalizeText(value);
  const tokens = normalized
    .split(/\s+/)
    .filter((token) => token.length > 2)
    .slice(0, 8);
  return tokens.join(':') || normalized || 'memory';
}

function classify(key: string, value: string): ConsolidatedMemoryCategory {
  const text = `${key} ${value}`.toLowerCase();
  if (/\b(birthday|born|anniversary)\b/.test(text)) return 'birthday';
  if (/\b(goal|gate|react|startup|learn|build|fitness|crack)\b/.test(text)) return 'goal';
  if (/\b(mother|father|teacher|mentor|friend|sir|mam|recruiter|interviewer|colleague|relationship)\b/.test(text)) return 'relationship';
  if (/\b(routine|usually|night|morning|coding time|study time|habit)\b/.test(text)) return 'routine';
  if (/\b(complete|completed|finished|achievement|won|streak|milestone)\b/.test(text)) return 'achievement';
  if (/\b(like|love|enjoy|prefer|favorite|favourite|coffee|music|playlist)\b/.test(text)) return 'preference';
  return 'general';
}

function rawSummary(entry: MemoryEntry): string {
  const value = entry.value.trim();
  if (!value) return titleCase(entry.key.replace(/[_:-]+/g, ' '));
  if (value.length <= 120) return value;
  return `${value.slice(0, 117)}...`;
}

function categorySummary(category: ConsolidatedMemoryCategory, entries: MemoryEntry[]): string {
  const first = rawSummary(entries[0]);
  if (entries.length === 1) return first;
  if (category === 'preference') return `${first.replace(/\.$/, '')}. Reinforced ${entries.length} times.`;
  if (category === 'goal') return `${first.replace(/\.$/, '')}. Mentioned across ${entries.length} memories.`;
  return `${first.replace(/\.$/, '')}. Consolidated from ${entries.length} related memories.`;
}

function confidenceFor(category: ConsolidatedMemoryCategory, strength: number, pinned: boolean): number {
  const important = category === 'goal' || category === 'birthday' || category === 'relationship' || category === 'routine' || category === 'achievement';
  const base = important ? 0.72 : 0.58;
  return Math.min(0.98, base + strength * 0.08 + (pinned ? 0.12 : 0));
}

function shouldPromote(category: ConsolidatedMemoryCategory, strength: number, pinned: boolean): boolean {
  return pinned || strength > 1 || category !== 'general';
}

function joinHuman(items: string[]): string {
  const unique = [...new Set(items.filter(Boolean))].slice(0, 5);
  if (!unique.length) return '';
  if (unique.length === 1) return unique[0];
  return `${unique.slice(0, -1).join(', ')} and ${unique[unique.length - 1]}`;
}

function isDerivedMemory(entry: MemoryEntry): boolean {
  return DERIVED_PREFIXES.some((prefix) => entry.key.startsWith(prefix));
}

class MemoryConsolidationEngineImpl {
  async consolidate(): Promise<MemoryConsolidationSnapshot> {
    const [rawMemories, planner, behavior, relationships, timeline] = await Promise.all([
      memoryStore.recall().catch(() => []),
      PlannerEngine.getSnapshot().catch(() => null),
      BehaviorEngine.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      TimelineService.getSnapshot().catch(() => null),
    ]);
    const raw = rawMemories.filter((entry) => !isDerivedMemory(entry));
    const pinnedMemoryKeys = new Set(
      (timeline?.events ?? [])
        .filter((event) => event.source === 'memory' && event.pinned)
        .map((event) => event.id.replace(/^memory:/, ''))
    );
    const groups = new Map<string, MemoryEntry[]>();

    raw.forEach((entry) => {
      const groupKey = `${classify(entry.key, entry.value)}:${compactKey(`${entry.key} ${entry.value}`)}`;
      const current = groups.get(groupKey) ?? [];
      groups.set(groupKey, [...current, entry]);
    });

    const generatedAt = now();
    const consolidated: ConsolidatedMemory[] = [...groups.entries()].map(([groupKey, entries]) => {
      const [categoryValue] = groupKey.split(':');
      const category = categoryValue as ConsolidatedMemoryCategory;
      const pinned = entries.some((entry) => pinnedMemoryKeys.has(entry.key));
      const strength = entries.length;
      const promoted = shouldPromote(category, strength, pinned);
      return {
        id: groupKey,
        category,
        summary: categorySummary(category, entries),
        sourceKeys: entries.map((entry) => entry.key),
        strength,
        confidence: confidenceFor(category, strength, pinned),
        lastReinforcedAt: generatedAt,
        pinned,
        decayed: !promoted && strength <= 1,
      };
    });

    relationships.forEach((profile) => {
      consolidated.push({
        id: `relationship:${profile.id}`,
        category: 'relationship',
        summary: `${profile.name} is saved as ${profile.relationship.replace('_', ' ')}.`,
        sourceKeys: [`relationships:profile:${profile.id}`],
        strength: Math.max(1, profile.timeline.length),
        confidence: Math.min(0.98, 0.72 + profile.timeline.length * 0.02),
        lastReinforcedAt: profile.lastDiscussed,
        pinned: false,
        decayed: false,
      });
    });

    planner?.goals.forEach((goal) => {
      consolidated.push({
        id: `goal:${goal.id}`,
        category: goal.status === 'completed' ? 'achievement' : 'goal',
        summary: `${goal.status === 'completed' ? 'Completed' : 'Working on'} ${goal.title}.`,
        sourceKeys: [`planner:goal:${goal.id}`],
        strength: Math.max(1, goal.progress.completedTasks),
        confidence: Math.min(0.98, 0.74 + goal.progress.completionPercent / 400),
        lastReinforcedAt: goal.updatedAt,
        pinned: false,
        decayed: false,
      });
    });

    behavior?.routines.forEach((routine) => {
      consolidated.push({
        id: `routine:${routine.id}`,
        category: 'routine',
        summary: routine.label,
        sourceKeys: [`behavior:routine:${routine.id}`],
        strength: routine.eventCount,
        confidence: routine.confidence,
        lastReinforcedAt: routine.updatedAt,
        pinned: false,
        decayed: false,
      });
    });

    const profile = this.buildProfile(consolidated, generatedAt);
    const snapshot: MemoryConsolidationSnapshot = {
      generatedAt,
      rawMemoryCount: raw.length,
      duplicateGroups: [...groups.values()].filter((entries) => entries.length > 1).length,
      promotedCount: consolidated.filter((item) => !item.decayed && item.confidence >= 0.68).length,
      decayedCount: consolidated.filter((item) => item.decayed).length,
      consolidated: consolidated.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        if (a.decayed !== b.decayed) return a.decayed ? 1 : -1;
        return b.confidence - a.confidence;
      }),
      profile,
    };

    await writeJson(SNAPSHOT_KEY, snapshot);
    await memoryStore.remember('consolidation:user-profile-snapshot', JSON.stringify(profile));
    return snapshot;
  }

  async getSnapshot(): Promise<MemoryConsolidationSnapshot> {
    const saved = await readJson<MemoryConsolidationSnapshot | null>(SNAPSHOT_KEY, null);
    return saved ?? this.consolidate();
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getSnapshot(), null, 2);
  }

  private buildProfile(items: ConsolidatedMemory[], updatedAt: string): UserProfileSnapshot {
    const active = items.filter((item) => !item.decayed && item.confidence >= 0.62);
    const preferences = active.filter((item) => item.category === 'preference').map((item) => item.summary);
    const goals = active.filter((item) => item.category === 'goal').map((item) => item.summary);
    const relationships = active.filter((item) => item.category === 'relationship').map((item) => item.summary);
    const routines = active.filter((item) => item.category === 'routine').map((item) => item.summary);
    const achievements = active.filter((item) => item.category === 'achievement').map((item) => item.summary);
    const profileBits = [
      preferences.length ? `enjoys ${joinHuman(preferences).toLowerCase()}` : '',
      goals.length ? `is working on ${joinHuman(goals).toLowerCase()}` : '',
      routines.length ? `often follows ${joinHuman(routines).toLowerCase()}` : '',
      relationships.length ? `has important people like ${joinHuman(relationships).toLowerCase()}` : '',
    ].filter(Boolean);

    return {
      summary: profileBits.length ? `Kashvi ${profileBits.join(', ')}.` : 'JISSI is still building a long-term profile from local memories.',
      preferences: preferences.slice(0, 8),
      goals: goals.slice(0, 8),
      relationships: relationships.slice(0, 8),
      routines: routines.slice(0, 8),
      achievements: achievements.slice(0, 8),
      confidence: active.length ? Math.min(0.96, active.reduce((sum, item) => sum + item.confidence, 0) / active.length) : 0,
      updatedAt,
    };
  }
}

export const MemoryConsolidationEngine = new MemoryConsolidationEngineImpl();
