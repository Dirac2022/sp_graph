/**
 * Sigma.js (WebGL) renderer mounted into a full-bleed `<div>`.
 *
 * Performance-critical design notes:
 *
 * - The `onSelect` callback is held in a ref so that the Sigma mount-effect
 *   only depends on `[graph]`. Without this, an inline-arrow `onSelect` from
 *   the parent would re-mount Sigma (and re-run the 3.5-second layout) on
 *   every click — that was the source of the "slow when changing nodes" lag.
 * - Selection-driven styling is done via `nodeReducer` / `edgeReducer`, but
 *   the reducers read mutable refs so flipping selection just calls
 *   `sigma.refresh()` rather than rebuilding the renderer.
 * - The forced label for selected / callee / caller nodes uses a custom
 *   dark-backdrop drawer so the label text never blends with Sigma's default
 *   white hover background.
 * - `hideEdgesOnMove: true` keeps pan and zoom snappy on weak GPUs.
 */

import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import Sigma from "sigma";
import type Graph from "graphology";

import type { EdgeAttrs, NodeAttrs } from "../graph/buildGraph";
import { startLayout } from "../graph/layout";
import type { MagicFilterMode } from "../hooks/useMagicFilter";
import type { SpRole } from "../graph/types";
import { info as logInfo } from "../logger";

interface GraphCanvasProps {
  readonly graph: Graph<NodeAttrs, EdgeAttrs>;
  readonly selected: string | null;
  readonly callees: ReadonlySet<string>;
  readonly callers: ReadonlySet<string>;
  /** Increments whenever the user presses the Reset View button. */
  readonly resetSignal: number;
  readonly onSelect: (id: string) => void;
  /** When non-null, the Magic filter is active and this is the full set of magic SP ids. */
  readonly magicSpIds: ReadonlySet<string> | null;
  readonly magicMode: MagicFilterMode;
  /** SPs belonging to the currently-selected program (highlighted in cyan). */
  readonly selectedProgramSpIds: ReadonlySet<string> | null;
}

const ROLE_COLOR: Record<SpRole, string> = {
  requerido: "#10b981",
  adjunto_hijo: "#64748b",
  adjunto_padre: "#64748b",
  adjunto_ambos: "#64748b",
};

const STUB_COLOR = "#fbbf24";
const GHOST_COLOR = "#3f3f46";
const CALLEE_COLOR = "#fb923c";
const CALLER_COLOR = "#a78bfa";
const PROGRAM_COLOR = "#06b6d4";
const LABEL_COLOR = "#f9fafb";
const EDGE_COLOR = "#71717a";
const LABEL_BG = "rgba(15, 23, 42, 0.95)";

const DEFAULT_LABEL_THRESHOLD = 6;
const INITIAL_CAMERA_RATIO = 0.18;
const SELECTION_CAMERA_RATIO = 0.06;
const CAMERA_ANIMATION_MS = 600;

const colorForNode = (attrs: NodeAttrs): string => {
  if (attrs.isGhost) return GHOST_COLOR;
  if (attrs.isStub) return STUB_COLOR;
  return ROLE_COLOR[attrs.rol];
};

const animateToNode = (
  sigma: Sigma<NodeAttrs, EdgeAttrs>,
  graph: Graph<NodeAttrs, EdgeAttrs>,
  nodeId: string,
): void => {
  if (!graph.hasNode(nodeId)) return;
  // Sigma normalizes raw graph coords into its own display space; the camera
  // operates in that display space, so we must read the post-normalization
  // coordinates via `getNodeDisplayData` rather than the raw graph attributes.
  const display = sigma.getNodeDisplayData(nodeId);
  if (!display) return;
  sigma.getCamera().animate(
    { x: display.x, y: display.y, ratio: SELECTION_CAMERA_RATIO },
    { duration: CAMERA_ANIMATION_MS },
  );
};

/**
 * Custom hover-label drawer. Sigma's default uses a WHITE background with
 * node-color text — emerald/orange/violet text on white is low-contrast.
 * This drawer paints a dark slate backdrop with the node color as a thin
 * border and renders the label in near-white text.
 */
