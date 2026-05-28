# Quickstart: Stored-Procedure Dependency Graph Viewer

**Feature**: 001-sp-graph-viewer
**Audience**: developers running the app locally for the first time
**Prerequisites**: Python 3.11+, Node 20+ (`pnpm` installed), the data file already present at
`data/mapeos_sp_grafo.json`.

This document is the runbook for bringing the feature up locally and validating the four user
stories from [spec.md](./spec.md). It stays in sync with implementation per constitution
Principle V.

---

## 1. Backend (FastAPI)

```bash
# From repo root
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -e .            # picks up pyproject.toml deps (fastapi, uvicorn, pydantic, pytest, ruff)

# Run the server
python -m sp_graph_api      # binds 127.0.0.1:8000 by default
```

Configuration is environment-driven (see `backend/src/sp_graph_api/config.py`):

| Var | Default | Purpose |
|---|---|---|
| `SP_GRAPH_DATA_PATH` | `data/mapeos_sp_grafo.json` (resolved from repo root) | source-of-truth JSON file |
| `SP_GRAPH_HOST` | `127.0.0.1` | bind host |
| `SP_GRAPH_PORT` | `8000` | bind port |
| `SP_GRAPH_LOG_LEVEL` | `INFO` | logger threshold |
| `SP_GRAPH_LOG_FILE` | `logs/app.log` (from repo root) | rotating log destination |
| `NO_COLOR` | unset | when set, disables ANSI colors in stdout |

Smoke test:

```bash
curl -s http://127.0.0.1:8000/api/health
# -> {"status":"ok"}

curl -s http://127.0.0.1:8000/api/graph | jq '.meta'
# -> { "dataFileMtimeIso": "...", "totalEntries": 3704, "totalRequerido": 3001, ... }
```

---

## 2. Frontend (Vite + React + TypeScript)

```bash
# In a second terminal, from repo root
cd frontend
pnpm install
pnpm dev                    # Vite on http://127.0.0.1:5173, /api proxied to :8000
```

Open `http://127.0.0.1:5173` in a modern desktop browser.

Production build:

```bash
pnpm build                  # emits frontend/dist/
pnpm preview                # serves dist on :4173 for local sanity
```

The production bundle is static; in deployment, point any static-file server (or FastAPI's
`StaticFiles`) at `frontend/dist/` and run the backend behind the same hostname.

---

## 3. Validating the user stories

### US1 — Explore the full graph

1. Load `http://127.0.0.1:5173`.
2. **Expect**: within ~5 seconds, a single canvas filling the viewport shows ~3,704 dots; no
   labels are visible at the default zoom. Background is near-black, in-scope nodes are vivid
   green (`emerald-500`), out-of-scope nodes are muted slate.
3. Scroll-wheel zoom in on a cluster.
4. **Expect**: node labels and edges become visible progressively. Edges show arrowheads
   indicating call direction.
5. Pan with mouse drag.
6. **Expect**: motion stays smooth (target ≥ 30 fps).
7. Hover any stub node (small ring icon).
8. **Expect**: a tooltip explaining "in-scope but no metadata" appears.

### US2 — Search and highlight neighborhood

1. With the canvas visible, click the search bar (top-left).
2. Type `ACTUALIZA`.
3. **Expect**: a suggestion list of up to 10 matches appears within ~200 ms.
4. Press Enter on the top match.
5. **Expect**: the canvas re-centers on that SP within ~1 second. The selected node has a
   sky-400 ring; its direct neighbors are at full opacity; everything else is faded to ~30 %.
6. Click the canvas background.
7. **Expect**: all highlighting clears and the graph returns to default.
8. Search a string with no matches (e.g., `zzzzz`).
9. **Expect**: a small "no SP matches that name" message under the search bar; the canvas is
   not modified.

### US3 — Detail panel

1. After selecting an SP in US2, the right-hand detail panel should already be open.
2. **Expect**: panel header shows SP name, role, lines (or "no metadata" for stubs), child /
   parent counts, and a counts strip for tables/views/functions.
3. Expand the **Children** section.
4. **Expect**: alphabetical list of child SP names, each clickable.
5. Expand the **Parents** section. Same shape.
6. Expand **Tables and other objects used**.
7. **Expect**: items grouped under their `objectType` (Table, View, Scalar Function,
   etc.), each group with a count and an alphabetical list.
8. Click any child or parent SP name in the panel.
9. **Expect**: the canvas re-centers on the clicked SP and the panel refreshes; nothing
   crashes on cycles or self-loops.

### US4 — Reflect data-file edits on reload

1. With the app open, edit `data/mapeos_sp_grafo.json` (e.g., remove an entry from
   `mappings`, or change a `rol`). Save the file.
2. Reload the browser tab (Ctrl/Cmd+R).
3. **Expect**: the rendered graph reflects the edit (node missing, role color changed). No
   process restart was needed; no rebuild step.
4. Introduce a JSON syntax error and reload.
5. **Expect**: an ErrorBanner appears with the file path and a one-line failure reason; the
   stale graph is not shown.
6. Restore validity but break a sanity rule (e.g., set `summary.total_entries` to a wrong
   value) and reload.
7. **Expect**: a non-blocking WarningBanner appears naming the inconsistency; the graph still
   renders best-effort.

---

## 4. Tests

```bash
# Backend
cd backend && pytest -q

# Frontend
cd frontend && pnpm test         # Vitest, single smoke file
```

Both suites are intentionally small per constitution Principle V. Failures here block
implementation.

---

## 5. Centralized logging — where to look when things go wrong

- Backend stdout: ANSI-colored prefixes (`[INFO]`, `[WARNING]`, `[ERROR]`, …) in the
  terminal running `python -m sp_graph_api`. Colors auto-disable under `NO_COLOR=1`.
- Backend file: `logs/app.log` (rotating, 10 MB × 5 backups). Contains every backend record
  plus forwarded WARN/ERROR/CRITICAL records from the frontend.
- Frontend devtools console: `%c`-styled prefixes for every level.
- For ops, the canonical log is the file. Tail it during validation:
  ```bash
  tail -F logs/app.log
  ```

If `logs/app.log` is empty even though you've seen records in the console, check:
1. `logs/` exists (the `.gitkeep` should be in git).
2. The backend has write permission on `logs/`.
3. `SP_GRAPH_LOG_FILE` env override hasn't redirected the file elsewhere.

---

## 6. Troubleshooting

| Symptom | Likely cause |
|---|---|
| Cold load takes >10 s | Backend re-parse on every request (mtime cache miss). Check the file isn't being touched by another process. |
| Canvas is blank but no banner | Browser without WebGL2 support. Use a current Chromium / Firefox / Safari. |
| Search returns no suggestions for known names | Frontend never received `/api/graph` (check network tab); or backend returned a 500 (check ErrorBanner). |
| Stub nodes look identical to real nodes | The data file's `summary.faltantes_en_mapeos_sp` may be empty or out of sync with `mappings`. A `stub_shape_mismatch` warning should be visible. |
| Edits to the JSON not reflected on reload | Vite dev server cached stale `/api/graph` response? Hard-reload (Ctrl+Shift+R). The backend's mtime cache will pick up the change on the next request. |
