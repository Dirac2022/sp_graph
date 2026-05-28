/**
 * Application shell.
 *
 * Owns the top-level grid layout: a header (title + counts + Reset View),
 * a left search column, a full-bleed canvas, and a right-hand detail panel.
 * Renders banners above the canvas when the loader reports warnings or errors.
 *
 * Selection semantics (set after visual review):
 *
 * - The selection persists until the user picks a new SP via the search bar
 *   or clicks a different node on the canvas.
 * - Clicking the canvas background is a no-op.
 * - The "Reset View" button clears the selection, empties the search input
 *   (via key-based remount of `<SearchBar/>`), and animates the camera back
 *   to the initial pose.
 */

import { useCallback, useMemo, useState } from "react";
import { RotateCcw } from "lucide-react";

import { GraphCanvas } from "./components/GraphCanvas";
import { Legend } from "./components/Legend";
import { SearchBar } from "./components/SearchBar";
import { DetailPanel } from "./components/DetailPanel";
import { ErrorBanner } from "./components/ErrorBanner";
import { WarningBanner } from "./components/WarningBanner";
import { buildGraph } from "./graph/buildGraph";
import { buildSpDetail } from "./graph/spDetail";
import { useGraphData } from "./hooks/useGraphData";
import { useSelection } from "./hooks/useSelection";

/** Top-level React component. */
export const App = (): JSX.Element => {
  const fetchState = useGraphData();

  const graph = useMemo(() => {
    if (fetchState.status !== "ok") return undefined;
    return buildGraph(fetchState.data);
  }, [fetchState]);

  const selection = useSelection(graph);

  const [resetSignal, setResetSignal] = useState<number>(0);

  const handleReset = useCallback(() => {
    selection.setSelection(null);
    setResetSignal((n) => n + 1);
  }, [selection]);

  const detail = useMemo(() => {
    if (fetchState.status !== "ok" || selection.selected === null) return null;
    return buildSpDetail(fetchState.data, selection.selected);
  }, [fetchState, selection.selected]);

  if (fetchState.status === "loading") {
    return (
      <div className="flex h-full w-full items-center justify-center text-neutral-400">
        Loading graph...
      </div>
    );
  }

  if (fetchState.status === "error") {
    return (
      <div className="flex h-full w-full flex-col">
        <ErrorBanner
          status={fetchState.status_code}
          envelope={fetchState.envelope}
        />
        <div className="flex flex-1 items-center justify-center text-neutral-500">
          The graph cannot be displayed until the data file is valid.
        </div>
      </div>
    );
  }

  const { data } = fetchState;

  return (
    <div className="grid h-full w-full grid-cols-[18rem_1fr_22rem] grid-rows-[auto_1fr] gap-0">
      <header className="col-span-3 border-b border-neutral-800 bg-neutral-900 px-4 py-2">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-sm font-semibold tracking-wide text-neutral-100">
            SP Graph Viewer
          </h1>
          <div className="flex items-center gap-3">
            <span className="text-xs text-neutral-400">
              {data.meta.totalEntries} SPs · {data.meta.totalRequerido} required ·{" "}
              {data.edges.length} edges
            </span>
            <button
              type="button"
              onClick={handleReset}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-950 px-2.5 py-1 text-xs text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
              title="Reset selection and camera"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset view
            </button>
          </div>
        </div>
        {data.warnings.length > 0 ? <WarningBanner warnings={data.warnings} /> : null}
      </header>

      <aside className="row-start-2 border-r border-neutral-800 bg-neutral-900 p-3">
        <SearchBar
          key={resetSignal}
          names={data.nodes.map((n) => n.id)}
          onPick={(id) => selection.setSelection(id)}
        />
      </aside>

      <main className="relative row-start-2 bg-neutral-950">
        {graph !== undefined ? (
          <GraphCanvas
            graph={graph}
            selected={selection.selected}
            callees={selection.callees}
            callers={selection.callers}
            resetSignal={resetSignal}
            onSelect={(id) => selection.setSelection(id)}
          />
        ) : null}
        <Legend />
      </main>

      <aside className="row-start-2 border-l border-neutral-800 bg-neutral-900">
        <DetailPanel detail={detail} onPick={(id) => selection.setSelection(id)} />
      </aside>
    </div>
  );
};
