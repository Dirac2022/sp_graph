# Phase 1 Data Model: Stored-Procedure Dependency Graph Viewer

**Feature**: 001-sp-graph-viewer
**Date**: 2026-05-28

This document defines the in-memory and over-the-wire shapes used by the feature. The source
of truth is the JSON file at `data/mapeos_sp_grafo.json`; both backend and frontend types
ultimately mirror the same data, with the backend acting as the validating adapter.

Origin reminder (see `data/mapeos_sp_grafo.info.md` for canonical detail): the source file
provides `summary`, `description`, and a `mappings` object keyed by SP name; each entry
carries `rol`, `source_sql_server.dependencies`, and `callers`. SP→SP edges come from
`dependencies` filtered to `objectType == "Stored Procedure"`, deduplicated against the
symmetric `callers` array.

---

## Entities

### SpRole (enum)

```ts
type SpRole = "requerido" | "adjunto_hijo" | "adjunto_padre" | "adjunto_ambos";
```

- `requerido` — SP in the migration scope (the in-scope set). 3,001 entries in the current
  data file.
- `adjunto_hijo` — Out-of-scope SP called by at least one `requerido`.
- `adjunto_padre` — Out-of-scope SP that calls at least one `requerido`.
- `adjunto_ambos` — Out-of-scope SP that is both a hijo and a padre.

Validation: backend rejects any other value with a 500-level `data_invalid_role` warning;
frontend treats unknown values as `adjunto_hijo` to avoid crashing (spec FR-028).

### LeafObjectType (enum)

```ts
type LeafObjectType =
  | "Table"
  | "View"
  | "Scalar Function"
  | "Table Function"
  | "Inline Function"
  | "OBJECT_OR_COLUMN"
  | "TYPE";
```

Non-SP objects an SP can reference. Surfaced only in the detail panel (not as graph nodes
per spec Assumptions).

### SpNode

The first-class graph node. One per SP in `mappings`, including stubs.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | SP name. Case-sensitive. Stable primary key. |
| `rol` | `SpRole` | From `mappings[id].rol`. |
| `lines` | `number \| null` | `null` for stubs. |
| `isStub` | `boolean` | `lines === null && dependencies.length === 0 && id in summary.faltantes_en_mapeos_sp`. |
| `outDegreeSp` | `number` | Count of `dependencies` items with `objectType === "Stored Procedure"`. |
| `inDegreeSp` | `number` | `callers.length`. |
| `module` | `string \| undefined` | Optional prefix-derived module tag (e.g., `PR_ERP`, `USP`, `ALERTA`). Computed from the name; populated when a known prefix matches. |

### SpEdge

Directed "A calls B" edge.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | `${source}->${target}`. Unique. |
| `source` | `string` | SP id of the caller. |
| `target` | `string` | SP id of the callee. |

No additional metadata at this stage. Self-loops are allowed but rendered as a single edge.
Duplicate edges from the symmetric `dependencies` / `callers` encodings are deduplicated by
`id`.

### GhostRef

A name that appears in some SP's `dependencies` or `callers` but has no entry in
`mappings`. Rendered as a visually distinct node (dashed outline, no fill) so users can see
the 1-hop boundary.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | The referenced name. |
| `isGhost` | `true` | Type discriminator. |

Implementation note: the frontend creates Graphology nodes for ghosts on the fly while
building edges; the backend exposes the set in the API response so the frontend doesn't
have to recompute it.

### LeafRef

A non-SP object referenced by some SP. Many-to-one with the owning SP.

| Field | Type | Notes |
|---|---|---|
| `name` | `string` | Object name. |
| `schema` | `string` | Always `"dbo"` in the current data; preserved verbatim. |
| `objectType` | `LeafObjectType` | Discriminator. |

### SpDetail (computed per selection)

Returned to the detail panel for a single SP. Derived purely from `GraphData`; not a
separate API entity.

| Field | Type | Notes |
|---|---|---|
| `id` | `string` | Selected SP id. |
| `rol` | `SpRole` | |
| `lines` | `number \| null` | |
| `isStub` | `boolean` | |
| `children` | `string[]` | SP ids called by this SP, alphabetically sorted. |
| `parents` | `string[]` | SP ids that call this SP, alphabetically sorted. |
| `leavesByType` | `Record<LeafObjectType, LeafRef[]>` | Group buckets, alphabetically sorted within each bucket. Empty buckets are present with empty arrays so the UI's empty-state branch is uniform. |

