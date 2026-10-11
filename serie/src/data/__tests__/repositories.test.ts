import { testRepos } from '@/test/sqljs';
import { bootstrap, KEYS } from '@/data/bootstrap';
import { buildTiming } from '@/domain/timing';
import { summarize } from '@/domain/stats';
import { DomainError } from '@/data/repositories';

const TZ = 'Europe/Rome';

describe('bootstrap & active activity', () => {
  it('seeds starter activities once with Surf active and no sessions', async () => {
    const r = await testRepos();
    const b = await bootstrap(r);
    expect(b.categories.map((c) => c.name)).toEqual(['Surf', 'Corsa', 'Allenamento', 'Viaggio']);
    expect(b.categories.find((c) => c.id === b.activeId)?.name).toBe('Surf');
    expect(b.changed).toBe(false);
    expect(await r.sessions.listAll()).toHaveLength(0);
    const again = await bootstrap(r);
    expect(again.categories).toHaveLength(4);
  });
  it('relaunches into the last used activity', async () => {
    const r = await testRepos();
    const b = await bootstrap(r);
    const corsa = b.categories.find((c) => c.name === 'Corsa')!;
    await r.settings.set(KEYS.lastActive, corsa.id);
    expect((await bootstrap(r)).activeId).toBe(corsa.id);
  });
  it('falls back visibly when the remembered activity was deleted, and to an empty state when none remain', async () => {
    const r = await testRepos();
    const b = await bootstrap(r);
    const surf = b.activeId!;
    await r.categories.remove(surf);
    const after = await bootstrap(r);
    expect(after.activeId).not.toBe(surf);
    expect(after.changed).toBe(true);
    for (const c of after.categories) await r.categories.remove(c.id);
    const empty = await bootstrap(r);
    expect(empty.activeId).toBeNull();
    expect(empty.categories).toHaveLength(0); // never re-seeded behind the user's back
  });
});

describe('sessions', () => {
  it('saves a multi-date batch atomically with no details required', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const res = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-07', '2026-10-03', '2026-10-06'], requestId: 'tap-1' });
    expect(res.created).toBe(3);
    expect(res.sessions.map((s) => s.date)).toEqual(['2026-10-03', '2026-10-06', '2026-10-07']);
    expect(res.sessions.every((s) => s.timing.state === 'date_only' && s.timing.durationSec === null && s.place === null && s.notes === null)).toBe(true);
  });
  it('re-delivering the same save request does not duplicate; a new request on the same date does', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 'tap-1' });
    const again = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 'tap-1' });
    expect(again.created).toBe(0);
    expect(await r.sessions.listAll()).toHaveLength(1);
    await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 'tap-2' });
    expect(await r.sessions.listAll()).toHaveLength(2);
  });
  it('never saves against a missing activity', async () => {
    const r = await testRepos();
    await bootstrap(r);
    await expect(r.sessions.saveBatch({ categoryId: 'nope', dates: ['2026-10-10'], requestId: 'x' })).rejects.toThrow(DomainError);
    expect(await r.sessions.listAll()).toHaveLength(0);
  });
  it('applies shared details as independent copies, then edits each independently', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const t = buildTiming('2026-10-03', { state: 'duration_only', declaredSec: 5400 });
    if (!t.ok) throw new Error();
    const { sessions } = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-03', '2026-10-06'], requestId: 'tap', shared: { timing: t.timing, notes: 'Mare liscio' } });
    expect(summarize(sessions).duration).toEqual({ knownSec: 10800, knownCount: 2, totalCount: 2 }); // each session gets 1.5 h, not 0.75 h
    const edited = await r.sessions.update(sessions[0].id, { notes: null, timing: buildTiming('2026-10-03', { state: 'date_only' }).ok ? (buildTiming('2026-10-03', { state: 'date_only' }) as any).timing : undefined });
    expect(edited.notes).toBeNull();
    expect(edited.timing.durationSec).toBeNull();
    const other = await r.sessions.get(sessions[1].id);
    expect(other?.notes).toBe('Mare liscio');
    expect(other?.timing.durationSec).toBe(5400);
  });
  it('persists every optional detail independently and clears them', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const { sessions } = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 't' });
    const id = sessions[0].id;
    let s = await r.sessions.update(id, { place: { label: null, address: null, mapUrl: 'https://maps.app.goo.gl/abc', coords: null, resolution: 'pending', resolutionNote: null } });
    expect(s.place?.mapUrl).toBe('https://maps.app.goo.gl/abc');
    expect(s.notes).toBeNull();
    s = await r.sessions.update(id, { notes: 'note only' , place: null });
    expect(s.place).toBeNull();
    expect((await r.sessions.get(id))?.notes).toBe('note only');
    const iv = buildTiming('2026-10-10', { state: 'interval', start: '09:00', end: '11:00', endDayOffset: 0, timeZone: TZ });
    if (!iv.ok) throw new Error();
    s = await r.sessions.update(id, { timing: iv.timing });
    expect((await r.sessions.get(id))?.timing).toMatchObject({ state: 'interval', durationSec: 7200, durationSource: 'interval' });
  });
  it('re-derives interval durations when the date moves across a DST change', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const iv = buildTiming('2026-10-24', { state: 'interval', start: '01:00', end: '04:00', endDayOffset: 0, timeZone: TZ });
    if (!iv.ok) throw new Error();
    const { sessions } = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-24'], requestId: 't', shared: { timing: iv.timing } });
    expect(sessions[0].timing.durationSec).toBe(3 * 3600);
    const moved = await r.sessions.update(sessions[0].id, { date: '2026-10-25' });
    expect(moved.timing.durationSec).toBe(4 * 3600);
  });
  it('rejects impossible timing rows at the database level', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    await expect(
      r.db.run(`INSERT INTO sessions (id, category_id, date, timing_state, duration_sec, duration_source, created_at, updated_at) VALUES ('x', ?, '2026-10-10', 'date_only', 0, NULL, 'a', 'a')`, [activeId!]),
    ).rejects.toThrow();
  });
});

