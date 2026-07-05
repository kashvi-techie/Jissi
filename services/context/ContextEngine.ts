import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BehaviorEngine } from '@/services/behavior';
import {
  ContextObject,
  ContextObservation,
  ContextState,
  EnvironmentContext,
  RelationshipContext,
  RelationshipType,
  ResolvedReference,
  RoutineContext,
  TaskContext,
  TaskType,
  TemporalContext,
} from './types';

const CONTEXT_KEY = '@jissi/context/state';
const CONVERSATION_TTL_MS = 30 * 60 * 1000;
const TASK_TTL_MS = 45 * 60 * 1000;
const MAX_REFERENCES = 20;

const DEFAULT_ENVIRONMENT: EnvironmentContext = {
  battery: 'unknown',
  network: 'unknown',
  headphones: 'unknown',
  bluetooth: 'unknown',
  driving: 'unknown',
  location: 'unknown',
  updatedAt: new Date(0).toISOString(),
};

const EMPTY_STATE: ContextState = {
  conversation: null,
  task: null,
  relationships: [],
  resolvedReferences: [],
  environment: DEFAULT_ENVIRONMENT,
};

function nowIso(date = new Date()): string {
  return date.toISOString();
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function dayPart(hour: number): TemporalContext['dayPart'] {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 21) return 'evening';
  return 'night';
}

function temporalContext(date = new Date()): TemporalContext {
  const weekday = date.getDay();
  return {
    timestamp: date.toISOString(),
    weekday,
    hour: date.getHours(),
    dayPart: dayPart(date.getHours()),
    isWeekend: weekday === 0 || weekday === 6,
    isWorkday: weekday >= 1 && weekday <= 5,
  };
}

function normalizeRelationship(value?: string): RelationshipType {
  const normalized = value?.toLowerCase().trim().replace(/\s+/g, '_');
  if (
    normalized === 'teacher' ||
    normalized === 'mentor' ||
    normalized === 'mother' ||
    normalized === 'father' ||
    normalized === 'friend' ||
    normalized === 'best_friend' ||
    normalized === 'sibling' ||
    normalized === 'recruiter' ||
    normalized === 'interviewer' ||
    normalized === 'doctor' ||
    normalized === 'manager' ||
    normalized === 'guest' ||
    normalized === 'senior' ||
    normalized === 'colleague'
  ) {
    return normalized;
  }
  return 'unknown';
}

function detectTask(input: string, intent?: string): TaskContext | null {
  const text = `${input} ${intent ?? ''}`.toLowerCase();
  const checks: { type: TaskType; label: string; words: RegExp; confidence: number }[] = [
    { type: 'coding', label: 'Coding', words: /\b(code|coding|program|debug|vscode|vs code|github|repo|api)\b/, confidence: 0.82 },
    { type: 'studying', label: 'Studying', words: /\b(study|learn|exam|notes|homework|chapter|revise)\b/, confidence: 0.78 },
    { type: 'writing', label: 'Writing', words: /\b(write|draft|essay|email|caption|proposal|document)\b/, confidence: 0.72 },
    { type: 'designing', label: 'Designing', words: /\b(design|ui|ux|figma|layout|logo|prototype)\b/, confidence: 0.76 },
    { type: 'meeting', label: 'Meeting', words: /\b(meeting|interview|call|presentation|recruiter)\b/, confidence: 0.78 },
    { type: 'browsing', label: 'Browsing', words: /\b(search|google|open chrome|browser|website)\b/, confidence: 0.68 },
    { type: 'gaming', label: 'Gaming', words: /\b(game|gaming|play)\b/, confidence: 0.64 },
  ];
  const match = checks.find((check) => check.words.test(text));
  if (!match) return null;
  const updatedAt = nowIso();
  return {
    type: match.type,
    label: match.label,
    confidence: match.confidence,
    evidence: [input.slice(0, 120)],
    updatedAt,
    expiresAt: new Date(Date.now() + TASK_TTL_MS).toISOString(),
  };
}

function topicFromInput(input: string): string {
  return input.trim().split(/\s+/).slice(0, 8).join(' ');
}

