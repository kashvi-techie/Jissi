import { AgentRouter } from './AgentRouter';
import { SkillExecutor } from './SkillExecutor';
import { SkillRegistry } from './SkillRegistry';
import { TaskPlanner } from './TaskPlanner';
import type { TaskExecutionPlan, TaskExecutionState, TaskPlannerInput, TaskStep, TaskTimelineEvent } from './types';
import type { AndroidActionPayload } from '@/services/android-actions';
import type { DecisionResult } from '@/services/decision';

export type OrchestratorState =
  | 'Planning'
  | 'Waiting Confirmation'
  | 'Executing'
  | 'Completed'
  | 'Failed';

export type OrchestratorNodeState =
  | 'planned'
  | 'waiting_confirmation'
  | 'executing'
  | 'completed'
  | 'failed'
  | 'skipped'
  | 'unsupported';

export interface OrchestratorNode {
  id: string;
  command: string;
  label: string;
  state: OrchestratorNodeState;
  plan?: TaskExecutionPlan;
  dependsOn: string[];
  condition: 'always' | 'previous_completed';
  retries: number;
  retryLimit: number;
  rollbackState: 'not_needed' | 'available' | 'unavailable' | 'attempted';
  estimatedMs: number;
  error?: string;
}

export interface OrchestratorEdge {
  from: string;
  to: string;
  condition: 'previous_completed';
}

export interface OrchestratorTimelineEvent {
  id: string;
  timestamp: string;
  state: OrchestratorState | OrchestratorNodeState;
  nodeId?: string;
  message: string;
}

export interface OrchestratorGraph {
  id: string;
  parsedRequest: string;
  state: OrchestratorState;
  nodes: OrchestratorNode[];
  edges: OrchestratorEdge[];
  currentNodeId?: string;
  completedNodeIds: string[];
  failedNodeIds: string[];
  retries: number;
  rollbackState: 'not_needed' | 'partial' | 'unavailable' | 'attempted';
  timeline: OrchestratorTimelineEvent[];
  estimatedDurationMs: number;
  startedAt?: string;
  completedAt?: string;
  durationMs?: number;
  finalReport?: string;
  createdAt: string;
  updatedAt: string;
}

export interface OrchestratorInput {
  request: string;
  parsedIntent: string;
  decision: DecisionResult;
  payload?: AndroidActionPayload;
}

let graphSequence = 0;
let nodeSequence = 0;
let timelineSequence = 0;

const DEFAULT_NODE_ESTIMATE_MS = 3500;

function timestamp(): string {
  return new Date().toISOString();
}

function durationMs(start?: string, end?: string): number | undefined {
  if (!start || !end) return undefined;
  return Math.max(0, new Date(end).getTime() - new Date(start).getTime());
}

function graphId(): string {
  graphSequence += 1;
  return `orchestrator_graph_${Date.now()}_${graphSequence}`;
}

function nodeId(): string {
  nodeSequence += 1;
  return `orchestrator_node_${Date.now()}_${nodeSequence}`;
}

function timeline(state: OrchestratorTimelineEvent['state'], message: string, nodeIdValue?: string): OrchestratorTimelineEvent {
  timelineSequence += 1;
  return {
    id: `orchestrator_event_${Date.now()}_${timelineSequence}`,
    timestamp: timestamp(),
    state,
    nodeId: nodeIdValue,
    message,
  };
}

function splitRequest(request: string): string[] {
  return request
    .split(/\b(?:and then|then|after that|and)\b/i)
    .map((part) => part.trim().replace(/^,+|,+$/g, '').trim())
    .filter(Boolean);
}

function cleanCommand(command: string): string {
  return command
    .replace(/^please\s+/i, '')
    .replace(/^next\s+/i, '')
    .trim();
}

function inferFallbackCommand(command: string): string {
  const text = command.toLowerCase();
  if (/\bmaps?\b/.test(text) && /\bopen\b/.test(text)) return 'open https://www.google.com/maps';
  if (/\bsearch\b/.test(text) && !/\bchrome\b/.test(text)) return command;
  return command;
}

function labelFor(command: string, plan?: TaskExecutionPlan): string {
  return plan?.humanPlan[0]?.replace(/^\d+\.\s*/, '') ?? command;
}

function executionStateToNodeState(state: TaskExecutionState): OrchestratorNodeState {
  if (state === 'completed') return 'completed';
  if (state === 'waiting_confirmation') return 'waiting_confirmation';
  if (state === 'failed' || state === 'waiting_external' || state === 'cancelled') return state === 'waiting_external' ? 'unsupported' : 'failed';
  if (state === 'executing') return 'executing';
  return 'planned';
}

function buildExecutionSummary(graph: OrchestratorGraph): string {
  if (graph.state === 'Completed') return `Completed ${graph.completedNodeIds.length} step${graph.completedNodeIds.length === 1 ? '' : 's'}.`;
  if (graph.state === 'Waiting Confirmation') return 'Waiting for confirmation before continuing.';
  if (graph.failedNodeIds.length) return `Stopped after ${graph.failedNodeIds.length} failed step${graph.failedNodeIds.length === 1 ? '' : 's'}.`;
  return 'Execution prepared.';
}

