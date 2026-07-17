import { DailyBriefEngine } from '@/services/daily';
import { DeviceStateEngine } from '@/services/device';
import { PlannerEngine } from '@/services/planner';
import { ProactiveEngine } from '@/services/proactive';
import { RelationshipService } from '@/services/relationships';
import { WorkflowEngine } from '@/services/workflows';
import { normalizeRuntime, OrchestratorContext, OrchestratorRuntimeInput } from './OrchestratorContext';
import { OrchestratorDecision } from './OrchestratorDecision';
import { OrchestratorPolicy } from './OrchestratorPolicy';

function activeWorkflowFrom(history: Awaited<ReturnType<typeof WorkflowEngine.history>>) {
  return history.find((run) => run.state === 'running' || run.state === 'paused' || run.state === 'waiting_confirmation' || run.state === 'pending') ?? null;
}

class CompanionOrchestratorImpl {
  async collectContext(runtime: OrchestratorRuntimeInput = {}): Promise<OrchestratorContext> {
    const [workflowHistory, device, planner, relationships, dailyBrief, proactive] = await Promise.all([
      WorkflowEngine.history().catch(() => []),
      DeviceStateEngine.getContext().catch(() => null),
      PlannerEngine.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      DailyBriefEngine.getBriefToShow().catch(() => null),
      ProactiveEngine.getLegacySuggestions({
        userTalking: runtime.isListening,
        voiceActive: runtime.isThinking || runtime.isSpeaking,
      }).catch(() => []),
    ]);

    return {
      runtime: normalizeRuntime(runtime),
      workflow: {
        active: activeWorkflowFrom(workflowHistory),
        recent: workflowHistory.slice(0, 5),
      },
      device,
      planner,
      relationships,
      dailyBrief,
      proactive,
      collectedAt: new Date().toISOString(),
    };
  }

  async decide(runtime: OrchestratorRuntimeInput = {}): Promise<OrchestratorDecision> {
    const context = await this.collectContext(runtime);
    return OrchestratorPolicy.decide(context);
  }

  async inspect(runtime: OrchestratorRuntimeInput = {}): Promise<{ context: OrchestratorContext; decision: OrchestratorDecision }> {
    const context = await this.collectContext(runtime);
    return {
      context,
      decision: OrchestratorPolicy.decide(context),
    };
  }
}

export const CompanionOrchestrator = new CompanionOrchestratorImpl();
