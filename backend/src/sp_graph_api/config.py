"""Runtime configuration for the SP Graph API.

Settings are sourced from environment variables (with the ``SP_GRAPH_`` prefix)
or use sensible defaults rooted at the repository directory. See ``quickstart.md``
for the full table.
"""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[3]


class Settings(BaseSettings):
    """Application settings read from the environment.

    Attributes:
        data_path: Absolute or repo-relative path to the JSON data file.
        host: Bind address for the HTTP server.
        port: Bind port for the HTTP server.
        log_level: Threshold for the centralized logger.
        log_file: Path to the rotating log file.
    """

    model_config = SettingsConfigDict(env_prefix="SP_GRAPH_", env_file=None)

    data_path: Path = Field(default=_REPO_ROOT / "data" / "mapeos_sp_grafo.json")
    programs_path: Path = Field(
        default=_REPO_ROOT / "data" / "ProgramasMagic_SP_ADMINISTRATIVO.csv"
    )
    host: str = Field(default="127.0.0.1")
    port: int = Field(default=8000)
    log_level: str = Field(default="INFO")
    log_file: Path = Field(default=_REPO_ROOT / "logs" / "app.log")

    def resolved_programs_path(self) -> Path:
        """Return ``programs_path`` resolved against the repository root if relative."""

        return (
            self.programs_path
            if self.programs_path.is_absolute()
            else _REPO_ROOT / self.programs_path
        )

    def resolved_data_path(self) -> Path:
        """Return ``data_path`` resolved against the repository root if relative."""

        return self.data_path if self.data_path.is_absolute() else _REPO_ROOT / self.data_path

    def resolved_log_file(self) -> Path:
        """Return ``log_file`` resolved against the repository root if relative."""

        return self.log_file if self.log_file.is_absolute() else _REPO_ROOT / self.log_file
