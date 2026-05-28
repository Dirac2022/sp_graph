/**
 * `useSelection` — manages the currently-selected SP and its 1-hop neighborhood,
 * split by direction so the canvas can paint callees and callers distinctly.
 */

import { useCallback, useMemo, useState } from "react";
import type Graph from "graphology";

import type { EdgeAttrs, NodeAttrs } from "../graph/buildGraph";

/** Shape returned by the hook. */
export interface SelectionState {
  /** Currently-selected SP id, or `null` when nothing is selected. */
  selected: string | null;
  /** Out-neighbors: SPs the selected SP calls. */
  callees: ReadonlySet<string>;
  /** In-neighbors: SPs that call the selected SP. */
  callers: ReadonlySet<string>;
  /** Union of `callees`, `callers`, and the selected id (handy for filtering). */
  neighborhood: ReadonlySet<string>;
  /** Set the selection. Pass `null` to clear. */
  setSelection: (id: string | null) => void;
}

const EMPTY: ReadonlySet<string> = new Set<string>();

/**
 * React hook returning the current {@link SelectionState}.
 *
 * @param graph - The Graphology graph used to compute the neighborhood. When
 *                `undefined` (e.g. before the data has loaded) selections are
 *                still tracked, but neighborhood sets stay empty.
 */
export const useSelection = (
  graph: Graph<NodeAttrs, EdgeAttrs> | undefined,
): SelectionState => {
  const [selected, setSelected] = useState<string | null>(null);

  const setSelection = useCallback((id: string | null) => {
    setSelected(id);
  }, []);

  const { callees, callers, neighborhood } = useMemo<{
    callees: ReadonlySet<string>;
    callers: ReadonlySet<string>;
    neighborhood: ReadonlySet<string>;
  }>(() => {
    if (selected === null || graph === undefined || !graph.hasNode(selected)) {
      return { callees: EMPTY, callers: EMPTY, neighborhood: EMPTY };
    }
    const out = new Set<string>();
    const inc = new Set<string>();
    graph.forEachOutNeighbor(selected, (id) => out.add(id));
    graph.forEachInNeighbor(selected, (id) => inc.add(id));
    const union = new Set<string>([selected, ...out, ...inc]);
    return { callees: out, callers: inc, neighborhood: union };
  }, [selected, graph]);

  return { selected, callees, callers, neighborhood, setSelection };
};
