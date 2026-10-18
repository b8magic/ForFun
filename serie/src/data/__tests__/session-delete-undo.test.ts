import { testRepos } from '@/test/sqljs';
import { buildTiming } from '@/domain/timing';

async function fixture() {
  const repos = await testRepos();
  const category = await repos.categories.create({ name: 'Surf', color: '#FF4D1F', pattern: 'swell' });
  const timing = buildTiming('2026-10-10', { state: 'interval', start: '23:15', end: '00:30', endDayOffset: 1, timeZone: 'Europe/Rome' });
  if (!timing.ok) throw new Error('invalid fixture');
  const { sessions: [session] } = await repos.sessions.saveBatch({
    categoryId: category.id, dates: ['2026-10-10'], requestId: 'import-tap', origin: 'import',
    shared: { timing: timing.timing, notes: 'Mare liscio\nSeconda riga', place: { label: 'Zurriola', address: 'Donostia', mapUrl: 'https://maps.apple.com/?ll=43.32,-1.97', coords: { lat: 43.32, lng: -1.97 }, resolution: 'resolved', resolutionNote: 'Posizione verificata' } },
  });
  const { sessions: [sibling] } = await repos.sessions.saveBatch({ categoryId: category.id, dates: [session.date], requestId: 'another-tap' });
  await repos.provenance.insert(repos.db, { sessionId: session.id, provider: 'google', accountId: 'a@b.c', calendarId: 'primary', externalEventId: 'import-event', recurringEventId: 'series', occurrenceKey: '2026-10-10', originalTitle: 'Surf Zurriola', sourceAllDay: false, sourceStart: '2026-10-10T23:15:00+02:00', sourceEnd: '2026-10-11T00:30:00+02:00', importBatchId: 'batch', importedAt: '2026-10-11T08:00:00Z' });
  await repos.exportLinks.upsert({ sessionId: session.id, provider: 'apple', accountId: 'icloud', calendarId: 'calendar', externalEventId: 'export-event', occurrenceKey: null, status: 'created', opId: 'export-op', snapshot: { title: 'Surf', notes: session.notes, location: 'Zurriola', allDay: false, start: '2026-10-10T23:15:00+02:00', end: '2026-10-11T00:30:00+02:00', timeZone: 'Europe/Rome', timingState: 'interval', durationSec: 4500, durationSource: 'interval', schedulingPlaceholder: false, categoryName: 'Surf' }, exportedAt: '2026-10-11T08:00:00Z' });
  return { repos, category, session, sibling };
}

it('restores the exact stored session and calendar associations atomically, without recreating export jobs', async () => {
  const { repos, session, sibling } = await fixture();
  const sessionRow = await repos.db.first('SELECT * FROM sessions WHERE id = ?', [session.id]);
  const provenance = await repos.db.all('SELECT * FROM import_provenance');
  const links = await repos.db.all('SELECT * FROM export_links');
  await repos.exportJobs.enqueue({ opId: 'pending-export', sessionId: session.id, provider: 'google', accountId: 'a@b.c', calendarId: 'other', kind: 'auto' });

  const receipt = await repos.sessions.removeWithUndo(session.id);
  expect(await repos.sessions.listAll()).toEqual([sibling]);
  expect((await repos.exportLinks.byOp('export-op'))?.sessionId).toBeNull();
  expect(await repos.exportJobs.list()).toEqual([]);
  expect(await receipt.restore()).toEqual(session);

  expect(await repos.db.first('SELECT * FROM sessions WHERE id = ?', [session.id])).toEqual(sessionRow);
  expect(await repos.db.all('SELECT * FROM import_provenance')).toEqual(provenance);
  expect(await repos.db.all('SELECT * FROM export_links')).toEqual(links);
  expect(await repos.sessions.get(sibling.id)).toEqual(sibling);
  expect(await repos.exportJobs.list()).toEqual([]);
});

it('consumes each receipt once, even for simultaneous calls or after another deletion', async () => {
  const { repos, session } = await fixture();
  const first = await repos.sessions.removeWithUndo(session.id);
  expect(await Promise.all([first.restore(), first.restore()])).toEqual([session, null]);
  const second = await repos.sessions.removeWithUndo(session.id);
  expect(await first.restore()).toBeNull();
  expect(await repos.sessions.get(session.id)).toBeNull();
  expect(await second.restore()).toEqual(session);
});

it.each([false, true])('rejects an undo after its category is deleted (ID recreated: %s)', async (recreate) => {
  const { repos, category, session } = await fixture();
  const receipt = await repos.sessions.removeWithUndo(session.id);
  await repos.categories.remove(category.id, { kind: 'delete_sessions' });
  if (recreate) await repos.db.run('INSERT INTO categories (id, name, color, pattern, sort_order, created_at, updated_at) VALUES (?, ?, ?, ?, 0, ?, ?)', [category.id, 'Replacement', category.color, category.pattern, '2026-10-12', '2026-10-12']);
  await expect(receipt.restore()).rejects.toMatchObject({ code: 'category_missing' });
  expect(await repos.sessions.get(session.id)).toBeNull();
  expect((await repos.exportLinks.byOp('export-op'))?.sessionId).toBeNull();
});

it.each(['id', 'request'] as const)('never overwrites a reused session %s', async (reuse) => {
  const { repos, session } = await fixture();
  const receipt = await repos.sessions.removeWithUndo(session.id);
  const replacement = { ...session, id: reuse === 'id' ? session.id : 'replacement-id', saveRequestId: reuse === 'request' ? session.saveRequestId : 'replacement-request', notes: 'New session' };
  await repos.sessions.insertMany(repos.db, [replacement]);
  await expect(receipt.restore()).rejects.toMatchObject({ code: 'session_changed' });
  expect(await repos.sessions.get(replacement.id)).toEqual(replacement);
  expect((await repos.exportLinks.byOp('export-op'))?.sessionId).toBeNull();
});

it('does not steal an import association or overwrite an export link changed after deletion', async () => {
  const { repos, session, sibling } = await fixture();
  const receipt = await repos.sessions.removeWithUndo(session.id);
  await repos.db.run('UPDATE import_provenance SET session_id = ? WHERE external_event_id = ?', [sibling.id, 'import-event']);
  await repos.db.run('UPDATE export_links SET external_event_id = ? WHERE op_id = ?', ['new-export-event', 'export-op']);
  const provenance = await repos.db.all('SELECT * FROM import_provenance');
  const links = await repos.db.all('SELECT * FROM export_links');
  expect(await receipt.restore()).toEqual(session);
  expect(await repos.db.all('SELECT * FROM import_provenance')).toEqual(provenance);
  expect(await repos.db.all('SELECT * FROM export_links')).toEqual(links);
});

it('rolls back the restored session and every association when any restoration write fails', async () => {
  const { repos, session } = await fixture();
  const receipt = await repos.sessions.removeWithUndo(session.id);
  await repos.db.exec("CREATE TRIGGER reject_link_restore BEFORE UPDATE OF session_id ON export_links WHEN NEW.session_id IS NOT NULL BEGIN SELECT RAISE(ABORT, 'disk full'); END;");
  await expect(receipt.restore()).rejects.toThrow('disk full');
  expect(await repos.sessions.get(session.id)).toBeNull();
  expect(await repos.provenance.listBySession(session.id)).toEqual([]);
  expect((await repos.exportLinks.byOp('export-op'))?.sessionId).toBeNull();
});
