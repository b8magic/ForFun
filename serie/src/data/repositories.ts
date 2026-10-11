/**
 * Repositories: the only code that writes SQL. Every multi-row write is one
 * transaction. Inputs are validated against domain rules before they touch
 * the database, and rows are normalized on the way out.
 */
import type { SqlDriver, SqlExecutor, SqlParam } from './driver';
import type {
  Category,
  ExportJob,
  ExportJobStatus,
  ExportLink,
  ExportSnapshot,
  ID,
  ImportProvenance,
  LocalDate,
  PatternKind,
  Place,
  ProviderKind,
  Session,
  SessionDetailsDraft,
  Timing,
} from '@/domain/types';
import { isLocalDate } from '@/domain/dates';
import { DATE_ONLY, normalizeTiming } from '@/domain/timing';

export interface Deps {
  newId: () => string;
  now: () => string; // ISO instant
}

export class DomainError extends Error {
  constructor(public code: string, message?: string) {
    super(message ?? code);
  }
}

// ─── row mapping ─────────────────────────────────────────────────────────────

interface SessionRow {
  id: string;
  category_id: string;
  date: string;
  timing_state: string;
  start_time: string | null;
  end_time: string | null;
  end_day_offset: number;
  time_zone: string | null;
  declared_sec: number | null;
  duration_sec: number | null;
  duration_source: string | null;
  place_label: string | null;
  place_address: string | null;
  map_url: string | null;
  lat: number | null;
  lng: number | null;
  place_resolution: string;
  place_note: string | null;
  notes: string | null;
  origin: string;
  save_request_id: string | null;
  created_at: string;
  updated_at: string;
}