function relationshipKey(name: string | undefined, relationship: RelationshipType): string {
  return `${relationship}:${(name ?? 'unknown').toLowerCase()}`;
}

async function readState(): Promise<ContextState> {
  try {
    const raw = Platform.OS === 'web' && typeof localStorage !== 'undefined'
      ? localStorage.getItem(CONTEXT_KEY)
      : await AsyncStorage.getItem(CONTEXT_KEY);
    return raw ? { ...EMPTY_STATE, ...JSON.parse(raw) } : EMPTY_STATE;
  } catch {
    return EMPTY_STATE;
  }
}

async function writeState(state: ContextState): Promise<void> {
  const raw = JSON.stringify(state);
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(CONTEXT_KEY, raw);
    return;
  }
  await AsyncStorage.setItem(CONTEXT_KEY, raw);
}

async function clearState(): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.removeItem(CONTEXT_KEY);
    return;
  }
  await AsyncStorage.removeItem(CONTEXT_KEY);
}

class ContextEngineImpl {
  private initialized = false;
  private state: ContextState = EMPTY_STATE;

  async initialize(): Promise<void> {
    if (this.initialized) return;
    this.state = this.prune(await readState());
    this.initialized = true;
  }

  private prune(state: ContextState): ContextState {
    const now = Date.now();
    return {
      ...state,
      conversation: state.conversation && new Date(state.conversation.expiresAt).getTime() > now ? state.conversation : null,
      task: state.task && new Date(state.task.expiresAt).getTime() > now ? state.task : null,
      relationships: state.relationships ?? [],
      resolvedReferences: (state.resolvedReferences ?? []).slice(0, MAX_REFERENCES),
      environment: state.environment ?? DEFAULT_ENVIRONMENT,
    };
  }

  async observe(observation: ContextObservation): Promise<ContextObject> {
    await this.initialize();
    const input = observation.input.trim();
    const updatedAt = nowIso();
    const intent = observation.intent?.intent;
    const nextTask = detectTask(input, intent);

    this.state = this.prune(this.state);
    this.state.conversation = {
      topic: topicFromInput(input),
      lastUserUtterance: input,
      lastAssistantResponse: observation.assistantResponse ?? this.state.conversation?.lastAssistantResponse,
      lastIntent: intent ?? this.state.conversation?.lastIntent,
      lastReferencedThing: this.extractReferencedThing(input) ?? this.state.conversation?.lastReferencedThing,
      confidence: 0.72,
      updatedAt,
      expiresAt: new Date(Date.now() + CONVERSATION_TTL_MS).toISOString(),
    };

    if (nextTask) this.state.task = nextTask;
    this.upsertRelationship(observation);
    this.state.resolvedReferences = [
      ...this.resolveReferences(input),
      ...this.state.resolvedReferences,
    ].slice(0, MAX_REFERENCES);

    await writeState(this.state);
    return this.getCurrentContext();
  }

  async rememberAssistantResponse(response: string): Promise<void> {
    await this.initialize();
    if (!this.state.conversation) return;
    this.state.conversation = {
      ...this.state.conversation,
      lastAssistantResponse: response,
      updatedAt: nowIso(),
    };
    await writeState(this.state);
  }

