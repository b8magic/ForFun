#!/usr/bin/env python3
"""Native smoke-test fixture only: reconstruct v1 and compare its original rows.

Called with the installed app stopped, after Maestro 01 clearState generated its
three sessions. Never searches outside that app's simulator data container.
"""
import argparse
import datetime
import json
import os
from pathlib import Path
import sqlite3
import sys

ORIGINAL_TABLES = (
    "categories", "sessions", "settings", "import_provenance", "export_links", "export_jobs",
)
V2_TABLES = ("named_period_categories", "named_periods", "category_drafts")


def write_json(path, data):
    path.write_text(json.dumps(data, indent=2, sort_keys=True) + "\n")


def connect(path, timeout=5):
    # mode=rw prevents a missing path from becoming a new empty database.
    db = sqlite3.connect(path.as_uri() + "?mode=rw", uri=True, timeout=timeout)
    db.row_factory = sqlite3.Row
    db.execute("PRAGMA foreign_keys=ON")
    return db


def snapshot(db):
    return {
        table: [dict(row) for row in db.execute(f'SELECT * FROM "{table}" ORDER BY rowid')]
        for table in ORIGINAL_TABLES
    }


def prepare(args):
    container = Path(args.container).resolve(strict=True)
    candidates = [path.resolve() for path in container.rglob("serie.db") if path.is_file()]
    if len(candidates) != 1:
        raise RuntimeError(f"Expected one serie.db in own simulator app container, found {len(candidates)}")
    path = candidates[0]
    if container not in path.parents:
        raise RuntimeError("Database path escaped the own simulator app container")
    out = Path(args.out).resolve()
    out.mkdir(parents=True, exist_ok=True)
    (out / "native-upgrade.json").unlink(missing_ok=True)
    with connect(path) as db:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        if version != 2:
            raise RuntimeError(f"Expected current schema v2, found v{version}")
        checkpoint = tuple(db.execute("PRAGMA wal_checkpoint(TRUNCATE)").fetchone())
        if checkpoint[0]:
            raise RuntimeError("Database WAL remained busy after stopping the fixture app")
        before = snapshot(db)
        # Refuse any unexpected database, even within this app's own container.
        names = {category["name"] for category in before["categories"]}
        allowed_dates = {args.previous_month + "-10", args.previous_month + "-12"}
        if names != {"Surf", "Corsa", "Allenamento", "Viaggio"}:
            raise RuntimeError("Upgrade test requires the fresh Maestro 01 starter activities")
        if len(before["sessions"]) != 3 or any(
            session["date"] not in allowed_dates or session["origin"] != "manual"
            for session in before["sessions"]
        ):
            raise RuntimeError("Upgrade test requires exactly Maestro 01's three historical manual sessions")
        for table in V2_TABLES:
            if db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]:
                raise RuntimeError(f"Upgrade fixture must have no pending draft or period rows ({table})")
        write_json(out / "native-upgrade-before.json", before)
        # Only additive v2 tables are removed, in foreign-key child-first order.
        db.execute("BEGIN IMMEDIATE")
        try:
            for table in V2_TABLES:
                db.execute(f'DROP TABLE "{table}"')
            db.execute("PRAGMA user_version=1")
            if snapshot(db) != before:
                raise RuntimeError("Reconstructing v1 changed an original row")
            db.commit()
        except BaseException:
            db.rollback()
            raise
        db.execute("PRAGMA wal_checkpoint(TRUNCATE)")
    write_json(out / "native-upgrade-fixture.json", {
        "databasePath": str(path), "dataContainer": str(container),
        "sourceCommit": args.source_commit, "bundleId": args.bundle,
        "previousMonth": args.previous_month, "reconstructedVersion": 1,
        "originalRows": {table: len(rows) for table, rows in before.items()},
    })
    print("Own Maestro fixture reconstructed as v1; every original row is unchanged")


def fixture(args):
    out = Path(args.out).resolve()
    metadata = json.loads((out / "native-upgrade-fixture.json").read_text())
    return out, metadata, Path(metadata["databasePath"])


def status(args):
    _, _, path = fixture(args)
    with connect(path, timeout=0.05) as db:
        if db.execute("PRAGMA user_version").fetchone()[0] != 2:
            return False
        tables = {row["name"] for row in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        return set(V2_TABLES).issubset(tables)


def verify(args):
    out, metadata, path = fixture(args)
    (out / "native-upgrade.json").unlink(missing_ok=True)
    before = json.loads((out / "native-upgrade-before.json").read_text())
    with connect(path) as db:
        version = db.execute("PRAGMA user_version").fetchone()[0]
        after = snapshot(db)
        write_json(out / "native-upgrade-after.json", after)
        if version != 2:
            raise RuntimeError(f"Native application did not migrate to v2 (found v{version})")
        if after != before:
            changed = [table for table in ORIGINAL_TABLES if after[table] != before[table]]
            raise RuntimeError(f"Native upgrade changed original rows: {', '.join(changed)}")
        if db.execute("PRAGMA foreign_key_check").fetchall():
            raise RuntimeError("Native upgrade left broken foreign keys")
        if db.execute("PRAGMA integrity_check").fetchone()[0] != "ok":
            raise RuntimeError("Native upgrade failed SQLite integrity_check")
        for table in V2_TABLES:
            if db.execute(f'SELECT count(*) FROM "{table}"').fetchone()[0]:
                raise RuntimeError(f"Migrated fixture unexpectedly contains {table} rows")
    write_json(out / "native-upgrade.json", {
        **metadata, "passed": True, "migratedVersion": version,
        "verifiedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "comparedTables": list(ORIGINAL_TABLES),
        "foreignKeys": "valid", "integrity": "ok",
    })
    print("Native v1 → v2: every original row and identifier unchanged; foreign keys and integrity valid")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("mode", choices=("prepare", "status", "verify"))
    parser.add_argument("--out", required=True)
    parser.add_argument("--container")
    parser.add_argument("--previous-month")
    parser.add_argument("--source-commit", default=os.environ.get("GITHUB_SHA", "local"))
    parser.add_argument("--bundle", default="app.serie.ios")
    args = parser.parse_args()
    try:
        if args.mode == "prepare":
            if not args.container or not args.previous_month:
                parser.error("prepare requires --container and --previous-month")
            prepare(args)
        elif args.mode == "status":
            return 0 if status(args) else 1
        else:
            verify(args)
    except (OSError, sqlite3.Error, ValueError, RuntimeError) as error:
        if args.mode != "status":
            print(f"Native upgrade check failed: {error}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
