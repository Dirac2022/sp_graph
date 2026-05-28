# Implementation Plan: Stored-Procedure Dependency Graph Viewer

**Branch**: `001-sp-graph-viewer` | **Date**: 2026-05-28 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-sp-graph-viewer/spec.md`

## Summary

Build a single-page web application that lets an engineer interactively explore the ~3,704-node
stored-procedure dependency graph derived from `data/mapeos_sp_grafo.json`. The frontend renders
the entire graph in one zoomable, panable canvas with level-of-detail labels and a vivid /
muted palette that highlights the 3,001 in-scope ("requerido") SPs. A persistent search box
locates any SP, focuses the canvas on it, and highlights its direct neighborhood (callees +
callers). A detail panel lists the selected SP's child SPs, parent SPs, and referenced tables /
views / functions, all clickable for navigation. Edits to the data JSON are reflected after a
plain page reload (the backing API reads the file on demand with `mtime` caching), with
explicit error and warning surfaces for malformed or inconsistent data.

**Technical approach** (full rationale in [research.md](./research.md)): a thin FastAPI
backend reads, validates, and serves the graph JSON; a Vite + React + TypeScript frontend
renders it with Sigma.js (WebGL) on top of a Graphology graph, laid out with ForceAtlas2 in a
Web Worker. Tailwind handles styling. A constitution-conformant centralized logger ships on
both sides (Python rotating-file + stdout; TypeScript browser console + remote-forward to the
backend's log file for WARN/ERROR).

## Technical Context

**Language/Version**:
- Frontend: TypeScript 5.x (strict mode), Node 20 LTS for tooling.
- Backend: Python 3.11+.

**Primary Dependencies**:
- Frontend: React 18, Vite 5 (build/dev server), Tailwind CSS 3, Sigma.js 2 + Graphology +
  `graphology-layout-forceatlas2`, Lucide icons, native `fetch`.
- Backend: FastAPI, Uvicorn, Pydantic v2, Python stdlib `logging` (with custom ANSI formatter
  + `RotatingFileHandler`).

**Storage**:
- The source-of-truth `data/mapeos_sp_grafo.json` is the only persistent store. No SQLite
  database is created — this is an explicit, documented choice (see Constitution Check below)
  and not a deviation: the constitution mandates SQLite only when a database is required, and
  this feature is read-only over a single canonical JSON file (spec FR-001, Assumptions).
- A `logs/` directory holds rotating application log files (`logs/app.log` for the backend;
  the frontend forwards WARN+ records to it via `POST /api/log`).

**Testing**:
- Backend: a small `pytest` suite covering the graph-loader sanity-check function and the
  `/api/graph` happy/error paths. No coverage target.
- Frontend: a smoke test (Vitest) for the pure graph-building module that turns the API
  response into a Graphology graph; one Playwright happy-path script for the search → select →
  detail-panel flow if effort permits, otherwise manual verification per quickstart.

**Target Platform**:
- Backend: any modern Linux (developer workstation; the same runtime serves the production
  internal deployment). Listens on `127.0.0.1:8000` by default.
- Frontend: last-2-versions Chromium, Firefox, Safari on desktop. Touch input is best-effort.

**Project Type**: Web application (split `backend/` + `frontend/`).

**Performance Goals**:
- Cold parse of `mapeos_sp_grafo.json` (5.94 MB) + sanity checks on the backend: ≤ 800 ms.
- Warm `/api/graph` response (mtime unchanged): ≤ 50 ms p95.
- Frontend overview render of all ~3,704 nodes ready for interaction: ≤ 5 s after page load
  (matches SC-001).
- Sustained ≥ 30 fps during continuous pan/zoom on the reference hardware (SC-002).
- Search suggestion list update: ≤ 200 ms after the last keystroke (SC-003).
- Selection-to-rendered transition (canvas re-center + neighborhood highlight + panel data
  shown): ≤ 1 s (SC-004).

**Constraints**:
- Read-only with respect to the data file; the app never writes to it.
- No authentication, single trusted user/internal deployment.
- 5.94 MB JSON must NOT be bundled into the frontend build — it is served by the backend so
  edits are picked up by reload without a rebuild (FR-022).
- Cycles, self-loops, dangling references, and stub SPs MUST be handled gracefully (FR-028).
- No emojis anywhere; centralized logger only; TS strict mode; pnpm only (constitution).

**Scale/Scope**:
- 3,704 SP nodes; 3,001 marked `requerido`; ~3,000 SP→SP edges after dedup; ~37k non-SP
  references aggregated across `dependencies` lists.
- Single-feature scope; no horizontal scaling, no multi-tenant concerns.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Constitution version pinned to: **v1.0.0** (`.specify/memory/constitution.md`).

| # | Principle | Compliance | Evidence in this plan |
|---|---|---|---|
| I | Clean, Modular, Type-Safe Code | PASS | TS strict mode enabled; Python type hints required on all public functions; modular folder layout below splits API, graph loading, logging, and UI components into single-responsibility modules. |
| II | Trusted Libraries & Fixed Stack | PASS | Frontend: React + Vite + Tailwind + pnpm — all mandated/permitted by Principle II. Backend: FastAPI + Pydantic. Sigma.js + Graphology are mainstream, actively maintained, TypeScript-first. SQLite is intentionally not added; see "Database deviation note" below. |
| III | Modern Minimalist UI/UX, No Emojis | PASS | Tailwind-only styling; Lucide as single icon library; spec FR-026 already forbids emojis; visual language is described in research.md (Tailwind tokens, neutral grays + accent green for `requerido`). |
| IV | Centralized Observability (NON-NEGOTIABLE) | PASS | One Python logger module (`backend/src/sp_graph_api/logger.py`) writes ANSI-colored prefixes to stdout AND a rotating `logs/app.log`. One TS logger module (`frontend/src/logger/index.ts`) writes CSS-styled prefixes to the browser console AND forwards WARN/ERROR/CRITICAL records to `POST /api/log` so they land in the same file. All other code calls these — no raw `print` / `console.log`. |
| V | Documented Code, Minimal Testing Discipline | PASS | TSDoc on every exported TS symbol; Google-style docstrings on every Python public function. Tests are limited to the graph-loader sanity-check function, the two API endpoints, and a Vitest smoke test on the pure graph-builder — no coverage target. |

**Database deviation note (not a violation)**: Principle II makes SQLite the default
"**when** a database is required". This feature is read-only over a single canonical JSON
artifact (`data/mapeos_sp_grafo.json`), declared in spec FR-001 and Assumptions as the single
source of truth. No persistent server-side state, no per-user data, no joins beyond what an
in-memory dict provides. Introducing SQLite would add migration, schema, and sync surface
without any user-facing benefit. This is therefore "no DB needed, none used" — explicitly
allowed by the principle's "when required" qualifier — not a stack swap. No entry in
Complexity Tracking is required.

**Gate result**: PASS — proceed to Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/001-sp-graph-viewer/
├── plan.md              # This file (/speckit-plan command output)
├── research.md          # Phase 0 output: library choices, layout strategy, log design
├── data-model.md        # Phase 1 output: SpNode / SpEdge / Reference entities
├── quickstart.md        # Phase 1 output: how to run backend + frontend locally
├── contracts/
│   ├── api.md           # Human-readable API contract description
│   └── openapi.yaml     # Machine-readable OpenAPI 3.1 schema for /api/*
├── checklists/
│   └── requirements.md  # Spec quality checklist (already passing)
├── spec.md              # Feature spec (already finalized)
└── tasks.md             # Phase 2 output (created later by /speckit-tasks)
```

