"""
Small helpers for the JSON files the admin page edits.

Writes are atomic (a temporary file is written, then swapped in), so a
crash half-way never leaves a broken file, and the previous version of
every file is copied to storage/backups/ first, so any admin edit can be
undone by copying a backup back.
"""

import json
import shutil
import threading
import time
from pathlib import Path

import config

_lock = threading.RLock()
BACKUP_DIR = config.STORAGE_DIR / "backups"
KEEP_BACKUPS = 30  # per file


def read_json(path: Path, default=None):
    try:
        return json.loads(Path(path).read_text(encoding="utf-8"))
    except FileNotFoundError:
        return default
    except json.JSONDecodeError:
        # A file edited by hand with a typo: keep the site running.
        return default


def write_json(path: Path, data, backup=True):
    path = Path(path)
    with _lock:
        path.parent.mkdir(parents=True, exist_ok=True)
        if backup and path.exists():
            BACKUP_DIR.mkdir(parents=True, exist_ok=True)
            stamp = time.strftime("%Y%m%d-%H%M%S")
            shutil.copy2(path, BACKUP_DIR / f"{path.stem}.{stamp}{path.suffix}")
            old = sorted(BACKUP_DIR.glob(f"{path.stem}.*{path.suffix}"))
            for p in old[:-KEEP_BACKUPS]:
                p.unlink(missing_ok=True)
        tmp = path.with_suffix(path.suffix + ".tmp")
        tmp.write_text(json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8")
        tmp.replace(path)


def backups(stem: str):
    if not BACKUP_DIR.exists():
        return []
    return [p.name for p in sorted(BACKUP_DIR.glob(f"{stem}.*"), reverse=True)]


def locked():
    return _lock
