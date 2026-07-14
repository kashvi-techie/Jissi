import { LifeGraphBuilder } from './LifeGraphBuilder';
import type { LifeGraph, LifeGraphSelection } from './LifeGraphTypes';

class LifeGraphEngineImpl {
  private builder = new LifeGraphBuilder();

  async getGraph(): Promise<LifeGraph> {
    return this.builder.build();
  }

  selectNode(graph: LifeGraph, nodeId: string): LifeGraphSelection | null {
    const node = graph.nodes.find((item) => item.id === nodeId);
    if (!node) return null;
    const edges = graph.edges.filter((edge) => edge.source === nodeId || edge.target === nodeId);
    const connectedIds = new Set(edges.map((edge) => edge.source === nodeId ? edge.target : edge.source));
    return {
      node,
      edges,
      connectedNodes: graph.nodes.filter((item) => connectedIds.has(item.id)),
    };
  }
}

export const LifeGraphEngine = new LifeGraphEngineImpl();
