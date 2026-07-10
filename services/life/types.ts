import { ProactiveAction } from '@/services/proactive';

export type LifeActionType = 'silent' | 'proactive_help' | 'congratulate' | 'remind' | 'motivate' | 'ask_question';
export type LifeSource = 'behavior' | 'planner' | 'emotion' | 'context' | 'timeline' | 'memory';

export interface LifeInterruptionState {
  userTalking?: boolean;
  voiceActive?: boolean;
  musicActive?: boolean;
  phoneCallActive?: boolean;
  navigationActive?: boolean;
}

export interface LifeDecision {
  id: string;
  actionType: LifeActionType;
  title: string;
  message: string;
  confidence: number;
  priority: 1 | 2 | 3;
  reason: string;
  explanation: string;
  sources: LifeSource[];
  cooldownKey: string;
  cooldownUntil?: string;
  action: ProactiveAction;
}

export interface LifeCooldownEntry {
  key: string;
  lastShownAt: string;
  cooldownUntil: string;
  count: number;
}

export interface LifeBehaviorSignals {
  routineCount: number;
  predictionCount: number;
  topRoutine?: string;
  topPrediction?: string;
  coffeePattern: boolean;
}

export interface LifePlannerState {
  activeGoals: number;
  completedGoals: number;
  pendingAgendaItems: number;
  stalledGoal?: string;
  recentCompletedGoal?: string;
  nextTask?: string;
}

export interface LifeEmotionState {
  state: string;
  confidence: number;
  frustrationSignals: number;
  reason: string;
}

export interface LifeContextState {
  task?: string;
  taskConfidence?: number;
  relationshipCount: number;
  dayPart: string;
}

export interface LifeSnapshot {
  behavior: LifeBehaviorSignals;
  planner: LifePlannerState;
  emotion: LifeEmotionState;
  context: LifeContextState;
  timeline: {
    eventCount: number;
    milestonesAchieved: number;
  };
  chosenAction: LifeDecision;
  candidates: LifeDecision[];
  cooldowns: LifeCooldownEntry[];
}
