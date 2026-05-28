"""Tests for the graph loader sanity checks and mtime cache."""

from __future__ import annotations

import json
from pathlib import Path

import pytest

from sp_graph_api.graph_loader import GraphLoader, GraphLoadError


def _good_payload() -> dict:
    return {
        "summary": {
            "total_entries": 2,
            "total_requerido": 1,
            "total_adjunto_hijo": 1,
            "total_adjunto_padre": 0,
            "total_adjunto_ambos": 0,
            "faltantes_en_mapeos_sp": [],
        },
        "mappings": {
            "SP_A": {
                "rol": "requerido",
                "source_sql_server": {
                    "procedure_name": "SP_A",
                    "lines": 10,
                    "dependencies": [
                        {"name": "SP_B", "schema": "dbo", "objectType": "Stored Procedure"},
                        {"name": "TBL_X", "schema": "dbo", "objectType": "Table"},
                    ],
                },
                "callers": [],
            },
            "SP_B": {
                "rol": "adjunto_hijo",
                "source_sql_server": {
                    "procedure_name": "SP_B",
                    "lines": 5,
                    "dependencies": [],
                },
                "callers": [{"name": "SP_A", "schema": "dbo"}],
            },
        },
    }


def _write(tmp_path: Path, payload: dict) -> Path:
    p = tmp_path / "data.json"
    p.write_text(json.dumps(payload), encoding="utf-8")
    return p


def test_happy_path_builds_graph(tmp_path: Path) -> None:
    loader = GraphLoader(_write(tmp_path, _good_payload()))
    data = loader.load()
    assert data.meta.total_entries == 2
    assert data.meta.total_requerido == 1
    assert {n.id for n in data.nodes} == {"SP_A", "SP_B"}
    assert len(data.edges) == 1
    edge = data.edges[0]
    assert edge.source == "SP_A" and edge.target == "SP_B"
    assert data.warnings == []
    # Leaf table for SP_A
    assert "SP_A" in data.leaves_by_sp
    assert data.leaves_by_sp["SP_A"][0].name == "TBL_X"


def test_entries_mismatch_warning(tmp_path: Path) -> None:
    payload = _good_payload()
    payload["summary"]["total_entries"] = 99
    loader = GraphLoader(_write(tmp_path, payload))
    data = loader.load()
    codes = {w.code for w in data.warnings}
    assert "entries_mismatch" in codes


def test_role_count_mismatch_warning(tmp_path: Path) -> None:
    payload = _good_payload()
    payload["summary"]["total_requerido"] = 7
    loader = GraphLoader(_write(tmp_path, payload))
    data = loader.load()
    codes = {w.code for w in data.warnings}
    assert "role_count_mismatch" in codes


def test_stub_shape_mismatch_warning(tmp_path: Path) -> None:
    payload = _good_payload()
    payload["summary"]["faltantes_en_mapeos_sp"] = ["SP_B"]
    # SP_B has lines=5 and rol=adjunto_hijo, not the required stub shape
    loader = GraphLoader(_write(tmp_path, payload))
    data = loader.load()
    codes = {w.code for w in data.warnings}
    assert "stub_shape_mismatch" in codes


def test_unparseable_raises(tmp_path: Path) -> None:
    p = tmp_path / "data.json"
    p.write_text("{not json", encoding="utf-8")
    loader = GraphLoader(p)
    with pytest.raises(GraphLoadError) as exc:
        loader.load()
    assert exc.value.code == "data_file_unparseable"


def test_missing_file_raises(tmp_path: Path) -> None:
    loader = GraphLoader(tmp_path / "missing.json")
    with pytest.raises(GraphLoadError) as exc:
        loader.load()
    assert exc.value.code == "data_file_unreadable"


def test_mtime_cache_reuses_payload(tmp_path: Path) -> None:
    path = _write(tmp_path, _good_payload())
    loader = GraphLoader(path)
    first = loader.load()
    second = loader.load()
    # Same object identity proves the cache hit (no re-parse)
    assert first is second
