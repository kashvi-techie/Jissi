import type { DecisionResult } from '@/services/decision';
import type { AndroidActionPayload, AndroidActionRequest, AndroidActionResult, AndroidActionType } from '@/services/android-actions';

export type AgentExecutionState =
  | 'pending'
  | 'asking_confirmation'
  | 'executing'
  | 'success'
  | 'failed';

export interface AgentRouteInput {
  input: string;
  decision: DecisionResult;
  payload?: AndroidActionPayload;
  confirmed?: boolean;
  timeoutMs?: number;
}

export interface AgentRoutePlan {
  actionType: AndroidActionType;
  payload: AndroidActionPayload;
  confidence: number;
  explanation: string;
  sensitive: boolean;
  confirmationPrompt?: string;
}

export interface AgentExecutionRecord {
  id: string;
  input: string;
  state: AgentExecutionState;
  decision: DecisionResult;
  actionRequest?: AndroidActionRequest;
  plan?: AgentRoutePlan;
  result?: AndroidActionResult;
  attempts: number;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AgentRouteResult {
  record: AgentExecutionRecord;
  handled: boolean;
  message: string;
}

export type TaskExecutionState =
  | 'planned'
  | 'waiting_confirmation'
  | 'executing'
  | 'waiting_external'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type SkillId =
  | 'open_app'
  | 'open_url'
  | 'share_text'
  | 'call'
  | 'sms'
  | 'settings';

export interface SkillExecutionContext {
  planId: string;
  stepId: string;
  confirmed?: boolean;
  timeoutMs?: number;
}

export interface SkillDefinition {
  id: SkillId;
  description: string;
  required_permissions: string[];
  supports_confirmation: boolean;
}

export interface SkillValidationResult {
  valid: boolean;
  reason: string;
  missing?: string[];
}

export interface SkillRollbackResult {
  supported: boolean;
  reason: string;
}

export interface TaskStep {
  id: string;
  skillId: SkillId;
  label: string;
  actionType: AndroidActionType;
  payload: AndroidActionPayload;
  state: TaskExecutionState;
  dependsOn: string[];
  retryLimit: number;
  retryCount: number;
  timeoutMs: number;
  rollback: {
    available: boolean;
    description: string;
  };
  result?: AndroidActionResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface TaskTimelineEvent {
  id: string;
  timestamp: string;
  state: TaskExecutionState;
  stepId?: string;
  message: string;
}

export interface TaskExecutionPlan {
  id: string;
  userCommand: string;
  parsedIntent: string;
  decision: DecisionResult;
  state: TaskExecutionState;
  steps: TaskStep[];
  currentStepId?: string;
  completedStepIds: string[];
  failedStepIds: string[];
  retryCount: number;
  humanPlan: string[];
  timeline: TaskTimelineEvent[];
  finalResult?: string;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  createdAt: string;
  updatedAt: string;
}

export interface TaskPlannerInput {
  userCommand: string;
  parsedIntent: string;
  decision: DecisionResult;
  payload?: AndroidActionPayload;
}

export interface SkillRunResult {
  state: TaskExecutionState;
  result?: AndroidActionResult;
  message: string;
  requiresConfirmation?: boolean;
}
