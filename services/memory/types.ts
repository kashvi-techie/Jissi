export type ConsolidatedMemoryCategory =
  | 'preference'
  | 'goal'
  | 'birthday'
  | 'relationship'
  | 'routine'
  | 'achievement'
  | 'general';

export interface ConsolidatedMemory {
  id: string;
  category: ConsolidatedMemoryCategory;
  summary: string;
  sourceKeys: string[];
  strength: number;
  confidence: number;
  lastReinforcedAt: string;
  pinned: boolean;
  decayed: boolean;
}

export interface UserProfileSnapshot {
  summary: string;
  preferences: string[];
  goals: string[];
  relationships: string[];
  routines: string[];
  achievements: string[];
  confidence: number;
  updatedAt: string;
}

export interface MemoryConsolidationSnapshot {
  generatedAt: string;
  rawMemoryCount: number;
  duplicateGroups: number;
  promotedCount: number;
  decayedCount: number;
  consolidated: ConsolidatedMemory[];
  profile: UserProfileSnapshot;
}
