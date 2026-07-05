export type EmotionState =
  | 'focused'
  | 'relaxed'
  | 'curious'
  | 'excited'
  | 'stressed'
  | 'confused'
  | 'tired'
  | 'lonely'
  | 'frustrated'
  | 'neutral';

export type EmotionSignalType =
  | 'conversation_frequency'
  | 'conversation_duration'
  | 'task_focus'
  | 'late_night_usage'
  | 'repeated_question'
  | 'repeated_failure'
  | 'missed_reminder'
  | 'behavior_confidence'
  | 'typing_speed'
  | 'voice_energy'
  | 'low_activity'
  | 'curiosity'
  | 'positive_energy';

export interface EmotionSignal {
  id: string;
  timestamp: string;
  weekday: number;
  hour: number;
  type: EmotionSignalType;
  emotion: EmotionState;
  weight: number;
  confidence: number;
  reason: string;
  metadata?: Record<string, unknown>;
}

export interface EmotionEstimate {
  state: EmotionState;
  confidence: number;
  reasons: string[];
  signals: EmotionSignal[];
  deliveryStyle: string;
  wellbeingSuggestion?: string;
  updatedAt: string;
}

export interface EmotionDailySummary {
  date: string;
  dominantEmotion: EmotionState;
  confidence: number;
  reasons: string[];
  signalCount: number;
}

export interface EmotionTrend {
  range: 'last_7_days' | 'last_30_days';
  dominantEmotion: EmotionState;
  confidence: number;
  summary: string;
}

export interface EmotionSnapshot {
  current: EmotionEstimate;
  signals: EmotionSignal[];
  history: EmotionDailySummary[];
  trends: EmotionTrend[];
}

export interface EmotionInteractionInput {
  input: string;
  intent?: string;
  taskType?: string | null;
  taskConfidence?: number;
  behaviorConfidence?: number;
  reminderMissed?: boolean;
  durationMs?: number;
  typingSpeed?: number;
  voiceEnergy?: number;
}
