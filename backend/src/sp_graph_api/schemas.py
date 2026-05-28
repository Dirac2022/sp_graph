"""Pydantic schemas for the SP Graph API responses and requests.

These mirror the entities defined in ``data-model.md``. Field names are
camelCase on the wire to match the TypeScript client.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field
from pydantic.alias_generators import to_camel

SpRole = Literal["requerido", "adjunto_hijo", "adjunto_padre", "adjunto_ambos"]
"""Discriminator for an SP's role relative to the migration scope."""

LeafObjectType = Literal[
    "Table",
    "View",
    "Scalar Function",
    "Table Function",
    "Inline Function",
    "OBJECT_OR_COLUMN",
    "TYPE",
]
"""Object types referenced by an SP that are not themselves SPs."""


class _CamelModel(BaseModel):
    """Shared base: serialize as camelCase but accept Python snake_case on input."""

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class SpNode(_CamelModel):
    """A single stored procedure node in the graph."""

    id: str
    rol: SpRole
    lines: int | None
    is_stub: bool
    out_degree_sp: int
    in_degree_sp: int
    module: str | None = None


class SpEdge(_CamelModel):
    """A directed ``source -> target`` "calls" relationship between two SPs."""

    id: str
    source: str
    target: str


class LeafRef(_CamelModel):
    """A non-SP object referenced by some SP (table, view, function, etc.)."""

    name: str
    schema_: str = Field(alias="schema")
    object_type: LeafObjectType

    model_config = ConfigDict(populate_by_name=True, alias_generator=to_camel)


class Warning(_CamelModel):
    """A non-fatal sanity-check finding emitted by the loader."""

    code: str
    message: str


class GraphMeta(_CamelModel):
    """Top-level metadata about the served payload."""

    data_file_mtime_iso: str
    data_file_path: str
    total_entries: int
    total_requerido: int


class GraphData(_CamelModel):
    """Full graph payload returned by ``GET /api/graph``."""

    meta: GraphMeta
    nodes: list[SpNode]
    edges: list[SpEdge]
    ghosts: list[str]
    leaves_by_sp: dict[str, list[LeafRef]]
    warnings: list[Warning]


class LogPayload(_CamelModel):
    """Body of a frontend-forwarded log record (``POST /api/log``)."""

    level: Literal["WARNING", "ERROR", "CRITICAL"]
    module: str
    message: str
    timestamp: str
    context: dict[str, Any] | None = None


class ErrorBody(_CamelModel):
    """Structured body returned for fatal data-file errors."""

    code: Literal["data_file_unreadable", "data_file_unparseable", "data_file_shape_invalid"]
    message: str
    data_file_path: str


class ErrorEnvelope(_CamelModel):
    """Wrapper for ``ErrorBody`` matching the OpenAPI contract."""

    error: ErrorBody