const drawSelectionLabel = (
  context: CanvasRenderingContext2D,
  data: {
    readonly x: number;
    readonly y: number;
    readonly size: number;
    readonly color: string;
    readonly label?: string | null;
  },
  settings: {
    readonly labelFont: string;
    readonly labelSize: number;
    readonly labelWeight: string;
  },
): void => {
  const label = data.label ?? "";
  if (label.length === 0) return;
  const padX = 6;
  const padY = 3;
  const radius = 4;
  const fontSize = settings.labelSize;
  context.font = `${settings.labelWeight} ${fontSize}px ${settings.labelFont}`;
  const textWidth = context.measureText(label).width;
  const w = textWidth + padX * 2;
  const h = fontSize + padY * 2;
  const offset = data.size + 4;
  const x = data.x + offset;
  const y = data.y - h / 2;

  context.fillStyle = LABEL_BG;
  context.strokeStyle = data.color;
  context.lineWidth = 1.25;
  context.beginPath();
  const ctx2d = context as CanvasRenderingContext2D & {
    roundRect?: (x: number, y: number, w: number, h: number, r: number) => void;
  };
  if (typeof ctx2d.roundRect === "function") {
    ctx2d.roundRect(x, y, w, h, radius);
  } else {
    context.rect(x, y, w, h);
  }
  context.fill();
  context.stroke();

  context.fillStyle = LABEL_COLOR;
  context.textBaseline = "middle";
  context.fillText(label, x + padX, y + h / 2);
};

