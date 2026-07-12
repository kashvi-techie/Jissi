import { AgentRouter } from './AgentRouter';
import { SkillRegistry } from './SkillRegistry';
import type { AgentRoutePlan, TaskExecutionPlan, TaskPlannerInput, TaskStep, TaskTimelineEvent } from './types';

const DEFAULT_STEP_TIMEOUT_MS = 12000;
const DEFAULT_RETRY_LIMIT = 1;

let planSequence = 0;
let stepSequence = 0;

function timestamp(): string {
  return new Date().toISOString();
}

function nextPlanId(): string {
  planSequence += 1;
  return `task_plan_${Date.now()}_${planSequence}`;
}

function nextStepId(): string {
  stepSequence += 1;
  return `task_step_${Date.now()}_${stepSequence}`;
}

function event(state: TaskExecutionPlan['state'], message: string, stepId?: string): TaskTimelineEvent {
  return {
    id: `task_event_${Date.now()}_${Math.max(planSequence, stepSequence)}`,
    timestamp: timestamp(),
    state,
    stepId,
    message,
  };
}

function labelFor(plan: AgentRoutePlan): string {
  if (plan.actionType === 'open_app') return `Open ${plan.payload.appName || plan.payload.packageName}`;
  if (plan.actionType === 'launch_url') return `Open ${plan.payload.url}`;
  if (plan.actionType === 'call_contact') return `Call ${plan.payload.contactName || plan.payload.phoneNumber}`;
  if (plan.actionType === 'send_sms') return `Prepare SMS for ${plan.payload.contactName || plan.payload.phoneNumber}`;
  if (plan.actionType === 'share_text') return 'Share text';
  if (plan.actionType === 'open_settings') return 'Open Android settings';
  return plan.actionType.replace(/_/g, ' ');
}

class TaskPlannerImpl {
  createPlan(input: TaskPlannerInput): TaskExecutionPlan | null {
    const routePlan = AgentRouter.plan(input.userCommand, input.decision, input.payload);
    if (!routePlan) return null;

    const skillId = SkillRegistry.skillIdForAction(routePlan.actionType);
    if (!skillId) return null;

    const now = timestamp();
    const step: TaskStep = {
      id: nextStepId(),
      skillId,
      label: labelFor(routePlan),
      actionType: routePlan.actionType,
      payload: routePlan.payload,
      state: 'planned',
      dependsOn: [],
      retryLimit: DEFAULT_RETRY_LIMIT,
      retryCount: 0,
      timeoutMs: DEFAULT_STEP_TIMEOUT_MS,
      rollback: {
        available: false,
        description: 'Rollback metadata placeholder. Android actions are not reversed automatically.',
      },
    };

    const plan: TaskExecutionPlan = {
      id: nextPlanId(),
      userCommand: input.userCommand,
      parsedIntent: input.parsedIntent,
      decision: input.decision,
      state: 'planned',
      steps: [step],
      completedStepIds: [],
      failedStepIds: [],
      retryCount: 0,
      humanPlan: [`1. ${step.label}`],
      timeline: [],
      createdAt: now,
      updatedAt: now,
    };

    plan.timeline.push(event('planned', `Created execution plan with ${plan.steps.length} step.`, step.id));
    return plan;
  }
}

export const TaskPlanner = new TaskPlannerImpl();
