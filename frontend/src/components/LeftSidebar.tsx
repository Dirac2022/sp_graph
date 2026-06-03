/**
 * Left sidebar with two tabs: Search (existing) and Programs (Magic filter).
 */

import { useState } from "react";

import { SearchBar } from "./SearchBar";
import { ProgramsPanel } from "./ProgramsPanel";
import type { MagicFilterState } from "../hooks/useMagicFilter";
import type { ProgramData } from "../graph/types";

type Tab = "search" | "programs";

interface LeftSidebarProps {
  readonly spNames: ReadonlyArray<string>;
  readonly onPickSp: (id: string) => void;
  readonly programData: ProgramData | undefined;
  readonly magic: MagicFilterState;
  /** Increments on Reset View to remount SearchBar and clear its input. */
  readonly resetSignal: number;
}

/** Left aside: tab bar + tab content. */
export const LeftSidebar = ({
  spNames,
  onPickSp,
  programData,
  magic,
  resetSignal,
}: LeftSidebarProps): JSX.Element => {
  const [activeTab, setActiveTab] = useState<Tab>("search");

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-neutral-800 bg-neutral-900">
        {(["search", "programs"] as Tab[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 text-[0.7rem] font-semibold uppercase tracking-wider transition ${
              activeTab === tab
                ? "border-b-2 border-cyan-400 text-cyan-300"
                : "text-neutral-400 hover:text-neutral-200"
            }`}
          >
            {tab === "search" ? "Buscar SP" : "Programas"}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden p-3">
        {activeTab === "search" ? (
          <SearchBar
            key={resetSignal}
            names={spNames}
            onPick={onPickSp}
          />
        ) : programData !== undefined ? (
          <ProgramsPanel programs={programData.programs} magic={magic} />
        ) : (
          <p className="py-4 text-center text-xs text-neutral-500">
            Cargando programas...
          </p>
        )}
      </div>
    </div>
  );
};
