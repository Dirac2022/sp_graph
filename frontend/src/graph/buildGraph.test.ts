/**
 * Smoke test for `buildGraph` — protects the edge-dedup, self-loop, and ghost
 * invariants that downstream rendering depends on.
 */

import { describe, expect, it } from "vitest";

import { buildGraph } from "./buildGraph";
import type { GraphData } from "./types";

const fixture: GraphData = {
  meta: {
    dataFileMtimeIso: "2026-05-28T00:00:00Z",
    dataFilePath: "x",
    totalEntries: 2,
    totalRequerido: 1,
  },
  nodes: [
    {
      id: "SP_A",
      rol: "requerido",
      lines: 1,
      isStub: false,
      outDegreeSp: 1,
      inDegreeSp: 0,
    },
    {
      id: "SP_B",
      rol: "adjunto_hijo",
      lines: 2,
      isStub: false,
      outDegreeSp: 1,
      inDegreeSp: 1,
    },
  ],
  edges: [
    { id: "SP_A->SP_B", source: "SP_A", target: "SP_B" },
    { id: "SP_B->SP_B", source: "SP_B", target: "SP_B" }, // self-loop
    { id: "SP_A->SP_GHOST", source: "SP_A", target: "SP_GHOST" },
  ],
  ghosts: ["SP_GHOST"],
  leavesBySp: {},
  warnings: [],
};

describe("buildGraph", () => {
  it("creates one node per real SP plus ghosts", () => {
    const g = buildGraph(fixture);
    expect(g.order).toBe(3); // SP_A, SP_B, SP_GHOST
  });

  it("preserves a self-loop as a single edge", () => {
    const g = buildGraph(fixture);
    expect(g.hasEdge("SP_B->SP_B")).toBe(true);
    let count = 0;
    g.forEachEdge((_id, _attrs, source, target) => {
      if (source === "SP_B" && target === "SP_B") count += 1;
    });
    expect(count).toBe(1);
  });

  it("flags ghost nodes with isGhost=true", () => {
    const g = buildGraph(fixture);
    expect(g.getNodeAttribute("SP_GHOST", "isGhost")).toBe(true);
    expect(g.getNodeAttribute("SP_A", "isGhost")).toBe(false);
  });

  it("retains edges to ghost targets", () => {
    const g = buildGraph(fixture);
    expect(g.hasEdge("SP_A->SP_GHOST")).toBe(true);
  });
});
