/**
 * Right-hand detail panel. Renders the selected SP's metadata, expandable
 * lists of child and parent SPs, and the grouped list of referenced non-SP
 * objects (tables, views, functions, unresolved references, types).
 */

import { useMemo } from "react";
import {
  Box,
  Eye,
  FunctionSquare,
  HelpCircle,
  Tag,
  Table2,
} from "lucide-react";

import type { LeafObjectType, LeafRef, SpDetail, SpRole } from "../graph/types";

interface DetailPanelProps {
  readonly detail: SpDetail | null;
  readonly onPick: (id: string) => void;
}

const ROLE_LABEL: Record<SpRole, string> = {
  requerido: "required",
  adjunto_hijo: "adjunto_hijo",
  adjunto_padre: "adjunto_padre",
  adjunto_ambos: "adjunto_ambos",
};

const ROLE_BG: Record<SpRole, string> = {
  requerido: "bg-emerald-500/15 text-emerald-300 border-emerald-500/40",
  adjunto_hijo: "bg-slate-500/15 text-slate-200 border-slate-500/40",
  adjunto_padre: "bg-slate-500/15 text-slate-200 border-slate-500/40",
  adjunto_ambos: "bg-slate-500/15 text-slate-200 border-slate-500/40",
};

const LEAF_TYPE_ORDER: ReadonlyArray<LeafObjectType> = [
  "Table",
  "View",
  "Scalar Function",
  "Table Function",
  "Inline Function",
  "OBJECT_OR_COLUMN",
  "TYPE",
];

const LEAF_TYPE_ICON: Record<LeafObjectType, JSX.Element> = {
  Table: <Table2 className="h-3.5 w-3.5" />,
  View: <Eye className="h-3.5 w-3.5" />,
  "Scalar Function": <FunctionSquare className="h-3.5 w-3.5" />,
  "Table Function": <FunctionSquare className="h-3.5 w-3.5" />,
  "Inline Function": <FunctionSquare className="h-3.5 w-3.5" />,
  OBJECT_OR_COLUMN: <HelpCircle className="h-3.5 w-3.5" />,
  TYPE: <Tag className="h-3.5 w-3.5" />,
};

const CountChip = ({ label, value }: { label: string; value: number }): JSX.Element => (
  <span className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-0.5 text-[0.7rem] text-neutral-300">
    <span className="text-neutral-500">{label}</span>
    <span className="font-semibold text-neutral-100">{value}</span>
  </span>
);

const SpNameList = ({
  names,
  emptyMessage,
  onPick,
}: {
  names: ReadonlyArray<string>;
  emptyMessage: string;
  onPick: (id: string) => void;
}): JSX.Element => {
  if (names.length === 0) {
    return <p className="px-1 py-2 text-xs text-neutral-500">{emptyMessage}</p>;
  }
  return (
    <ul className="space-y-0.5">
      {names.map((name) => (
        <li key={name}>
          <button
            type="button"
            onClick={() => onPick(name)}
            className="block w-full truncate rounded px-2 py-1 text-left font-mono text-xs text-neutral-200 hover:bg-neutral-800"
          >
            {name}
          </button>
        </li>
      ))}
    </ul>
  );
};

const LeavesSection = ({
  leavesByType,
}: {
  leavesByType: Readonly<Record<LeafObjectType, ReadonlyArray<LeafRef>>>;
}): JSX.Element => {
  const totalCount = LEAF_TYPE_ORDER.reduce(
    (sum, type) => sum + leavesByType[type].length,
    0,
  );
  if (totalCount === 0) {
    return (
      <p className="px-1 py-2 text-xs text-neutral-500">
        No referenced non-SP objects.
      </p>
    );
  }
  return (
    <div className="space-y-3">
      {LEAF_TYPE_ORDER.map((type) => {
        const items = leavesByType[type];
        if (items.length === 0) return null;
        return (
          <section key={type}>
            <header className="mb-1 flex items-center gap-2 text-[0.7rem] uppercase tracking-wider text-neutral-400">
              {LEAF_TYPE_ICON[type]}
              <span>{type}</span>
              <span className="text-neutral-600">{items.length}</span>
            </header>
            <ul className="space-y-0.5">
              {items.map((leaf) => (
                <li
                  key={`${type}:${leaf.schema}.${leaf.name}`}
                  className="truncate px-2 py-0.5 font-mono text-xs text-neutral-300"
                >
                  {leaf.schema === "dbo" ? leaf.name : `${leaf.schema}.${leaf.name}`}
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
};

/** Right-hand detail panel. Renders nothing when no SP is selected. */
export const DetailPanel = ({ detail, onPick }: DetailPanelProps): JSX.Element => {
  const leafCounts = useMemo(() => {
    if (detail === null) return null;
    let tables = 0;
    let views = 0;
    let funcs = 0;
    for (const type of LEAF_TYPE_ORDER) {
      const n = detail.leavesByType[type].length;
      if (type === "Table") tables += n;
      else if (type === "View") views += n;
      else if (
        type === "Scalar Function" ||
        type === "Table Function" ||
        type === "Inline Function"
      ) {
        funcs += n;
      }
    }
    return { tables, views, funcs };
  }, [detail]);

  if (detail === null) {
    return (
      <div className="flex h-full items-center justify-center px-4 text-center text-xs text-neutral-500">
        Select an SP from the graph or search to view its details.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <header className="border-b border-neutral-800 px-3 py-3">
        <h2 className="break-all font-mono text-sm font-semibold text-neutral-100">
          {detail.id}
        </h2>
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[0.7rem] ${
              ROLE_BG[detail.rol]
            }`}
          >
            {ROLE_LABEL[detail.rol]}
          </span>
          {detail.isStub ? (
            <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-[0.7rem] text-amber-300">
              stub: no metadata
            </span>
          ) : null}
          <CountChip label="lines" value={detail.lines ?? 0} />
          <CountChip label="children" value={detail.children.length} />
          <CountChip label="parents" value={detail.parents.length} />
          {leafCounts ? (
            <>
              <CountChip label="tables" value={leafCounts.tables} />
              <CountChip label="views" value={leafCounts.views} />
              <CountChip label="functions" value={leafCounts.funcs} />
            </>
          ) : null}
        </div>
      </header>

      <div className="flex-1 space-y-3 overflow-y-auto px-2 py-3">
        <details open className="rounded border border-neutral-800">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-200">
            <Box className="-mt-px mr-1 inline h-3.5 w-3.5 align-middle" />
            Children (SPs called by this SP) · {detail.children.length}
          </summary>
          <div className="border-t border-neutral-800 px-2 py-2">
            <SpNameList
              names={detail.children}
              emptyMessage="No child SPs."
              onPick={onPick}
            />
          </div>
        </details>

        <details open className="rounded border border-neutral-800">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-200">
            <Box className="-mt-px mr-1 inline h-3.5 w-3.5 align-middle" />
            Parents (SPs that call this SP) · {detail.parents.length}
          </summary>
          <div className="border-t border-neutral-800 px-2 py-2">
            <SpNameList
              names={detail.parents}
              emptyMessage="No parent SPs."
              onPick={onPick}
            />
          </div>
        </details>

        <details className="rounded border border-neutral-800">
          <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-200">
            Tables and other objects used
          </summary>
          <div className="border-t border-neutral-800 px-2 py-2">
            <LeavesSection leavesByType={detail.leavesByType} />
          </div>
        </details>
      </div>
    </div>
  );
};
