# Phase 0 Research: Stored-Procedure Dependency Graph Viewer

**Feature**: 001-sp-graph-viewer
**Date**: 2026-05-28

This document records the technology and design decisions made for the SP Graph Viewer,
along with the alternatives that were considered and rejected. The constitution
(`/specs/../.specify/memory/constitution.md` v1.0.0) pins the high-level stack; this
document fills in the specific library and pattern choices it leaves open.

There are no `NEEDS CLARIFICATION` markers from the Technical Context to resolve — the spec
arrived clarification-free and the stack is constitution-pinned. The remaining decisions are
all "best fit within the pinned stack" choices.

---

## Decision 1 — Frontend framework

**Decision**: React 18.

**Rationale**:
- The constitution lists React as a sanctioned mainstream option (Principle II).
- It is the ecosystem with the strongest first-class TypeScript and Sigma.js bindings, both
  of which are central to this feature.
- Mature pnpm support; trivial Vite template.

**Alternatives considered**:
- *Vue 3 / Svelte 5* — also constitution-compliant, but neither offers the same first-party
  Sigma.js / Graphology ergonomics, and the project has no existing Vue/Svelte code to
  reuse. Adopting one of them buys nothing here.

---

## Decision 2 — Build tool / dev server

**Decision**: Vite 5.

**Rationale**:
- The de-facto modern default; first-class TypeScript and React support; native ESM dev
  server with sub-second HMR.
- Trivial dev-time proxy to forward `/api` to the FastAPI process so the frontend sees a
  single origin in development.
