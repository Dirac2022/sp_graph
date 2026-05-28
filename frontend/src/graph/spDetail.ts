/**
 * Pure derivation of an {@link SpDetail} from the loaded {@link GraphData}.
 *
 * Lives separately from the React layer so it can be unit-tested or reused.
 */

import type { GraphData, LeafObjectType, LeafRef, SpDetail } from "./types";

const LEAF_TYPES: ReadonlyArray<LeafObjectType> = [
  "Table",
  "View",
  "Scalar Function",
  "Table Function",
  "Inline Function",
  "OBJECT_OR_COLUMN",
  "TYPE",
];

const emptyLeavesByType = (): Record<LeafObjectType, ReadonlyArray<LeafRef>> => ({
  Table: [],
  View: [],
  "Scalar Function": [],
  "Table Function": [],
  "Inline Function": [],
  OBJECT_OR_COLUMN: [],
  TYPE: [],
});

/**
 * Build the {@link SpDetail} for the SP identified by `id`.
 *
 * Returns `null` when the id is not present in the data (e.g. a ghost click).
 *
 * @param data - Full graph payload.
 * @param id   - SP id to inspect.
 */
export const buildSpDetail = (data: GraphData, id: string): SpDetail | null => {
  const node = data.nodes.find((n) => n.id === id);
  if (!node) return null;

  const children = new Set<string>();
  const parents = new Set<string>();
  for (const edge of data.edges) {
    if (edge.source === id) children.add(edge.target);
    if (edge.target === id) parents.add(edge.source);
  }

  const leavesByType = emptyLeavesByType();
  const leaves = data.leavesBySp[id] ?? [];
  const grouped: Record<LeafObjectType, LeafRef[]> = {
    Table: [],
    View: [],
    "Scalar Function": [],
    "Table Function": [],
    "Inline Function": [],
    OBJECT_OR_COLUMN: [],
    TYPE: [],
  };
  for (const leaf of leaves) {
    grouped[leaf.objectType].push(leaf);
  }
  for (const key of LEAF_TYPES) {
    leavesByType[key] = [...grouped[key]].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }

  return {
    id: node.id,
    rol: node.rol,
    lines: node.lines,
    isStub: node.isStub,
    children: [...children].sort((a, b) => a.localeCompare(b)),
    parents: [...parents].sort((a, b) => a.localeCompare(b)),
    leavesByType,
  };
};