class AgentOrchestratorImpl {
  buildGraph(input: OrchestratorInput): OrchestratorGraph {
    const createdAt = timestamp();
    const graph: OrchestratorGraph = {
      id: graphId(),
      parsedRequest: input.request,
      state: 'Planning',
      nodes: [],
      edges: [],
      completedNodeIds: [],
      failedNodeIds: [],
      retries: 0,
      rollbackState: 'not_needed',
      timeline: [timeline('Planning', 'Started deterministic orchestration planning.')],
      estimatedDurationMs: 0,
      createdAt,
      updatedAt: createdAt,
    };

    const commands = splitRequest(input.request);
    const sourceCommands = commands.length ? commands : [input.request];

    graph.nodes = [];
    sourceCommands.forEach((rawCommand, index) => {
      const command = inferFallbackCommand(cleanCommand(rawCommand));
      const plannerInput: TaskPlannerInput = {
        userCommand: command,
        parsedIntent: input.parsedIntent,
        decision: input.decision,
        payload: index === 0 ? input.payload : undefined,
      };
      const plan = TaskPlanner.createPlan(plannerInput);
      const id = nodeId();
      const dependsOn = index > 0 ? [graph.nodes[index - 1]?.id].filter(Boolean) : [];
      const unsupportedReason = plan ? undefined : this.unsupportedReason(command, input.decision);
      graph.nodes.push({
        id,
        command,
        label: labelFor(command, plan ?? undefined),
        state: plan ? 'planned' : 'unsupported',
        plan: plan ?? undefined,
        dependsOn,
        condition: index === 0 ? 'always' : 'previous_completed',
        retries: 0,
        retryLimit: 1,
        rollbackState: plan ? 'not_needed' : 'unavailable',
        estimatedMs: plan ? DEFAULT_NODE_ESTIMATE_MS : 0,
        error: unsupportedReason,
      });
    });

    graph.edges = graph.nodes.slice(1).map((node, index) => ({
      from: graph.nodes[index].id,
      to: node.id,
      condition: 'previous_completed',
    }));
    graph.estimatedDurationMs = graph.nodes.reduce((total, node) => total + node.estimatedMs, 0);
    graph.state = graph.nodes.some((node) => node.state === 'unsupported') ? 'Failed' : 'Planning';
    graph.finalReport = graph.state === 'Failed' ? 'One or more steps are unsupported in the current Android action layer.' : undefined;
    graph.timeline.push(timeline(graph.state, `Built execution graph with ${graph.nodes.length} node${graph.nodes.length === 1 ? '' : 's'}.`));
    graph.updatedAt = timestamp();
    return graph;
  }

  async execute(graph: OrchestratorGraph, confirmed = false): Promise<OrchestratorGraph> {
    const startedAt = graph.startedAt ?? timestamp();
    let nextGraph: OrchestratorGraph = {
      ...graph,
      state: 'Executing',
      startedAt,
      updatedAt: startedAt,
      timeline: [...graph.timeline, timeline('Executing', 'Started sequential graph execution.')],
    };

    for (const node of nextGraph.nodes) {
      if (node.state === 'completed') continue;

      const dependenciesMet = node.dependsOn.every((dependencyId) => nextGraph.completedNodeIds.includes(dependencyId));
      if (!dependenciesMet) {
        nextGraph = this.updateNode(nextGraph, node.id, {
          state: 'skipped',
          error: 'Dependency was not completed.',
          rollbackState: 'not_needed',
        });
        nextGraph.timeline.push(timeline('skipped', 'Skipped because a dependency was not completed.', node.id));
        continue;
      }

      if (!node.plan) {
        nextGraph = this.failNode(nextGraph, node, node.error ?? 'No executable plan exists for this node.', 'unsupported');
        break;
      }

      nextGraph = this.updateNode(nextGraph, node.id, { state: 'executing' });
      nextGraph = {
        ...nextGraph,
        currentNodeId: node.id,
        timeline: [...nextGraph.timeline, timeline('executing', `Running: ${node.label}`, node.id)],
      };

      const executedPlan = await SkillExecutor.execute(node.plan, confirmed);
      const nextState = executionStateToNodeState(executedPlan.state);
      nextGraph = this.updateNode(nextGraph, node.id, {
        state: nextState,
        plan: executedPlan,
        retries: executedPlan.retryCount,
        error: executedPlan.finalResult,
      });
      nextGraph.retries += executedPlan.retryCount;

      if (nextState === 'completed') {
        nextGraph = {
          ...nextGraph,
          completedNodeIds: Array.from(new Set([...nextGraph.completedNodeIds, node.id])),
          timeline: [...nextGraph.timeline, timeline('completed', executedPlan.finalResult ?? `${node.label} completed.`, node.id)],
        };
        continue;
      }

      if (nextState === 'waiting_confirmation') {
        nextGraph = {
          ...nextGraph,
          state: 'Waiting Confirmation',
          finalReport: executedPlan.finalResult,
          updatedAt: timestamp(),
          timeline: [...nextGraph.timeline, timeline('waiting_confirmation', executedPlan.finalResult ?? 'Confirmation required.', node.id)],
        };
        return nextGraph;
      }

      nextGraph = await this.rollbackAfterFailure(this.failNode(nextGraph, node, executedPlan.finalResult ?? 'Step failed.', nextState), node);
      break;
    }

    if (nextGraph.state === 'Executing') {
      const completedAt = timestamp();
      nextGraph = {
        ...nextGraph,
        state: nextGraph.failedNodeIds.length ? 'Failed' : 'Completed',
        completedAt,
        durationMs: durationMs(nextGraph.startedAt, completedAt),
        updatedAt: completedAt,
        finalReport: buildExecutionSummary({
          ...nextGraph,
          state: nextGraph.failedNodeIds.length ? 'Failed' : 'Completed',
        }),
        timeline: [...nextGraph.timeline, timeline(nextGraph.failedNodeIds.length ? 'Failed' : 'Completed', 'Graph execution finished.')],
      };
    }

    return nextGraph;
  }

