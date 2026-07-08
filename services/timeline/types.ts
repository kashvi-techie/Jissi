export type TimelineFilter = 'all' | 'goals' | 'habits' | 'people' | 'projects' | 'learning' | 'achievements';
export type TimelineSource = 'planner' | 'behavior' | 'context' | 'memory' | 'conversation';

export interface TimelineEvent {
  id: string;
  title: string;
  description: string;
  timestamp?: string;
  source: TimelineSource;
  filter: Exclude<TimelineFilter, 'all'>;
  icon: 'goal' | 'habit' | 'person' | 'project' | 'learning' | 'achievement' | 'conversation' | 'memory';
  confidence?: number;
  pinned: boolean;
  favorite: boolean;
  note?: string;
}

export interface TimelineMetadata {
  pinned?: boolean;
  favorite?: boolean;
  note?: string;
  updatedAt: string;
}

export interface TimelineStats {
  completedGoals: number;
  habitsDetected: number;
  conversationsRemembered: number;
  milestonesAchieved: number;
}

export interface TimelineSnapshot {
  events: TimelineEvent[];
  stats: TimelineStats;
}
