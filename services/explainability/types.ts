export type ExplanationKind = 'proactive' | 'planner' | 'relationship' | 'life';

export interface ExplanationItem {
  id: string;
  kind: ExplanationKind;
  title: string;
  message: string;
  explanation: string;
  sourceSystems: string[];
  createdAt: string;
}

export interface ExplainabilitySnapshot {
  generatedAt: string;
  items: ExplanationItem[];
}
