/**
 * Bottom-left legend that explains the role-based palette, the ghost / stub
 * conventions, and the selection accent colors (callees in orange, callers in
 * violet). Documented in `research.md` Decision 11.
 */

import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpLeft,
  ChevronDown,
  ChevronUp,
  Circle,
  Diamond,
} from "lucide-react";
import type { JSX } from "react";

interface LegendRow {
  readonly label: string;
  readonly swatch: JSX.Element;
}

const ROLE_ROWS: ReadonlyArray<LegendRow> = [
  {
    label: "requerido (in scope)",
    swatch: <Circle className="h-3.5 w-3.5 fill-emerald-500 text-emerald-500" />,
  },
  {
    label: "adjunto_hijo (called by required)",
    swatch: <ChevronDown className="h-3.5 w-3.5 text-slate-400" />,
  },
  {
    label: "adjunto_padre (calls required)",
    swatch: <ChevronUp className="h-3.5 w-3.5 text-slate-400" />,
  },
  {
    label: "adjunto_ambos (both)",
    swatch: <Diamond className="h-3.5 w-3.5 text-slate-400" />,
  },
  {
    label: "stub (in scope, no metadata)",
    swatch: <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />,
  },
  {
    label: "ghost (outside subgraph)",
    swatch: (
      <Circle className="h-3.5 w-3.5 text-zinc-500 [stroke-dasharray:2_2]" />
    ),
  },
];

const SELECTION_ROWS: ReadonlyArray<LegendRow> = [
  {
    label: "callee (selected SP calls this)",
    swatch: <ArrowDownRight className="h-3.5 w-3.5 text-orange-400" />,
  },
  {
    label: "caller (calls the selected SP)",
    swatch: <ArrowUpLeft className="h-3.5 w-3.5 text-violet-400" />,
  },
];

/** Fixed-position legend chip; not interactive. */
export const Legend = (): JSX.Element => (
  <div className="pointer-events-none absolute bottom-3 left-3 rounded-md border border-neutral-800 bg-neutral-900/85 px-3 py-2 text-xs text-neutral-300 shadow-lg backdrop-blur">
    <h2 className="mb-2 text-[0.7rem] uppercase tracking-wider text-neutral-400">
      Legend
    </h2>
    <ul className="space-y-1">
      {ROLE_ROWS.map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          {row.swatch}
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
    <h3 className="mb-1 mt-3 text-[0.7rem] uppercase tracking-wider text-neutral-400">
      When an SP is selected
    </h3>
    <ul className="space-y-1">
      {SELECTION_ROWS.map((row) => (
        <li key={row.label} className="flex items-center gap-2">
          {row.swatch}
          <span>{row.label}</span>
        </li>
      ))}
    </ul>
  </div>
);
