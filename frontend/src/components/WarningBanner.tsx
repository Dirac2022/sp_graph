/**
 * Full-width amber banner that surfaces sanity-check findings (spec FR-024).
 * Dismissible per session; reload re-shows if warnings still present.
 */

import { useState } from "react";
import { AlertTriangle, X } from "lucide-react";

import type { GraphWarning } from "../graph/types";

interface WarningBannerProps {
  readonly warnings: ReadonlyArray<GraphWarning>;
}

/** Renders the non-fatal warnings list above the canvas. */
export const WarningBanner = ({ warnings }: WarningBannerProps): JSX.Element | null => {
  const [dismissed, setDismissed] = useState(false);
  if (dismissed || warnings.length === 0) return null;

  return (
    <div
      role="status"
      className="mt-2 flex items-start gap-3 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0 text-amber-300" />
      <div className="flex-1 space-y-0.5">
        <p className="text-xs font-semibold uppercase tracking-wider text-amber-300">
          Data inconsistencies
        </p>
        <ul className="list-disc space-y-0.5 pl-4 text-xs">
          {warnings.map((w, idx) => (
            <li key={`${w.code}-${idx}`}>
              <span className="font-mono text-amber-300">{w.code}</span>{" "}
              <span className="text-amber-200/90">{w.message}</span>
            </li>
          ))}
        </ul>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="flex h-6 w-6 items-center justify-center rounded text-amber-300 hover:bg-amber-500/10"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};