- Production build emits static assets that any HTTP server (or FastAPI's `StaticFiles`)
  can serve.

**Alternatives considered**:
- *Next.js* — overkill (SSR/RSC not needed for a single-page tool), would mix server and
  client surface and complicate the simple split.
- *Webpack / CRA* — both effectively deprecated for new work.

---

## Decision 3 — Graph rendering library

**Decision**: Sigma.js 2.x with Graphology as the in-memory model, plus
`graphology-layout-forceatlas2` for layout (workerized).

**Rationale**:
- The dataset is ~3,704 nodes and ~3,000 SP→SP edges. Canvas/SVG renderers (Cytoscape's
  default, vis-network, plain D3-force) start to drop frames in the low-thousands-of-nodes
  range during continuous interaction. Sigma 2 is WebGL-first and stays interactive at this
  scale without exotic tuning.
- Graphology is the canonical in-memory graph library for the Sigma ecosystem; it gives us
  free BFS / neighbor iteration / set algebra needed for "highlight neighbors" (US2/FR-012).
- TypeScript-first APIs, active maintenance, MIT license. Squarely "robust, well-known,
  actively maintained" per Principle II.

**Alternatives considered**:
- *Cytoscape.js + cytoscape-fcose* — also mainstream, but its canvas renderer is the
  performance ceiling at this scale; we'd be fighting `hideEdgesOnViewport`, `wheelSensitivity`,
  and lazy label rendering to hit SC-002's 30 fps target.
- *react-force-graph (Three.js)* — WebGL-fast, but force-directed only and its API leans
  toward animated layouts rather than the stable positions we need for predictable LOD
  labels.
- *D3-force + custom canvas / WebGL* — too much DIY; violates the spirit of Principle II's
  "trusted library" rule.

---

## Decision 4 — Layout strategy

**Decision**: Run **ForceAtlas2** in a Web Worker (the `worker` build of
`graphology-layout-forceatlas2`) for ~150 iterations on first load, then freeze positions.

**Rationale**:
- ForceAtlas2 is the standard for SP-graph-shaped datasets (sparse, scale-free, some hubs);
  it produces visually clean clusters and converges quickly.
- Running in a Web Worker keeps the main thread free so SC-002 (30 fps interactive) is not
  blocked while the layout computes.
- ~150 iterations on 3,704 nodes takes a few hundred milliseconds in a worker on the
  reference hardware, well within SC-001's 5-second budget.
- Once converged, positions are static — predictable for the user, and LOD label thresholds
  work cleanly.

**Alternatives considered**:
- *Server-side precompute and cache by mtime* — would shave hundreds of ms off the client
  load but adds a layout dependency on the backend (Python force-directed libraries are
  weaker), persistence concerns, and version-mismatch risk between client/server graph
  versions. Worker path on the client is simpler and fast enough.
- *Hierarchical layouts (dagre, sugiyama)* — would hang on the documented cycles
  (`PR_ERP_COM_QRY_WS_*`) unless we ran an SCC condensation first. Force-directed sidesteps
  the issue.

---

## Decision 5 — Level-of-detail (labels and edges)

**Decision**: Hide all node labels and all edges at zoom levels below a threshold; reveal
them progressively as the user zooms in. Sigma 2 exposes `labelRenderedSizeThreshold` and
per-render reducer hooks that implement this directly.

**Rationale**:
- Spec FR-008 explicitly requires labels and edges to be invisible at maximum zoom-out and
  to reveal as the user zooms in.
- Rendering 3,704 labels + 3,000 edges at all times tanks frame rate; the threshold also
  prevents label spaghetti and gives the user a real overview.

**Alternatives considered**:
- *Always-on labels with collision-avoidance* — visually unusable at 3,704 nodes, and
  Sigma's renderer doesn't support label collision out of the box.

---

## Decision 6 — Search implementation

**Decision**: Build an in-memory list of `{lowerName, originalName}` pairs at graph load
time. On each keystroke (debounced 100 ms), do a linear pass scoring:
- exact match: 0
- prefix match: 1 + position
- substring match: 10 + position
Sort ascending by score and take the top 10 (matches the spec's user-edited cap in
US2 AS-1 / FR-011).

**Rationale**:
- 3,704 strings × O(n) scan on each keystroke is sub-millisecond in modern JS — far inside
  SC-003's 200 ms budget. No external dependency needed.
- Principle II favors *not* adding a dependency unless it earns its keep; Fuse.js, MiniSearch,
  and lunr would all work but add weight for behavior we can write in ~20 lines.

**Alternatives considered**:
- *Fuse.js* — popular fuzzy search; rejected because exact/prefix/substring is what the
  user asked for, not Levenshtein fuzziness, and bringing it in just for ranking is
  premature.
- *MiniSearch / lunr* — index-based, overkill for the data size.

---

## Decision 7 — Backend framework & data path

**Decision**: FastAPI 0.115+ with Uvicorn. A single `GraphLoader` class owns:
1. The configured path to `data/mapeos_sp_grafo.json` (default: project-root-relative).
2. An mtime-keyed in-memory cache of the parsed payload + computed warnings.
3. A re-read-on-stale method called from every request.

**Rationale**:
- FastAPI is constitution-pinned.
- mtime caching satisfies both ends of FR-022: a page reload re-asks the API and gets fresh
  data after any edit, but identical reloads within the same mtime are served in <50 ms (no
  re-parse).
- Putting the loader in one class concentrates the parse / validate / cache logic in a
  single testable surface.

**Alternatives considered**:
- *Watching the file with `watchfiles` and pushing via SSE* — explicitly out of scope per
  spec (the user said reload is the trigger). Adds complexity for no requested benefit.
- *Serving the JSON statically from Vite without a backend* — would bundle a 5.94 MB asset
  or require a Vite plugin to serve it; muddies edit-then-reload semantics across dev /
  build modes; cannot enforce sanity-check warnings server-side (FR-024). Rejected.

---

## Decision 8 — Sanity check enforcement (FR-024)

**Decision**: The backend computes the three sanity checks from
`data/mapeos_sp_grafo.info.md` on every cache refresh:

1. `summary.total_entries === len(mappings)`
2. Sum of the four `total_*` role counters equals `total_entries`.
3. Every name in `summary.faltantes_en_mapeos_sp` exists in `mappings` with
   `rol == "requerido"` and `source_sql_server.lines is None`.

Failures are emitted as structured warnings on the response (`warnings: [{code, message}]`)
rather than as HTTP errors — the spec says best-effort render is required.

**Rationale**:
- Server-side enforcement means the rule is in one place and the frontend just renders the
  warning array.
- Pydantic v2 makes the response shape trivially typed.

**Alternatives considered**:
- *Client-side validation* — duplicates effort, splits the canonical rule across two
  languages, and is harder to log to the centralized file sink.

---

## Decision 9 — Centralized logger (constitution Principle IV)

**Decision**:

- **Python side** (`backend/src/sp_graph_api/logger.py`): wrap stdlib `logging` with two
  handlers: a `StreamHandler` whose formatter wraps the level token in ANSI color codes
  when `sys.stdout.isatty()` and `NO_COLOR` is unset, and a `RotatingFileHandler` writing
  to `logs/app.log` (10 MB × 5 backups, plain text, no ANSI). The format string is
  `[%(levelname)s] %(asctime)sZ %(name)s :: %(message)s` with `asctime` set to UTC. Public
  helpers: `get_logger(name)` returning a stdlib logger pre-attached to both handlers.

- **TypeScript side** (`frontend/src/logger/index.ts`): a module exposing `debug/info/warn/
  error/critical` functions. Each formats `[LEVEL] <iso> <module> :: <msg>` and:
  - Writes to `console.log` (or `.warn`/`.error` per level) with CSS color via the `%c`
    convention (the browser's analog of ANSI).
  - For `WARN`, `ERROR`, `CRITICAL` only: forwards a structured record to
    `POST /api/log`, where the backend logger persists it to `logs/app.log` so the
    file sink stays the single canonical log file. The forwarder is fire-and-forget and
    never blocks the UI.

**Rationale**:
- Principle IV requires terminal + file dual sink. The browser cannot write a file directly;
  forwarding upgraded records to the backend's file sink is the cleanest faithful reading.
- Limiting forwarding to WARN+ keeps the file from being flooded by debug noise from every
  browser tab and bounds the POST traffic to actually-actionable events.

**Alternatives considered**:
- *localStorage / IndexedDB ring buffer on the FE* — meets the letter of "writes to a file"
  only loosely; users would have to export manually. Bad for ops.
- *Browser-only logging, no remote forward* — would mean FE errors never reach `logs/app.log`,
  failing Principle IV.

---

## Decision 10 — Testing footprint (Principle V)

**Decision**: Three concrete test artifacts, no coverage target:

1. `backend/tests/test_graph_loader.py` — feeds the loader a tiny fixture that violates
   each sanity rule one at a time; asserts the warnings array contains the expected codes.
2. `backend/tests/test_app.py` — asserts `GET /api/graph` returns 200 + a well-shaped payload
   on a good fixture, and returns 500 with a structured error body on a malformed fixture.
3. `frontend/src/graph/buildGraph.test.ts` (Vitest) — calls `buildGraph` on a fixture and
   asserts node count, edge dedup (the symmetric callers / dependencies case), and that a
   self-loop is preserved as a single edge.

**Rationale**:
- Each test guards a contract or invariant whose silent failure would mislead the user (per
  Principle V's two acceptable test cases). UI behavior is verified manually per
  quickstart.md.

**Alternatives considered**:
- *Playwright happy-path E2E* — nice-to-have but not required by Principle V; deferred
  unless time permits during implementation.

---

## Decision 11 — Visual palette (Principle III, spec FR-004)

**Decision**:

- Background: Tailwind `neutral-950` (near-black, lets the WebGL canvas pop).
- `rol == "requerido"`: Tailwind `emerald-500` solid fill (the vivid green the spec
  references).
- `rol == "adjunto_hijo"`: Tailwind `slate-500` with a small chevron-down marker.
- `rol == "adjunto_padre"`: Tailwind `slate-500` with a small chevron-up marker.
- `rol == "adjunto_ambos"`: Tailwind `slate-500` with a diamond marker.
- Stub SP: gray (`slate-700`) ring + warning glyph overlay (Lucide `alert-triangle`).
- Ghost reference: dashed outline, `zinc-600`, no fill.
- Selection ring: `sky-400` 2-px ring.
- Highlighted neighbor: full opacity; everything else at 30 % opacity.
- Text labels (when visible at zoom): `neutral-200` over the canvas.
- UI chrome (search bar, side panel): `neutral-900` panels, `neutral-100` text,
  `neutral-700` borders. Generous whitespace per Principle III.

**Rationale**:
- Single Tailwind palette keeps tokens in one config file.
- Emerald (in-scope) vs. slate (out-of-scope) satisfies "vivid vs muted" cleanly while
  staying minimalist.
- All markers / glyphs come from Lucide so no per-component icons grow.

**Alternatives considered**:
- *Three vivid colors for the three muted roles* — would compete with the in-scope green
  and dilute the "in scope vs out of scope" signal the user asked for.

---

## Open issues / deferred items

None. All Technical Context fields are filled; no clarifications outstanding.
