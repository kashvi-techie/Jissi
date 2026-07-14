export type LifeNodeType =
  | 'me'
  | 'person'
  | 'project'
  | 'goal'
  | 'habit'
  | 'place'
  | 'interest'
  | 'achievement'
  | 'memory';

export type LifeEdgeType =
  | 'working_on'
  | 'knows'
  | 'learned'
  | 'visited'
  | 'completed'
  | 'improving'
  | 'related_to';

export interface LifeNode {
  id: string;
  type: LifeNodeType;
  title: string;
  subtitle?: string;
  reason: string;
  confidence: number;
  lastUpdated: string;
  x: number;
  y: number;
  metadata?: Record<string, string | number | boolean>;
}

export interface LifeEdge {
  id: string;
  source: string;
  target: string;
  type: LifeEdgeType;
  reason: string;
  confidence: number;
}

export interface LifeGraph {
  id: string;
  generatedAt: string;
  nodes: LifeNode[];
  edges: LifeEdge[];
  stats: {
    people: number;
    goals: number;
    habits: number;
    memories: number;
    achievements: number;
  };
}

export interface LifeGraphSelection {
  node: LifeNode;
  connectedNodes: LifeNode[];
  edges: LifeEdge[];
}
