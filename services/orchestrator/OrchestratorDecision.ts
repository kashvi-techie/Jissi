export type OrchestratorPrimaryAction =
  | 'stay_idle'
  | 'handle_interruption'
  | 'continue_workflow'
  | 'show_device_status'
  | 'answer_user'
  | 'show_planner_focus'
  | 'show_relationship_reminder'
  | 'show_daily_brief'
  | 'show_proactive_suggestion'
  | 'companion_idle';

export type OrchestratorSecondaryAction =
  | 'open_chat'
  | 'open_timeline'
  | 'open_settings'
  | 'open_profile'
  | 'open_daily_brief'
  | 'dismiss'
  | 'ask_later';

export type SpeakingStyle =
  | 'calm'
  | 'excited'
  | 'supportive'
  | 'professional'
  | 'playful'
  | 'focused'
  | 'urgent';

export type CompanionState =
  | 'Idle'
  | 'Listening'
  | 'Thinking'
  | 'Searching'
  | 'Helping'
  | 'Celebrating'
  | 'Reflecting'
  | 'Waiting'
  | 'Executing';

export interface OrchestratorCandidate {
  id: OrchestratorPrimaryAction;
  label: string;
  engine: string;
  priority: number;
  score: number;
  accepted: boolean;
  reason: string;
  rejectedReason?: string;
}

export interface OrchestratorDecision {
  primary_action: OrchestratorPrimaryAction;
  secondary_actions: OrchestratorSecondaryAction[];
  speaking_style: SpeakingStyle;
  companion_state: CompanionState;
  should_interrupt: boolean;
  should_wait: boolean;
  should_ask_confirmation: boolean;
  explanation: string;
  chosen_engine: string;
  rejected_engines: OrchestratorCandidate[];
  priority_scores: OrchestratorCandidate[];
  generated_at: string;
}
