import { IntentResult } from '@/engine/intentEngine';

export type DecisionAction =
  | 'answer_user'
  | 'ask_followup'
  | 'remind'
  | 'congratulate'
  | 'motivate'
  | 'stay_silent'
  | 'proactive_help'
  | 'planner_update'
  | 'memory_update'
  | 'relationship_response'
  | 'clarification_required';

export type DecisionSourceSystem =
  | 'life'
  | 'planner'
  | 'behavior'
  | 'emotion'
  | 'context'
  | 'timeline'
  | 'memory'
  | 'relationship'
  | 'intent';

export interface DecisionCandidate {
  action: DecisionAction;
  confidence: number;
  explanation: string;
  sourceSystems: DecisionSourceSystem[];
  cooldown?: string;
  accepted: boolean;
  rejectedReason?: string;
}

export interface DecisionResult {
  action: DecisionAction;
  confidence: number;
  explanation: string;
  sourceSystems: DecisionSourceSystem[];
  cooldown?: string;
  candidates: DecisionCandidate[];
}

export interface DecisionInput {
  input: string;
  intent?: IntentResult | null;
}

export interface DecisionSnapshot {
  finalDecision: DecisionResult;
  candidates: DecisionCandidate[];
  generatedAt: string;
}
