/**
 * Layout driver: runs ForceAtlas2 in a Web Worker and writes the resulting
 * positions back into the graph nodes' `x`/`y` attributes.
 *
 * Exposes a small handle interface so the caller can both wait for completion
 * (`done`) and cancel the supervisor early (`stop`). The supervisor lives in a
 * worker thread, so cancellation matters on unmount: a leaked supervisor
 * keeps a JS Worker alive and continues mutating the graph object.
 */

import FA2Layout from "graphology-layout-forceatlas2/worker";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type Graph from "graphology";

import type { EdgeAttrs, NodeAttrs } from "./buildGraph";
import { info as logInfo } from "../logger";

const ITERATION_BUDGET_MS = 20_000;

/** Handle returned by {@link startLayout}. */
export interface LayoutHandle {
  /** Resolves when the iteration budget elapses (or immediately if cancelled). */
  readonly done: Promise<void>;
  /** Stop the supervisor and free the worker. Safe to call multiple times. */
  stop(): void;
}

/**
 * Start ForceAtlas2 against the supplied graph.
 *
 * Tuning notes (set after visual feedback on the 3.7k-node dataset):
 *
 * - `scalingRatio` raised aggressively (80) so the cloud spreads instead of
 *   crushing into a tight cluster.
 * - `gravity` lowered (0.05) so nodes are not pulled toward the origin.
 * - `outboundAttractionDistribution` on so hub SPs are visually distinct from
 *   their long tails.
 * - `edgeWeightInfluence` zeroed so dense subgraphs do not collapse harder
 *   than sparse ones.
 */
export const startLayout = (
  graph: Graph<NodeAttrs, EdgeAttrs>,
): LayoutHandle => {
  if (graph.order === 0) {
    return { done: Promise.resolve(), stop: () => undefined };
  }

  const inferred = forceAtlas2.inferSettings(graph);
  const supervisor = new FA2Layout(graph, {
    settings: {
      ...inferred,
      scalingRatio: 2000,
      gravity: 0.005,
      outboundAttractionDistribution: true,
      edgeWeightInfluence: 0,
      slowDown: 1,
    },
  });

  let stopped = false;
  const stop = (): void => {
    if (stopped) return;
    stopped = true;
    supervisor.stop();
    supervisor.kill();
    logInfo("graph/layout", "supervisor stopped");
  };

  supervisor.start();

  const done = new Promise<void>((resolve) => {
    window.setTimeout(() => {
      stop();
      resolve();
    }, ITERATION_BUDGET_MS);
  });

  return { done, stop };
};