### Source Code (repository root)

The project type is **web application** (split backend + frontend). Concrete tree:

```text
backend/
├── pyproject.toml              # ruff + pytest + uvicorn[standard] + fastapi + pydantic
├── src/
│   └── sp_graph_api/
│       ├── __init__.py
│       ├── __main__.py         # `python -m sp_graph_api` entrypoint -> uvicorn.run(...)
│       ├── app.py              # FastAPI() instance + routes (/api/graph, /api/log, /api/health)
│       ├── config.py           # Settings (data path, host/port, log level, log file path)
│       ├── logger.py           # Constitution-conformant logger (stdout + rotating file)
│       ├── graph_loader.py     # JSON read + parse + sanity checks + mtime cache
│       └── schemas.py          # Pydantic response models (GraphResponse, etc.)
└── tests/
    ├── test_graph_loader.py    # sanity-check coverage on a tiny fixture
    └── test_app.py             # /api/graph happy + 5xx-on-malformed-file paths

frontend/
├── package.json                # pnpm-managed
├── pnpm-lock.yaml
├── tsconfig.json               # "strict": true, "noUncheckedIndexedAccess": true
├── tailwind.config.ts
├── postcss.config.cjs
├── vite.config.ts              # dev-proxy /api -> http://127.0.0.1:8000
├── index.html
└── src/
    ├── main.tsx
    ├── App.tsx
    ├── api/
    │   └── client.ts           # typed fetch wrappers around /api/graph and /api/log
    ├── graph/
    │   ├── types.ts            # SpNode, SpEdge, LeafRef, GraphData (mirrors backend schemas)
    │   ├── buildGraph.ts       # API response -> Graphology graph (pure)
    │   ├── layout.ts           # ForceAtlas2 worker driver
    │   └── search.ts           # ranked substring matcher (pure)
    ├── components/
    │   ├── GraphCanvas.tsx     # <SigmaContainer> + camera control on selection
    │   ├── SearchBar.tsx       # input + suggestion list (up to 10 matches per FR-011)
    │   ├── DetailPanel.tsx     # children / parents / leaves sections
    │   ├── Legend.tsx          # color/role/stub/ghost legend
    │   ├── ErrorBanner.tsx     # FR-023 parse-failure state
    │   └── WarningBanner.tsx   # FR-024 sanity-warning state
    ├── hooks/
    │   ├── useGraphData.ts     # fetch + cache + status (loading/ok/error)
    │   └── useSelection.ts     # selected SP + neighborhood derived state
    ├── logger/
    │   └── index.ts            # centralized FE logger (console + remote forward)
    └── styles/
        └── index.css           # @tailwind base/components/utilities

logs/
└── .gitkeep                    # rotating logs land here at runtime

data/                            # already exists, untouched by this feature
├── mapeos_sp_grafo.json
└── mapeos_sp_grafo.info.md
```

**Structure Decision**: Web application split. Backend in `backend/` (FastAPI), frontend in
`frontend/` (Vite + React + TypeScript). They communicate via JSON over HTTP under `/api/*`.
During development Vite's dev server proxies `/api` to the FastAPI process so the user sees a
single origin. The 5.94 MB `data/mapeos_sp_grafo.json` is served exclusively by the backend so
that file edits are reflected on plain page reload (FR-022) without rebuilding the bundle.

## Complexity Tracking

> Fill ONLY if Constitution Check has violations that must be justified.

None. The Constitution Check above passed all five principles. The "no SQLite" choice is
covered by Principle II's "when required" qualifier and is documented inline, not as a
deviation.
