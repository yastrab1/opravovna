"""Read-only migration audit. Run against a stopped application's data folder."""
import hashlib
import json
import sqlite3
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
result = {"tables": {}, "r2": {}}
databases = []
for file in (root / "d1").rglob("*.sqlite"):
    with sqlite3.connect(f"file:{file}?mode=ro", uri=True) as connection:
        if not connection.execute("SELECT name FROM sqlite_master WHERE name='projects'").fetchone():
            continue
        databases.append(file)
        integrity = connection.execute("PRAGMA integrity_check").fetchone()[0]
        if integrity != "ok":
            raise RuntimeError(f"SQLite integrity check failed: {integrity}")
        for table in ["projects", "documents", "members", "uploads"]:
            rows = connection.execute("SELECT * FROM " + table + " ORDER BY id").fetchall()
            result["tables"][table] = {
                "count": len(rows),
                "sha256": hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest(),
            }
if len(databases) != 1:
    raise RuntimeError(f"Expected one application database, found {len(databases)}")
for file in sorted((root / "r2").rglob("*")):
    if not file.is_file() or file.name.endswith(("-shm", "-wal")):
        continue
    digest = hashlib.sha256()
    with file.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    result["r2"][str(file.relative_to(root))] = digest.hexdigest()
print(json.dumps(result, sort_keys=True, indent=2))
