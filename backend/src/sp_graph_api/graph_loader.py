"""JSON-backed loader for the SP dependency graph.

This module is the only place that reads the source-of-truth data file at
``data/mapeos_sp_grafo.json``. It performs three things:

1. Parses the file and projects it into the :class:`~sp_graph_api.schemas.GraphData`
   shape that the API surfaces.
2. Runs three documented sanity checks (see ``research.md`` Decision 8) and exposes
   any failures as non-fatal :class:`~sp_graph_api.schemas.Warning` records.
3. Caches the parsed payload in memory, keyed on the file's mtime, so repeated
   requests within the same on-disk version do not re-parse 5.94 MB of JSON.

Fatal failures (file missing, JSON parse error, top-level shape mismatch) are
raised as :class:`GraphLoadError`. The HTTP layer turns them into HTTP 500
responses.
"""

from __future__ import annotations

import json
import re
import threading
from collections.abc import Iterable
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from .logger import get_logger
from .schemas import (
    GraphData,
    GraphMeta,
    LeafObjectType,
    LeafRef,
    SpEdge,
    SpNode,
    SpRole,
    Warning,
)

_VALID_ROLES: frozenset[SpRole] = frozenset(
    ("requerido", "adjunto_hijo", "adjunto_padre", "adjunto_ambos")
)

_VALID_LEAF_TYPES: frozenset[LeafObjectType] = frozenset(
    (
        "Table",
        "View",
        "Scalar Function",
        "Table Function",
        "Inline Function",
        "OBJECT_OR_COLUMN",
        "TYPE",
    )
)

_MODULE_PREFIX_RE = re.compile(r"^([A-Za-z]+)(?:_|[A-Z][a-z])")

_log = get_logger(__name__)


class GraphLoadError(Exception):
    """Raised on fatal data-file errors. Carries an :class:`ErrorBody`-style payload."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


def _derive_module(name: str) -> str | None:
    """Return a coarse module tag based on the SP name's prefix, or ``None``."""

    match = _MODULE_PREFIX_RE.match(name)
    if not match:
        return None
    prefix = match.group(1)
    return prefix if len(prefix) >= 3 else None


