"""FastAPI application: health probe, graph endpoint, and FE log forwarder."""

from __future__ import annotations

import logging
from typing import Any

from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse

from .config import Settings
from .graph_loader import GraphLoader, GraphLoadError
from .logger import configure_root_logger, get_logger
from .schemas import ErrorBody, ErrorEnvelope, GraphData, LogPayload

_LEVEL_INT = {"WARNING": logging.WARNING, "ERROR": logging.ERROR, "CRITICAL": logging.CRITICAL}


def create_app(settings: Settings | None = None) -> FastAPI:
    """Return a configured FastAPI application.

    Args:
        settings: Optional ready-made settings instance. When ``None`` a fresh
            :class:`~sp_graph_api.config.Settings` is constructed from the
            environment.

    Returns:
        The application instance. Side effects: the root logger is configured.
    """

    settings = settings or Settings()
    configure_root_logger(level=settings.log_level, log_file=settings.resolved_log_file())
    log = get_logger(__name__)

    loader = GraphLoader(settings.resolved_data_path())
    app = FastAPI(title="SP Graph Viewer API", version="0.1.0")
    app.state.settings = settings
    app.state.loader = loader

    @app.get("/api/health")
    def health() -> dict[str, str]:
        """Liveness probe. Intentionally does not touch the data file."""

        return {"status": "ok"}

    @app.get("/api/graph", response_model=GraphData, response_model_by_alias=True)
    def graph(request: Request) -> Any:
        """Return the full SP dependency graph, re-reading on mtime change."""

        active_loader: GraphLoader = request.app.state.loader
        try:
            return active_loader.load()
        except GraphLoadError as exc:
            log.error("Data file error: %s :: %s", exc.code, exc.message)
            body = ErrorEnvelope(
                error=ErrorBody(
                    code=exc.code,  # type: ignore[arg-type]
                    message=exc.message,
                    data_file_path=str(active_loader.data_path),
                )
            )
            return JSONResponse(status_code=500, content=body.model_dump(by_alias=True))

    @app.post("/api/log", status_code=204)
    def receive_log(payload: LogPayload) -> None:
        """Persist a frontend-emitted WARN/ERROR/CRITICAL record."""

        fe_log = get_logger(f"frontend.{payload.module}")
        fe_log.log(
            _LEVEL_INT[payload.level],
            "%s (client_ts=%s, context=%s)",
            payload.message,
            payload.timestamp,
            payload.context or {},
        )

    log.info(
        "App initialized: host=%s port=%d data_path=%s log_file=%s",
        settings.host,
        settings.port,
        loader.data_path,
        settings.resolved_log_file(),
    )
    return app


app = create_app()
