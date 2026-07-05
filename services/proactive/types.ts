export type ProactiveSource = 'behavior' | 'planner' | 'emotion' | 'context' | 'memory';

export type ProactiveFeedback = 'accepted' | 'rejected' | 'ignored';

export type ProactiveAction =
  | { type: 'prompt'; prompt: string }
  | { type: 'open_debug'; route: string }
  | { type: 'none' };

export interface ProactiveSuggestion {
  id: string;
  source: ProactiveSource;
  title: string;
  message: string;
  reason: string;
  confidence: number;
  priority: 1 | 2 | 3;
  expiry: string;
  action: ProactiveAction;
}

export interface ProactiveHistoryEntry {
  id: string;
  suggestionId: string;
  signature: string;
  source: ProactiveSource;
  feedback: ProactiveFeedback;
  confidenceBefore: number;
  confidenceAfter: number;
  timestamp: string;
  reason: string;
}

export interface ProactiveInterruptionState {
  userTalking?: boolean;
  voiceActive?: boolean;
  musicActive?: boolean;
  phoneCallActive?: boolean;
  navigationActive?: boolean;
}

export interface ProactiveConfig {
  threshold: number;
  cooldownHours: number;
}

export interface ProactiveSnapshot {
  suggestions: ProactiveSuggestion[];
  history: ProactiveHistoryEntry[];
  config: ProactiveConfig;
  blockedReason?: string;
}
