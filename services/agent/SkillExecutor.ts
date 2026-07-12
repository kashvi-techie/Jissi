import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SkillRegistry } from './SkillRegistry';
import type { TaskExecutionPlan, TaskStep, TaskTimelineEvent } from './types';

const HISTORY_KEY = '@jissi/task-planner/history';
const MAX_HISTORY = 40;
let timelineSequence = 0;

function timestamp(): string {
  return new Date().toISOString();
}

function duration(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function timelineEvent(state: TaskExecutionPlan['state'], message: string, stepId?: string): TaskTimelineEvent {
  timelineSequence += 1;
  return {
    id: `task_timeline_${Date.now()}_${timelineSequence}`,
    timestamp: timestamp(),
    state,
    stepId,
    message,
  };
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

class SkillExecutorImpl {
  async execute(plan: TaskExecutionPlan, confirmed = false): Promise<TaskExecutionPlan> {
    const startedAt = plan.startedAt ?? timestamp();
    let nextPlan: TaskExecutionPlan = {
      ...plan,
      state: 'executing',
      startedAt,
      updatedAt: startedAt,
      timeline: [...plan.timeline, timelineEvent('executing', 'Execution started.')],
    };

    for (const step of nextPlan.steps) {
      const dependencyFailed = step.dependsOn.some((dependencyId) => !nextPlan.completedStepIds.includes(dependencyId));
      if (dependencyFailed) {
        nextPlan = this.failStep(nextPlan, step, 'A dependency did not complete.');
        break;
      }

      const result = await this.executeStep(nextPlan, step, confirmed);
      nextPlan = result.plan;

      if (result.shouldStop) break;
    }

    if (nextPlan.state === 'executing') {
      const completedAt = timestamp();
      nextPlan = {
        ...nextPlan,
        state: 'completed',
        completedAt,
        durationMs: duration(nextPlan.startedAt, completedAt),
        updatedAt: completedAt,
        finalResult: 'Execution completed.',
        timeline: [...nextPlan.timeline, timelineEvent('completed', 'All steps completed.')],
      };
    }

    await this.save(nextPlan);
    return nextPlan;
  }

  async retry(plan: TaskExecutionPlan, confirmed = false): Promise<TaskExecutionPlan> {
    const resetSteps = plan.steps.map((step) => {
      if (!plan.failedStepIds.includes(step.id)) return step;
      return {
        ...step,
        state: 'planned' as const,
        error: undefined,
        result: undefined,
        startedAt: undefined,
        completedAt: undefined,
      };
    });

    return this.execute({
      ...plan,
      state: 'planned',
      steps: resetSteps,
      failedStepIds: [],
      updatedAt: timestamp(),
      retryCount: plan.retryCount + 1,
      timeline: [...plan.timeline, timelineEvent('planned', 'Retry requested for failed steps.')],
    }, confirmed);
  }

  cancel(plan: TaskExecutionPlan): TaskExecutionPlan {
    const completedAt = timestamp();
    return {
      ...plan,
      state: 'cancelled',
      completedAt,
      durationMs: duration(plan.startedAt, completedAt),
      updatedAt: completedAt,
      finalResult: 'Execution cancelled.',
      timeline: [...plan.timeline, timelineEvent('cancelled', 'Execution cancelled by user.')],
    };
  }

  async getHistory(): Promise<TaskExecutionPlan[]> {
    try {
      const raw = await getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) as TaskExecutionPlan[] : [];
    } catch {
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    await setItem(HISTORY_KEY, JSON.stringify([]));
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getHistory(), null, 2);
  }

  private async executeStep(plan: TaskExecutionPlan, step: TaskStep, confirmed: boolean): Promise<{ plan: TaskExecutionPlan; shouldStop: boolean }> {
    const skill = SkillRegistry.get(step.skillId);
    if (!skill) {
      return { plan: this.failStep(plan, step, `Skill ${step.skillId} is not registered.`), shouldStop: true };
    }

    const startedAt = timestamp();
    let nextPlan = this.updateStep(plan, step.id, {
      state: 'executing',
      startedAt,
      retryCount: step.retryCount,
    });
    nextPlan = {
      ...nextPlan,
      state: 'executing',
      currentStepId: step.id,
      updatedAt: startedAt,
      timeline: [...nextPlan.timeline, timelineEvent('executing', `Running step: ${step.label}`, step.id)],
    };

    const run = await skill.execute(step, {
      planId: plan.id,
      stepId: step.id,
      confirmed,
      timeoutMs: step.timeoutMs,
    });

    if (run.state === 'waiting_confirmation') {
      nextPlan = this.updateStep(nextPlan, step.id, {
        state: 'waiting_confirmation',
        result: run.result,
        completedAt: timestamp(),
      });
      return {
        plan: {
          ...nextPlan,
          state: 'waiting_confirmation',
          finalResult: run.message,
          updatedAt: timestamp(),
          timeline: [...nextPlan.timeline, timelineEvent('waiting_confirmation', run.message, step.id)],
        },
        shouldStop: true,
      };
    }

    if (run.state === 'completed') {
      const completedAt = timestamp();
      nextPlan = this.updateStep(nextPlan, step.id, {
        state: 'completed',
        result: run.result,
        completedAt,
      });
      return {
        plan: {
          ...nextPlan,
          completedStepIds: Array.from(new Set([...nextPlan.completedStepIds, step.id])),
          updatedAt: completedAt,
          timeline: [...nextPlan.timeline, timelineEvent('completed', run.message, step.id)],
        },
        shouldStop: false,
      };
    }

    const retryable = step.retryCount < step.retryLimit;
    if (retryable) {
      const retryStep = { ...step, retryCount: step.retryCount + 1 };
      const retryPlan = this.updateStep(nextPlan, step.id, retryStep);
      return this.executeStep({
        ...retryPlan,
        retryCount: retryPlan.retryCount + 1,
        timeline: [...retryPlan.timeline, timelineEvent('executing', `Retrying step: ${step.label}`, step.id)],
      }, retryStep, confirmed);
    }

    return {
      plan: this.failStep(nextPlan, step, run.message, run.state),
      shouldStop: true,
    };
  }

  private failStep(plan: TaskExecutionPlan, step: TaskStep, message: string, state: TaskExecutionPlan['state'] = 'failed'): TaskExecutionPlan {
    const completedAt = timestamp();
    const nextPlan = this.updateStep(plan, step.id, {
      state,
      error: message,
      completedAt,
    });
    return {
      ...nextPlan,
      state,
      failedStepIds: Array.from(new Set([...nextPlan.failedStepIds, step.id])),
      completedAt,
      durationMs: duration(nextPlan.startedAt, completedAt),
      updatedAt: completedAt,
      finalResult: message,
      timeline: [...nextPlan.timeline, timelineEvent(state, message, step.id)],
    };
  }

  private updateStep(plan: TaskExecutionPlan, stepId: string, patch: Partial<TaskStep>): TaskExecutionPlan {
    return {
      ...plan,
      steps: plan.steps.map((step) => step.id === stepId ? { ...step, ...patch } : step),
    };
  }

  private async save(plan: TaskExecutionPlan): Promise<void> {
    const existing = await this.getHistory();
    const next = [plan, ...existing.filter((item) => item.id !== plan.id)].slice(0, MAX_HISTORY);
    await setItem(HISTORY_KEY, JSON.stringify(next));
  }
}

export const SkillExecutor = new SkillExecutorImpl();
