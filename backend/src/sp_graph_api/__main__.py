"""Entry point: ``python -m sp_graph_api`` runs uvicorn with our settings."""

from __future__ import annotations

import uvicorn

from .config import Settings


def main() -> None:
    """Launch the FastAPI app via uvicorn using the configured host/port."""

    settings = Settings()
    uvicorn.run(
        "sp_graph_api.app:app",
        host=settings.host,
        port=settings.port,
        log_config=None,
        access_log=False,
    )


if __name__ == "__main__":
    main()
