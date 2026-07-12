import { ActionExecutor } from '@/services/android-actions';
import type { AndroidActionPayload, AndroidActionResult, AndroidActionType } from '@/services/android-actions';
import type { DecisionResult } from '@/services/decision';
import type { SkillId, TaskExecutionPlan, TaskStep, TaskTimelineEvent } from '@/services/agent';
import { SkillExecutor } from '@/services/agent';
import type { RealWorldSkillExecution, RealWorldSkillId, RealWorldSkillValidation } from './types';

let planSequence = 0;
let stepSequence = 0;
let eventSequence = 0;

const ACTION_TO_AGENT_SKILL: Partial<Record<AndroidActionType, SkillId>> = {
  open_app: 'open_app',
  launch_url: 'open_url',
  share_text: 'share_text',
  call_contact: 'call',
  send_sms: 'sms',
  open_settings: 'settings',
};

export function normalizeCommand(command: string): string {
  return command.toLowerCase().replace(/\s+/g, ' ').trim();
}

export function encodeSearch(value: string): string {
  return encodeURIComponent(value.trim());
}

export function unsupported(reason: string, requiredPermissions: string[] = []): RealWorldSkillValidation {
  return { valid: false, status: 'unsupported', reason, requiredPermissions };
}

export function validateAction(
  actionType: AndroidActionType,
  payload: AndroidActionPayload,
  requiredPermissions: string[],
  needsConfirmation = false
): RealWorldSkillValidation {
  const permission = ActionExecutor.checkPermissions({ type: actionType, payload, confirmed: needsConfirmation });
  return {
    valid: permission.allowed,
    status: permission.allowed ? 'available' : 'unsupported',
    reason: permission.reason,
    requiredPermissions,
    actionType,
    payload,
    needsConfirmation,
  };
}

export function createSingleStepPlan(
  command: string,
  parsedIntent: string,
  decision: DecisionResult,
  label: string,
  actionType: AndroidActionType,
  payload: AndroidActionPayload
): TaskExecutionPlan | null {
  const skillId = ACTION_TO_AGENT_SKILL[actionType];
  if (!skillId) return null;

  const now = new Date().toISOString();
  planSequence += 1;
  stepSequence += 1;
  eventSequence += 1;

  const stepId = `real_skill_step_${Date.now()}_${stepSequence}`;
  const step: TaskStep = {
    id: stepId,
    skillId,
    label,
    actionType,
    payload,
    state: 'planned',
    dependsOn: [],
    retryLimit: 1,
    retryCount: 0,
    timeoutMs: 12000,
    rollback: {
      available: false,
      description: 'Rollback placeholder. The launched external app is not automatically reversed.',
    },
  };

  const timeline: TaskTimelineEvent[] = [{
    id: `real_skill_event_${Date.now()}_${eventSequence}`,
    timestamp: now,
    state: 'planned',
    stepId,
    message: `Created real-world skill plan: ${label}.`,
  }];

  return {
    id: `real_skill_plan_${Date.now()}_${planSequence}`,
    userCommand: command,
    parsedIntent,
    decision,
    state: 'planned',
    steps: [step],
    currentStepId: undefined,
    completedStepIds: [],
    failedStepIds: [],
    retryCount: 0,
    humanPlan: [`1. ${label}`],
    timeline,
    createdAt: now,
    updatedAt: now,
  };
}

export async function executePlanForSkill(
  skillId: RealWorldSkillId,
  command: string,
  validation: RealWorldSkillValidation,
  plan: TaskExecutionPlan | null,
  confirmed = false
): Promise<RealWorldSkillExecution> {
  const started = Date.now();
  if (!validation.valid || !plan) {
    return {
      skillId,
      command,
      validation,
      plan: plan ?? undefined,
      durationMs: Date.now() - started,
    };
  }

  const executed = await SkillExecutor.execute(plan, confirmed);
  return {
    skillId,
    command,
    validation,
    plan: executed,
    result: executed.steps[executed.steps.length - 1]?.result,
    durationMs: Date.now() - started,
  };
}

export function rollbackPlaceholder() {
  return Promise.resolve({
    supported: false,
    reason: 'Rollback placeholder only. External app actions cannot be safely reversed from the current Expo runtime.',
  });
}
