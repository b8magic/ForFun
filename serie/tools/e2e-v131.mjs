// Focused 1.3.1 regression; run against the root's single production export.
// Browser plugin not available: use the installed Playwright harness.
// Flow: neutral dates -> shared selection / scoped edits -> real row swipe /
// immediate explicit deletion -> readable history -> exact SQLite persistence.
// node tools/e2e-v131.mjs
import initSqlJs from 'sql.js';
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v131');
const { page, $, tap, fill, text, label, body, home, reload, switchTo, jumpMonth, details, save, screenshot } = h;
const SQL = await initSqlJs();
const mixedDate = '2026-09-08';
const unknownDate = '2026-09-09';
const emptyDate = '2026-09-23';
const changedNote = 'Modifica condivisa 1.3.1';
const dialogs = [];
page.on('dialog', (dialog) => {
  dialogs.push({ type: dialog.type(), message: dialog.message() });
  void dialog.dismiss();
});

let baseline;
let detailedSurf;
let bareSurf;
let corsa;
let unknownSurf;
let afterBulk;
let afterDelete;

// Each journey consumes fixtures from the previous one. Stop at the first
// failure instead of spending time on dependent failures or unrelated suites.
async function check(name, run) {
  await h.check(name, run);
  assert(h.results.at(-1)?.ok, `Prerequisite journey failed: ${name}`);
}
const equalRows = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);

async function sessionRows() {
  const bytes = await page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('serie', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('sqlite', 'readonly').objectStore('sqlite').get('db');
      request.onerror = () => { database.close(); reject(request.error); };
      request.onsuccess = () => { database.close(); resolve(Array.from(new Uint8Array(request.result))); };
    };
  }));
  const database = new SQL.Database(new Uint8Array(bytes));
  try {
    const statement = database.prepare('SELECT * FROM sessions ORDER BY id');
    const rows = [];
    try { while (statement.step()) rows.push(statement.getAsObject()); }
    finally { statement.free(); }
    return rows;
  } finally { database.close(); }
}
async function waitForRows(predicate, message) {
  const deadline = Date.now() + 5000;
  do {
    const rows = await sessionRows();
    if (predicate(rows)) return rows;
    await page.waitForTimeout(100);
  } while (Date.now() < deadline);
  throw new Error(message);
}
async function dismissMessage() {
  if (await $('toast-dismiss').count()) await tap('toast-dismiss', 80);
}
async function mode(value) {
  await tap(`home-mode-${value}`, 120);
  assert(await $(`home-mode-${value}`).getAttribute('aria-checked') === 'true', `Home is in ${value} mode`);
}
async function selected(...dates) {
  for (const date of dates) assert(/selezionato/.test(await label(`day-${date}`)), `${date} stays selected`);
}
async function neutral() {
  const active = await $('activity-switcher').count();
  if (active) {
    const name = (await label('activity-switcher')).replace(/^Attività attiva: /, '').split(',')[0];
    await tap(`activity-${name}`, 160);
  }
  assert(await $('activity-switcher').count() === 0, 'Activity focus is neutral');
}
async function closeSheet() {
  await tap('sheet-close', 180);
  await h.visible('lineup');
}
async function longPress(id) {
  await $(id).scrollIntoViewIfNeeded();
  const box = await $(id).boundingBox();
  assert(box, `${id} has a touch target`);
  const cdp = await h.context.newCDPSession(page);
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x + box.width / 2, y: box.y + box.height / 2, radiusX: 3, radiusY: 3, force: 1, id: 1 }] });
    await page.waitForTimeout(650);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  } finally { await cdp.detach(); }
  await h.visible('day-sheet');
}
async function openChecklist() {
  await tap('selected-day-sessions', 180);
  await h.visible('bulk-day-sheet');
}
async function checked(id, value) {
  assert(await $(`bulk-day-session-${id}`).getAttribute('aria-checked') === String(value), `Session ${id} selection is ${value}`);
}
async function openInline(date) {
  const day = $('time-place').getByTestId(`mini-${date}`).first();
  await day.scrollIntoViewIfNeeded();
  await day.tap();
  await h.visible(`history-day-${date}`);
  await page.waitForTimeout(400);
  assert(await $('day-sheet').count() === 0, 'Monthly history stays inline');
}

