// Focused 1.3.3 QA against the root's single production export.
// Browser plugin not available: use the installed Playwright harness.
// Flow: real saves -> scoped/hidden counts -> inline trash and exact Undo ->
// native browser date controls, future range and persisted local dates.
import initSqlJs from 'sql.js';
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v133');
const { page, $, tap, fill, text, label, body, home, reload, switchTo, jumpMonth, details, save, screenshot } = h;
const SQL = await initSqlJs();
const september = '2026-09';
const august = '2026-08';
const mixedDate = '2026-09-08';
const soloDate = '2026-08-18';
const periodName = 'Periodo date locali 1.3.3';
const screenshots = [];
const dialogs = [];
let baseline;
let corsa;
let solo;
let savedPeriod;
const inHistory = (id) => $('time-place').getByTestId(id).first();
page.on('dialog', (dialog) => {
  dialogs.push({ type: dialog.type(), message: dialog.message() });
  void dialog.dismiss();
});

// These journeys share real UI fixtures; stop at the first failed prerequisite.
async function check(name, run) {
  await h.check(name, run);
  assert(h.results.at(-1)?.ok, `Prerequisite journey failed: ${name}`);
}
const equalRows = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);
async function rows(table = 'sessions') {
  assert(['sessions', 'named_periods'].includes(table), 'Read only the intended SQLite tables');
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
    const statement = database.prepare(`SELECT * FROM ${table} ORDER BY id`);
    const result = [];
    try { while (statement.step()) result.push(statement.getAsObject()); }
    finally { statement.free(); }
    return result;
  } finally { database.close(); }
}
async function waitForRows(predicate, message, table = 'sessions') {
  const deadline = Date.now() + 5000;
  do {
    const result = await rows(table);
    if (predicate(result)) return result;
    await page.waitForTimeout(80);
  } while (Date.now() < deadline);
  throw new Error(message);
}
async function dismissMessage() {
  if (await $('toast-dismiss').count()) await tap('toast-dismiss', 30);
}
async function neutral() {
  if (await $('activity-switcher').count()) {
    const active = (await label('activity-switcher')).replace(/^Attività attiva: /, '').split(',')[0];
    await tap(`activity-${active}`, 100);
  }
  assert(await $('activity-switcher').count() === 0, 'Home has neutral activity focus');
}
async function expectCount(month, expected) {
  const heading = $(`home-month-heading-${month}`);
  await heading.scrollIntoViewIfNeeded();
  if (expected === null) {
    assert(await $(`home-month-count-${month}`).count() === 0, `${month} hides a zero saved count`);
    assert(!/\b0 session[ei]\b/.test(await heading.getAttribute('aria-label')), 'Month navigation also omits the zero count');
  } else {
    assert(await text(`home-month-count-${month}`) === expected, `${month} count is ${expected}`);
    assert((await heading.getAttribute('aria-label')).includes(expected), 'Month navigation announces the same count');
  }
}
async function openHistory(activity) {
  await tap('history-handle', 500);
  await h.visible('time-place');
  await tap(`filter-${activity}`, 100);
  await tap('scale-month', 100);
}
async function openInline(date) {
  const month = inHistory(`month-${date.slice(0, 7)}`);
  await month.scrollIntoViewIfNeeded();
  if (await month.getAttribute('aria-expanded') !== 'true') await month.tap();
  const day = inHistory(`mini-${date}`);
  await day.scrollIntoViewIfNeeded();
  await day.tap();
  await h.visible(`history-day-${date}`);
  await page.waitForTimeout(350);
  assert(await $('day-sheet').count() === 0, 'History opens saved day details inline');
}
async function expectUndo() {
  await h.visible('toast-action');
  assert(await label('toast-action') === 'Annulla', 'The deletion toast offers Annulla');
  assert((await text('toast-dismiss')).includes('Sessione eliminata'), 'Deletion is reported immediately');
  const color = await $('toast-action').getByText('Annulla', { exact: true }).evaluate((node) => getComputedStyle(node).color);
  // Existing cream/dark surface accent tokens; the action must not fall back to text gray.
  assert(['rgb(201, 61, 28)', 'rgb(255, 77, 31)'].includes(color), `Annulla uses the existing red accent: ${color}`);
}
async function undoTwice() {
  await $('toast-action').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const restored = await waitForRows((result) => JSON.stringify(result) === JSON.stringify(baseline), 'Undo restores every complete original session row exactly once');
  equalRows(restored, baseline, 'Undo preserves IDs, timestamps, timing, place, note and other saved fields');
  assert(await $('toast-action').count() === 0, 'The consumed Undo action is no longer available');
  assert((await text('toast-dismiss')).includes('Sessione ripristinata'), 'Successful Undo reports restoration');
  await dismissMessage();
}

