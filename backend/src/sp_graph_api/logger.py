"""Centralized backend logger.

Implements the contract defined in the project constitution (Principle IV):

* All records pass through a single module.
* Severity is prefixed in square brackets (``[INFO]``, ``[WARNING]``, ``[ERROR]``,
  ``[CRITICAL]``, ``[DEBUG]``) and colored with ANSI codes on terminal output.
* The same record is written to the terminal AND to a rotating file on disk.
* Color is auto-disabled when stdout is not a TTY or when ``NO_COLOR`` is set.
* Every record carries a UTC ISO-8601 timestamp and the originating logger name.

Public API:

* :func:`configure_root_logger` -- one-time setup wiring both sinks.
* :func:`get_logger` -- return a stdlib :class:`logging.Logger` instance.
"""

from __future__ import annotations

import logging
import logging.handlers
import os
import sys
import time
from pathlib import Path

_ANSI: dict[str, str] = {
    "DEBUG": "\x1b[90m",
    "INFO": "\x1b[36m",
    "WARNING": "\x1b[33m",
    "ERROR": "\x1b[31m",
    "CRITICAL": "\x1b[1;31m",
}
_ANSI_RESET = "\x1b[0m"

_LOG_FMT = "[%(levelname)s] %(asctime)sZ %(name)s :: %(message)s"
_DATE_FMT = "%Y-%m-%dT%H:%M:%S"

_configured: bool = False


class _UtcFormatter(logging.Formatter):
    """Formatter that renders ``asctime`` in UTC."""

    converter = time.gmtime


class _ColorFormatter(_UtcFormatter):
    """UTC formatter that wraps ``[LEVEL]`` in ANSI color codes."""

    def format(self, record: logging.LogRecord) -> str:
        rendered = super().format(record)
        color = _ANSI.get(record.levelname)
        if color is None:
            return rendered
        token = f"[{record.levelname}]"
        return rendered.replace(token, f"{color}{token}{_ANSI_RESET}", 1)


def _color_enabled() -> bool:
    if os.environ.get("NO_COLOR"):
        return False
    return sys.stdout.isatty()


def configure_root_logger(*, level: str = "INFO", log_file: Path) -> None:
    """Wire the stream and rotating-file handlers to the root logger.

    Idempotent: a second call replaces the handlers so tests can reconfigure
    cleanly.

    Args:
        level: Threshold for both sinks; one of DEBUG/INFO/WARNING/ERROR/CRITICAL.
        log_file: Path to the rotating log file. Parent directories must exist.
    """

    global _configured

    root = logging.getLogger()
    for handler in list(root.handlers):
        root.removeHandler(handler)

    root.setLevel(level.upper())

    plain = _UtcFormatter(_LOG_FMT, datefmt=_DATE_FMT)
    colored = _ColorFormatter(_LOG_FMT, datefmt=_DATE_FMT) if _color_enabled() else plain

    stream = logging.StreamHandler(stream=sys.stdout)
    stream.setFormatter(colored)
    root.addHandler(stream)

    log_file.parent.mkdir(parents=True, exist_ok=True)
    rotating = logging.handlers.RotatingFileHandler(
        log_file,
        maxBytes=10_000_000,
        backupCount=5,
        encoding="utf-8",
    )
    rotating.setFormatter(plain)
    root.addHandler(rotating)

    _configured = True


def get_logger(name: str) -> logging.Logger:
    """Return a named logger bound to the configured root handlers.

    Args:
        name: Dotted logger name, e.g. ``sp_graph_api.graph_loader``.

    Returns:
        A standard :class:`logging.Logger` instance.
    """

    return logging.getLogger(name)