try {
  await home();
  await check('meaningful Home creates four real SQLite fixtures without framework errors', async () => {
    assert(page.url() === h.url && typeof await page.title() === 'string', 'Expected page identity');
    assert(/Surf/.test(await body()) && !/Uncaught Error|Failed to compile|Something went wrong/i.test(await body()), 'Home renders meaningful app content without an error overlay');
    await jumpMonth(2026, 9);
    await tap(`day-${mixedDate}`);
    await details(async () => {
      await fill('details-notes', 'Surf con durata');
      await fill('details-place-name', 'Luogo Surf');
      await tap('details-timing-mode-duration_only');
      await fill('details-timing-duration-input', '130');
    });
    await save();
    await dismissMessage();
    await tap(`day-${mixedDate}`);
    await save();
    await dismissMessage();
    await tap(`day-${unknownDate}`);
    await details(async () => {
      await fill('details-notes', 'Nota del giorno senza durata');
      await fill('details-place-name', 'Luogo senza durata');
    });
    await save();
    await dismissMessage();
    await switchTo('Corsa');
    await tap(`day-${mixedDate}`);
    await details(async () => {
      await fill('details-notes', 'Corsa con durata');
      await fill('details-place-name', 'Luogo Corsa');
      await tap('details-timing-mode-duration_only');
      await fill('details-timing-duration-input', '35');
    });
    await save();
    await dismissMessage();
    baseline = await waitForRows((rows) => rows.length === 4, 'All four UI-created sessions are persisted');
    detailedSurf = baseline.find((row) => row.notes === 'Surf con durata');
    corsa = baseline.find((row) => row.notes === 'Corsa con durata');
    unknownSurf = baseline.find((row) => row.date === unknownDate);
    bareSurf = baseline.find((row) => row.date === mixedDate && row.category_id === detailedSurf?.category_id && row.id !== detailedSurf.id);
    assert(detailedSurf && corsa && unknownSurf && bareSurf, 'Fixture identities are unambiguous');
    assert(detailedSurf.duration_sec === 5400 && corsa.duration_sec === 2100 && unknownSurf.duration_sec === null && bareSurf.duration_sec === null, 'Known and unknown durations remain distinct');
  });

  await check('neutral taps select dates, Save stays disabled and real long press opens saved details', async () => {
    await neutral();
    await mode('new');
    await tap(`day-${mixedDate}`);
    await tap(`day-${emptyDate}`);
    await selected(mixedDate, emptyDate);
    assert(await $('day-sheet').count() === 0, 'Ordinary neutral taps do not open a sheet');
    assert(await $('save').getAttribute('aria-disabled') === 'true', 'Neutral Save is visible and disabled');
    await $('save').tap({ force: true });
    equalRows(await sessionRows(), baseline, 'Neutral selection cannot save or change a session');
    await longPress(`day-${mixedDate}`);
    assert(await $('day-sheet').locator('[role="button"][data-testid^="session-"]').count() === 3, 'Long press shows all three sessions of the mixed day');
    assert(await $('session-editor').count() === 0, 'Long press does not open an editor');
    await closeSheet();
    await selected(mixedDate, emptyDate);
    equalRows(await sessionRows(), baseline, 'Long press preserves every complete saved row');
    await screenshot('01-neutral-selected-days');
  });

  await check('shared dates survive activity and mode changes including an empty date in edit mode', async () => {
    await switchTo('Surf');
    await selected(mixedDate, emptyDate);
    await mode('edit');
    await selected(mixedDate, emptyDate);
    assert(await $(`day-${emptyDate}`).getAttribute('aria-disabled') !== 'true', 'Empty dates remain selectable while editing');
    await tap('day-2026-09-24');
    await selected(mixedDate, emptyDate, '2026-09-24');
    await tap('day-2026-09-24');
    assert(!/selezionato/.test(await label('day-2026-09-24')), 'A second tap deselects the empty date');
    await mode('new');
    await switchTo('Corsa');
    await selected(mixedDate, emptyDate);
    await mode('edit');
    await selected(mixedDate, emptyDate);
    await neutral();
    await mode('new');
    await selected(mixedDate, emptyDate);
    await mode('edit');
    await selected(mixedDate, emptyDate);
    await tap(`day-${emptyDate}`);
    assert(!/selezionato/.test(await label(`day-${emptyDate}`)), 'Only the deliberately toggled date leaves the shared selection');
    equalRows(await sessionRows(), baseline, 'Selection and mode changes do not write session rows');
  });

  await check('active editing scopes sessions while neutral editing keeps all activities and individual exclusions', async () => {
    await switchTo('Surf');
    await mode('edit');
    await openChecklist();
    assert(await $('bulk-day-sheet').locator('[data-testid^="bulk-day-session-"]').count() === 2, 'Surf editing lists both Surf records only');
    assert(await $(`bulk-day-session-${corsa.id}`).count() === 0, 'The active-activity checklist excludes Corsa');
    await checked(detailedSurf.id, true);
    await checked(bareSurf.id, true);
    await tap(`bulk-day-session-${bareSurf.id}`);
    await checked(bareSurf.id, false);
    await tap('bulk-day-done', 180);
    await switchTo('Corsa');
    await mode('edit');
    await openChecklist();
    assert(await $('bulk-day-sheet').locator('[data-testid^="bulk-day-session-"]').count() === 1, 'Corsa editing lists its single record');
    await checked(corsa.id, true);
    await tap('bulk-day-done', 180);
    await neutral();
    await mode('edit');
    await openChecklist();
    assert(await $('bulk-day-sheet').locator('[data-testid^="bulk-day-session-"]').count() === 3, 'Neutral editing lists every activity on the selected date');
    await checked(detailedSurf.id, true);
    await checked(corsa.id, true);
    await checked(bareSurf.id, false);
    await tap('bulk-day-done', 180);
    equalRows(await sessionRows(), baseline, 'Checklist exclusions never change saved records');
    await tap('bulk-edit', 180);
    await h.visible('bulk-details-sheet');
    await tap('bulk-notes-set');
    await fill('bulk-notes-input', changedNote);
    await tap('bulk-save', 450);
    afterBulk = await waitForRows((rows) => rows.filter((row) => row.notes === changedNote).length === 2, 'Both selected activities receive the committed note');
    for (const prior of baseline) {
      const current = afterBulk.find((row) => row.id === prior.id);
      if ([detailedSurf.id, corsa.id].includes(prior.id)) equalRows({ ...current, notes: prior.notes, updated_at: prior.updated_at }, prior, 'Cross-activity note editing preserves all other fields');
      else equalRows(current, prior, 'Excluded duplicates and other dates stay byte-for-byte equivalent');
    }
    assert(afterBulk.length === baseline.length, 'Bulk editing neither creates nor deletes sessions');
    await dismissMessage();
  });

  await check('a real left swipe stays in day details and explicit Elimina deletes only its row without confirmation', async () => {
    await mode('new');
    await longPress(`day-${mixedDate}`);
    await h.swipeLeft(`session-${bareSurf.id}`);
    assert(await $('day-sheet').isVisible() && await $('session-editor').count() === 0 && !page.url().includes('/session/'), 'A physical row swipe cannot open the editor');
    assert(await $(`day-swipe-delete-${bareSurf.id}`).getAttribute('aria-hidden') !== 'true', 'The swipe reveals the explicit Elimina action');
    equalRows(await sessionRows(), afterBulk, 'The swipe itself never deletes or edits data');
    await tap(`day-swipe-delete-${bareSurf.id}`, 450);
    afterDelete = await waitForRows((rows) => rows.length === afterBulk.length - 1, 'Elimina immediately removes exactly one session');
    equalRows(afterDelete, afterBulk.filter((row) => row.id !== bareSurf.id), 'Immediate deletion preserves every other complete session row');
    assert(await $('day-delete-confirm').count() === 0 && dialogs.length === 0, 'No second confirmation is requested');
    assert(await $('day-sheet').isVisible() && await $('session-editor').count() === 0, 'Deletion leaves the day sheet open');
    await screenshot('02-immediate-single-row-delete');
    await closeSheet();
    await dismissMessage();
  });

  await check('inline history hides missing timing copy while actual duration, place and notes remain visible', async () => {
    await tap('history-handle', 550);
    await h.visible('time-place');
    await openInline(mixedDate);
    assert(/1\s*h\s*30\s*min/.test(await text(`session-${detailedSurf.id}`)), 'The actual ninety-minute duration remains visible');
    assert((await text(`session-place-preview-${detailedSurf.id}`)).includes('Luogo Surf'), 'The saved place remains visible');
    assert((await text(`session-notes-preview-${detailedSurf.id}`)).includes(changedNote), 'The saved note remains visible');
    await openInline(unknownDate);
    const panel = await text('history-day-details');
    assert(!/durata non|nessuna durata|solo data|orario non|senza orario/i.test(panel), 'A date-only preview has no missing-timing instructions');
    assert((await text(`session-place-preview-${unknownSurf.id}`)).includes('Luogo senza durata'), 'A date-only session retains its place');
    assert((await text(`session-notes-preview-${unknownSurf.id}`)).includes(unknownSurf.notes), 'A date-only session retains its note');
    equalRows(await sessionRows(), afterDelete, 'Compact history never changes unknown duration or stored details');
    await screenshot('03-inline-date-only-details');
    await tap('back-to-log', 350);
  });

  await check('restart preserves the shared date and every surviving SQLite row without runtime errors', async () => {
    await mode('new');
    // A successful bulk commit can consume its edit selection. Establish one
    // explicit neutral draft date to verify the independent persistent dates.
    const date = '2026-09-25';
    await neutral();
    await tap(`day-${date}`);
    await selected(date);
    await reload();
    await jumpMonth(2026, 9);
    await selected(date);
    assert(await $('save').getAttribute('aria-disabled') === 'true', 'Restart keeps neutral saving disabled');
    await switchTo('Surf');
    await selected(date);
    equalRows(await sessionRows(), afterDelete, 'Restart retains the exact surviving IDs, timing, places and notes');
    assert(h.errors.length === 0 && dialogs.length === 0, 'No runtime errors or unexpected confirmations');
    await screenshot('04-restored-shared-date');
  });
} finally {
  await h.finish();
}
