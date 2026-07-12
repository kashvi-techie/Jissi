import type { AndroidActionPayload, AndroidActionResult, AndroidActionType } from '@/services/android-actions';
import type { DecisionResult } from '@/services/decision';
import type { TaskExecutionPlan } from '@/services/agent';

export type RealWorldSkillId = 'whatsapp' | 'chrome' | 'youtube' | 'maps' | 'spotify';
export type RealWorldSkillStatus = 'available' | 'unsupported';

export interface RealWorldSkillValidation {
  valid: boolean;
  status: RealWorldSkillStatus;
  reason: string;
  requiredPermissions: string[];
  actionType?: AndroidActionType;
  payload?: AndroidActionPayload;
  needsConfirmation?: boolean;
}

export interface RealWorldSkillExecution {
  skillId: RealWorldSkillId;
  command: string;
  validation: RealWorldSkillValidation;
  plan?: TaskExecutionPlan;
  result?: AndroidActionResult;
  durationMs: number;
}

export interface RealWorldSkill {
  id: RealWorldSkillId;
  name: string;
  description: string;
  requiredPermissions: string[];
  supportsConfirmation: boolean;
  match(command: string): boolean;
  availability(): RealWorldSkillValidation;
  validate(command: string): RealWorldSkillValidation;
  createPlan(command: string, decision: DecisionResult): TaskExecutionPlan | null;
  execute(command: string, decision: DecisionResult, confirmed?: boolean): Promise<RealWorldSkillExecution>;
  rollback(): Promise<{ supported: boolean; reason: string }>;
}
