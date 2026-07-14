import type { CapabilityExecutionInput, CapabilityId, CapabilityResult } from '@/services/capabilities';

export type WorkflowState =
  | 'pending'
  | 'running'
  | 'paused'
  | 'waiting_confirmation'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type WorkflowCondition = 'always' | 'previous_completed' | 'if_supported';

export interface WorkflowStepDefinition {
  id: string;
  label: string;
  capabilityId: CapabilityId;
  input?: CapabilityExecutionInput;
  dependsOn: string[];
  condition: WorkflowCondition;
  retryLimit: number;
  timeoutMs: number;
  rollback?: {
    available: boolean;
    description: string;
  };
}

export interface WorkflowDefinition {
  id: string;
  name: string;
  description: string;
  estimatedDurationMs: number;
  steps: WorkflowStepDefinition[];
}

export interface WorkflowStepRuntime extends WorkflowStepDefinition {
  state: WorkflowState;
  retryCount: number;
  result?: CapabilityResult;
  error?: string;
  startedAt?: string;
  completedAt?: string;
}

export interface WorkflowTimelineEvent {
  id: string;
  timestamp: string;
  state: WorkflowState;
  stepId?: string;
  message: string;
}

export interface WorkflowRun {
  id: string;
  definitionId: string;
  name: string;
  state: WorkflowState;
  graph: {
    nodes: WorkflowStepRuntime[];
    edges: { from: string; to: string; condition: WorkflowCondition }[];
  };
  currentStepId?: string;
  completedStepIds: string[];
  failedStepIds: string[];
  retryCount: number;
  rollbackState: 'not_needed' | 'available' | 'unavailable' | 'attempted';
  errors: string[];
  timeline: WorkflowTimelineEvent[];
  estimatedDurationMs: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  summary?: string;
  createdAt: string;
  updatedAt: string;
}