try {
  await home();
  await check('Serie renders and real saves replace hidden empty counts', async () => {
    assert(page.url() === h.url && await page.title() === 'Serie', 'URL and document title identify Serie');
    const content = await body();
    assert(/Surf/.test(content) && /Storia/.test(content), 'Home renders meaningful activity and history controls');
    assert(!/Uncaught Error|Failed to compile|Something went wrong|webpack-error-overlay/i.test(content), 'No framework error overlay');
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    await expectCount(september, null);
    await neutral();
    await expectCount(september, null);
    await switchTo('Surf');
    await tap(`day-${mixedDate}`, 80);
    await details(async () => {
      await fill('details-notes', 'Surf con durata 1.3.3');
      await fill('details-place-name', 'Luogo Surf');
      await tap('details-timing-mode-duration_only', 80);
      await fill('details-timing-duration-input', '130');
    });
    await save();
    await dismissMessage();
    await tap(`day-${mixedDate}`, 80);
    await save();
    await dismissMessage();
    await switchTo('Corsa');
    await tap(`day-${mixedDate}`, 80);
    await details(async () => { await fill('details-notes', 'Corsa unica 1.3.3'); });
    await save();
    await dismissMessage();
    await switchTo('Surf');
    await jumpMonth(2026, 8);
    await tap(`day-${soloDate}`, 80);
    await details(async () => {
      await fill('details-notes', 'Ultima sessione agosto 1.3.3');
      await fill('details-place-name', 'Luogo da ripristinare');
      await tap('details-timing-mode-interval', 80);
      await fill('details-timing-start', '09:00');
      await fill('details-timing-end', '10:15');
    });
    await save();
    await dismissMessage();
    baseline = await waitForRows((result) => result.length === 4, 'Four UI-created records persist');
    corsa = baseline.find((row) => row.notes === 'Corsa unica 1.3.3');
    solo = baseline.find((row) => row.date === soloDate);
    assert(corsa && solo && solo.duration_sec === 4500, 'Delete fixtures have unambiguous IDs and real interval timing');
  });

  await check('saved counts follow Surf Corsa and neutral scope without counting a draft', async () => {
    await jumpMonth(2026, 9);
    await expectCount(september, '2 sessioni di Surf');
    await tap('day-2026-09-23', 80);
    await expectCount(september, '2 sessioni di Surf');
    await switchTo('Corsa');
    await expectCount(september, '1 sessione di Corsa');
    await neutral();
    await expectCount(september, '3 sessioni totali');
    await tap('clear-selection', 80);
    await switchTo('Surf');
    await page.setViewportSize({ width: 320, height: 740 });
    await expectCount(september, '2 sessioni di Surf');
    const [titleBox, countBox] = await Promise.all([
      $('home-month-title-2026-09').boundingBox(), $('home-month-count-2026-09').boundingBox(),
    ]);
    assert(titleBox && countBox && titleBox.x + titleBox.width + 4 <= countBox.x + 1, 'Month title and saved count do not overlap at 320px');
    assert(countBox.x + countBox.width <= 320 && countBox.height <= 33, 'The count stays readable inside the small-phone viewport');
    screenshots.push(await screenshot('01-home-320-saved-count'));
    await page.setViewportSize({ width: 390, height: 844 });
  });

  await check('inline trash deletes the last focused activity and red Undo restores its exact row once', async () => {
    await switchTo('Corsa');
    await openHistory('Corsa');
    await openInline(mixedDate);
    assert(await $(`day-delete-${corsa.id}`).isVisible(), 'The inline row exposes its trash action');
    await tap(`day-delete-${corsa.id}`, 80);
    equalRows(await waitForRows((result) => result.length === 3, 'Trash immediately deletes one row'), baseline.filter((row) => row.id !== corsa.id), 'Trash removes only the chosen saved record');
    assert(dialogs.length === 0 && await $('day-delete-confirm').count() === 0, 'Inline trash needs no confirmation');
    assert(!page.url().includes('/session/') && await $('session-editor').count() === 0, 'Trash does not open the session editor');
    await expectUndo();
    await tap('back-to-log', 160);
    await expectCount(september, null);
    await neutral();
    await expectCount(september, '2 sessioni totali');
    await undoTwice();
    await expectCount(september, '3 sessioni totali');
    await switchTo('Corsa');
    await expectCount(september, '1 sessione di Corsa');
  });

  await check('deleting the last month record hides active and neutral zero counts then Undo restores metadata', async () => {
    await switchTo('Surf');
    await jumpMonth(2026, 8);
    await expectCount(august, '1 sessione di Surf');
    await openHistory('Surf');
    await openInline(soloDate);
    assert((await text(`session-place-preview-${solo.id}`)).includes('Luogo da ripristinare'), 'Saved place is visible before deletion');
    await tap(`day-delete-${solo.id}`, 80);
    equalRows(await waitForRows((result) => result.length === 3, 'Last month record is removed'), baseline.filter((row) => row.id !== solo.id), 'Other months and duplicate records remain exact');
    await expectUndo();
    await tap('back-to-log', 160);
    await expectCount(august, null);
    await neutral();
    await expectCount(august, null);
    screenshots.push(await screenshot('02-zero-count-red-undo'));
    await undoTwice();
    await expectCount(august, '1 sessione totale');
    await switchTo('Surf');
    await expectCount(august, '1 sessione di Surf');
    await openHistory('Surf');
    await openInline(soloDate);
    assert((await text(`session-place-preview-${solo.id}`)).includes('Luogo da ripristinare'), 'Undo restores the saved place in the inline preview');
    assert((await text(`session-notes-preview-${solo.id}`)).includes(solo.notes), 'Undo restores the saved note in the inline preview');
    assert(/1\s*h\s*15\s*min/.test(await text(`session-${solo.id}`)), 'Undo restores the actual interval duration');
    screenshots.push(await screenshot('03-restored-inline-metadata'));
  });

  await check('native web date inputs reject reversed ranges and persist the chosen future end', async () => {
    assert(await page.evaluate(() => Intl.DateTimeFormat().resolvedOptions().timeZone) === 'UTC', 'Browser date checks use the actual shared harness timezone');
    await tap('named-periods', 300);
    await tap('periods-create', 150);
    await h.visible('period-form');
    for (const id of ['period-start', 'period-end']) {
      assert(await $(id).evaluate((node) => node.tagName === 'INPUT' && node.type === 'date'), `${id} is a native browser date control`);
      assert(await $(id).getAttribute('min') === '1900-01-01' && await $(id).getAttribute('max') === null, 'Date controls preserve the historical lower bound and allow future endpoints');
    }
    await fill('period-name', periodName);
    await fill('period-start', '2026-09-09');
    await fill('period-end', '2026-09-08');
    await tap('period-save', 150);
    assert(await $('period-form').isVisible() && await rows('named_periods').then((result) => result.length === 0), 'A reversed range does not save');
    assert(await $('period-end-error').isVisible() && await $('period-end').getAttribute('aria-invalid') === 'true', 'The invalid end date has visible accessible feedback');
    assert(await $('period-start').inputValue() === '2026-09-09' && await $('period-end').inputValue() === '2026-09-08', 'Range validation does not silently move either endpoint');
    await fill('period-start', mixedDate);
    await fill('period-end', '2026-12-05');
    await fill('period-note', 'Date scelte dal calendario');
    screenshots.push(await screenshot('04-period-browser-date-controls'));
    await tap('period-save', 350);
    await h.visible('period-detail');
    savedPeriod = (await waitForRows((result) => result.length === 1, 'The named future range persists', 'named_periods'))[0];
    assert(savedPeriod.name === periodName && savedPeriod.start_date === mixedDate && savedPeriod.end_date === '2026-12-05', 'SQLite preserves both chosen local dates verbatim');
    assert(/3 sessioni/.test(await text('period-detail-summary')), 'The period includes the September records and excludes August');
    await home();
    await reload();
    equalRows(await rows(), baseline, 'Reload preserves every exact restored session row');
    equalRows(await rows('named_periods'), [savedPeriod], 'Reload preserves every exact period field');
    await tap('history-handle', 350);
    await tap('named-periods', 250);
    await tap(`period-${savedPeriod.id}`, 200);
    await tap('period-edit', 150);
    assert(await $('period-start').inputValue() === mixedDate && await $('period-end').inputValue() === '2026-12-05', 'Reopened browser controls retain the selected dates without a UTC offset');
    assert(dialogs.length === 0 && h.errors.length === 0, 'No unexpected confirmation or runtime error occurs');
  });
  console.log(`Screenshots:\n${screenshots.join('\n')}`);
} finally {
  await h.finish();
}
