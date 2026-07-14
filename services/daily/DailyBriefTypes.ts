export interface DailyBriefLine {
  label: string;
  value: string;
  reason: string;
  confidence: number;
}

export interface DailyBrief {
  id: string;
  date: string;
  greeting: string;
  moodSummary: DailyBriefLine;
  todaysFocus: DailyBriefLine;
  plannerTasks: DailyBriefLine[];
  relationshipReminder: DailyBriefLine;
  timelineHighlight: DailyBriefLine;
  recentAchievement: DailyBriefLine;
  habitStreak: DailyBriefLine;
  suggestedAction: DailyBriefLine;
  companionThought: string;
  explanation: string[];
  showReason: 'morning' | 'long_gap' | 'first_open';
  createdAt: string;
}

export interface DailyBriefStorage {
  lastShownDate?: string;
  lastOpenedAt?: string;
}

export interface DailyBriefSourceSnapshot {
  name?: string;
  mood?: string;
  moodConfidence?: number;
  moodReason?: string;
  focusTitle?: string;
  focusReason?: string;
  tasks: Array<{ title: string; minutes: number; reason: string; priority: number }>;
  relationshipName?: string;
  relationshipReason?: string;
  timelineTitle?: string;
  timelineReason?: string;
  achievementTitle?: string;
  achievementReason?: string;
  streak?: number;
  streakReason?: string;
  suggestedAction?: string;
  suggestedActionReason?: string;
  companionThought?: string;
}
