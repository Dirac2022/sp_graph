/**
 * Full-width red banner that surfaces a fatal data-file error (spec FR-023).
 * Persistent — there is no dismiss action while the error condition holds.
 */

import { AlertOctagon } from "lucide-react";

import type { ErrorEnvelope } from "../graph/types";

interface ErrorBannerProps {
  readonly status: number;
  readonly envelope: ErrorEnvelope | null;
}

/** Renders the fatal-error UI when `/api/graph` returns a 500. */
export const ErrorBanner = ({ status, envelope }: ErrorBannerProps): JSX.Element => {
  const code = envelope?.error.code ?? "data_file_unreadable";
  const message = envelope?.error.message ?? `Server returned status ${status}`;
  const path = envelope?.error.dataFilePath ?? "(unknown path)";

  return (
    <div
      role="alert"
      className="flex items-start gap-3 border-b border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200"
    >
      <AlertOctagon className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-400" />
      <div className="space-y-0.5">
        <p className="font-semibold text-red-100">
          Could not load graph data ({code})
        </p>
        <p className="text-red-200/90">{message}</p>
        <p className="font-mono text-xs text-red-300/80">{path}</p>
      </div>
    </div>
  );
};
