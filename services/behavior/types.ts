export type BehaviorCategory =
  | 'conversation'
  | 'intent'
  | 'tool'
  | 'application'
  | 'search'
  | 'music'
  | 'navigation'
  | 'weather'
  | 'news'
  | 'memory'
  | 'reminder'
  | 'routine'
  | 'unknown';

export type RoutineType =
  | 'coding'
  | 'studying'
  | 'workout'
  | 'sleep'
  | 'travel'
  | 'reading'
  | 'morning_routine'
  | 'night_routine'
  | 'music'
  | 'searching'
  | 'conversation';

export interface BehaviorEvent {
  id: string;
  timestamp: string;
  weekday: number;
  hour: number;
  category: BehaviorCategory;
  intent?: string;
  metadata?: Record<string, unknown>;
  confidence: number;
}

export interface BehaviorRoutine {
  id: string;
  type: RoutineType;
  label: string;
  confidence: number;
  reason: string;
  eventCount: number;
  category: BehaviorCategory;
  intent?: string;
  weekday?: number;
  hourWindow: {
    start: number;
    end: number;
  };
  lastObservedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface BehaviorPrediction {
  id: string;
  routineId: string;
  routineType: RoutineType;
  suggestion: string;
  confidence: number;
  reason: string;
  createdAt: string;
}

export interface BehaviorSnapshot {
  events: BehaviorEvent[];
  routines: BehaviorRoutine[];
  predictions: BehaviorPrediction[];
}

export interface BehaviorContext {
  timestamp?: Date;
  category?: BehaviorCategory;
  intent?: string;
}

export type BehaviorFeedback = 'accepted' | 'rejected' | 'ignored';
