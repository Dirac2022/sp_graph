/**
 * `useProgramData` — fetches the Magic program→SP mapping once on mount.
 *
 * Mirrors the shape of `useGraphData` so consumers can branch on status.
 */

import { useEffect, useState } from "react";

import { ApiError, fetchPrograms } from "../api/client";
import { error as logError, info as logInfo } from "../logger";
import type { ProgramData } from "../graph/types";

export type ProgramFetchState =
  | { status: "loading" }
  | { status: "ok"; data: ProgramData }
  | { status: "error" };

/** Fetch `GET /api/programs` once on mount and expose status + data. */
export const useProgramData = (): ProgramFetchState => {
  const [state, setState] = useState<ProgramFetchState>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    logInfo("hooks/useProgramData", "fetching /api/programs");

    fetchPrograms()
      .then((data) => {
        if (cancelled) return;
        logInfo("hooks/useProgramData", "programs fetched", {
          programs: data.programs.length,
          sps: Object.keys(data.spToPrograms).length,
        });
        setState({ status: "ok", data });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        const message = err instanceof ApiError ? err.message : String(err);
        logError("hooks/useProgramData", "programs fetch failed", { message });
        setState({ status: "error" });
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return state;
};
