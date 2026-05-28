---

description: "Task list for feature 001-sp-graph-viewer"
---

# Tasks: Stored-Procedure Dependency Graph Viewer

**Input**: Design documents from `/specs/001-sp-graph-viewer/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md,
contracts/api.md + contracts/openapi.yaml, quickstart.md

**Tests**: Constitution Principle V keeps the test footprint minimal. The three tests below
(T015, T016, T020) are included because they each protect a contract or invariant whose silent
failure would mislead users — they are not a coverage target.

**Organization**: Tasks are grouped by user story so each story can be implemented and validated
independently. US1 is the MVP.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks).
- **[Story]**: User-story label (US1/US2/US3/US4). Setup, Foundational, and Polish phases have
  no story label.
- File paths in descriptions are absolute or repo-relative; the implementer should use the
  repo-relative form they prefer.

## Path Conventions

- Repo root: `/home/dirac/sp_graph/`
- Backend source: `backend/src/sp_graph_api/`; backend tests: `backend/tests/`
- Frontend source: `frontend/src/`; frontend tests live next to the module they cover
- Logs at runtime: `logs/app.log` (rotating, written by the backend logger)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the repo skeleton and configure the canonical stack (TypeScript + pnpm +
Tailwind on the frontend, FastAPI + Pydantic on the backend) per constitution Principle II.

- [X] T001 Create top-level project skeleton: `backend/`, `backend/src/sp_graph_api/`,
      `backend/tests/`, `frontend/`, `frontend/src/`, and `logs/` (with `logs/.gitkeep`) at the
      repo root.
- [X] T002 [P] Configure `.gitignore` at the repo root to cover Python (`__pycache__/`,
      `*.pyc`, `.venv/`, `venv/`, `dist/`, `*.egg-info/`), Node
      (`node_modules/`, `dist/`, `build/`, `*.log`, `.env*`), and universal patterns
      (`.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp`, `.vscode/`, `.idea/`); ensure
      `logs/*.log*` is ignored but `logs/.gitkeep` is tracked.
- [X] T003 Initialize the backend Python project at `backend/pyproject.toml` with deps
      `fastapi`, `uvicorn[standard]`, `pydantic>=2`, `pydantic-settings`, `pytest`, `ruff`;
      declare the package `sp_graph_api` under `backend/src/`; add an `__init__.py` so the
      package is importable.
- [X] T004 Initialize the frontend pnpm project at `frontend/package.json` with deps
      `react`, `react-dom`, `sigma`, `graphology`, `graphology-layout-forceatlas2`,
      `lucide-react`; devDeps `typescript@^5`, `vite`, `@vitejs/plugin-react`, `tailwindcss`,
      `postcss`, `autoprefixer`, `vitest`, `@types/react`, `@types/react-dom`; commit
      `frontend/pnpm-lock.yaml`.
- [X] T005 [P] Configure ruff + pytest in `backend/pyproject.toml` (ruff: `line-length = 100`,
      enable `E`, `F`, `I`, `B`, `UP`; pytest: `testpaths = ["tests"]`).
- [X] T006 [P] Configure TypeScript strict mode in `frontend/tsconfig.json`
      (`"strict": true`, `"noUncheckedIndexedAccess": true`,
      `"exactOptionalPropertyTypes": true`, `"moduleResolution": "Bundler"`,
      `"target": "ES2022"`, `"jsx": "react-jsx"`, `"types": ["vite/client"]`).
- [X] T007 [P] Configure Vite at `frontend/vite.config.ts` (React plugin; dev `server.proxy`
      forwards `/api` to `http://127.0.0.1:8000`; `server.port = 5173`); create
      `frontend/index.html` with the `#root` mount and a `<title>SP Graph Viewer</title>`.
- [X] T008 [P] Configure Tailwind: `frontend/tailwind.config.ts` (content globs cover
      `index.html` and `src/**/*.{ts,tsx}`; extend palette with the role tokens documented in
      research.md Decision 11), `frontend/postcss.config.cjs`, and
      `frontend/src/styles/index.css` (`@tailwind base; @tailwind components; @tailwind
      utilities;` plus a `body { @apply bg-neutral-950 text-neutral-100; }` reset).

**Checkpoint**: Skeleton, lockfiles, and tooling configs land. Backend and frontend can be
installed but do nothing yet.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Wire the centralized logger (constitution Principle IV mandate), the config
loader, the data-file reader, the `/api/*` endpoints, and the shared frontend types and
graph-building primitives. **No user story can begin until this phase completes** — every
story below renders data the foundational layer produces.

**CRITICAL**: T009, T010, T011 satisfy the constitution's "Foundational tasks" rule —
loggers and config MUST exist before any feature code.

- [X] T009 Implement the backend centralized logger in
      `backend/src/sp_graph_api/logger.py`: stdlib `logging` with a `StreamHandler` whose
      formatter wraps the level token in ANSI color codes (cyan INFO, yellow WARNING, red
      ERROR, bright-red CRITICAL, gray DEBUG) when `sys.stdout.isatty()` and `NO_COLOR` is
      unset, plus a `RotatingFileHandler` writing plain text to `logs/app.log`
      (`maxBytes=10_000_000`, `backupCount=5`); format
      `[%(levelname)s] %(asctime)sZ %(name)s :: %(message)s` with UTC `asctime`; export
      `get_logger(name)`.
- [X] T010 Implement the backend config module in `backend/src/sp_graph_api/config.py`:
      Pydantic `Settings(BaseSettings)` with fields `data_path: Path`, `host: str`, `port:
      int`, `log_level: str`, `log_file: Path` reading env vars `SP_GRAPH_DATA_PATH`,
      `SP_GRAPH_HOST`, `SP_GRAPH_PORT`, `SP_GRAPH_LOG_LEVEL`, `SP_GRAPH_LOG_FILE`; defaults
      resolve to repo-root-relative `data/mapeos_sp_grafo.json`, `127.0.0.1`, `8000`,
      `INFO`, `logs/app.log`.
- [X] T011 [P] Implement the frontend centralized logger in
      `frontend/src/logger/index.ts`: exports `debug/info/warn/error/critical(module: string,
      message: string, context?: Record<string, unknown>)`; writes `%c[LEVEL] <iso> <module>
      :: <msg>` to the matching `console.*`; for `WARNING`, `ERROR`, `CRITICAL` only,
      fire-and-forget `POST /api/log` with `{level, module, message, timestamp, context}`;
      forwarding failure is swallowed (must not crash the UI).
- [X] T012 Implement backend Pydantic response schemas in
      `backend/src/sp_graph_api/schemas.py` mirroring data-model.md: `SpRole`,
      `LeafObjectType`, `SpNode`, `SpEdge`, `LeafRef`, `Warning`, `GraphMeta`, `GraphData`,
      `LogPayload`, `ErrorEnvelope`. All field names use camelCase via Pydantic's
      `model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)`.
- [X] T013 Implement the backend graph loader in
      `backend/src/sp_graph_api/graph_loader.py`: `class GraphLoader` holds the configured
      data path; method `load() -> GraphData` reads file mtime, returns a cached payload if
      mtime is unchanged, else re-reads JSON, builds nodes (one per `mappings` entry,
      computing `outDegreeSp`, `inDegreeSp`, `isStub`, optional `module` from name prefix),
      builds the deduplicated edge set (Set keyed by `${source}->${target}`; combines
      `dependencies` with `objectType=="Stored Procedure"` and symmetric `callers`),
      collects ghost ids, builds `leavesBySp` (non-SP referenced objects in input order),
      runs the sanity checks defined in research.md Decision 8, and produces a
      `warnings: list[Warning]`. Raise `GraphLoadError(code, message)` on unreadable /
      unparseable / shape-invalid file.
- [X] T014 Implement the FastAPI application in `backend/src/sp_graph_api/app.py` plus
      entrypoint `backend/src/sp_graph_api/__main__.py`: instantiate `Settings` and
      `GraphLoader(settings.data_path)` at startup; configure root logger via T009 helper;
      mount `GET /api/health` (returns `{"status":"ok"}` without touching the data file),
      `GET /api/graph` (calls `GraphLoader.load()`, returns `GraphData`; on `GraphLoadError`
      return HTTP 500 with `ErrorEnvelope`), and `POST /api/log` (validates `LogPayload`,
      calls `get_logger("frontend").log(level_int, "%s :: %s", module, message, extra=...)`,
      returns 204). `__main__.py` runs `uvicorn.run` with `settings.host`, `settings.port`,
      and `log_config=None` so our logger owns formatting.
- [X] T015 [P] [TEST] Backend sanity-check coverage in
      `backend/tests/test_graph_loader.py`: ship three small fixture JSON files (one with
      `total_entries` off by one, one with role counters that don't sum to `total_entries`,
      one with a `faltantes_en_mapeos_sp` entry whose mapping has the wrong shape); each
      test asserts the expected warning `code` appears and that `load()` still returns a
      payload (best-effort render). Add one test that asserts mtime-cache hit reuses the
      parsed payload (no second read).
- [X] T016 [P] [TEST] Backend `/api/graph` endpoint coverage in `backend/tests/test_app.py`:
      using FastAPI's `TestClient` and a tiny valid fixture, assert 200 + the response
      validates against the `GraphData` schema; using a malformed fixture, assert 500 + an
      `ErrorEnvelope` body whose `code` is one of `data_file_unreadable` /
      `data_file_unparseable` / `data_file_shape_invalid`; assert `GET /api/health` returns
      200 without touching the data file (point `SP_GRAPH_DATA_PATH` at a non-existent file
      and the health probe still passes).
- [X] T017 [P] Implement the frontend API client in `frontend/src/api/client.ts`: typed
      `fetchGraph(): Promise<GraphData>` (parses JSON, throws on non-200 with the
      `ErrorEnvelope` body attached), and `postLog(payload: LogPayload): Promise<void>`
      (fire-and-forget; never throws). Use the native `fetch`; do not pull in axios.
- [X] T018 [P] Define frontend graph types in `frontend/src/graph/types.ts`: mirror every
      entity in data-model.md as a TypeScript `interface` or `type` alias with TSDoc on
      each export.
- [X] T019 Implement `frontend/src/graph/buildGraph.ts`: pure function
      `buildGraph(data: GraphData): Graph` (Graphology) that adds one node per
      `data.nodes[i]` with attributes `{rol, isStub, lines, module}`, one node per `id` in
      `data.ghosts` with attribute `{isGhost: true}`, and one edge per `data.edges[i]`
      using `addEdgeWithKey(edge.id, source, target)`; preserves self-loops as single
      edges; if a ghost id collides with a real node, the real node wins.
- [X] T020 [P] [TEST] Vitest smoke test in `frontend/src/graph/buildGraph.test.ts`: given a
      hand-built `GraphData` fixture with (a) a duplicated edge encoded via both
      `dependencies` and the symmetric `callers` (already deduplicated by the backend, so
      assert single edge), (b) a self-loop, and (c) a ghost reference, assert the resulting
      Graphology graph has the expected node count (real + ghosts), edge count (deduped),
      and that the self-loop edge exists exactly once.
- [X] T021 Implement `frontend/src/hooks/useGraphData.ts`: React hook returning
      `{status: 'loading' | 'ok' | 'error', data?: GraphData, error?: ErrorEnvelope}`;
      calls `fetchGraph()` once on mount; on error calls the FE logger's `error()`.
- [X] T022 Implement the frontend app shell: `frontend/src/main.tsx` (ReactDOM root that
      renders `<App />`), `frontend/src/App.tsx` (uses `useGraphData`; renders a top-level
      `<main>` with Tailwind grid containing slots for `<SearchBar/>` (left), the canvas
      area (center), and `<DetailPanel/>` (right); renders a loading state, otherwise
      renders `<ErrorBanner/>` if `status==='error'`, `<WarningBanner/>` if
      `data.warnings.length > 0`, and the children below them). The Banner and Panel
      components don't exist yet — App.tsx temporarily imports `null`-returning stubs from
      `./components/_stubs.tsx` so this task can compile.

**Checkpoint**: Backend serves real data at `GET /api/graph`; FE app fetches it and parses
it into a Graphology graph; loggers on both sides write to `logs/app.log`. No visible graph
yet — that lands in US1.

---

## Phase 3: User Story 1 — Explore the full stored-procedure graph (Priority: P1) — MVP

**Goal**: With the foundational layer in place, render every SP as a node in a single
zoomable, panable canvas; apply the vivid/muted palette; progressively reveal labels and
edges as the user zooms in; visually distinguish stubs and ghost references.

**Independent Test**: Load the page against the live data file. All ~3,704 nodes appear at
default zoom-out without labels. `requerido` nodes are emerald; the three out-of-scope roles
are muted slate with distinct markers; 26 stub SPs and any ghost references render
distinctly. Pan/zoom feels smooth. No search, no detail panel, no error/warning UI required
for this story to deliver value.

- [X] T023 [P] [US1] Implement `frontend/src/graph/layout.ts`:
      `computeLayout(graph: Graph): Promise<void>` runs ForceAtlas2 via the
      `graphology-layout-forceatlas2/worker` build for ~150 iterations with
      `barnesHutOptimize: true`, `scalingRatio: 10`, `slowDown: 1`, `gravity: 1`; on resolve
      writes `x`/`y` attributes to each node and terminates the worker.
- [X] T024 [P] [US1] Implement `frontend/src/components/Legend.tsx`: a small bottom-left
      Tailwind panel listing role swatches (emerald `requerido`, slate `adjunto_hijo`/
      `adjunto_padre`/`adjunto_ambos` with their markers, gray ringed stub, dashed ghost).
      Use Lucide `circle`, `chevron-up`, `chevron-down`, `diamond`, `alert-triangle` icons —
      no emojis.
- [X] T025 [US1] Implement `frontend/src/components/GraphCanvas.tsx`: full-area Sigma
      renderer over the graph from `useGraphData` + `buildGraph` + `computeLayout`. Apply a
      `nodeReducer` that returns the role-based color from research.md Decision 11 and a
      `labelRenderedSizeThreshold` so labels appear only above a zoom threshold; configure
      the renderer with `enableEdgeEvents: true`, `renderEdgeLabels: false`, arrowheads on,
      and stub-node hover via Sigma's `enterNode`/`leaveNode` events that surface a Tailwind
      tooltip reading "Required SP, no metadata available". Ghost nodes get a dashed-ring
      reducer.
- [X] T026 [US1] Wire the layout pipeline and `<GraphCanvas/>` plus `<Legend/>` into
      `frontend/src/App.tsx`, removing the canvas-area stub from T022. Show a centered
      "Computing layout..." indicator while `computeLayout` is running.
- [X] T027 [US1] Manually validate against quickstart.md US1 (palette correct, ~3,704 nodes
      render, pan/zoom interactive, LOD labels/edges progressive, stub tooltip works, ghosts
      visually distinct). Document any acceptance gaps inline below this task before
      progressing to US2.

**Checkpoint**: MVP shippable. The user can already use this for raw exploration.

---

## Phase 4: User Story 2 — Search and highlight neighborhood (Priority: P2)

**Goal**: Add a persistent search bar that finds an SP by name (case-insensitive, ranked),
and on selection re-centers the canvas and highlights the SP plus its direct neighborhood.
Background nodes fade.

**Independent Test**: Without depending on US3 or US4, type a known SP name; see up to 10
ranked suggestions; pick one; the canvas pans/zooms to it; the selected SP is sky-ringed;
neighbors are full opacity; everything else fades to ~30 %; clicking the canvas background
resets the view.

- [X] T028 [P] [US2] Implement ranked search in `frontend/src/graph/search.ts`:
      `searchSps(query: string, names: string[]): string[]` performs case-insensitive scoring
      (exact = 0, prefix = 1+position, substring = 10+position), returns the top 10 names
      with the original casing preserved. Pure function — no React, no Graphology.
- [X] T029 [P] [US2] Implement `frontend/src/hooks/useSelection.ts`:
      `useSelection(graph: Graph | undefined)` returns
      `{selected: string | null, neighborhood: Set<string>, setSelection: (id: string | null)
      => void}`. The neighborhood is computed via Graphology
      `graph.outNeighbors(id)` ∪ `graph.inNeighbors(id)` ∪ `{id}`.
- [X] T030 [US2] Implement `frontend/src/components/SearchBar.tsx`: text input (Tailwind,
      sticky top-left), 100 ms debounce, calls `searchSps`, renders the suggestion list
      below the input (up to 10 items per spec FR-011); Enter picks the top match; clicking
      a suggestion picks it; empty input shows nothing; a non-empty query with zero matches
      shows "No SP matches that name." in muted text.
- [X] T031 [US2] Extend `GraphCanvas.tsx` to consume `useSelection`: the `nodeReducer` now
      branches on selection — selected → sky-400 ring + full opacity; in-neighborhood → full
      opacity; out-of-neighborhood → 30 % opacity; same for edges (edges with both endpoints
      in neighborhood stay opaque, others fade). When `selected` changes, call Sigma's
      `camera.animate(...)` to bring the selected node to the viewport center.
- [X] T032 [US2] Wire `<SearchBar/>` into `App.tsx`; remove the search-area stub; add a
      background-click handler on the canvas that calls `setSelection(null)`; ensure typing
      in the search bar does not modify the canvas (only selection does).
- [X] T033 [US2] Manually validate against quickstart.md US2 (suggestions appear <200 ms,
      selection transition <1 s, neighborhood highlighting correct, clear works,
      no-match empty state).

**Checkpoint**: Users can navigate the graph by name. Detail panel still missing.

---

## Phase 5: User Story 3 — List children, parents, and tables (Priority: P3)

**Goal**: When an SP is selected, show a detail panel with role + lines + counts and
expandable lists of child SPs, parent SPs, and referenced non-SP objects grouped by type.
Names in the lists are clickable to re-select.

**Independent Test**: Select an SP. The panel shows correct name/role/lines/counts. Expand
Children → alphabetical clickable list. Expand Parents → same. Expand Tables and other
objects used → grouped by `objectType` with per-group counts. Clicking a child name
re-selects that SP and refreshes the panel; cycles do not crash.

- [X] T034 [US3] Implement `frontend/src/graph/spDetail.ts`: pure
      `buildSpDetail(data: GraphData, selectedId: string): SpDetail` that produces the
      `SpDetail` shape from data-model.md — alphabetical `children` (from outgoing edges),
      alphabetical `parents` (from incoming edges), `leavesByType` (groups `leavesBySp[id]`
      by `objectType`, alphabetical within each group, includes all 7 buckets with empty
      arrays where applicable).
- [X] T035 [US3] Implement `frontend/src/components/DetailPanel.tsx`: right-hand Tailwind
      panel. Header shows SP name, role chip, `lines` (or "no metadata" for stubs), and a
      counts strip (`outDegreeSp`, `inDegreeSp`, table count, view count, function count
      across the three function types). Three collapsible `<details>` sections with explicit
      empty-state strings ("No child SPs", "No parent SPs", "No referenced non-SP objects").
      Each SP name in Children/Parents is a `<button>` that calls a callback prop with the
      name. The Leaves section sub-groups by `objectType` with a count next to each
      subheader, using Lucide `table-2`, `eye`, `function-square`, `box`, `help-circle`,
      `tag` icons as section markers.
- [X] T036 [US3] Wire `<DetailPanel/>` into `App.tsx`: pass the currently-selected SP's
      detail (from `buildSpDetail`) and an `onPick(name)` that forwards to
      `setSelection(name)`. Hide the panel when nothing is selected. Confirm that clicking
      a child of an SP that calls itself (self-loop) doesn't double-count or crash.
- [X] T037 [US3] Manually validate against quickstart.md US3 (counts spot-checked against
      the source JSON for 5 different SPs of varying roles, including at least one stub and
      one SP with a self-loop).

**Checkpoint**: Detail panel works. The only thing left is the data-freshness error / warning
UI.

---

## Phase 6: User Story 4 — Reflect data-file edits on reload (Priority: P4)

**Goal**: The backend already re-reads the data file on mtime change and emits warnings; this
phase surfaces those signals in the UI. Malformed file → ErrorBanner. Sanity warnings →
WarningBanner. The graph either renders (warnings) or doesn't (error), per spec.

**Independent Test**: Edit `data/mapeos_sp_grafo.json` and reload the browser; see the
change. Introduce a JSON syntax error and reload; see the ErrorBanner identifying the file
and reason (no stale render). Restore validity but break a sanity rule; see the
WarningBanner naming the inconsistency while the graph still renders.

- [X] T038 [P] [US4] Implement `frontend/src/components/ErrorBanner.tsx`: full-width Tailwind
      red banner taking `{code, message, dataFilePath}`; uses Lucide `alert-octagon`; no
      stack trace; persistent (cannot dismiss while the error condition holds).
- [X] T039 [P] [US4] Implement `frontend/src/components/WarningBanner.tsx`: full-width
      Tailwind amber banner taking `warnings: Warning[]`; renders a bullet list of
      `code — message`; uses Lucide `alert-triangle`; dismissible per session (state held in
      the component; reload reshows if warnings still present).
- [X] T040 [US4] Wire `<ErrorBanner/>` and `<WarningBanner/>` into `App.tsx`, removing the
      banner stubs from T022. When `useGraphData` returns `status === 'error'`, render only
      the ErrorBanner — do NOT render a stale graph from a previous successful fetch. When
      `data.warnings.length > 0`, render the WarningBanner above the canvas and still render
      the graph.
- [X] T041 [US4] Manually validate against quickstart.md US4: edit JSON → reload → see
      change; introduce parse error → reload → ErrorBanner; introduce sanity error → reload
      → WarningBanner + best-effort render. Confirm the FE logger forwarded the error to
      `logs/app.log` via the `POST /api/log` path.

**Checkpoint**: All four user stories independently functional.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Constitution compliance sweeps, lint/type/test gates, end-to-end run against the
live data.

- [X] T042 [P] Run `pnpm tsc --noEmit` in `frontend/` and fix any reported errors; verify TS
      `strict` is active and no `any` slipped in outside explicit annotations.
- [X] T043 [P] Run `ruff check backend/` and `ruff format --check backend/` and fix any
      findings; verify Python files type-check under `pyright` or `mypy` if available
      (skip if neither is installed — `ruff` covers the lint surface).
- [X] T044 [P] Run both test suites green: `cd backend && pytest -q` and
      `cd frontend && pnpm test`. Any red test halts implementation.
- [X] T045 Constitution sweep: `grep -RIn --include='*.ts' --include='*.tsx' "console\.\(log\|debug\|info\|warn\|error\)" frontend/src`
      must only match `frontend/src/logger/`; `grep -RIn --include='*.py' "print(" backend/src`
      must be empty outside `logger.py` (and even there only as a fallback we don't use);
      `grep -RIn -P "[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}]" frontend/src backend/src specs/` must return zero hits (no
      emojis); confirm every exported TS symbol has a TSDoc block and every Python public
      function has a Google-style docstring.
- [X] T046 End-to-end validation against the live `data/mapeos_sp_grafo.json` (3,704 nodes)
      following quickstart.md sections 3.1–3.4 in order; record any acceptance scenario
      failure under this task. SC-001 through SC-008 are the pass criteria.

---

## Dependencies & Execution Order

### Phase dependencies

- **Setup (Phase 1)**: no dependencies; can start immediately.
- **Foundational (Phase 2)**: depends on Setup; blocks all user stories.
- **User Story 1 (Phase 3, P1)**: depends on Foundational only.
- **User Story 2 (Phase 4, P2)**: depends on Foundational; recommended to follow US1 since it
  reuses the live canvas.
- **User Story 3 (Phase 5, P3)**: depends on Foundational; independent of US2 (it consumes
  `useSelection` from US2 if available, but the panel can be wired to fire on plain node
  clicks instead — implementer can keep US3 self-contained).
- **User Story 4 (Phase 6, P4)**: depends on Foundational; independent of US1–US3 (banners
  only need `useGraphData`).
- **Polish (Phase 7)**: depends on all desired user stories being complete.

### Story-internal order

- US1: T023 ∥ T024 → T025 → T026 → T027
- US2: T028 ∥ T029 → T030 → T031 → T032 → T033
- US3: T034 → T035 → T036 → T037
- US4: T038 ∥ T039 → T040 → T041

### Parallel opportunities

- Setup phase: T002, T005, T006, T007, T008 are all `[P]` once T001/T003/T004 land.
- Foundational phase: T011, T015, T016, T017, T018, T020 are `[P]` against their non-overlapping files.
- US1: T023 ∥ T024 then sequential.
- US2: T028 ∥ T029 then sequential.
- US4: T038 ∥ T039 then sequential.
- Polish: T042, T043, T044 are `[P]`.

---

## Parallel Example: Foundational kickoff

Once T009/T010/T012/T013/T014 are sequenced through the backend critical path, these can run
side-by-side:

```bash
# In separate workers / sessions:
Task: T011 [P] frontend logger
Task: T015 [P] [TEST] backend graph_loader sanity tests
Task: T016 [P] [TEST] backend /api/graph endpoint tests
Task: T017 [P] frontend API client
Task: T018 [P] frontend graph types
```

---

## Implementation Strategy

### MVP first (US1 only)

1. Complete Phase 1 (Setup).
2. Complete Phase 2 (Foundational) — DO NOT skip; the constitution requires the logger,
   config, and graph loader to land before any user story.
3. Complete Phase 3 (US1).
4. **STOP and VALIDATE**: run quickstart.md US1; the graph should already be navigable.
5. If acceptable as MVP, demo here.

### Incremental delivery

1. Setup + Foundational → backend serves data; FE shell renders banners only.
2. + US1 → graph appears; ship as MVP.
3. + US2 → search works; ship.
4. + US3 → detail panel works; ship.
5. + US4 → error/warning banners work; final ship.

### Parallel team strategy (if multiple implementers)

1. One implementer completes Setup + Foundational solo (sequential critical path).
2. After the foundational checkpoint, US1, US2, US3, US4 can be split across implementers —
   they touch disjoint frontend files. US1 owns `GraphCanvas`, US2 adds
   `SearchBar` + `useSelection`, US3 adds `DetailPanel` + `spDetail`, US4 adds the two
   banners.
3. Polish phase (T042–T046) is a final solo pass.

---

## Notes

- `[P]` tasks touch different files and have no dependencies on still-incomplete tasks.
- `[Story]` labels live only on Phase 3–6 tasks per the format rules.
- Tests in this plan are intentionally three small files (T015, T016, T020) — they protect
  contracts and invariants per constitution Principle V. They are NOT a coverage target.
- Commit after each task or each logical pair; avoid mixing multiple stories in a single
  commit.
- The data file at `data/mapeos_sp_grafo.json` is read-only for this feature — no task may
  write to it.
