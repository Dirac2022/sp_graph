/**
 * `useMagicFilter` — manages the "SPs Big Magic" filter state.
 *
 * Exposes:
 * - `isActive`: whether the Magic filter is currently on.
 * - `mode`: `'highlight'` (fade non-magic) | `'filter'` (hide non-magic).
 * - `magicSpIds`: the full set of SP ids from the CSV (555 items).
 * - `selectedProgram`: the currently-chosen program, or `null`.
 * - `selectedProgramSpIds`: SP ids for the chosen program, or empty set.
 */

import { useCallback, useMemo, useState } from "react";

import type { ProgramData, ProgramEntry } from "../graph/types";

export type MagicFilterMode = "highlight" | "filter";

export interface MagicFilterState {
  isActive: boolean;
  mode: MagicFilterMode;
  /** Union of all SP ids across all programs in the CSV. */
  magicSpIds: ReadonlySet<string>;
  selectedProgram: ProgramEntry | null;
  /** SP ids belonging to the currently-selected program. */
  selectedProgramSpIds: ReadonlySet<string>;
  toggleActive(): void;
  setMode(m: MagicFilterMode): void;
  /** Select a program. Also activates the filter if not already active. */
  setSelectedProgram(p: ProgramEntry | null): void;
  /** Clear everything (program + filter). Called by Reset View. */
  reset(): void;
}

const EMPTY_SET: ReadonlySet<string> = new Set<string>();

/** Build and manage the Magic filter state from a loaded `ProgramData`. */
export const useMagicFilter = (
  programData: ProgramData | undefined,
): MagicFilterState => {
  const [isActive, setIsActive] = useState(false);
  const [mode, setModeState] = useState<MagicFilterMode>("highlight");
  const [selectedProgram, setSelectedProgramState] = useState<ProgramEntry | null>(null);

  const magicSpIds = useMemo<ReadonlySet<string>>(() => {
    if (!programData) return EMPTY_SET;
    const ids = new Set<string>();
    for (const prog of programData.programs) {
      for (const id of prog.spIds) ids.add(id);
    }
    return ids;
  }, [programData]);

  const selectedProgramSpIds = useMemo<ReadonlySet<string>>(() => {
    if (!selectedProgram) return EMPTY_SET;
    return new Set<string>(selectedProgram.spIds);
  }, [selectedProgram]);

  const toggleActive = useCallback(() => setIsActive((v) => !v), []);

  const setMode = useCallback((m: MagicFilterMode) => setModeState(m), []);

  const setSelectedProgram = useCallback((p: ProgramEntry | null) => {
    setSelectedProgramState(p);
    if (p !== null) setIsActive(true);
  }, []);

  const reset = useCallback(() => {
    setIsActive(false);
    setSelectedProgramState(null);
  }, []);

  return {
    isActive,
    mode,
    magicSpIds,
    selectedProgram,
    selectedProgramSpIds,
    toggleActive,
    setMode,
    setSelectedProgram,
    reset,
  };
};