/** Full-bleed Sigma renderer. */
export const GraphCanvas = ({
  graph,
  selected,
  callees,
  callers,
  resetSignal,
  onSelect,
  magicSpIds,
  magicMode,
  selectedProgramSpIds,
}: GraphCanvasProps): JSX.Element => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sigmaRef = useRef<Sigma<NodeAttrs, EdgeAttrs> | null>(null);
  const sigmaReadyRef = useRef<boolean>(false);
  const [layoutDone, setLayoutDone] = useState<boolean>(false);

  // Cache latest selection/neighborhood/onSelect in refs so the Sigma reducers
  // and click handler always see fresh values without re-mounting the canvas.
  const selectedRef = useRef<string | null>(selected);
  const calleesRef = useRef<ReadonlySet<string>>(callees);
  const callersRef = useRef<ReadonlySet<string>>(callers);
  const onSelectRef = useRef<(id: string) => void>(onSelect);
  const magicSpIdsRef = useRef<ReadonlySet<string> | null>(magicSpIds);
  const magicModeRef = useRef<MagicFilterMode>(magicMode);
  const selectedProgramSpIdsRef = useRef<ReadonlySet<string> | null>(selectedProgramSpIds);
  useEffect(() => {
    selectedRef.current = selected;
    calleesRef.current = callees;
    callersRef.current = callers;
    magicSpIdsRef.current = magicSpIds;
    magicModeRef.current = magicMode;
    selectedProgramSpIdsRef.current = selectedProgramSpIds;
    sigmaRef.current?.refresh();
  }, [selected, callees, callers, magicSpIds, magicMode, selectedProgramSpIds]);
  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  // Mount Sigma + drive the layout pass once per graph instance. The
  // dependency list is intentionally `[graph]` only — clicks must not
  // re-mount the canvas or re-run layout.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let disposed = false;
    let sigma: Sigma<NodeAttrs, EdgeAttrs> | null = null;
    setLayoutDone(false);

    const handle = startLayout(graph);
    void handle.done.then(() => {
      if (disposed) return;

      logInfo("components/GraphCanvas", "layout converged; mounting Sigma");
      sigma = new Sigma(graph, container, {
        renderEdgeLabels: false,
        defaultEdgeType: "arrow",
        hideEdgesOnMove: true,
        labelRenderedSizeThreshold: DEFAULT_LABEL_THRESHOLD,
        labelDensity: 0.7,
        labelColor: { color: LABEL_COLOR },
        labelFont: "ui-sans-serif, system-ui, sans-serif",
        defaultNodeColor: "#94a3b8",
        defaultEdgeColor: EDGE_COLOR,
        defaultDrawNodeHover: drawSelectionLabel,
        nodeReducer: (id, attrs) => {
          const truncatedLabel = attrs.label && attrs.label.length > 10
            ? attrs.label.substring(0, 10) + "..."
            : attrs.label;
          const baseColor = colorForNode(attrs);
          const sel = selectedRef.current;
          const magic = magicSpIdsRef.current;
          const progIds = selectedProgramSpIdsRef.current;

          if (id === sel) {
            return {
              ...attrs,
              label: attrs.label,
              color: baseColor,
              size: attrs.size * 1.2,
              forceLabel: true,
              zIndex: 4,
              hidden: false,
            };
          }
          if (calleesRef.current.has(id)) {
            return {
              ...attrs,
              label: attrs.label,
              color: CALLEE_COLOR,
              size: attrs.size * 1.1,
              forceLabel: true,
              zIndex: 3,
              hidden: false,
            };
          }
          if (callersRef.current.has(id)) {
            return {
              ...attrs,
              label: attrs.label,
              color: CALLER_COLOR,
              size: attrs.size * 1.3,
              forceLabel: true,
              zIndex: 3,
              hidden: false,
            };
          }
          if (progIds !== null && progIds.has(id)) {
            return {
              ...attrs,
              label: attrs.label,
              color: PROGRAM_COLOR,
              size: attrs.size * 1.1,
              forceLabel: true,
              zIndex: 2,
              hidden: false,
            };
          }
          if (magic !== null) {
            const isMagic = magic.has(id);
            if (magicModeRef.current === "filter" && !isMagic) {
              return { ...attrs, hidden: true };
            }
            if (magicModeRef.current === "highlight" && !isMagic) {
              return {
                ...attrs,
                label: "",
                color: baseColor,
                size: attrs.size * 0.6,
                zIndex: 0,
                hidden: false,
              };
            }
          }
          return {
            ...attrs,
            label: truncatedLabel,
            color: baseColor,
            zIndex: attrs.rol === "requerido" ? 1 : 0,
            hidden: false,
          };
        },
        edgeReducer: (id, attrs) => {
          const sel = selectedRef.current;
          if (sel === null) return attrs;
          const source = graph.source(id);
          const target = graph.target(id);
          if (source === sel) {
            return { ...attrs, color: CALLEE_COLOR, size: 1.1, zIndex: 3 };
          }
          if (target === sel) {
            return { ...attrs, color: CALLER_COLOR, size: 1.1, zIndex: 3 };
          }
          // Non-selection edge: leave it in its default styling.
          return attrs;
        },
      });

      sigma.on("clickNode", ({ node }) => onSelectRef.current(node));
      // clickStage (background click) intentionally not wired: selection
      // persists until the user picks a new SP or presses Reset View.

      sigma.getCamera().setState({
        x: 0.5,
        y: 0.5,
        ratio: INITIAL_CAMERA_RATIO,
      });

      sigmaRef.current = sigma;
      sigmaReadyRef.current = true;
      setLayoutDone(true);

      // If a selection existed before Sigma finished initializing, pan to it.
      const initialSelected = selectedRef.current;
      if (initialSelected !== null) {
        animateToNode(sigma, graph, initialSelected);
      }
    });

    return () => {
      disposed = true;
      sigmaReadyRef.current = false;
      handle.stop();
      sigma?.kill();
      sigmaRef.current = null;
    };
  }, [graph]);

  // Pan to the selected node whenever the selection changes (and Sigma is up).
  useEffect(() => {
    const sigma = sigmaRef.current;
    if (!sigma || !sigmaReadyRef.current) return;
    if (selected === null) return;
    animateToNode(sigma, graph, selected);
  }, [selected, graph]);

  // Reset the camera to the initial pose when the user presses Reset View.
  useEffect(() => {
    if (resetSignal === 0) return;
    const sigma = sigmaRef.current;
    if (!sigma || !sigmaReadyRef.current) return;
    sigma.getCamera().animate(
      { x: 0.5, y: 0.5, ratio: INITIAL_CAMERA_RATIO },
      { duration: CAMERA_ANIMATION_MS },
    );
  }, [resetSignal]);

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="absolute inset-0" />
      {!layoutDone ? (
        <div className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center bg-neutral-950/85">
          <div className="flex items-center gap-3 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-sm text-neutral-200 shadow-lg">
            <Loader2 className="h-4 w-4 animate-spin text-emerald-400" />
            <span>Computing graph layout…</span>
          </div>
        </div>
      ) : null}
    </div>
  );
};
