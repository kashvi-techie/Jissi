export type PlannerDomain =
  | 'gate'
  | 'react'
  | 'fitness'
  | 'learning'
  | 'career'
  | 'generic';

export type PlannerTaskState = 'pending' | 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'delayed';

export interface PlannerTask {
  id: string;
  title: string;
  description: string;
  status: PlannerTaskState;
  priority: 1 | 2 | 3;
  estimatedMinutes: number;
  scheduledFor?: string;
  dueAt?: string;
  completedAt?: string;
  skippedAt?: string;
  reason?: string;
}

export interface PlannerMilestone {
  id: string;
  title: string;
  description: string;
  status: PlannerTaskState;
  targetDate?: string;
  tasks: PlannerTask[];
}

export interface PlannerProgress {
  completionPercent: number;
  consistency: number;
  currentStreak: number;
  longestStreak: number;
  estimatedFinishDate?: string;
  completedTasks: number;
  totalTasks: number;
}

export interface PlannerGoal {
  id: string;
  title: string;
  rawText: string;
  domain: PlannerDomain;
  status: PlannerTaskState;
  createdAt: string;
  updatedAt: string;
  deadline?: string;
  motivation: string;
  milestones: PlannerMilestone[];
  progress: PlannerProgress;
}

export interface PlannerHistoryEntry {
  id: string;
  timestamp: string;
  type: 'goal_created' | 'task_completed' | 'task_skipped' | 'task_rescheduled' | 'agenda_created';
  goalId?: string;
  taskId?: string;
  reason: string;
}

export interface PlannerAgendaItem {
  goalId: string;
  goalTitle: string;
  milestoneId: string;
  taskId: string;
  title: string;
  estimatedMinutes: number;
  priority: PlannerTask['priority'];
  reason: string;
}

export interface PlannerDailyAgenda {
  date: string;
  items: PlannerAgendaItem[];
  reasons: string[];
  behaviorHint?: string;
  emotionHint?: string;
}

export interface PlannerSnapshot {
  goals: PlannerGoal[];
  agenda: PlannerDailyAgenda;
  history: PlannerHistoryEntry[];
}

export interface PlannerConversationResult {
  handled: true;
  reply: string;
  reason: string;
  goal?: PlannerGoal;
  agenda?: PlannerDailyAgenda;
}
