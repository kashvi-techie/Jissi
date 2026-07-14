import { AgentRouter, TaskPlanner } from '@/services/agent';
import type { DecisionResult } from '@/services/decision';
import { WorkflowExecution } from './WorkflowExecution';
import { WorkflowHistory } from './WorkflowHistory';
import { WorkflowRegistry } from './WorkflowRegistry';
import type { WorkflowDefinition, WorkflowRun, WorkflowStepRuntime } from './WorkflowTypes';

let runSequence = 0;

function now(): string {
  return new Date().toISOString();
}

function runId(): string {
  runSequence += 1;
  return `workflow_run_${Date.now()}_${runSequence}`;
}

function edgesFor(steps: WorkflowStepRuntime[]) {
  return steps.flatMap((step) => step.dependsOn.map((dependencyId) => ({
    from: dependencyId,
    to: step.id,
    condition: step.condition,
  })));
}

class WorkflowEngineImpl {
  createRun(definition: WorkflowDefinition): WorkflowRun {
    const createdAt = now();
    const nodes: WorkflowStepRuntime[] = definition.steps.map((step) => ({
      ...step,
      state: 'pending',
      retryCount: 0,
    }));
    return {
      id: runId(),
      definitionId: definition.id,
      name: definition.name,
      state: 'pending',
      graph: { nodes, edges: edgesFor(nodes) },
      completedStepIds: [],
      failedStepIds: [],
      retryCount: 0,
      rollbackState: 'not_needed',
      errors: [],
      timeline: [{
        id: `workflow_start_${Date.now()}`,
        timestamp: createdAt,
        state: 'pending',
        message: `Created workflow: ${definition.name}.`,
      }],
      estimatedDurationMs: definition.estimatedDurationMs,
      createdAt,
      updatedAt: createdAt,
    };
  }

  async execute(definitionId: string): Promise<WorkflowRun | null> {
    const definition = WorkflowRegistry.get(definitionId);
    if (!definition) return null;
    const run = await WorkflowExecution.execute(this.createRun(definition));
    await WorkflowHistory.save(run);
    return run;
  }

  async resume(run: WorkflowRun): Promise<WorkflowRun> {
    const next = await WorkflowExecution.execute({ ...run, state: 'pending', updatedAt: now() });
    await WorkflowHistory.save(next);
    return next;
  }

  async pause(run: WorkflowRun): Promise<WorkflowRun> {
    const next = WorkflowExecution.pause(run);
    await WorkflowHistory.save(next);
    return next;
  }

  async cancel(run: WorkflowRun): Promise<WorkflowRun> {
    const next = WorkflowExecution.cancel(run);
    await WorkflowHistory.save(next);
    return next;
  }

  planningPreview(command: string) {
    const decision: DecisionResult = {
      action: 'proactive_help',
      confidence: 0.74,
      explanation: 'Workflow planning preview.',
      sourceSystems: ['intent'],
      candidates: [],
    };
    return {
      agentRoute: AgentRouter.plan(command, decision),
      taskPlan: TaskPlanner.createPlan({ userCommand: command, parsedIntent: 'workflow_preview', decision }),
    };
  }

  async history(): Promise<WorkflowRun[]> {
    return WorkflowHistory.list();
  }
}

export const WorkflowEngine = new WorkflowEngineImpl();
