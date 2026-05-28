/**
 * Build a Graphology graph from a {@link GraphData} payload.
 *
 * Pure function: no React, no DOM, no side effects beyond the returned graph.
 * Imported by the layout worker driver and by the canvas component.
 */

import Graph from "graphology";

import type { GraphData, SpNode } from "./types";

/** Node attribute shape attached to each Graphology node. */
export interface NodeAttrs {
  /** Visible label. Equal to the SP id (case preserved). */
  label: string;
  /** Role bucket for color/shape decisions. */
  rol: SpNode["rol"];
  /** Stub flag (in-scope but no metadata). */
  isStub: boolean;
  /** Ghost flag (referenced but not present in mappings). */
  isGhost: boolean;
  /** Line count when known; `null` for stubs and ghosts. */
  lines: number | null;
  /** Initial size — Sigma scales these in screen space. */
  size: number;
  /** Initial X coordinate (will be replaced by the layout pass). */
  x: number;
  /** Initial Y coordinate (will be replaced by the layout pass). */
  y: number;
}

/** Edge attribute shape attached to each Graphology edge. */
export interface EdgeAttrs {
  /** Sigma's default edge type; arrowheads are drawn for "arrow". */
  type: "arrow";
  /** Edge weight; affects ForceAtlas2's repulsion calculations. */
  weight: number;
  /** Stroke width in Sigma's screen-space pixels. */
  size: number;
}

const DEFAULT_EDGE_SIZE = 0.6;

const DEFAULT_NODE_SIZE = 5;
const GHOST_NODE_SIZE = 3.5;
const INITIAL_SPREAD = 50;

const seedCoord = (): number => (Math.random() * 2 - 1) * INITIAL_SPREAD;

/**
 * Build the Graphology graph used by both the layout worker and the renderer.
 *
 * Behavior:
 * - One node per `data.nodes[i]` (real SP).
 * - One node per `data.ghosts[i]` that is NOT already a real SP id (ghost).
 * - One edge per `data.edges[i]`. Self-loops are preserved as a single edge.
 *   Duplicates are impossible by construction because the API already deduped.
 * - Initial coordinates are randomized in `[-1, 1]` so the force-directed pass
 *   has somewhere to start.
 *
 * @param data - The payload returned by `GET /api/graph`.
 * @returns A directed Graphology graph ready for layout and rendering.
 */
export const buildGraph = (data: GraphData): Graph<NodeAttrs, EdgeAttrs> => {
  const graph = new Graph<NodeAttrs, EdgeAttrs>({ type: "directed", allowSelfLoops: true });

  const realIds = new Set<string>();
  for (const node of data.nodes) {
    realIds.add(node.id);
    graph.addNode(node.id, {
      label: node.id,
      rol: node.rol,
      isStub: node.isStub,
      isGhost: false,
      lines: node.lines,
      size: DEFAULT_NODE_SIZE,
      x: seedCoord(),
      y: seedCoord(),
    });
  }

  for (const ghostId of data.ghosts) {
    if (realIds.has(ghostId) || graph.hasNode(ghostId)) {
      continue;
    }
    graph.addNode(ghostId, {
      label: ghostId,
      rol: "adjunto_hijo",
      isStub: false,
      isGhost: true,
      lines: null,
      size: GHOST_NODE_SIZE,
      x: seedCoord(),
      y: seedCoord(),
    });
  }

  for (const edge of data.edges) {
    if (!graph.hasNode(edge.source)) {
      graph.addNode(edge.source, {
        label: edge.source,
        rol: "adjunto_hijo",
        isStub: false,
        isGhost: true,
        lines: null,
        size: GHOST_NODE_SIZE,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
      });
    }
    if (!graph.hasNode(edge.target)) {
      graph.addNode(edge.target, {
        label: edge.target,
        rol: "adjunto_hijo",
        isStub: false,
        isGhost: true,
        lines: null,
        size: GHOST_NODE_SIZE,
        x: Math.random() * 2 - 1,
        y: Math.random() * 2 - 1,
      });
    }
    if (graph.hasEdge(edge.id)) {
      continue;
    }
    graph.addEdgeWithKey(edge.id, edge.source, edge.target, {
      type: "arrow",
      weight: 1,
      size: DEFAULT_EDGE_SIZE,
    });
  }

  return graph;
};