class GraphLoader:
    """Reads, validates, and caches the SP graph from disk."""

    def __init__(self, data_path: Path) -> None:
        self._path = data_path
        self._lock = threading.Lock()
        self._cache_mtime: float | None = None
        self._cache_payload: GraphData | None = None

    @property
    def data_path(self) -> Path:
        """The configured path to the JSON source-of-truth file."""

        return self._path

    def load(self) -> GraphData:
        """Return the parsed :class:`GraphData`, re-reading on mtime change.

        Returns:
            The cached payload, or a freshly-built one if the file changed.

        Raises:
            GraphLoadError: when the file is missing, unparseable, or fails the
                top-level shape check.
        """

        with self._lock:
            try:
                stat = self._path.stat()
            except FileNotFoundError as exc:
                raise GraphLoadError(
                    "data_file_unreadable",
                    f"Data file not found at {self._path}",
                ) from exc
            except OSError as exc:
                raise GraphLoadError(
                    "data_file_unreadable",
                    f"Could not stat data file: {exc}",
                ) from exc

            if self._cache_payload is not None and self._cache_mtime == stat.st_mtime:
                return self._cache_payload

            _log.info("Reading data file: %s", self._path)
            try:
                raw = json.loads(self._path.read_text(encoding="utf-8"))
            except json.JSONDecodeError as exc:
                raise GraphLoadError(
                    "data_file_unparseable",
                    f"Could not parse data file: {exc.msg} at line {exc.lineno} column {exc.colno}",
                ) from exc
            except OSError as exc:
                raise GraphLoadError(
                    "data_file_unreadable",
                    f"Could not read data file: {exc}",
                ) from exc

            payload = self._build(raw, mtime=stat.st_mtime)
            self._cache_payload = payload
            self._cache_mtime = stat.st_mtime
            return payload

    def _build(self, raw: Any, *, mtime: float) -> GraphData:
        """Project the raw JSON into a :class:`GraphData`."""

        if not isinstance(raw, dict):
            raise GraphLoadError(
                "data_file_shape_invalid", "Top-level value is not a JSON object"
            )
        summary = raw.get("summary")
        mappings = raw.get("mappings")
        if not isinstance(summary, dict) or not isinstance(mappings, dict):
            raise GraphLoadError(
                "data_file_shape_invalid",
                "Top-level object is missing 'summary' or 'mappings'",
            )

        warnings: list[Warning] = []

        nodes: list[SpNode] = []
        edges_set: dict[str, SpEdge] = {}
        leaves_by_sp: dict[str, list[LeafRef]] = {}
        ghosts_set: set[str] = set()
        mapping_ids: set[str] = set(mappings.keys())

        for sp_name, entry in mappings.items():
            if not isinstance(entry, dict):
                warnings.append(
                    Warning(
                        code="entry_shape_invalid",
                        message=f"Entry '{sp_name}' is not an object",
                    )
                )
                continue

            rol = entry.get("rol")
            if rol not in _VALID_ROLES:
                warnings.append(
                    Warning(
                        code="unknown_role",
                        message=(
                            f"Entry '{sp_name}' has unknown rol '{rol}'; "
                            "defaulting to adjunto_hijo"
                        ),
                    )
                )
                rol = "adjunto_hijo"

            source = entry.get("source_sql_server")
            if not isinstance(source, dict):
                source = {}
            lines = source.get("lines")
            if not (lines is None or isinstance(lines, int)):
                lines = None

            deps = source.get("dependencies") or []
            callers = entry.get("callers") or []

            out_sp = 0
            sp_leaves: list[LeafRef] = []
            for dep in deps:
                if not isinstance(dep, dict):
                    continue
                dep_name = dep.get("name")
                obj_type = dep.get("objectType")
                schema_ = dep.get("schema", "dbo")
                if not isinstance(dep_name, str):
                    continue
                if obj_type == "Stored Procedure":
                    edge_id = f"{sp_name}->{dep_name}"
                    if edge_id not in edges_set:
                        edges_set[edge_id] = SpEdge(id=edge_id, source=sp_name, target=dep_name)
                    out_sp += 1
                elif isinstance(obj_type, str) and obj_type in _VALID_LEAF_TYPES:
                    sp_leaves.append(
                        LeafRef.model_validate(
                            {"name": dep_name, "schema": schema_, "objectType": obj_type}
                        )
                    )

            in_sp = 0
            for caller in callers:
                if not isinstance(caller, dict):
                    continue
                caller_name = caller.get("name")
                if not isinstance(caller_name, str):
                    continue
                edge_id = f"{caller_name}->{sp_name}"
                if edge_id not in edges_set:
                    edges_set[edge_id] = SpEdge(id=edge_id, source=caller_name, target=sp_name)
                in_sp += 1

            is_stub = lines is None and out_sp == 0 and sp_name in (
                summary.get("faltantes_en_mapeos_sp") or []
            )

            node = SpNode(
                id=sp_name,
                rol=rol,
                lines=lines,
                is_stub=is_stub,
                out_degree_sp=out_sp,
                in_degree_sp=in_sp,
                module=_derive_module(sp_name),
            )
            nodes.append(node)
            if sp_leaves:
                leaves_by_sp[sp_name] = sp_leaves

        # Collect ghosts: any source/target on an edge that isn't a known mapping id.
        for edge in edges_set.values():
            if edge.source not in mapping_ids:
                ghosts_set.add(edge.source)
            if edge.target not in mapping_ids:
                ghosts_set.add(edge.target)

        warnings.extend(self._sanity_checks(summary=summary, mappings=mappings))

        meta = GraphMeta(
            data_file_mtime_iso=datetime.fromtimestamp(mtime, tz=UTC).strftime(
                "%Y-%m-%dT%H:%M:%SZ"
            ),
            data_file_path=str(self._path),
            total_entries=len(mappings),
            total_requerido=sum(1 for n in nodes if n.rol == "requerido"),
        )

        _log.info(
            "Built graph: %d nodes, %d edges, %d ghosts, %d warnings",
            len(nodes),
            len(edges_set),
            len(ghosts_set),
            len(warnings),
        )

        return GraphData(
            meta=meta,
            nodes=nodes,
            edges=list(edges_set.values()),
            ghosts=sorted(ghosts_set),
            leaves_by_sp=leaves_by_sp,
            warnings=warnings,
        )

    @staticmethod
    def _sanity_checks(*, summary: dict[str, Any], mappings: dict[str, Any]) -> Iterable[Warning]:
        """Run the three documented sanity checks against ``summary``/``mappings``."""

        total_entries = summary.get("total_entries")
        if isinstance(total_entries, int) and total_entries != len(mappings):
            yield Warning(
                code="entries_mismatch",
                message=(
                    f"summary.total_entries={total_entries} but mappings has {len(mappings)} keys"
                ),
            )

        try:
            role_sum = (
                int(summary.get("total_requerido", 0))
                + int(summary.get("total_adjunto_hijo", 0))
                + int(summary.get("total_adjunto_padre", 0))
                + int(summary.get("total_adjunto_ambos", 0))
            )
        except (TypeError, ValueError):
            role_sum = None
        if (
            isinstance(role_sum, int)
            and isinstance(total_entries, int)
            and role_sum != total_entries
        ):
            yield Warning(
                code="role_count_mismatch",
                message=(
                    f"Sum of role counters ({role_sum}) does not equal total_entries "
                    f"({total_entries})"
                ),
            )

        faltantes = summary.get("faltantes_en_mapeos_sp") or []
        if isinstance(faltantes, list):
            for stub_name in faltantes:
                entry = mappings.get(stub_name)
                if not isinstance(entry, dict):
                    yield Warning(
                        code="stub_shape_mismatch",
                        message=f"Stub '{stub_name}' is missing from mappings",
                    )
                    continue
                rol = entry.get("rol")
                src = entry.get("source_sql_server") or {}
                if rol != "requerido" or src.get("lines") is not None:
                    yield Warning(
                        code="stub_shape_mismatch",
                        message=(
                            f"Stub '{stub_name}' has unexpected shape "
                            f"(rol={rol!r}, lines={src.get('lines')!r})"
                        ),
                    )
