import type { DeviceContextSummary } from '@/services/device';
import type { DailyBrief } from '@/services/daily';
import type { PlannerSnapshot } from '@/services/planner';
import type { ProactiveSuggestion } from '@/services/proactive';
import type { RelationshipProfile } from '@/services/relationships';
import type { WorkflowRun } from '@/services/workflows';

export interface OrchestratorRuntimeInput {
  userInput?: string;
  isListening?: boolean;
  isThinking?: boolean;
  isSpeaking?: boolean;
  pendingTasks?: string[];
  requiresConfirmation?: boolean;
}

export interface OrchestratorContext {
  runtime: Required<OrchestratorRuntimeInput>;
  workflow: {
    active: WorkflowRun | null;
    recent: WorkflowRun[];
  };
  device: DeviceContextSummary | null;
  planner: PlannerSnapshot | null;
  relationships: RelationshipProfile[];
  dailyBrief: DailyBrief | null;
  proactive: ProactiveSuggestion[];
  collectedAt: string;
}

export function normalizeRuntime(input: OrchestratorRuntimeInput = {}): Required<OrchestratorRuntimeInput> {
  return {
    userInput: input.userInput ?? '',
    isListening: input.isListening ?? false,
    isThinking: input.isThinking ?? false,
    isSpeaking: input.isSpeaking ?? false,
    pendingTasks: input.pendingTasks ?? [],
    requiresConfirmation: input.requiresConfirmation ?? false,
  };
}