describe('activity management safeguards', () => {
  it('requires an explicit strategy to delete an activity with sessions', async () => {
    const r = await testRepos();
    const { categories, activeId } = await bootstrap(r);
    await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10', '2026-10-11'], requestId: 't' });
    await expect(r.categories.remove(activeId!)).rejects.toMatchObject({ code: 'category_has_sessions' });
    const corsa = categories.find((c) => c.name === 'Corsa')!;
    await r.categories.remove(activeId!, { kind: 'move', toCategoryId: corsa.id });
    expect((await r.sessions.listByCategory(corsa.id))).toHaveLength(2);
    await r.categories.remove(corsa.id, { kind: 'delete_sessions' });
    expect(await r.sessions.listAll()).toHaveLength(0);
  });
  it('validates names (required, unique case-insensitively)', async () => {
    const r = await testRepos();
    await bootstrap(r);
    await expect(r.categories.create({ name: '  ', color: '#fff', pattern: 'swell' })).rejects.toMatchObject({ code: 'name_required' });
    await expect(r.categories.create({ name: 'surf', color: '#fff', pattern: 'swell' })).rejects.toMatchObject({ code: 'name_taken' });
    const c = await r.categories.create({ name: 'Yoga', color: '#B9A8FF', pattern: 'ripple' });
    expect((await r.categories.update(c.id, { name: 'Yoga del mattino' })).name).toBe('Yoga del mattino');
  });
});

describe('exchange records', () => {
  it('keeps provenance and export links when a session is deleted, and cancels its jobs', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const { sessions } = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 't' });
    const s = sessions[0];
    await r.provenance.insert(r.db, { sessionId: s.id, provider: 'google', accountId: 'a@b.c', calendarId: 'primary', externalEventId: 'e1', recurringEventId: null, occurrenceKey: null, originalTitle: 'Surf Zurriola', sourceAllDay: true, sourceStart: '2026-10-10', sourceEnd: '2026-10-11', importBatchId: 'b1', importedAt: '2026-10-10T10:00:00Z' });
    await r.exportLinks.upsert({ sessionId: s.id, provider: 'apple', accountId: 'icloud', calendarId: 'c1', externalEventId: 'x1', occurrenceKey: null, status: 'created', opId: 'op1', snapshot: { title: 'Surf', notes: null, location: null, allDay: true, start: '2026-10-10', end: '2026-10-11', timeZone: null, timingState: 'date_only', durationSec: null, durationSource: null, schedulingPlaceholder: false, categoryName: 'Surf' }, exportedAt: '2026-10-10T10:00:00Z' });
    await r.exportJobs.enqueue({ opId: 'op2', sessionId: s.id, provider: 'google', accountId: 'a@b.c', calendarId: 'primary', kind: 'auto' });
    await r.sessions.remove([s.id]);
    const prov = await r.provenance.listForCalendars('google', 'a@b.c', ['primary']);
    expect(prov).toHaveLength(1);
    expect(prov[0].sessionId).toBeNull();
    expect((await r.exportLinks.byOp('op1'))?.sessionId).toBeNull();
    expect(await r.exportJobs.list()).toHaveLength(0);
  });
  it('enqueues jobs idempotently per operation', async () => {
    const r = await testRepos();
    const { activeId } = await bootstrap(r);
    const { sessions } = await r.sessions.saveBatch({ categoryId: activeId!, dates: ['2026-10-10'], requestId: 't' });
    const a = await r.exportJobs.enqueue({ opId: 'op', sessionId: sessions[0].id, provider: 'google', accountId: 'a', calendarId: 'c', kind: 'auto' });
    const b = await r.exportJobs.enqueue({ opId: 'op', sessionId: sessions[0].id, provider: 'google', accountId: 'a', calendarId: 'c', kind: 'auto' });
    expect(a.id).toBe(b.id);
    expect(await r.exportJobs.countOpen()).toBe(1);
    expect(await r.exportJobs.cancelOpen({ kind: 'auto' })).toBe(1);
    expect(await r.exportJobs.countOpen()).toBe(0);
  });
});