### Warning

Structured sanity-check finding emitted by the backend.

| Field | Type | Notes |
|---|---|---|
| `code` | `string` | Machine-readable identifier (e.g., `entries_mismatch`, `role_count_mismatch`, `stub_shape_mismatch`). |
| `message` | `string` | Human-readable description suitable for the WarningBanner. |

### GraphData (API response payload)

The full payload of `GET /api/graph`.

| Field | Type | Notes |
|---|---|---|
| `meta.dataFileMtimeIso` | `string` | UTC ISO-8601 mtime of the JSON file at parse time. |
| `meta.dataFilePath` | `string` | Project-relative path of the data file. |
| `meta.totalEntries` | `number` | From `summary.total_entries`. |
| `meta.totalRequerido` | `number` | From `summary.total_requerido`. |
| `nodes` | `SpNode[]` | Every SP in `mappings`, including stubs. |
| `edges` | `SpEdge[]` | Deduplicated SP→SP "calls" edges. |
| `ghosts` | `string[]` | Names referenced but missing from `mappings`. |
| `leavesBySp` | `Record<string, LeafRef[]>` | Map from SP id to its non-SP referenced objects, in input order. |
| `warnings` | `Warning[]` | Empty array if all sanity checks pass. |

### LogPayload (frontend → backend)

POST body for `/api/log` (FE-side WARN/ERROR/CRITICAL forwarding).

| Field | Type | Notes |
|---|---|---|
| `level` | `"WARNING" \| "ERROR" \| "CRITICAL"` | Only these are forwarded. |
| `module` | `string` | Originating TS module name (e.g., `graph/buildGraph`). |
| `message` | `string` | Free-form. |
| `timestamp` | `string` | Client UTC ISO-8601. Server preserves it but stamps its own receipt time too. |
| `context` | `Record<string, unknown>?` | Optional structured fields. |

---

## Relationships

```
SpNode 1 --< SpEdge >-- 1 SpNode          # calls / is called by
SpNode 1 --< LeafRef                       # references (via leavesBySp[spId])
SpEdge target  -->  may be a GhostRef      # 1-hop boundary
```

All non-discoverable relationships (callers reachable via dependencies, etc.) are computable
in O(N) at parse time and cached in `GraphData`.

---

## Validation rules (enforced server-side by `graph_loader.py`)

| Rule | On failure |
|---|---|
| File at configured path exists and is readable. | HTTP 500 `data_file_unreadable` error. |
| File parses as JSON. | HTTP 500 `data_file_unparseable` error (with truncated reason; no stack trace). |
| Top-level `summary` and `mappings` keys present. | HTTP 500 `data_file_shape_invalid` error. |
| `summary.total_entries === len(mappings)`. | Warning `entries_mismatch`. |
| Sum of the four `total_*` role counters equals `total_entries`. | Warning `role_count_mismatch`. |
| Every name in `summary.faltantes_en_mapeos_sp` has `rol == "requerido"` and `lines is None`. | Warning `stub_shape_mismatch`. |
| Each entry's `rol` is one of the four known values. | Warning `unknown_role` (entry kept; frontend defaults role on render). |

Frontend never re-runs these checks; it just renders `warnings[]` in the WarningBanner.

---

## State transitions

There are no persisted state machines in this feature — the application is stateless on the
server (cache is just a memoization of the disk contents) and uses transient UI state on the
client. For completeness, the client-side selection state is:

```
idle ── searchType ──> searching
idle ── nodeClick ──> selected
searching ── pickMatch ──> selected
selected ── clear ──> idle
selected ── pickMatch | nodeClick ──> selected (different id)
```

`idle` shows the full graph at default styling; `selected` applies the selection + highlight
mode and opens the detail panel. `searching` overlays the suggestion list but does not
modify the canvas.

---

## Frontend mirror

`frontend/src/graph/types.ts` defines TypeScript interfaces matching every entity above with
identical field names (camelCase preserved across the boundary; only `rol` keeps the Spanish
name because it is also the data file's literal key). The frontend never invents a node or
edge that isn't in the API response — even ghost rendering uses the `ghosts` array.
