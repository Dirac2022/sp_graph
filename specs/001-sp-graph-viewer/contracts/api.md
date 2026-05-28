# API Contracts: Stored-Procedure Dependency Graph Viewer

**Feature**: 001-sp-graph-viewer
**Base URL** (dev): `http://127.0.0.1:8000`
**Base URL** (frontend dev via Vite proxy): same-origin under `/api/*`
**Content type**: `application/json; charset=utf-8`
**Authentication**: none (single-trusted-user internal deployment, per spec Assumptions).

All schemas mirror the shapes in [../data-model.md](../data-model.md); refer there for field
semantics. The OpenAPI 3.1 description at [openapi.yaml](./openapi.yaml) is the
machine-readable source of truth.

---

## GET /api/graph

Returns the full graph payload, re-reading the data file if its `mtime` has changed since
the last successful parse.

**Request**: no parameters, no body.

**Responses**:

- `200 OK` — `application/json` matching the `GraphData` schema. Example:
  ```json
  {
    "meta": {
      "dataFileMtimeIso": "2026-05-28T13:42:11Z",
      "dataFilePath": "data/mapeos_sp_grafo.json",
      "totalEntries": 3704,
      "totalRequerido": 3001
    },
    "nodes": [
      { "id": "ACTUALIZA_COMPROBANTE", "rol": "requerido",
        "lines": 142, "isStub": false, "outDegreeSp": 3, "inDegreeSp": 7,
        "module": "ACTUALIZA" }
    ],
    "edges": [
      { "id": "ACTUALIZA_COMPROBANTE->ALERTA_LISTAR_USUARIOS",
        "source": "ACTUALIZA_COMPROBANTE",
        "target": "ALERTA_LISTAR_USUARIOS" }
    ],
    "ghosts": ["SOME_REFERENCED_SP_OUTSIDE_SUBGRAPH"],
    "leavesBySp": {
      "ACTUALIZA_COMPROBANTE": [
        { "name": "MBANCO1F", "schema": "dbo", "objectType": "Table" }
      ]
    },
    "warnings": []
  }
  ```

- `500 Internal Server Error` — data file unreadable / unparseable / shape-invalid.
  Body shape:
  ```json
  {
    "error": {
      "code": "data_file_unparseable",
      "message": "Could not parse data file: Unexpected character at line 42 column 5",
      "dataFilePath": "data/mapeos_sp_grafo.json"
    }
  }
  ```
  `code` is one of `data_file_unreadable`, `data_file_unparseable`,
  `data_file_shape_invalid`. The frontend renders this via the ErrorBanner (spec FR-023).

**Caching**: server-side, mtime-keyed in-memory. Identical reloads return in <50 ms with no
re-parse (matches the warm-path performance goal in plan.md). No client-side cache headers
are set — page reload should be authoritative.

---

## POST /api/log

Receives a structured WARN/ERROR/CRITICAL log record from the frontend logger and writes
it to the backend's centralized log sink (`logs/app.log`). Fire-and-forget from the
frontend's perspective — the response body is empty.

**Request body** matches the `LogPayload` schema:
```json
{
  "level": "ERROR",
  "module": "graph/buildGraph",
  "message": "Edge target not found in mappings; rendering as ghost",
  "timestamp": "2026-05-28T13:42:18.512Z",
  "context": { "source": "ACTUALIZA_COMPROBANTE", "target": "MISSING_SP" }
}
```

`level` MUST be one of `WARNING`, `ERROR`, `CRITICAL`. Other levels are rejected with
422 — debug/info from the browser do not pollute the file sink.

**Responses**:
- `204 No Content` — record accepted and written.
- `422 Unprocessable Entity` — payload shape invalid (Pydantic validation failed).
- `500 Internal Server Error` — file sink unavailable (e.g., disk full); a single
  diagnostic line is still printed to backend stdout.

The receiving handler writes the record through the same `get_logger("frontend")` instance
the rest of the backend uses, so file format is identical to a backend-emitted record.

---

## GET /api/health

Liveness probe. No-op intentionally: does NOT touch the data file (so an unparseable file
doesn't fail the health probe).

**Responses**:
- `200 OK` — `{"status": "ok"}`.

---

## CORS

The dev-time setup avoids CORS entirely by routing through Vite's `/api` proxy.
In production (single-origin static + FastAPI under same hostname), CORS remains off.

---

## Versioning

This is an internal-only single-feature API. No `/v1/` prefix is used. Breaking changes will
ship in lockstep with the frontend in the same commit.
