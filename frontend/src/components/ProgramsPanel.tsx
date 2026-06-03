/**
 * Programs panel for the left sidebar.
 *
 * Renders a searchable list of Magic programs. Selecting a program highlights
 * its SPs on the canvas (cyan). The panel also hosts the "SPs Big Magic"
 * toggle and the highlight/filter mode switch.
 */

import { useMemo, useState } from "react";
import { Search, X, Zap } from "lucide-react";

import type { MagicFilterMode, MagicFilterState } from "../hooks/useMagicFilter";
import type { ProgramEntry } from "../graph/types";

interface ProgramsPanelProps {
  readonly programs: ReadonlyArray<ProgramEntry>;
  readonly magic: MagicFilterState;
}

/** Programs panel: list + Big Magic toggle. */
export const ProgramsPanel = ({ programs, magic }: ProgramsPanelProps): JSX.Element => {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return programs;
    return programs.filter(
      (p) => p.name.toLowerCase().includes(q) || String(p.num).includes(q),
    );
  }, [query, programs]);

  return (
    <div className="flex h-full flex-col gap-3">
      {/* Big Magic toggle */}
      <div className="rounded-md border border-neutral-700 bg-neutral-950 p-2.5">
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Zap className="h-3.5 w-3.5 text-cyan-400" />
            <span className="text-xs font-semibold text-neutral-100">SPs Big Magic</span>
          </div>
          <button
            type="button"
            onClick={magic.toggleActive}
            className={`relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none ${
              magic.isActive ? "bg-cyan-500" : "bg-neutral-700"
            }`}
            aria-pressed={magic.isActive}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${
                magic.isActive ? "translate-x-4" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        {/* Mode toggle — only meaningful when active */}
        <div className="flex gap-1">
          {(["highlight", "filter"] as MagicFilterMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => magic.setMode(m)}
              className={`flex-1 rounded px-2 py-1 text-[0.65rem] font-medium transition ${
                magic.mode === m
                  ? "bg-cyan-500/20 text-cyan-300 border border-cyan-500/40"
                  : "border border-neutral-700 text-neutral-400 hover:border-neutral-500 hover:text-neutral-300"
              }`}
            >
              {m === "highlight" ? "Resaltar" : "Solo Magic"}
            </button>
          ))}
        </div>

        {magic.isActive && (
          <p className="mt-1.5 text-[0.65rem] text-neutral-500">
            {magic.mode === "highlight"
              ? "SPs no-Magic aparecen al 15 % de opacidad."
              : "Solo los 555 SPs Magic son visibles."}
          </p>
        )}
      </div>

      {/* Search */}
      <div>
        <label
          htmlFor="prog-search"
          className="mb-1 block text-[0.7rem] uppercase tracking-wider text-neutral-400"
        >
          Buscar programa
        </label>
        <div className="flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-950 px-2 focus-within:border-sky-500">
          <Search className="h-4 w-4 flex-shrink-0 text-neutral-500" />
          <input
            id="prog-search"
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Nombre o número"
            className="w-full bg-transparent py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus:outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          {query.length > 0 && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex-shrink-0 text-neutral-500 hover:text-neutral-300"
              aria-label="Limpiar búsqueda"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Program list */}
      <div className="flex-1 overflow-y-auto">
        {magic.selectedProgram !== null && (
          <div className="mb-2 flex items-center justify-between rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2 py-1.5">
            <span className="truncate text-[0.7rem] text-cyan-300">
              {magic.selectedProgram.num} · {magic.selectedProgram.name}
            </span>
            <button
              type="button"
              onClick={() => magic.setSelectedProgram(null)}
              className="ml-2 flex-shrink-0 text-cyan-500 hover:text-cyan-300"
              aria-label="Deseleccionar programa"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        {filtered.length === 0 ? (
          <p className="px-1 py-2 text-xs text-neutral-500">
            No hay programas que coincidan.
          </p>
        ) : (
          <ul className="space-y-0.5">
            {filtered.map((prog) => {
              const isSelected = magic.selectedProgram?.num === prog.num;
              return (
                <li key={prog.num}>
                  <button
                    type="button"
                    onClick={() =>
                      magic.setSelectedProgram(isSelected ? null : prog)
                    }
                    className={`flex w-full items-center gap-2 rounded px-2 py-1.5 text-left transition ${
                      isSelected
                        ? "border border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                        : "text-neutral-200 hover:bg-neutral-800"
                    }`}
                  >
                    <span className="w-10 flex-shrink-0 text-right font-mono text-[0.65rem] text-neutral-500">
                      {prog.num}
                    </span>
                    <span className="flex-1 truncate text-xs">{prog.name}</span>
                    <span className="flex-shrink-0 rounded bg-neutral-800 px-1 py-0.5 text-[0.6rem] text-neutral-400">
                      {prog.spIds.length}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};
