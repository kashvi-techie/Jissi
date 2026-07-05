import { IntentResult } from '@/engine/intentEngine';
import { BehaviorPrediction } from '@/services/behavior';
import { EmotionEstimate } from '@/services/emotion';

export type TaskType = 'coding' | 'studying' | 'writing' | 'designing' | 'meeting' | 'browsing' | 'gaming' | 'unknown';
export type RelationshipType =
  | 'teacher'
  | 'mentor'
  | 'mother'
  | 'father'
  | 'friend'
  | 'best_friend'
  | 'sibling'
  | 'recruiter'
  | 'interviewer'
  | 'doctor'
  | 'manager'
  | 'guest'
  | 'senior'
  | 'colleague'
  | 'unknown';

export interface ConversationContext {
  topic?: string;
  lastUserUtterance?: string;
  lastAssistantResponse?: string;
  lastIntent?: string;
  lastReferencedThing?: string;
  confidence: number;
  updatedAt: string;
  expiresAt: string;
}

export interface TaskContext {
  type: TaskType;
  label: string;
  confidence: number;
  evidence: string[];
  updatedAt: string;
  expiresAt: string;
}

export interface RelationshipContext {
  id: string;
  name?: string;
  relationship: RelationshipType;
  gender?: string;
  mentionCount: number;
  confidence: number;
  firstSeenAt: string;
  lastSeenAt: string;
}

export interface RoutineContext {
  active: BehaviorPrediction[];
  confidence: number;
  updatedAt: string;
}

export interface EmotionContext {
  state: EmotionEstimate['state'];
  confidence: number;
  reasons: string[];
  deliveryStyle: string;
  wellbeingSuggestion?: string;
  updatedAt: string;
}

export interface EnvironmentContext {
  battery?: 'unknown' | 'charging' | 'discharging' | 'low' | 'full';
  network?: 'unknown' | 'online' | 'offline';
  headphones?: 'unknown' | 'connected' | 'disconnected';
  bluetooth?: 'unknown' | 'connected' | 'disconnected';
  driving?: 'unknown' | 'likely' | 'unlikely';
  location?: 'unknown' | string;
  updatedAt: string;
}

export interface TemporalContext {
  timestamp: string;
  weekday: number;
  hour: number;
  dayPart: 'morning' | 'afternoon' | 'evening' | 'night';
  isWeekend: boolean;
  isWorkday: boolean;
  specialPeriod?: 'vacation' | 'exam_week' | 'birthday';
}

export interface ResolvedReference {
  phrase: string;
  resolvedTo: string;
  source: 'conversation' | 'relationship' | 'task' | 'routine';
  confidence: number;
  reason: string;
  updatedAt: string;
}

export interface ContextObject {
  conversation: ConversationContext | null;
  task: TaskContext | null;
  relationships: RelationshipContext[];
  routine: RoutineContext;
  emotion: EmotionContext;
  environment: EnvironmentContext;
  temporal: TemporalContext;
  resolvedReferences: ResolvedReference[];
  confidence: number;
  updatedAt: string;
}

export interface ContextState {
  conversation: ConversationContext | null;
  task: TaskContext | null;
  relationships: RelationshipContext[];
  resolvedReferences: ResolvedReference[];
  environment: EnvironmentContext;
}

export interface ContextObservation {
  input: string;
  intent?: IntentResult | null;
  assistantResponse?: string;
}
