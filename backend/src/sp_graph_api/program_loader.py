"""CSV-backed loader for the Magic program → SP mapping.

Reads ``ProgramasMagic_SP_ADMINISTRATIVO.csv``, normalizes SP names
(strips leading ``DBO.``/``dbo.`` prefix), deduplicates rows, and builds
the :class:`~sp_graph_api.schemas.ProgramData` payload served at
``GET /api/programs``.

Caching strategy mirrors :class:`~sp_graph_api.graph_loader.GraphLoader`:
the parsed payload is held in memory and only rebuilt when the file's
mtime changes.
"""

from __future__ import annotations

import csv
import threading
from collections import defaultdict
from pathlib import Path

from .logger import get_logger
from .schemas import ProgramData, ProgramEntry

_log = get_logger(__name__)

_DBO_PREFIX = "dbo."


def _normalize_sp(raw: str) -> str:
    """Strip an optional ``DBO.``/``dbo.`` schema prefix from a SP name."""
    stripped = raw.strip()
    if stripped.lower().startswith(_DBO_PREFIX):
        return stripped[len(_DBO_PREFIX):]
    return stripped


class ProgramLoadError(Exception):
    """Raised on fatal CSV-file errors."""

    def __init__(self, code: str, message: str) -> None:
        super().__init__(message)
        self.code = code
        self.message = message


class ProgramLoader:
    """Reads, normalizes, and caches the program→SP mapping from the CSV."""

    def __init__(self, csv_path: Path) -> None:
        self._path = csv_path
        self._lock = threading.Lock()
        self._cache_mtime: float | None = None
        self._cache_payload: ProgramData | None = None

    @property
    def csv_path(self) -> Path:
        """The configured path to the CSV file."""
        return self._path

    def load(self) -> ProgramData:
        """Return the parsed :class:`ProgramData`, re-reading on mtime change.

        Returns:
            Cached or freshly-built payload.

        Raises:
            ProgramLoadError: when the file is missing or malformed.
        """
        with self._lock:
            try:
                stat = self._path.stat()
            except FileNotFoundError as exc:
                raise ProgramLoadError(
                    "data_file_unreadable",
                    f"Programs CSV not found at {self._path}",
                ) from exc
            except OSError as exc:
                raise ProgramLoadError(
                    "data_file_unreadable",
                    f"Could not stat programs CSV: {exc}",
                ) from exc

            if self._cache_payload is not None and self._cache_mtime == stat.st_mtime:
                return self._cache_payload

            _log.info("Reading programs CSV: %s", self._path)
            payload = self._build(stat.st_mtime)
            self._cache_payload = payload
            self._cache_mtime = stat.st_mtime
            return payload

    def _build(self, _mtime: float) -> ProgramData:
        """Parse the CSV and build a :class:`ProgramData`."""
        try:
            text = self._path.read_text(encoding="utf-8")
        except OSError as exc:
            raise ProgramLoadError(
                "data_file_unreadable",
                f"Could not read programs CSV: {exc}",
            ) from exc

        # num → (name, set of normalized sp_ids)
        program_sps: dict[int, tuple[str, set[str]]] = {}
        seen_pairs: set[tuple[int, str]] = set()

        try:
            reader = csv.DictReader(
                text.splitlines(),
                fieldnames=["num", "name", "sp"],
            )
            next(reader)  # skip header row
            for row in reader:
                raw_num = (row.get("num") or "").strip()
                name = (row.get("name") or "").strip()
                sp_raw = (row.get("sp") or "").strip()

                if not raw_num or not name or not sp_raw:
                    continue
                try:
                    num = int(raw_num)
                except ValueError:
                    continue

                sp_norm = _normalize_sp(sp_raw)
                if not sp_norm:
                    continue

                pair = (num, sp_norm)
                if pair in seen_pairs:
                    continue
                seen_pairs.add(pair)

                if num not in program_sps:
                    program_sps[num] = (name, set())
                program_sps[num][1].add(sp_norm)

        except csv.Error as exc:
            raise ProgramLoadError(
                "data_file_unparseable",
                f"Could not parse programs CSV: {exc}",
            ) from exc

        programs: list[ProgramEntry] = []
        sp_to_programs: dict[str, list[int]] = defaultdict(list)

        for num in sorted(program_sps):
            name, sp_set = program_sps[num]
            sp_ids = sorted(sp_set)
            programs.append(ProgramEntry(num=num, name=name, sp_ids=sp_ids))
            for sp_id in sp_ids:
                sp_to_programs[sp_id].append(num)

        _log.info(
            "Built program map: %d programs, %d unique SPs",
            len(programs),
            len(sp_to_programs),
        )

        return ProgramData(
            programs=programs,
            sp_to_programs=dict(sp_to_programs),
        )
