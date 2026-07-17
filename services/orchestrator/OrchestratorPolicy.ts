import type { OrchestratorContext } from './OrchestratorContext';
import type {
  CompanionState,
  OrchestratorCandidate,
  OrchestratorDecision,
  OrchestratorPrimaryAction,
  OrchestratorSecondaryAction,
  SpeakingStyle,
} from './OrchestratorDecision';

const PRIORITY: Record<OrchestratorPrimaryAction, number> = {
  handle_interruption: 1,
  continue_workflow: 2,
  show_device_status: 3,
  answer_user: 4,
  show_planner_focus: 5,
  show_relationship_reminder: 6,
  show_daily_brief: 7,
  show_proactive_suggestion: 8,
  companion_idle: 9,
  stay_idle: 10,
};

function hasQuestion(input: string): boolean {
  const text = input.trim();
  return text.length > 0 && (text.endsWith('?') || /\b(how|what|why|when|where|who|can|should|explain|tell|help|open|call|message)\b/i.test(text));
}

function relationshipNeedsAttention(context: OrchestratorContext): boolean {
  const first = context.relationships[0];
  if (!first?.lastDiscussed) return false;
  const days = (Date.now() - new Date(first.lastDiscussed).getTime()) / (24 * 60 * 60 * 1000);
  return Number.isFinite(days) && days >= 7;
}

function plannerHasFocus(context: OrchestratorContext): boolean {
  return (context.planner?.agenda.items.length ?? 0) > 0 || !!context.planner?.goals.find((goal) => goal.status !== 'completed');
}

function makeCandidate(
  id: OrchestratorPrimaryAction,
  engine: string,
  score: number,
  reason: string,
  accepted: boolean
): OrchestratorCandidate {
  return {
    id,
    label: id.replace(/_/g, ' '),
    engine,
    priority: PRIORITY[id],
    score,
    accepted,
    reason,
    rejectedReason: accepted ? undefined : 'A higher-priority or stronger candidate owns the screen.',
  };
}

function styleFor(action: OrchestratorPrimaryAction, context: OrchestratorContext): SpeakingStyle {
  if (action === 'handle_interruption' || context.device?.lowBattery || context.device?.offline) return 'urgent';
  if (action === 'continue_workflow' || action === 'answer_user') return 'focused';
  if (action === 'show_relationship_reminder' || action === 'show_daily_brief') return 'supportive';
  if (action === 'show_planner_focus') return 'professional';
  if (action === 'show_proactive_suggestion') return 'calm';
  return 'calm';
}

function companionFor(action: OrchestratorPrimaryAction): CompanionState {
  if (action === 'handle_interruption') return 'Listening';
  if (action === 'continue_workflow') return 'Executing';
  if (action === 'show_device_status') return 'Helping';
  if (action === 'answer_user') return 'Thinking';
  if (action === 'show_planner_focus') return 'Helping';
  if (action === 'show_relationship_reminder') return 'Reflecting';
  if (action === 'show_daily_brief') return 'Reflecting';
  if (action === 'show_proactive_suggestion') return 'Waiting';
  return 'Idle';
}

function secondaryFor(action: OrchestratorPrimaryAction): OrchestratorSecondaryAction[] {
  if (action === 'answer_user') return ['open_chat'];
  if (action === 'show_planner_focus' || action === 'continue_workflow') return ['open_timeline', 'dismiss'];
  if (action === 'show_relationship_reminder') return ['open_profile', 'ask_later'];
  if (action === 'show_daily_brief') return ['open_daily_brief', 'dismiss'];
  if (action === 'show_device_status') return ['open_settings', 'dismiss'];
  if (action === 'show_proactive_suggestion') return ['dismiss', 'ask_later'];
  return ['open_chat'];
}