  private upsertRelationship(observation: ContextObservation): void {
    const relationship = normalizeRelationship(observation.intent?.entities?.relationship);
    const name = observation.intent?.entities?.name;
    if (relationship === 'unknown' && !name) return;

    const key = relationshipKey(name, relationship);
    const existing = this.state.relationships.find((item) => relationshipKey(item.name, item.relationship) === key);
    const now = nowIso();
    const next: RelationshipContext = {
      id: existing?.id ?? `rel_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      name,
      relationship,
      gender: observation.intent?.entities?.gender ?? existing?.gender,
      mentionCount: (existing?.mentionCount ?? 0) + 1,
      confidence: clamp((existing?.confidence ?? 0.62) + 0.05),
      firstSeenAt: existing?.firstSeenAt ?? now,
      lastSeenAt: now,
    };

    this.state.relationships = [next, ...this.state.relationships.filter((item) => item.id !== existing?.id)].slice(0, 50);
  }

  private extractReferencedThing(input: string): string | undefined {
    const appMatch = input.match(/\b(open|launch|start)\s+([a-z][a-z0-9\s]{1,40})/i);
    if (appMatch?.[2]) return appMatch[2].trim();
    const quoted = input.match(/["']([^"']+)["']/);
    return quoted?.[1]?.trim();
  }

  private resolveReferences(input: string): ResolvedReference[] {
    const refs: ResolvedReference[] = [];
    const lowered = input.toLowerCase();
    const newestRelationship = this.state.relationships[0];
    const now = nowIso();

    if (/\b(him|her|them)\b/.test(lowered) && newestRelationship) {
      refs.push({
        phrase: lowered.match(/\b(him|her|them)\b/)?.[1] ?? 'them',
        resolvedTo: newestRelationship.name ?? newestRelationship.relationship,
        source: 'relationship',
        confidence: newestRelationship.confidence,
        reason: `Most recent relationship context is ${newestRelationship.name ?? newestRelationship.relationship}.`,
        updatedAt: now,
      });
    }

    if (/\bit\b|\bthat\b|\bcontinue\b|\bopen it\b/.test(lowered) && this.state.conversation?.lastReferencedThing) {
      refs.push({
        phrase: lowered.includes('continue') ? 'continue' : 'it',
        resolvedTo: this.state.conversation.lastReferencedThing,
        source: 'conversation',
        confidence: 0.68,
        reason: `Most recent referenced item was ${this.state.conversation.lastReferencedThing}.`,
        updatedAt: now,
      });
    }

    if (/\bcontinue\b/.test(lowered) && this.state.task) {
      refs.push({
        phrase: 'continue',
        resolvedTo: this.state.task.label,
        source: 'task',
        confidence: this.state.task.confidence,
        reason: `Active task context is ${this.state.task.label}.`,
        updatedAt: now,
      });
    }

    return refs;
  }

  async getCurrentContext(): Promise<ContextObject> {
    await this.initialize();
    this.state = this.prune(this.state);
    const routine = await this.getRoutineContext();
    const confidenceParts = [
      this.state.conversation?.confidence ?? 0,
      this.state.task?.confidence ?? 0,
      routine.confidence,
      this.state.relationships[0]?.confidence ?? 0,
    ].filter((value) => value > 0);
    const confidence = confidenceParts.length
      ? confidenceParts.reduce((sum, value) => sum + value, 0) / confidenceParts.length
      : 0;

    return {
      conversation: this.state.conversation,
      task: this.state.task,
      relationships: this.state.relationships,
      routine,
      environment: this.state.environment,
      temporal: temporalContext(),
      resolvedReferences: this.state.resolvedReferences,
      confidence: clamp(confidence),
      updatedAt: nowIso(),
    };
  }

  private async getRoutineContext(): Promise<RoutineContext> {
    const active = await BehaviorEngine.getPredictions();
    return {
      active,
      confidence: active[0]?.confidence ?? 0,
      updatedAt: nowIso(),
    };
  }

  async buildPromptContext(userInput: string): Promise<string> {
    const context = await this.getCurrentContext();
    const compact = {
      temporal: context.temporal,
      conversation: context.conversation,
      task: context.task,
      relationships: context.relationships.slice(0, 5),
      routines: context.routine.active.slice(0, 3),
      environment: context.environment,
      resolvedReferences: context.resolvedReferences.slice(0, 5),
      confidence: context.confidence,
    };

    return [
      'Current local context for JISSI. Use this privately to resolve pronouns, continuations, task context, relationship context, routines, and timing. Do not mention this context unless it helps the user.',
      JSON.stringify(compact),
      `User message: ${userInput}`,
    ].join('\n\n');
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getCurrentContext(), null, 2);
  }

  async clearData(): Promise<void> {
    this.state = EMPTY_STATE;
    await clearState();
  }
}

export const ContextEngine = new ContextEngineImpl();
