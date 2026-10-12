/**
 * Schema migrations, tracked with PRAGMA user_version.
 * Calendar-only dates are TEXT 'YYYY-MM-DD'; timed data stores wall times +
 * IANA zone + explicit next-day flag; unknown durations are NULL.
 */
import type { SqlDriver } from './driver';

const TIMING_STATES = "'date_only','start_only','interval','duration_only','start_duration'";

export const MIGRATIONS: string[] = [
  // v1
  `
  CREATE TABLE categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    color TEXT NOT NULL,
    pattern TEXT NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX categories_name_ci ON categories(name COLLATE NOCASE);

  CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
    date TEXT NOT NULL CHECK (date GLOB '[0-9][0-9][0-9][0-9]-[0-1][0-9]-[0-3][0-9]'),
    timing_state TEXT NOT NULL DEFAULT 'date_only' CHECK (timing_state IN (${TIMING_STATES})),
    start_time TEXT,
    end_time TEXT,
    end_day_offset INTEGER NOT NULL DEFAULT 0 CHECK (end_day_offset IN (0, 1)),
    time_zone TEXT,
    declared_sec INTEGER CHECK (declared_sec IS NULL OR declared_sec > 0),
    duration_sec INTEGER CHECK (duration_sec IS NULL OR duration_sec > 0),
    duration_source TEXT CHECK (duration_source IS NULL OR duration_source IN ('interval', 'declared')),
    place_label TEXT,
    place_address TEXT,
    map_url TEXT,
    lat REAL,
    lng REAL,
    place_resolution TEXT NOT NULL DEFAULT 'none',
    place_note TEXT,
    notes TEXT,
    origin TEXT NOT NULL DEFAULT 'manual' CHECK (origin IN ('manual', 'import')),
    save_request_id TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL,
    CHECK ((duration_sec IS NULL) = (duration_source IS NULL))
  );
  CREATE INDEX sessions_category_date ON sessions(category_id, date);
  CREATE INDEX sessions_date ON sessions(date);
  CREATE UNIQUE INDEX sessions_save_request ON sessions(save_request_id, category_id, date) WHERE save_request_id IS NOT NULL;

  CREATE TABLE settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE import_provenance (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    account_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    recurring_event_id TEXT,
    occurrence_key TEXT NOT NULL DEFAULT '',
    original_title TEXT NOT NULL,
    source_all_day INTEGER NOT NULL,
    source_start TEXT NOT NULL,
    source_end TEXT NOT NULL,
    import_batch_id TEXT NOT NULL,
    imported_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX import_provenance_event ON import_provenance(provider, account_id, calendar_id, external_event_id, occurrence_key);
  CREATE INDEX import_provenance_session ON import_provenance(session_id);

  CREATE TABLE export_links (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id) ON DELETE SET NULL,
    provider TEXT NOT NULL,
    account_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    external_event_id TEXT NOT NULL,
    occurrence_key TEXT,
    status TEXT NOT NULL CHECK (status IN ('created', 'linked', 'updated')),
    op_id TEXT NOT NULL,
    snapshot TEXT NOT NULL,
    exported_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX export_links_op ON export_links(op_id);
  CREATE INDEX export_links_session ON export_links(session_id);
  CREATE INDEX export_links_event ON export_links(provider, account_id, calendar_id, external_event_id);

  CREATE TABLE export_jobs (
    id TEXT PRIMARY KEY,
    op_id TEXT NOT NULL,
    session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
    provider TEXT NOT NULL,
    account_id TEXT NOT NULL,
    calendar_id TEXT NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('auto', 'manual')),
    status TEXT NOT NULL CHECK (status IN ('pending', 'running', 'succeeded', 'failed', 'uncertain', 'needs_review', 'cancelled')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    review_reason TEXT,
    next_attempt_at TEXT,
    payload TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE UNIQUE INDEX export_jobs_open_op ON export_jobs(op_id) WHERE status IN ('pending', 'running', 'failed', 'uncertain', 'needs_review');
  CREATE INDEX export_jobs_status ON export_jobs(status, next_attempt_at);
  `,
  // v2: additive only; sessions, exchange records and settings retain their ids.
  `
  CREATE TABLE category_drafts (
    category_id TEXT PRIMARY KEY REFERENCES categories(id) ON DELETE CASCADE,
    dates TEXT NOT NULL,
    details TEXT,
    request_id TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE named_periods (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 80),
    start_date TEXT NOT NULL,
    end_date TEXT NOT NULL CHECK (end_date >= start_date),
    scope TEXT NOT NULL CHECK (scope IN ('all', 'selected')),
    note TEXT,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
  CREATE INDEX named_periods_dates ON named_periods(start_date, end_date);

  CREATE TABLE named_period_categories (
    period_id TEXT NOT NULL REFERENCES named_periods(id) ON DELETE CASCADE,
    category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
    PRIMARY KEY (period_id, category_id)
  );
  CREATE INDEX named_period_categories_category ON named_period_categories(category_id);
  `,
];

export async function migrate(db: SqlDriver): Promise<number> {
  const row = await db.first<{ user_version: number }>('PRAGMA user_version');
  let v = row?.user_version ?? 0;
  for (; v < MIGRATIONS.length; v++) {
    const next = v + 1;
    await db.transaction(async (tx) => {
      await tx.exec(MIGRATIONS[v]);
      await tx.exec(`PRAGMA user_version = ${next}`);
    });
  }
  return v;
}