export class OrchestratorPolicy {
  static decide(context: OrchestratorContext): OrchestratorDecision {
    const candidates = this.score(context);
    const chosen = [...candidates].sort((a, b) => a.priority - b.priority || b.score - a.score)[0]
      ?? makeCandidate('stay_idle', 'Companion', 0.1, 'No active context needs the screen.', true);
    const priorityScores = candidates.map((candidate) => ({
      ...candidate,
      accepted: candidate.id === chosen.id,
      rejectedReason: candidate.id === chosen.id ? undefined : candidate.rejectedReason,
    }));
    const rejected = priorityScores.filter((candidate) => !candidate.accepted);

    return {
      primary_action: chosen.id,
      secondary_actions: secondaryFor(chosen.id),
      speaking_style: styleFor(chosen.id, context),
      companion_state: companionFor(chosen.id),
      should_interrupt: chosen.id === 'handle_interruption' || chosen.id === 'show_device_status',
      should_wait: context.runtime.isSpeaking || context.runtime.isThinking,
      should_ask_confirmation: context.runtime.requiresConfirmation || chosen.id === 'continue_workflow',
      explanation: chosen.reason,
      chosen_engine: chosen.engine,
      rejected_engines: rejected,
      priority_scores: priorityScores,
      generated_at: new Date().toISOString(),
    };
  }

  static score(context: OrchestratorContext): OrchestratorCandidate[] {
    const runtime = context.runtime;
    const activeWorkflow = context.workflow.active;
    const deviceIssue = context.device?.offline || context.device?.lowBattery;
    const candidates: OrchestratorCandidate[] = [
      makeCandidate(
        'handle_interruption',
        'Runtime',
        runtime.isSpeaking && runtime.userInput.trim().length > 0 ? 0.98 : 0,
        runtime.isSpeaking ? 'User input arrived while JISSI was speaking.' : 'No active interruption.',
        runtime.isSpeaking && runtime.userInput.trim().length > 0
      ),
      makeCandidate(
        'continue_workflow',
        'WorkflowEngine',
        activeWorkflow ? 0.93 : 0,
        activeWorkflow ? `Workflow "${activeWorkflow.name}" is ${activeWorkflow.state}.` : 'No active workflow is running.',
        !!activeWorkflow
      ),
      makeCandidate(
        'show_device_status',
        'DeviceStateEngine',
        deviceIssue ? 0.9 : 0,
        context.device?.offline ? "Device is offline." : context.device?.lowBattery ? 'Battery is low.' : 'No urgent device condition.',
        !!deviceIssue
      ),
      makeCandidate(
        'answer_user',
        'Conversation',
        hasQuestion(runtime.userInput) ? 0.86 : 0,
        runtime.userInput ? 'User asked for a direct response.' : 'No user question is waiting.',
        hasQuestion(runtime.userInput)
      ),
      makeCandidate(
        'show_planner_focus',
        'PlannerEngine',
        plannerHasFocus(context) ? 0.72 : 0,
        plannerHasFocus(context) ? 'Planner has a current goal or agenda item.' : 'Planner has no active focus.',
        plannerHasFocus(context)
      ),
      makeCandidate(
        'show_relationship_reminder',
        'RelationshipService',
        relationshipNeedsAttention(context) ? 0.64 : 0,
        relationshipNeedsAttention(context) ? 'A relationship has not been discussed recently.' : 'No relationship reminder is due.',
        relationshipNeedsAttention(context)
      ),
      makeCandidate(
        'show_daily_brief',
        'DailyBriefEngine',
        context.dailyBrief ? 0.58 : 0,
        context.dailyBrief ? 'A daily brief is available for today.' : 'No daily brief is waiting.',
        !!context.dailyBrief
      ),
      makeCandidate(
        'show_proactive_suggestion',
        'ProactiveEngine',
        context.proactive[0] ? context.proactive[0].confidence : 0,
        context.proactive[0]?.reason ?? 'No proactive suggestion is eligible.',
        !!context.proactive[0]
      ),
      makeCandidate(
        'companion_idle',
        'Companion',
        0.3,
        'No engine needs ownership, so JISSI can stay quietly present.',
        true
      ),
    ];

    return candidates.filter((candidate) => candidate.accepted || candidate.id === 'companion_idle');
  }
}