  async retry(graph: OrchestratorGraph, confirmed = false): Promise<OrchestratorGraph> {
    const resetNodes = graph.nodes.map((node) => {
      if (!graph.failedNodeIds.includes(node.id)) return node;
      const resetPlan = node.plan ? {
        ...node.plan,
        state: 'planned' as const,
        failedStepIds: [],
        currentStepId: undefined,
        finalResult: undefined,
      } : undefined;
      return {
        ...node,
        state: resetPlan ? 'planned' as const : 'unsupported' as const,
        plan: resetPlan,
        error: undefined,
      };
    });

    return this.execute({
      ...graph,
      state: 'Planning',
      nodes: resetNodes,
      failedNodeIds: [],
      updatedAt: timestamp(),
      timeline: [...graph.timeline, timeline('Planning', 'Retry requested for failed graph nodes.')],
    }, confirmed);
  }

  private unsupportedReason(command: string, decision: DecisionResult): string {
    const routePlan = AgentRouter.plan(command, decision);
    if (!routePlan) return 'Command did not map to a supported Android action.';
    const skill = SkillRegistry.getByAction(routePlan.actionType);
    if (!skill) return `No registered skill can execute ${routePlan.actionType}.`;
    return 'TaskPlanner could not create an executable plan.';
  }

  private failNode(graph: OrchestratorGraph, node: OrchestratorNode, message: string, state: OrchestratorNodeState = 'failed'): OrchestratorGraph {
    return {
      ...this.updateNode(graph, node.id, {
        state,
        error: message,
        rollbackState: node.rollbackState === 'available' ? 'available' : 'unavailable',
      }),
      state: 'Failed',
      failedNodeIds: Array.from(new Set([...graph.failedNodeIds, node.id])),
      finalReport: message,
      updatedAt: timestamp(),
      timeline: [...graph.timeline, timeline(state, message, node.id)],
    };
  }

  private async rollbackAfterFailure(graph: OrchestratorGraph, failedNode: OrchestratorNode): Promise<OrchestratorGraph> {
    const rollbackEvents: OrchestratorTimelineEvent[] = [];
    let rollbackState: OrchestratorGraph['rollbackState'] = 'not_needed';

    for (const node of graph.nodes.filter((item) => graph.completedNodeIds.includes(item.id)).reverse()) {
      const step: TaskStep | undefined = node.plan?.steps[0];
      const skill = step ? SkillRegistry.get(step.skillId) : undefined;
      if (!skill) {
        rollbackState = 'unavailable';
        rollbackEvents.push(timeline('failed', `Rollback unavailable for ${node.label}.`, node.id));
        continue;
      }
      const rollback = await skill.rollback();
      rollbackState = rollback.supported ? 'attempted' : 'unavailable';
      rollbackEvents.push(timeline('failed', `Rollback for ${node.label}: ${rollback.reason}`, node.id));
    }

    if (!rollbackEvents.length) {
      rollbackState = 'not_needed';
      rollbackEvents.push(timeline('failed', `No completed steps needed rollback after ${failedNode.label}.`, failedNode.id));
    }

    return {
      ...graph,
      rollbackState,
      timeline: [...graph.timeline, ...rollbackEvents],
      updatedAt: timestamp(),
    };
  }

  private updateNode(graph: OrchestratorGraph, nodeIdValue: string, patch: Partial<OrchestratorNode>): OrchestratorGraph {
    return {
      ...graph,
      nodes: graph.nodes.map((node) => node.id === nodeIdValue ? { ...node, ...patch } : node),
      updatedAt: timestamp(),
    };
  }
}

export const AgentOrchestrator = new AgentOrchestratorImpl();
