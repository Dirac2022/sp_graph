/**
 * `useGraphData` — React hook that owns the graph fetch lifecycle.
 *
 * Returns a discriminated-union status so consumers can render loading,
 * success, and error states without optional-chaining everywhere.
 */

import { useEffect, useState } from "react";

import { ApiError, fetchGraph } from "../api/client";
import { error as logError, info as logInfo } from "../logger";
import type { ErrorEnvelope, GraphData } from "../graph/types";

/** Discriminated union for the hook's return value. */
export type GraphFetchState =
  | { status: "loading" }
  | { status: "ok"; data: GraphData }
  | { status: "error"; envelope: ErrorEnvelope | null; status_code: number };

/** Fetch `/api/graph` once on mount and expose status + data. */
export const useGraphData = (): GraphFetchState => {
  const [state, setState] = useState<GraphFetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    logInfo("hooks/useGraphData", "fetching /api/graph");

    fetchGraph()
      .then((data) => {
        if (cancelled) return;
        logInfo("hooks/useGraphData", "graph fetched", {
          nodes: data.nodes.length,
          edges: data.edges.length,
          warnings: data.warnings.length,
        });
        setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError) {
          logError("hooks/useGraphData", "graph fetch failed", {
            status: err.status,
            envelope: err.envelope,
          });
          setState({ status: "error", envelope: err.envelope, status_code: err.status });
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        logError("hooks/useGraphData", "graph fetch threw", { message });
        setState({ status: "error", envelope: null, status_code: 0 });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
