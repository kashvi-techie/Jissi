import { AgentRouter } from '@/services/agent';
import { TaskPlanner } from '@/services/agent';
import type { DecisionResult } from '@/services/decision';
import { CapabilityAnalytics } from './CapabilityAnalytics';
import { CapabilityPermissionManager } from './CapabilityPermissionManager';
import { CapabilityRegistry } from './CapabilityRegistry';
import type { CapabilityExecutionInput, CapabilityId, CapabilityResult, CapabilitySnapshot, CapabilitySnapshotItem } from './CapabilityTypes';

class CapabilityManagerImpl {
  list() {
    return CapabilityRegistry.list();
  }

  async snapshot(): Promise<CapabilitySnapshot> {
    const history = await CapabilityAnalytics.getHistory();
    const registered: CapabilitySnapshotItem[] = await Promise.all(CapabilityRegistry.list().map(async (capability) => ({
      id: capability.id,
      displayName: capability.displayName,
      description: capability.description,
      requiredPermissions: capability.requiredPermissions,
      permissionState: await CapabilityPermissionManager.getCachedPermissionState(capability),
      supportedPlatforms: capability.supportedPlatforms,
      availability: capability.availability(),
      validation: capability.validate(),
      lastExecution: history.find((entry) => entry.capabilityId === capability.id),
      lastSuccess: history.find((entry) => entry.capabilityId === capability.id && entry.status === 'supported'),
      lastFailure: history.find((entry) => entry.capabilityId === capability.id && entry.status !== 'supported'),
      platformNotes: capability.platformNotes,
    })));
    return { registered, history };
  }

  async execute(id: CapabilityId, input?: CapabilityExecutionInput): Promise<CapabilityResult> {
    const capability = CapabilityRegistry.get(id);
    if (!capability) {
      return {
        id: `capability_missing_${Date.now()}`,
        capabilityId: id,
        status: 'unsupported',
        message: 'Capability is not registered.',
        reason: 'No matching capability definition exists.',
        timestamp: new Date().toISOString(),
        durationMs: 0,
      };
    }
    return capability.execute(input);
  }

  planMetadata(command: string) {
    const decision: DecisionResult = {
      action: 'proactive_help' as const,
      confidence: 0.75,
      explanation: 'Capability metadata planning preview.',
      sourceSystems: ['intent'],
      candidates: [],
    };
    return {
      agentRoute: AgentRouter.plan(command, decision),
      taskPlan: TaskPlanner.createPlan({ userCommand: command, parsedIntent: 'capability_preview', decision }),
    };
  }

  async clearAnalytics(): Promise<void> {
    await CapabilityAnalytics.clear();
  }
}

export const CapabilityManager = new CapabilityManagerImpl();
