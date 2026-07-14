import React from 'react';
import { Line } from 'react-native-svg';
import type { LifeEdge as LifeEdgeModel, LifeNode } from '@/services/lifegraph';

const EDGE_COLORS: Record<LifeEdgeModel['type'], string> = {
  working_on: 'rgba(93,220,255,0.62)',
  knows: 'rgba(255,151,218,0.58)',
  learned: 'rgba(170,139,255,0.58)',
  visited: 'rgba(112,255,205,0.5)',
  completed: 'rgba(255,218,122,0.62)',
  improving: 'rgba(122,233,255,0.52)',
  related_to: 'rgba(255,255,255,0.28)',
};

export function LifeEdge({ edge, source, target, selected }: { edge: LifeEdgeModel; source: LifeNode; target: LifeNode; selected?: boolean }) {
  return (
    <Line
      x1={source.x}
      y1={source.y}
      x2={target.x}
      y2={target.y}
      stroke={EDGE_COLORS[edge.type]}
      strokeWidth={selected ? 2.6 : 1.2}
      strokeOpacity={selected ? 0.95 : 0.54}
    />
  );
}
