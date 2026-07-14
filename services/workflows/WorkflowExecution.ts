import { CapabilityManager } from '@/services/capabilities';
import type { WorkflowRun, WorkflowState, WorkflowStepRuntime, WorkflowTimelineEvent } from './WorkflowTypes';

let eventSequence = 0;

function now(): string {
  return new Date().toISOString();
}

function duration(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function event(state: WorkflowState, message: string, stepId?: string): WorkflowTimelineEvent {
  eventSequence += 1;
  return {
    id: `workflow_event_${Date.now()}_${eventSequence}`,
    timestamp: now(),
    state,
    stepId,
    message,
  };
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Workflow step timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

class WorkflowExecutionImpl {
  async execute(run: WorkflowRun): Promise<WorkflowRun> {
    if (run.state === 'cancelled') return run;
    const startedAt = run.startedAt ?? now();
    let nextRun: WorkflowRun = {
      ...run,
      state: 'running',
      startedAt,
      updatedAt: startedAt,
      timeline: [...run.timeline, event('running', 'Workflow execution started.')],
    };

    for (const step of nextRun.graph.nodes) {
      if (nextRun.state === 'paused' || nextRun.state === 'cancelled') break;
      if (step.state === 'completed') continue;

      const dependencyMet = step.dependsOn.every((dependencyId) => nextRun.completedStepIds.includes(dependencyId));
      if (!dependencyMet && step.condition !== 'always') {
        nextRun = this.failStep(nextRun, step, 'Dependency did not complete.');
        break;
      }

      nextRun = this.updateStep(nextRun, step.id, { state: 'running', startedAt: now() });
      nextRun = {
        ...nextRun,
        currentStepId: step.id,
        timeline: [...nextRun.timeline, event('running', `Running ${step.label}.`, step.id)],
      };

      try {
        let activeStep = step;
        let result = await withTimeout(CapabilityManager.execute(activeStep.capabilityId, activeStep.input), activeStep.timeoutMs);
        while (result.status !== 'supported' && result.status !== 'permission_required' && activeStep.retryCount < activeStep.retryLimit) {
          activeStep = { ...activeStep, retryCount: activeStep.retryCount + 1 };
          nextRun = this.updateStep(nextRun, activeStep.id, activeStep);
          nextRun = {
            ...nextRun,
            retryCount: nextRun.retryCount + 1,
            timeline: [...nextRun.timeline, event('running', `Retrying ${activeStep.label}.`, activeStep.id)],
          };
          result = await withTimeout(CapabilityManager.execute(activeStep.capabilityId, activeStep.input), activeStep.timeoutMs);
        }
        if (result.status === 'permission_required') {
          nextRun = this.updateStep(nextRun, activeStep.id, { state: 'waiting_confirmation', result, completedAt: now() });
          return {
            ...nextRun,
            state: 'waiting_confirmation',
            summary: result.message,
            updatedAt: now(),
            timeline: [...nextRun.timeline, event('waiting_confirmation', result.message, activeStep.id)],
          };
        }
        if (result.status === 'supported') {
          nextRun = this.updateStep(nextRun, activeStep.id, { state: 'completed', result, completedAt: now() });
          nextRun = {
            ...nextRun,
            completedStepIds: Array.from(new Set([...nextRun.completedStepIds, activeStep.id])),
            timeline: [...nextRun.timeline, event('completed', result.message, activeStep.id)],
          };
          continue;
        }

        nextRun = await this.rollback(this.failStep(nextRun, activeStep, result.reason));
        break;
      } catch (error) {
        nextRun = await this.rollback(this.failStep(nextRun, step, error instanceof Error ? error.message : 'Unknown workflow error.'));
        break;
      }
    }

    if (nextRun.state === 'running') {
      const completedAt = now();
      nextRun = {
        ...nextRun,
        state: nextRun.failedStepIds.length ? 'failed' : 'completed',
        completedAt,
        durationMs: duration(nextRun.startedAt, completedAt),
        updatedAt: completedAt,
        summary: nextRun.failedStepIds.length ? 'Workflow failed.' : 'Workflow completed.',
        timeline: [...nextRun.timeline, event(nextRun.failedStepIds.length ? 'failed' : 'completed', nextRun.failedStepIds.length ? 'Workflow failed.' : 'Workflow completed.')],
      };
    }

    return nextRun;
  }

  pause(run: WorkflowRun): WorkflowRun {
    return {
      ...run,
      state: 'paused',
      updatedAt: now(),
      timeline: [...run.timeline, event('paused', 'Workflow paused.')],
    };
  }

  cancel(run: WorkflowRun): WorkflowRun {
    const completedAt = now();
    return {
      ...run,
      state: 'cancelled',
      completedAt,
      durationMs: duration(run.startedAt, completedAt),
      updatedAt: completedAt,
      summary: 'Workflow cancelled.',
      timeline: [...run.timeline, event('cancelled', 'Workflow cancelled.')],
    };
  }

  private failStep(run: WorkflowRun, step: WorkflowStepRuntime, message: string): WorkflowRun {
    const completedAt = now();
    const nextRun = this.updateStep(run, step.id, { state: 'failed', error: message, completedAt });
    return {
      ...nextRun,
      state: 'failed',
      failedStepIds: Array.from(new Set([...nextRun.failedStepIds, step.id])),
      errors: [...nextRun.errors, message],
      completedAt,
      durationMs: duration(nextRun.startedAt, completedAt),
      updatedAt: completedAt,
      summary: message,
      timeline: [...nextRun.timeline, event('failed', message, step.id)],
    };
  }

  private async rollback(run: WorkflowRun): Promise<WorkflowRun> {
    const completed = run.graph.nodes.filter((step) => run.completedStepIds.includes(step.id));
    if (!completed.length) {
      return {
        ...run,
        rollbackState: 'not_needed',
        timeline: [...run.timeline, event('failed', 'No completed steps required rollback.')],
      };
    }
    return {
      ...run,
      rollbackState: completed.some((step) => step.rollback?.available) ? 'available' : 'unavailable',
      timeline: [...run.timeline, event('failed', 'Rollback metadata recorded. No automatic rollback executed.')],
    };
  }

  private updateStep(run: WorkflowRun, stepId: string, patch: Partial<WorkflowStepRuntime>): WorkflowRun {
    return {
      ...run,
      graph: {
        ...run.graph,
        nodes: run.graph.nodes.map((step) => step.id === stepId ? { ...step, ...patch } : step),
      },
      updatedAt: now(),
    };
  }
}

export const WorkflowExecution = new WorkflowExecutionImpl();
