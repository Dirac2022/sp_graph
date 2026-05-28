"""Tests for the FastAPI endpoints."""

from __future__ import annotations

import json
from pathlib import Path

from fastapi.testclient import TestClient

from sp_graph_api.app import create_app
from sp_graph_api.config import Settings


def _good_payload() -> dict:
    return {
        "summary": {
            "total_entries": 1,
            "total_requerido": 1,
            "total_adjunto_hijo": 0,
            "total_adjunto_padre": 0,
            "total_adjunto_ambos": 0,
            "faltantes_en_mapeos_sp": [],
        },
        "mappings": {
            "SP_A": {
                "rol": "requerido",
                "source_sql_server": {
                    "procedure_name": "SP_A",
                    "lines": 1,
                    "dependencies": [],
                },
                "callers": [],
            }
        },
    }


def _settings(tmp_path: Path, *, data_file: Path | None = None) -> Settings:
    data = data_file if data_file is not None else tmp_path / "data.json"
    return Settings(
        data_path=data,
        log_file=tmp_path / "app.log",
        log_level="WARNING",
    )


def test_graph_endpoint_returns_payload(tmp_path: Path) -> None:
    data_file = tmp_path / "data.json"
    data_file.write_text(json.dumps(_good_payload()), encoding="utf-8")
    client = TestClient(create_app(_settings(tmp_path, data_file=data_file)))

    response = client.get("/api/graph")
    assert response.status_code == 200
    body = response.json()
    assert body["meta"]["totalEntries"] == 1
    assert body["nodes"][0]["id"] == "SP_A"
    assert body["edges"] == []
    assert body["warnings"] == []


def test_graph_endpoint_500_on_malformed_file(tmp_path: Path) -> None:
    data_file = tmp_path / "data.json"
    data_file.write_text("{not json", encoding="utf-8")
    client = TestClient(create_app(_settings(tmp_path, data_file=data_file)))

    response = client.get("/api/graph")
    assert response.status_code == 500
    body = response.json()
    assert body["error"]["code"] == "data_file_unparseable"
    assert body["error"]["dataFilePath"].endswith("data.json")


def test_health_endpoint_does_not_touch_data_file(tmp_path: Path) -> None:
    missing = tmp_path / "does-not-exist.json"
    client = TestClient(create_app(_settings(tmp_path, data_file=missing)))

    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_log_endpoint_accepts_warning(tmp_path: Path) -> None:
    data_file = tmp_path / "data.json"
    data_file.write_text(json.dumps(_good_payload()), encoding="utf-8")
    client = TestClient(create_app(_settings(tmp_path, data_file=data_file)))

    response = client.post(
        "/api/log",
        json={
            "level": "ERROR",
            "module": "graph/buildGraph",
            "message": "edge target missing",
            "timestamp": "2026-05-28T13:42:18.512Z",
            "context": {"source": "SP_A", "target": "MISSING"},
        },
    )
    assert response.status_code == 204


def test_log_endpoint_rejects_debug_level(tmp_path: Path) -> None:
    data_file = tmp_path / "data.json"
    data_file.write_text(json.dumps(_good_payload()), encoding="utf-8")
    client = TestClient(create_app(_settings(tmp_path, data_file=data_file)))

    response = client.post(
        "/api/log",
        json={
            "level": "DEBUG",
            "module": "x",
            "message": "y",
            "timestamp": "2026-05-28T13:42:18.512Z",
        },
    )
    assert response.status_code == 422
