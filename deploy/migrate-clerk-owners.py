"""Remap application ownership after provisioning replacement Clerk accounts.

Stop the app first. The account map is private and must not be committed.
The script defaults to a read-only preview; use --apply after taking a backup.
"""
import argparse
import hashlib
import json
import sqlite3
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("state", type=Path)
parser.add_argument("account_map", type=Path)
parser.add_argument("--apply", action="store_true")
args = parser.parse_args()
mapping = json.loads(args.account_map.read_text())
if not isinstance(mapping, dict) or not mapping:
    raise ValueError("Account mapping is empty")
if any(not isinstance(value, str) or not value.startswith("user_")
       for pair in mapping.items() for value in pair):
    raise ValueError("Invalid Clerk user ID")
if len(set(mapping.values())) != len(mapping) or set(mapping) & set(mapping.values()):
    raise ValueError("Account mapping is ambiguous")

databases = []
for file in (args.state / "d1").rglob("*.sqlite"):
    with sqlite3.connect(f"file:{file.resolve()}?mode=ro", uri=True) as db:
        if db.execute("SELECT name FROM sqlite_master WHERE name='projects'").fetchone():
            databases.append(file)
if len(databases) != 1:
    raise ValueError("Expected one application database")

mode = "rw" if args.apply else "ro"
with sqlite3.connect(f"file:{databases[0].resolve()}?mode={mode}", uri=True) as db:
    if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
        raise ValueError("Database integrity check failed")
    valid_ids = set(mapping) | set(mapping.values())
    owners = {row[0] for row in db.execute("SELECT DISTINCT owner FROM projects")}
    uploaders = {row[0] for row in db.execute("SELECT DISTINCT user FROM uploads")}
    if (owners | uploaders) - valid_ids:
        raise ValueError("Missing production mapping for an existing owner/uploader")
    rows = db.execute("SELECT * FROM documents ORDER BY id").fetchall()
    digest = hashlib.sha256(json.dumps(rows, sort_keys=True).encode()).hexdigest()
    report = {"accounts": len(mapping), "projects": db.execute("SELECT count(*) FROM projects").fetchone()[0],
              "documents": len(rows), "document_sha256": digest, "applied": args.apply}
    if args.apply:
        db.execute("BEGIN IMMEDIATE")
        report["projects_remapped"] = 0
        report["uploads_remapped"] = 0
        for old, new in mapping.items():
            report["projects_remapped"] += db.execute("UPDATE projects SET owner=? WHERE owner=?", (new, old)).rowcount
            report["uploads_remapped"] += db.execute("UPDATE uploads SET user=? WHERE user=?", (new, old)).rowcount
        after = db.execute("SELECT * FROM documents ORDER BY id").fetchall()
        if after != rows:
            raise ValueError("Document data changed during ownership migration")
print(json.dumps(report))
