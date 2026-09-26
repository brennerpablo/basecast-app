import dagre from "@dagrejs/dagre";

import type { FlowGraph, FlowKind } from "./graph";

/** Node boxes in flow units; the node components fill exactly this size. */
export const NODE_SIZE: Record<FlowKind, { width: number; height: number }> = {
  origin: { width: 208, height: 88 },
  ingest: { width: 256, height: 120 },
  process: { width: 240, height: 104 },
  pipeline: { width: 268, height: 140 },
  table: { width: 256, height: 104 },
  derived: { width: 256, height: 104 },
};

const GAP = 16;

export type Positioned = { x: number; y: number; width: number; height: number };

/**
 * Left-to-right layers from dagre. Dagre centers an origin on its sources, which in a long group puts it far
 * below the group's top; each origin is pinned to its first source instead, then pushed down past the one above.
 */
export function layoutFlow(graph: FlowGraph): { positions: Map<string, Positioned>; width: number; height: number } {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: "LR", nodesep: GAP, ranksep: 84, marginx: 32, marginy: 24 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const node of graph.nodes) g.setNode(node.id, { ...NODE_SIZE[node.kind] });
  for (const edge of graph.edges) g.setEdge(edge.source, edge.target);
  dagre.layout(g);

  const positions = new Map<string, Positioned>();
  for (const node of graph.nodes) {
    const box = g.node(node.id);
    const { width, height } = NODE_SIZE[node.kind];
    positions.set(node.id, { x: box.x - width / 2, y: box.y - height / 2, width, height });
  }

  const origins = graph.nodes.filter((n) => n.kind === "origin").map((n) => ({ id: n.id, box: positions.get(n.id)! }));
  for (const origin of origins) {
    const tops = (graph.down.get(origin.id) ?? []).map((id) => positions.get(id)!.y);
    if (tops.length) origin.box.y = Math.min(...tops);
  }
  origins.sort((a, b) => a.box.y - b.box.y);
  for (let i = 1; i < origins.length; i += 1) {
    const above = origins[i - 1].box;
    origins[i].box.y = Math.max(origins[i].box.y, above.y + above.height + GAP);
  }

  const label = g.graph();
  const bottom = Math.max(label.height ?? 0, ...[...positions.values()].map((p) => p.y + p.height + 24));
  return { positions, width: label.width ?? 0, height: bottom };
}
