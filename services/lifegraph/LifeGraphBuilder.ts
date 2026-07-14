import { BehaviorEngine } from '@/services/behavior';
import { MemoryConsolidationEngine } from '@/services/memory';
import { OnboardingService } from '@/services/onboarding';
import { PlannerEngine } from '@/services/planner';
import { RelationshipService } from '@/services/relationships';
import { TimelineService } from '@/services/timeline';
import type { LifeEdge, LifeEdgeType, LifeGraph, LifeNode, LifeNodeType } from './LifeGraphTypes';

const CENTER = { x: 520, y: 360 };
const RINGS: Record<LifeNodeType, number> = {
  me: 0,
  goal: 175,
  project: 220,
  person: 250,
  habit: 300,
  interest: 335,
  achievement: 365,
  memory: 395,
  place: 425,
};

const ANGLE_START: Record<LifeNodeType, number> = {
  me: 0,
  goal: -80,
  project: -25,
  person: 35,
  habit: 95,
  interest: 150,
  achievement: 210,
  memory: 265,
  place: 320,
};

function now(): string {
  return new Date().toISOString();
}

function slug(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'item';
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function placeNode(type: LifeNodeType, index: number, total: number): { x: number; y: number } {
  if (type === 'me') return CENTER;
  const radius = RINGS[type];
  const spread = Math.min(72, Math.max(26, total * 13));
  const offset = total <= 1 ? 0 : -spread / 2 + (spread / Math.max(1, total - 1)) * index;
  const angle = ((ANGLE_START[type] + offset) * Math.PI) / 180;
  return {
    x: Math.round(CENTER.x + Math.cos(angle) * radius),
    y: Math.round(CENTER.y + Math.sin(angle) * radius),
  };
}

function edgeTypeForNode(type: LifeNodeType): LifeEdgeType {
  if (type === 'person') return 'knows';
  if (type === 'goal' || type === 'project') return 'working_on';
  if (type === 'habit') return 'improving';
  if (type === 'achievement') return 'completed';
  if (type === 'place') return 'visited';
  if (type === 'interest') return 'learned';
  return 'related_to';
}

function uniqueNodes(nodes: LifeNode[]): LifeNode[] {
  const seen = new Set<string>();
  return nodes.filter((node) => {
    if (seen.has(node.id)) return false;
    seen.add(node.id);
    return true;
  });
}

export class LifeGraphBuilder {
  async build(): Promise<LifeGraph> {
    const [profile, planner, behavior, relationships, timeline, memory] = await Promise.all([
      OnboardingService.getProfile().catch(() => null),
      PlannerEngine.getSnapshot().catch(() => null),
      BehaviorEngine.getSnapshot().catch(() => null),
      RelationshipService.getProfiles().catch(() => []),
      TimelineService.getSnapshot().catch(() => null),
      MemoryConsolidationEngine.getSnapshot().catch(() => null),
    ]);

    const generatedAt = now();
    const meTitle = profile?.nickname || profile?.name || 'Me';
    const candidates: LifeNode[] = [{
      id: 'me',
      type: 'me',
      title: meTitle,
      subtitle: profile?.roles?.[0] ? titleCase(profile.roles[0]) : 'JISSI user',
      reason: profile ? 'Created from the local onboarding profile.' : 'Created as the root of the local graph.',
      confidence: profile ? 0.9 : 0.55,
      lastUpdated: profile?.updatedAt ?? generatedAt,
      ...CENTER,
    }];

    planner?.goals.slice(0, 8).forEach((goal) => {
      candidates.push({
        id: `goal:${goal.id}`,
        type: goal.domain === 'react' || goal.domain === 'career' ? 'project' : 'goal',
        title: goal.title,
        subtitle: `${goal.progress.completionPercent}% complete`,
        reason: goal.motivation,
        confidence: 0.86,
        lastUpdated: goal.updatedAt,
        x: 0,
        y: 0,
      });
    });

    relationships.slice(0, 10).forEach((person) => {
      candidates.push({
        id: `person:${person.id}`,
        type: 'person',
        title: person.name,
        subtitle: titleCase(person.relationship),
        reason: `${person.name} exists because JISSI has a local relationship profile for them.`,
        confidence: Math.min(0.96, 0.7 + person.timeline.length * 0.03),
        lastUpdated: person.lastDiscussed,
        x: 0,
        y: 0,
        metadata: { memories: person.memories.length + person.likes.length + person.dislikes.length },
      });
    });

    behavior?.routines.slice(0, 7).forEach((routine) => {
      candidates.push({
        id: `habit:${routine.id}`,
        type: 'habit',
        title: routine.label,
        subtitle: `${Math.round(routine.confidence * 100)}% confidence`,
        reason: routine.reason,
        confidence: routine.confidence,
        lastUpdated: routine.updatedAt,
        x: 0,
        y: 0,
      });
    });

    profile?.interests.slice(0, 8).forEach((interest) => {
      candidates.push({
        id: `interest:${slug(interest)}`,
        type: 'interest',
        title: titleCase(interest),
        reason: 'Added from local onboarding interests.',
        confidence: 0.76,
        lastUpdated: profile.updatedAt,
        x: 0,
        y: 0,
      });
    });

    timeline?.events.slice(0, 12).forEach((event) => {
      const type: LifeNodeType = event.filter === 'achievements' ? 'achievement' : event.filter === 'projects' ? 'project' : event.icon === 'memory' ? 'memory' : 'memory';
      candidates.push({
        id: `timeline:${event.id}`,
        type,
        title: event.title,
        subtitle: titleCase(event.filter),
        reason: event.description,
        confidence: event.confidence ?? 0.68,
        lastUpdated: event.timestamp ?? generatedAt,
        x: 0,
        y: 0,
      });
    });

    memory?.consolidated.slice(0, 12).forEach((item) => {
      const type: LifeNodeType = item.category === 'achievement' ? 'achievement' : item.category === 'routine' ? 'habit' : item.category === 'goal' ? 'goal' : 'memory';
      candidates.push({
        id: `memory:${item.id}`,
        type,
        title: item.summary,
        subtitle: titleCase(item.category),
        reason: `Consolidated local memory reinforced ${item.strength} time${item.strength === 1 ? '' : 's'}.`,
        confidence: item.confidence,
        lastUpdated: item.lastReinforcedAt,
        x: 0,
        y: 0,
      });
    });

    const groupedCounts = candidates.reduce<Record<LifeNodeType, number>>((counts, node) => {
      counts[node.type] = (counts[node.type] ?? 0) + 1;
      return counts;
    }, {} as Record<LifeNodeType, number>);
    const groupedIndex: Partial<Record<LifeNodeType, number>> = {};
    const nodes = uniqueNodes(candidates).map((node) => {
      if (node.type === 'me') return node;
      const index = groupedIndex[node.type] ?? 0;
      groupedIndex[node.type] = index + 1;
      return { ...node, ...placeNode(node.type, index, groupedCounts[node.type] ?? 1) };
    });

    const nodeById = new Map(nodes.map((node) => [node.id, node]));
    const edges: LifeEdge[] = nodes
      .filter((node) => node.id !== 'me')
      .map((node) => ({
        id: `edge:me:${node.id}`,
        source: 'me',
        target: node.id,
        type: edgeTypeForNode(node.type),
        reason: node.reason,
        confidence: node.confidence,
      }));

    relationships.forEach((person) => {
      const personNode = nodes.find((node) => node.id === `person:${person.id}`);
      if (!personNode) return;
      person.likes.slice(0, 3).forEach((like) => {
        const interestId = `interest:${slug(like)}`;
        if (nodeById.has(interestId)) {
          edges.push({
            id: `edge:${personNode.id}:${interestId}`,
            source: personNode.id,
            target: interestId,
            type: 'related_to',
            reason: `${person.name} is remembered locally as liking ${like}.`,
            confidence: 0.72,
          });
        }
      });
    });

    return {
      id: `lifegraph_${generatedAt}`,
      generatedAt,
      nodes,
      edges,
      stats: {
        people: nodes.filter((node) => node.type === 'person').length,
        goals: nodes.filter((node) => node.type === 'goal').length,
        habits: nodes.filter((node) => node.type === 'habit').length,
        memories: nodes.filter((node) => node.type === 'memory').length,
        achievements: nodes.filter((node) => node.type === 'achievement').length,
      },
    };
  }
}
