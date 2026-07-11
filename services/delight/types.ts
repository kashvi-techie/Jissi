export type DelightAchievementId =
  | 'first_goal_completed'
  | 'seven_day_streak'
  | 'ten_conversations'
  | 'first_proactive_suggestion_accepted'
  | 'first_relationship_remembered';

export interface DelightAchievement {
  id: DelightAchievementId;
  title: string;
  description: string;
  reason: string;
  unlockedAt?: string;
  fresh: boolean;
}

export interface DelightQuote {
  text: string;
  author: string;
}

export interface DelightSnapshot {
  welcome: string;
  quote: DelightQuote;
  achievements: DelightAchievement[];
  newlyUnlocked: DelightAchievement[];
}