export function sessionFromRow(r: SessionRow): Session {
  const timing = normalizeTiming(r.date, {
    state: r.timing_state as Timing['state'],
    start: r.start_time,
    end: r.end_time,
    endDayOffset: r.end_day_offset === 1 ? 1 : 0,
    timeZone: r.time_zone,
    declaredSec: r.declared_sec,
    durationSec: r.duration_sec,
    durationSource: r.duration_source as Timing['durationSource'],
  });
  const hasPlace = r.place_label || r.place_address || r.map_url || r.lat != null;
  return {
    id: r.id,
    categoryId: r.category_id,
    date: r.date,
    timing,
    place: hasPlace
      ? {
          label: r.place_label,
          address: r.place_address,
          mapUrl: r.map_url,
          coords: r.lat != null && r.lng != null ? { lat: r.lat, lng: r.lng } : null,
          resolution: (r.place_resolution as Place['resolution']) ?? 'none',
          resolutionNote: r.place_note,
        }
      : null,
    notes: r.notes,
    origin: r.origin === 'import' ? 'import' : 'manual',
    saveRequestId: r.save_request_id,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

const clean = (s: string | null | undefined): string | null => {
  if (s == null) return null;
  const t = s.trim();
  return t.length ? t : null;
};

function normalizePlace(p: Place | null | undefined): Place | null {
  if (!p) return null;
  const place: Place = {
    label: clean(p.label),
    address: clean(p.address),
    mapUrl: clean(p.mapUrl),
    coords: p.coords && Number.isFinite(p.coords.lat) && Number.isFinite(p.coords.lng) && Math.abs(p.coords.lat) <= 90 && Math.abs(p.coords.lng) <= 180 ? p.coords : null,
    resolution: p.resolution,
    resolutionNote: clean(p.resolutionNote),
  };
  if (!place.label && !place.address && !place.mapUrl && !place.coords) return null;
  if (!place.mapUrl && place.resolution !== 'manual') place.resolution = place.coords ? 'manual' : 'none';
  return place;
}

function sessionParams(s: Session): SqlParam[] {
  const t = s.timing;
  const p = s.place;
  return [
    s.id, s.categoryId, s.date, t.state, t.start, t.end, t.endDayOffset, t.timeZone, t.declaredSec, t.durationSec, t.durationSource,
    p?.label ?? null, p?.address ?? null, p?.mapUrl ?? null, p?.coords?.lat ?? null, p?.coords?.lng ?? null, p?.resolution ?? 'none', p?.resolutionNote ?? null,
    clean(s.notes), s.origin, s.saveRequestId, s.createdAt, s.updatedAt,
  ];
}

const SESSION_COLS =
  'id, category_id, date, timing_state, start_time, end_time, end_day_offset, time_zone, declared_sec, duration_sec, duration_source, place_label, place_address, map_url, lat, lng, place_resolution, place_note, notes, origin, save_request_id, created_at, updated_at';
const SESSION_PLACEHOLDERS = SESSION_COLS.split(',').map(() => '?').join(', ');

interface CategoryRow {
  id: string;
  name: string;
  color: string;
  pattern: string;
  sort_order: number;
  created_at: string;
  updated_at: string;
}
const categoryFromRow = (r: CategoryRow): Category => ({
  id: r.id,
  name: r.name,
  color: r.color,
  pattern: r.pattern as PatternKind,
  sortOrder: r.sort_order,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

// ─── categories ──────────────────────────────────────────────────────────────

export type DeleteStrategy = { kind: 'move'; toCategoryId: ID } | { kind: 'delete_sessions' };

export function categoriesRepo(db: SqlDriver, deps: Deps) {
  async function assertName(ex: SqlExecutor, name: string, exceptId?: string) {
    const n = name.trim();
    if (!n) throw new DomainError('name_required');
    if (n.length > 40) throw new DomainError('name_too_long');
    const dup = await ex.first<{ id: string }>('SELECT id FROM categories WHERE name = ? COLLATE NOCASE AND id != ?', [n, exceptId ?? '']);
    if (dup) throw new DomainError('name_taken');
    return n;
  }
  return {
    async list(): Promise<Category[]> {
      return (await db.all<CategoryRow>('SELECT * FROM categories ORDER BY sort_order, created_at')).map(categoryFromRow);
    },
    async get(id: ID): Promise<Category | null> {
      const r = await db.first<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
      return r ? categoryFromRow(r) : null;
    },
    async create(input: { name: string; color: string; pattern: PatternKind }): Promise<Category> {
      return db.transaction(async (tx) => {
        const name = await assertName(tx, input.name);
        const max = await tx.first<{ m: number | null }>('SELECT MAX(sort_order) AS m FROM categories');
        const now = deps.now();
        const c: Category = { id: deps.newId(), name, color: input.color, pattern: input.pattern, sortOrder: (max?.m ?? -1) + 1, createdAt: now, updatedAt: now };
        await tx.run('INSERT INTO categories (id, name, color, pattern, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)', [c.id, c.name, c.color, c.pattern, c.sortOrder, c.createdAt, c.updatedAt]);
        return c;
      });
    },
    async update(id: ID, patch: { name?: string; color?: string; pattern?: PatternKind }): Promise<Category> {
      return db.transaction(async (tx) => {
        const cur = await tx.first<CategoryRow>('SELECT * FROM categories WHERE id = ?', [id]);
        if (!cur) throw new DomainError('category_missing');
        const name = patch.name !== undefined ? await assertName(tx, patch.name, id) : cur.name;
        const now = deps.now();
        await tx.run('UPDATE categories SET name = ?, color = ?, pattern = ?, updated_at = ? WHERE id = ?', [name, patch.color ?? cur.color, patch.pattern ?? cur.pattern, now, id]);
        return categoryFromRow({ ...cur, name, color: patch.color ?? cur.color, pattern: patch.pattern ?? cur.pattern, updated_at: now });
      });
    },
    async reorder(ids: ID[]): Promise<void> {
      await db.transaction(async (tx) => {
        for (let i = 0; i < ids.length; i++) await tx.run('UPDATE categories SET sort_order = ? WHERE id = ?', [i, ids[i]]);
      });
    },
    async sessionCount(id: ID): Promise<number> {
      return (await db.first<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE category_id = ?', [id]))?.n ?? 0;
    },
    /** Deleting an activity with sessions requires an explicit strategy. */
    async remove(id: ID, strategy?: DeleteStrategy): Promise<{ movedOrDeleted: number }> {
      return db.transaction(async (tx) => {
        const n = (await tx.first<{ n: number }>('SELECT COUNT(*) AS n FROM sessions WHERE category_id = ?', [id]))?.n ?? 0;
        if (n > 0 && !strategy) throw new DomainError('category_has_sessions');
        if (n > 0 && strategy?.kind === 'move') {
          if (strategy.toCategoryId === id) throw new DomainError('move_to_same');
          const target = await tx.first('SELECT id FROM categories WHERE id = ?', [strategy.toCategoryId]);
          if (!target) throw new DomainError('category_missing');
          // moved sessions leave their creating tap behind (see sessions.update): no unique-index collision with the target's own sessions
          await tx.run('UPDATE sessions SET category_id = ?, save_request_id = NULL, updated_at = ? WHERE category_id = ?', [strategy.toCategoryId, deps.now(), id]);
        } else if (n > 0 && strategy?.kind === 'delete_sessions') {
          await tx.run('DELETE FROM sessions WHERE category_id = ?', [id]);
        }
        const r = await tx.run('DELETE FROM categories WHERE id = ?', [id]);
        if (r.changes === 0) throw new DomainError('category_missing');
        return { movedOrDeleted: n };
      });
    },
  };
}

// ─── sessions ────────────────────────────────────────────────────────────────

export interface SaveBatchInput {
  categoryId: ID;
  dates: LocalDate[];
  /** One id per Save tap. Re-delivering the same id never duplicates sessions. */
  requestId: string;
  /** Details applied explicitly to every session of the batch (each copy stays independent). */
  shared?: SessionDetailsDraft;
  /** Per-date details, applied on top of `shared`. */
  perDate?: Record<LocalDate, SessionDetailsDraft>;
  origin?: 'manual' | 'import';
}

export interface SessionPatch {
  date?: LocalDate;
  categoryId?: ID;
  timing?: Timing;
  place?: Place | null;
  notes?: string | null;
}

export function sessionsRepo(db: SqlDriver, deps: Deps) {
  const insert = (ex: SqlExecutor, s: Session) => ex.run(`INSERT INTO sessions (${SESSION_COLS}) VALUES (${SESSION_PLACEHOLDERS}) ON CONFLICT DO NOTHING`, sessionParams(s));

  return {
    async listAll(): Promise<Session[]> {
      return (await db.all<SessionRow>('SELECT * FROM sessions ORDER BY date, created_at')).map(sessionFromRow);
    },
    async listByCategory(categoryId: ID): Promise<Session[]> {
      return (await db.all<SessionRow>('SELECT * FROM sessions WHERE category_id = ? ORDER BY date, created_at', [categoryId])).map(sessionFromRow);
    },
    async get(id: ID): Promise<Session | null> {
      const r = await db.first<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
      return r ? sessionFromRow(r) : null;
    },
    /**
     * Commit a logging batch atomically. Returns the sessions for this request
     * (newly created or already present from an earlier delivery of the same request).
     */
    async saveBatch(input: SaveBatchInput): Promise<{ sessions: Session[]; created: number }> {
      const dates = [...new Set(input.dates)].sort();
      if (!dates.length) throw new DomainError('no_dates');
      for (const d of dates) if (!isLocalDate(d)) throw new DomainError('invalid_date', d);
      if (!input.requestId) throw new DomainError('request_id_required');
      return db.transaction(async (tx) => {
        const cat = await tx.first('SELECT id FROM categories WHERE id = ?', [input.categoryId]);
        if (!cat) throw new DomainError('category_missing');
        let created = 0;
        const now = deps.now();
        for (const date of dates) {
          const d = { ...(input.shared ?? {}), ...(input.perDate?.[date] ?? {}) };
          const s: Session = {
            id: deps.newId(),
            categoryId: input.categoryId,
            date,
            timing: normalizeTiming(date, d.timing ?? DATE_ONLY),
            place: normalizePlace(d.place),
            notes: clean(d.notes ?? null),
            origin: input.origin ?? 'manual',
            saveRequestId: input.requestId,
            createdAt: now,
            updatedAt: now,
          };
          const r = await insert(tx, s);
          created += r.changes;
        }
        const rows = await tx.all<SessionRow>(
          `SELECT * FROM sessions WHERE save_request_id = ? AND category_id = ? AND date IN (${dates.map(() => '?').join(',')}) ORDER BY date`,
          [input.requestId, input.categoryId, ...dates],
        );
        return { sessions: rows.map(sessionFromRow), created };
      });
    },
    /** Insert fully-formed sessions (used by import, inside its own transaction). */
    async insertMany(ex: SqlExecutor, sessions: Session[]): Promise<number> {
      let n = 0;
      for (const s of sessions) n += (await insert(ex, { ...s, timing: normalizeTiming(s.date, s.timing), place: normalizePlace(s.place), notes: clean(s.notes) })).changes;
      return n;
    },
    async update(id: ID, patch: SessionPatch): Promise<Session> {
      return db.transaction(async (tx) => {
        const row = await tx.first<SessionRow>('SELECT * FROM sessions WHERE id = ?', [id]);
        if (!row) throw new DomainError('session_missing');
        const cur = sessionFromRow(row);
        const date = patch.date ?? cur.date;
        if (!isLocalDate(date)) throw new DomainError('invalid_date', date);
        const categoryId = patch.categoryId ?? cur.categoryId;
        if (patch.categoryId) {
          const cat = await tx.first('SELECT id FROM categories WHERE id = ?', [categoryId]);
          if (!cat) throw new DomainError('category_missing');
        }
        // Timing is re-derived for the (possibly new) date so DST-dependent durations stay correct.
        const timing = normalizeTiming(date, patch.timing ?? cur.timing);
        const next: Session = {
          ...cur,
          date,
          categoryId,
          timing,
          place: patch.place !== undefined ? normalizePlace(patch.place) : cur.place,
          notes: patch.notes !== undefined ? clean(patch.notes) : cur.notes,
          updatedAt: deps.now(),
        };
        // The save request id only guards the creating tap against double delivery. Once a session
        // moves to another date or activity it must not collide with its siblings from that tap.
        if (date !== cur.date || categoryId !== cur.categoryId) {
          await tx.run('UPDATE sessions SET save_request_id = NULL WHERE id = ?', [id]);
          next.saveRequestId = null;
        }
        const p = sessionParams(next);
        await tx.run(
          `UPDATE sessions SET category_id = ?, date = ?, timing_state = ?, start_time = ?, end_time = ?, end_day_offset = ?, time_zone = ?, declared_sec = ?, duration_sec = ?, duration_source = ?, place_label = ?, place_address = ?, map_url = ?, lat = ?, lng = ?, place_resolution = ?, place_note = ?, notes = ?, updated_at = ? WHERE id = ?`,
          [...p.slice(1, 19), next.updatedAt, id],
        );
        return next;
      });
    },
    /** Deletes the session. Calendar events are never touched; links keep their record. */
    async remove(ids: ID[]): Promise<number> {
      if (!ids.length) return 0;
      return db.transaction(async (tx) => {
        const r = await tx.run(`DELETE FROM sessions WHERE id IN (${ids.map(() => '?').join(',')})`, ids);
        return r.changes;
      });
    },
  };
}

// ─── settings ────────────────────────────────────────────────────────────────

export function settingsRepo(db: SqlDriver) {
  return {
    async get<T>(key: string, fallback: T): Promise<T> {
      const r = await db.first<{ value: string }>('SELECT value FROM settings WHERE key = ?', [key]);
      if (!r) return fallback;
      try {
        return JSON.parse(r.value) as T;
      } catch {
        return fallback;
      }
    },
    async set<T>(key: string, value: T): Promise<void> {
      await db.run('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', [key, JSON.stringify(value)]);
    },
    async remove(key: string): Promise<void> {
      await db.run('DELETE FROM settings WHERE key = ?', [key]);
    },
  };
}

// ─── import provenance ───────────────────────────────────────────────────────

interface ProvRow {
  id: string;
  session_id: string | null;
  provider: string;
  account_id: string;
  calendar_id: string;
  external_event_id: string;
  recurring_event_id: string | null;
  occurrence_key: string;
  original_title: string;
  source_all_day: number;
  source_start: string;
  source_end: string;
  import_batch_id: string;
  imported_at: string;
}

export interface ProvenanceRecord extends Omit<ImportProvenance, 'sessionId'> {
  id: ID;
  /** null when the imported session was later deleted (the event stays "already imported"). */
  sessionId: ID | null;
}

const provFromRow = (r: ProvRow): ProvenanceRecord => ({
  id: r.id,
  sessionId: r.session_id,
  provider: r.provider as ProviderKind,
  accountId: r.account_id,
  calendarId: r.calendar_id,
  externalEventId: r.external_event_id,
  recurringEventId: r.recurring_event_id,
  occurrenceKey: r.occurrence_key || null,
  originalTitle: r.original_title,
  sourceAllDay: !!r.source_all_day,
  sourceStart: r.source_start,
  sourceEnd: r.source_end,
  importBatchId: r.import_batch_id,
  importedAt: r.imported_at,
});

export function provenanceRepo(db: SqlDriver, deps: Deps) {
  return {
    async listForCalendars(provider: ProviderKind, accountId: string, calendarIds: string[]): Promise<ProvenanceRecord[]> {
      if (!calendarIds.length) return [];
      return (
        await db.all<ProvRow>(`SELECT * FROM import_provenance WHERE provider = ? AND account_id = ? AND calendar_id IN (${calendarIds.map(() => '?').join(',')})`, [provider, accountId, ...calendarIds])
      ).map(provFromRow);
    },
    async listBySession(sessionId: ID): Promise<ProvenanceRecord[]> {
      return (await db.all<ProvRow>('SELECT * FROM import_provenance WHERE session_id = ?', [sessionId])).map(provFromRow);
    },
    async insert(ex: SqlExecutor, p: ImportProvenance): Promise<void> {
      await ex.run(
        `INSERT INTO import_provenance (id, session_id, provider, account_id, calendar_id, external_event_id, recurring_event_id, occurrence_key, original_title, source_all_day, source_start, source_end, import_batch_id, imported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(provider, account_id, calendar_id, external_event_id, occurrence_key) DO UPDATE SET session_id = excluded.session_id, import_batch_id = excluded.import_batch_id, imported_at = excluded.imported_at`,
        [deps.newId(), p.sessionId, p.provider, p.accountId, p.calendarId, p.externalEventId, p.recurringEventId, p.occurrenceKey ?? '', p.originalTitle, p.sourceAllDay ? 1 : 0, p.sourceStart, p.sourceEnd, p.importBatchId, p.importedAt],
      );
    },
  };
}

// ─── export links ────────────────────────────────────────────────────────────

interface LinkRow {
  id: string;
  session_id: string | null;
  provider: string;
  account_id: string;
  calendar_id: string;
  external_event_id: string;
  occurrence_key: string | null;
  status: string;
  op_id: string;
  snapshot: string;
  exported_at: string;
}

export interface ExportLinkRecord extends Omit<ExportLink, 'sessionId'> {
  sessionId: ID | null;
}

const linkFromRow = (r: LinkRow): ExportLinkRecord => ({
  id: r.id,
  sessionId: r.session_id,
  provider: r.provider as ProviderKind,
  accountId: r.account_id,
  calendarId: r.calendar_id,
  externalEventId: r.external_event_id,
  occurrenceKey: r.occurrence_key,
  status: r.status as ExportLink['status'],
  opId: r.op_id,
  snapshot: JSON.parse(r.snapshot) as ExportSnapshot,
  exportedAt: r.exported_at,
});

export function exportLinksRepo(db: SqlDriver, deps: Deps) {
  return {
    async byOp(opId: string): Promise<ExportLinkRecord | null> {
      const r = await db.first<LinkRow>('SELECT * FROM export_links WHERE op_id = ?', [opId]);
      return r ? linkFromRow(r) : null;
    },
    async bySession(sessionId: ID): Promise<ExportLinkRecord[]> {
      return (await db.all<LinkRow>('SELECT * FROM export_links WHERE session_id = ? ORDER BY exported_at', [sessionId])).map(linkFromRow);
    },
    async byDestination(provider: ProviderKind, accountId: string, calendarId: string): Promise<ExportLinkRecord[]> {
      return (await db.all<LinkRow>('SELECT * FROM export_links WHERE provider = ? AND account_id = ? AND calendar_id = ?', [provider, accountId, calendarId])).map(linkFromRow);
    },
    async all(): Promise<ExportLinkRecord[]> {
      return (await db.all<LinkRow>('SELECT * FROM export_links')).map(linkFromRow);
    },
    async upsert(link: Omit<ExportLink, 'id'> & { id?: string }): Promise<ExportLinkRecord> {
      const id = link.id ?? deps.newId();
      await db.run(
        `INSERT INTO export_links (id, session_id, provider, account_id, calendar_id, external_event_id, occurrence_key, status, op_id, snapshot, exported_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(op_id) DO UPDATE SET external_event_id = excluded.external_event_id, occurrence_key = excluded.occurrence_key, status = excluded.status, snapshot = excluded.snapshot, exported_at = excluded.exported_at`,
        [id, link.sessionId, link.provider, link.accountId, link.calendarId, link.externalEventId, link.occurrenceKey, link.status, link.opId, JSON.stringify(link.snapshot), link.exportedAt],
      );
      return (await this.byOp(link.opId))!;
    },
  };
}

// ─── export jobs ─────────────────────────────────────────────────────────────

interface JobRow {
  id: string;
  op_id: string;
  session_id: string;
  provider: string;
  account_id: string;
  calendar_id: string;
  kind: string;
  status: string;
  attempts: number;
  last_error: string | null;
  review_reason: string | null;
  next_attempt_at: string | null;
  payload: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExportJobRecord extends ExportJob {
  payload: unknown;
}

const jobFromRow = (r: JobRow): ExportJobRecord => ({
  id: r.id,
  opId: r.op_id,
  sessionId: r.session_id,
  provider: r.provider as ProviderKind,
  accountId: r.account_id,
  calendarId: r.calendar_id,
  kind: r.kind as ExportJob['kind'],
  status: r.status as ExportJobStatus,
  attempts: r.attempts,
  lastError: r.last_error,
  reviewReason: r.review_reason,
  nextAttemptAt: r.next_attempt_at,
  payload: r.payload ? JSON.parse(r.payload) : null,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

export const OPEN_JOB_STATUSES: ExportJobStatus[] = ['pending', 'running', 'failed', 'uncertain', 'needs_review'];

export function exportJobsRepo(db: SqlDriver, deps: Deps) {
  return {
    /** Enqueue unless an open job for the same operation already exists (idempotent). */
    async enqueue(job: { opId: string; sessionId: ID; provider: ProviderKind; accountId: string; calendarId: string; kind: 'auto' | 'manual'; payload?: unknown; status?: ExportJobStatus; reviewReason?: string | null }): Promise<ExportJobRecord> {
      const now = deps.now();
      await db.run(
        `INSERT INTO export_jobs (id, op_id, session_id, provider, account_id, calendar_id, kind, status, attempts, last_error, review_reason, next_attempt_at, payload, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, NULL, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`,
        [deps.newId(), job.opId, job.sessionId, job.provider, job.accountId, job.calendarId, job.kind, job.status ?? 'pending', job.reviewReason ?? null, now, job.payload === undefined ? null : JSON.stringify(job.payload), now, now],
      );
      const r = await db.first<JobRow>(`SELECT * FROM export_jobs WHERE op_id = ? ORDER BY created_at DESC LIMIT 1`, [job.opId]);
      return jobFromRow(r!);
    },
    async list(statuses?: ExportJobStatus[]): Promise<ExportJobRecord[]> {
      const rows = statuses?.length
        ? await db.all<JobRow>(`SELECT * FROM export_jobs WHERE status IN (${statuses.map(() => '?').join(',')}) ORDER BY created_at`, statuses)
        : await db.all<JobRow>('SELECT * FROM export_jobs ORDER BY created_at');
      return rows.map(jobFromRow);
    },
    async due(nowIso: string): Promise<ExportJobRecord[]> {
      return (
        await db.all<JobRow>(
          `SELECT * FROM export_jobs WHERE status IN ('pending','failed','uncertain') AND (next_attempt_at IS NULL OR next_attempt_at <= ?) ORDER BY created_at`,
          [nowIso],
        )
      ).map(jobFromRow);
    },
    async update(id: ID, patch: Partial<Pick<ExportJob, 'status' | 'attempts' | 'lastError' | 'reviewReason' | 'nextAttemptAt'>> & { payload?: unknown }): Promise<void> {
      const cur = await db.first<JobRow>('SELECT * FROM export_jobs WHERE id = ?', [id]);
      if (!cur) return;
      await db.run(
        'UPDATE export_jobs SET status = ?, attempts = ?, last_error = ?, review_reason = ?, next_attempt_at = ?, payload = ?, updated_at = ? WHERE id = ?',
        [
          patch.status ?? cur.status,
          patch.attempts ?? cur.attempts,
          patch.lastError !== undefined ? patch.lastError : cur.last_error,
          patch.reviewReason !== undefined ? patch.reviewReason : cur.review_reason,
          patch.nextAttemptAt !== undefined ? patch.nextAttemptAt : cur.next_attempt_at,
          patch.payload !== undefined ? JSON.stringify(patch.payload) : cur.payload,
          deps.now(),
          id,
        ],
      );
    },
    /** Cancel open jobs (e.g. when automatic export is turned off). Never touches calendars. */
    async cancelOpen(filter: { kind?: 'auto' | 'manual' } = {}): Promise<number> {
      const r = await db.run(
        `UPDATE export_jobs SET status = 'cancelled', updated_at = ? WHERE status IN ('pending','failed','uncertain','needs_review')${filter.kind ? ' AND kind = ?' : ''}`,
        filter.kind ? [deps.now(), filter.kind] : [deps.now()],
      );
      return r.changes;
    },
    async countOpen(): Promise<number> {
      return (await db.first<{ n: number }>(`SELECT COUNT(*) AS n FROM export_jobs WHERE status IN ('pending','running','failed','uncertain','needs_review')`))?.n ?? 0;
    },
  };
}

export type Repositories = ReturnType<typeof createRepositories>;

export function createRepositories(db: SqlDriver, deps: Deps) {
  return {
    db,
    categories: categoriesRepo(db, deps),
    sessions: sessionsRepo(db, deps),
    settings: settingsRepo(db),
    provenance: provenanceRepo(db, deps),
    exportLinks: exportLinksRepo(db, deps),
    exportJobs: exportJobsRepo(db, deps),
  };
}
