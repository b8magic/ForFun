// Focused 1.3.3 QA against the root's single production export.
// Browser plugin not available: use the installed Playwright harness.
// Flow: real saves -> scoped/hidden counts -> inline trash and exact Undo ->
// native browser date controls -> shared Sessioni -> view/discard Bozze.
import initSqlJs from 'sql.js';
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v133');
const { page, $, tap, fill, text, label, body, home, reload, switchTo, jumpMonth, details, save, screenshot } = h;
const SQL = await initSqlJs();
const september = '2026-09';
const august = '2026-08';
const mixedDate = '2026-09-08';
const soloDate = '2026-08-18';
const emptyDate = '2026-09-23';
const selectedDates = [soloDate, mixedDate, emptyDate].sort();
const periodName = 'Periodo date locali 1.3.3';
const screenshots = [];
const dialogs = [];
let baseline;
let corsa;
let solo;
let savedPeriod;
let detailedSurf;
let bareSurf;
let categories;
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
  const order = { sessions: 'id', named_periods: 'id', categories: 'id', settings: 'key', category_drafts: 'category_id' };
  assert(Object.hasOwn(order, table), 'Read only the intended SQLite tables');
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
    const statement = database.prepare(`SELECT * FROM ${table} ORDER BY ${order[table]}`);
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
async function expectUndo(scope = $) {
  await scope('toast-action').waitFor({ state: 'visible', timeout: 15000 });
  assert(await scope('toast-action').getAttribute('aria-label') === 'Annulla', 'The deletion toast offers Annulla');
  assert((await scope('toast-dismiss').innerText()).includes('Sessione eliminata'), 'Deletion is reported immediately');
  const color = await scope('toast-action').getByText('Annulla', { exact: true }).evaluate((node) => getComputedStyle(node).color);
  // Existing cream/dark surface accent tokens; the action must not fall back to text gray.
  assert(['rgb(201, 61, 28)', 'rgb(255, 77, 31)'].includes(color), `Annulla uses the existing red accent: ${color}`);
}
async function undoTwice(scope = $) {
  await scope('toast-action').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  const restored = await waitForRows((result) => JSON.stringify(result) === JSON.stringify(baseline), 'Undo restores every complete original session row exactly once');
  equalRows(restored, baseline, 'Undo preserves IDs, timestamps, timing, place, note and other saved fields');
  assert(await scope('toast-action').count() === 0, 'The consumed Undo action is no longer available');
  assert((await scope('toast-dismiss').innerText()).includes('Sessione ripristinata'), 'Successful Undo reports restoration');
  if (scope === $) await dismissMessage();
  else await scope('toast-dismiss').tap();
}
async function mode(value) {
  await tap(`home-mode-${value}`, 100);
  assert(await $(`home-mode-${value}`).getAttribute('aria-checked') === 'true', `Home is in ${value} mode`);
}
async function expectSelection(expected = selectedDates) {
  await waitForRows((result) => {
    const selection = result.find((row) => row.key === 'homeSelection');
    return selection && JSON.stringify(JSON.parse(selection.value)) === JSON.stringify(expected);
  }, 'The exact shared date selection persists', 'settings');
  for (const date of expected) {
    if (await $(`day-${date}`).count()) assert((await label(`day-${date}`)).includes('selezionato'), `${date} remains selected in Home`);
  }
}
async function sessionList(value) {
  await tap(value === 'new' ? 'selected-day-details' : 'selected-day-sessions', 180);
  await h.visible('bulk-day-sheet');
  assert(await $('bulk-day-sheet').getByText('Sessioni', { exact: true }).count() === 1, 'Both modes use the common Sessioni title');
}
async function expectSessionColors(records) {
  for (const record of records) {
    const category = categories.find((item) => item.id === record.category_id);
    assert(category, 'Each saved row keeps its activity identity');
    const color = await $(`session-color-${record.id}`).evaluate((node) => getComputedStyle(node).backgroundColor);
    const hex = category.color.replace('#', '');
    const expanded = hex.length === 3 ? [...hex].map((digit) => digit + digit).join('') : hex;
    const rgb = [0, 2, 4].map((offset) => parseInt(expanded.slice(offset, offset + 2), 16));
    assert(color === `rgb(${rgb.join(', ')})`, `${category.name} row retains its activity color`);
  }
}
async function checked(id, expected) {
  const deadline = Date.now() + 1500;
  let actual;
  do {
    actual = await $(`bulk-day-session-${id}`).getAttribute('aria-checked');
    if (actual === String(expected)) return;
    await page.waitForTimeout(50);
  } while (Date.now() < deadline);
  assert(false, `Session ${id} inclusion should be ${expected}; got ${actual}`);
}
async function openDrafts() {
  await tap('menu', 180);
  await tap('menu-drafts', 200);
  await h.visible('drafts-sheet');
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
    detailedSurf = baseline.find((row) => row.notes === 'Surf con durata 1.3.3');
    bareSurf = baseline.find((row) => row.date === mixedDate && row.category_id === detailedSurf?.category_id && row.id !== detailedSurf.id);
    categories = await rows('categories');
    assert(corsa && solo && solo.duration_sec === 4500, 'Delete fixtures have unambiguous IDs and real interval timing');
    assert(detailedSurf && bareSurf, 'Detailed and duplicate Surf rows remain distinct');
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

  await check('Nuove Sessioni groups every selected date with activity colors and supports an individual edit', async () => {
    await home();
    await mode('new');
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    await tap(`day-${mixedDate}`, 80);
    await tap(`day-${emptyDate}`, 80);
    await jumpMonth(2026, 8);
    await tap(`day-${soloDate}`, 80);
    await expectSelection();
    await sessionList('new');
    for (const date of selectedDates) assert(await $(`selected-sessions-day-${date}`).count() === 1, `Sessioni has one group for ${date}`);
    assert(await $('bulk-day-sheet').locator('[role="button"][data-testid^="session-"]').count() === 4, 'Nuove shows saved sessions from all activities across the selected dates');
    assert(/Nessuna sessione/i.test(await text(`selected-sessions-day-${emptyDate}`)), 'An empty selected date is represented honestly');
    assert((await text(`selected-sessions-day-${mixedDate}`)).includes('Surf') && (await text(`selected-sessions-day-${mixedDate}`)).includes('Corsa'), 'Activity names accompany the colored rows');
    await expectSessionColors(baseline);
    await $(`selected-sessions-day-${mixedDate}`).scrollIntoViewIfNeeded();
    screenshots.push(await screenshot('05-common-sessioni-multiday-colors'));
    const note = 'Nota singola da Sessioni 1.3.3';
    await tap(`session-${detailedSurf.id}`, 180);
    await h.visible('session-editor');
    assert(await $('session-notes').inputValue() === detailedSurf.notes, 'An individual row opens its own stored details');
    await fill('session-notes', note);
    await tap('session-save', 350);
    await h.visible('bulk-day-sheet');
    const updated = await waitForRows((result) => result.find((row) => row.id === detailedSurf.id)?.notes === note, 'The individual Sessioni edit persists');
    for (const prior of baseline) {
      const current = updated.find((row) => row.id === prior.id);
      if (prior.id === detailedSurf.id) equalRows({ ...current, notes: prior.notes, updated_at: prior.updated_at }, prior, 'Individual editing preserves every other field');
      else equalRows(current, prior, 'Individual editing preserves all other saved records');
    }
    baseline = updated;
    assert((await text(`session-${detailedSurf.id}`)).includes(note), 'Saving returns to the refreshed common Sessioni sheet');
    const inCommon = (id) => $('bulk-day-sheet').getByTestId(id).first();
    await inCommon(`day-delete-${bareSurf.id}`).tap();
    equalRows(await waitForRows((result) => result.length === baseline.length - 1, 'Nuove trash immediately deletes its chosen row'), baseline.filter((row) => row.id !== bareSurf.id), 'Nuove deletion preserves every other saved record');
    await expectUndo(inCommon);
    await undoTwice(inCommon);
    await expectSelection();
    await tap('bulk-day-done', 180);
    await expectSelection();
    await switchTo('Corsa');
    await sessionList('new');
    assert(await $('bulk-day-sheet').locator('[role="button"][data-testid^="session-"]').count() === 4, 'Nuove consultation retains all activities when the active activity changes');
    await tap('bulk-day-done', 150);
    await neutral();
    await sessionList('new');
    assert(await $('bulk-day-sheet').locator('[role="button"][data-testid^="session-"]').count() === 4, 'Neutral Nuove uses the same complete Sessioni view');
    await tap('bulk-day-done', 150);
    await expectSelection();
    equalRows(await rows(), baseline, 'Consultation and focus changes do not save extra records');
  });

  await check('Modifica Sessioni preserves activity scope date selection and individual exclusions through a real bulk edit', async () => {
    await switchTo('Surf');
    await mode('edit');
    await sessionList('edit');
    assert(await $('bulk-day-sheet').locator('[role="checkbox"][data-testid^="bulk-day-session-"]').count() === 3, 'Active Surf editing includes its three saved records only');
    assert(await $(`bulk-day-session-${corsa.id}`).count() === 0, 'The other activity stays outside the active edit scope');
    await expectSessionColors(baseline.filter((row) => row.category_id === detailedSurf.category_id));
    await checked(bareSurf.id, true);
    await tap(`bulk-day-session-${bareSurf.id}`, 80);
    await checked(bareSurf.id, false);
    await tap('bulk-day-done', 150);
    await switchTo('Corsa');
    await sessionList('edit');
    assert(await $('bulk-day-sheet').locator('[role="checkbox"][data-testid^="bulk-day-session-"]').count() === 1, 'Corsa editing shows its own record');
    await checked(corsa.id, true);
    await expectSessionColors([corsa]);
    await tap('bulk-day-done', 150);
    await neutral();
    await sessionList('edit');
    assert(await $('bulk-day-sheet').locator('[role="checkbox"][data-testid^="bulk-day-session-"]').count() === 4, 'Neutral editing includes all saved activities');
    await checked(bareSurf.id, false);
    for (const id of [detailedSurf.id, corsa.id, solo.id]) await checked(id, true);
    await tap('bulk-day-done', 150);
    await mode('new');
    await sessionList('new');
    await tap('bulk-day-done', 150);
    await mode('edit');
    await sessionList('edit');
    await checked(bareSurf.id, false);
    await tap('bulk-day-done', 150);
    await expectSelection();
    equalRows(await rows(), baseline, 'Date, mode, activity and inclusion choices do not alter saved rows');
    await tap('bulk-edit', 180);
    await h.visible('bulk-details-sheet');
    await tap('bulk-notes-set', 80);
    const note = 'Nota comune Sessioni 1.3.3';
    await fill('bulk-notes-input', note);
    await tap('bulk-save', 350);
    const updated = await waitForRows((result) => result.filter((row) => row.notes === note).length === 3, 'The reviewed included records receive the shared note');
    for (const prior of baseline) {
      const current = updated.find((row) => row.id === prior.id);
      if (prior.id === bareSurf.id) equalRows(current, prior, 'The excluded duplicate stays completely unchanged');
      else equalRows({ ...current, notes: prior.notes, updated_at: prior.updated_at }, prior, 'The bulk edit changes only the reviewed note and update timestamp');
    }
    assert(updated.length === baseline.length, 'Bulk editing creates and deletes no sessions');
    baseline = updated;
    await expectSelection();
    await dismissMessage();
  });

  await check('Bozze exposes shared dates and per-activity details and discards them without touching saved sessions', async () => {
    await mode('new');
    await switchTo('Surf');
    await details(async () => {
      await fill('details-notes', 'Bozza Surf da scartare');
      await fill('details-place-name', 'Luogo della bozza Surf');
      await tap('details-timing-mode-duration_only', 80);
      await fill('details-timing-duration-input', '45');
    });
    await switchTo('Corsa');
    await details(async () => {
      await fill('details-notes', 'Bozza Corsa da conservare prima dello scarto totale');
      await fill('details-place-name', 'Luogo della bozza Corsa');
    });
    for (const id of [detailedSurf.category_id, corsa.category_id]) {
      assert(await $(`activity-pill-${id}`).evaluate((node) => node.children.length) === 2, 'Activity pills contain the identity disc and name with no trailing legacy draft dot');
    }
    assert(!/date da salvare/.test(await label('activity-Surf')) && !/date da salvare/.test(await label('activity-Corsa')), 'Activity labels omit stale per-activity date counts');
    await expectSelection();
    await openDrafts();
    const surfDraft = `draft-${detailedSurf.category_id}`;
    const corsaDraft = `draft-${corsa.category_id}`;
    const selectionCopy = await text('drafts-selection');
    assert(/18.*ago/i.test(selectionCopy) && /8.*set/i.test(selectionCopy) && /23.*set/i.test(selectionCopy), 'Bozze lists the exact selected dates across both months');
    assert((await text(surfDraft)).includes('Bozza Surf da scartare') && (await text(surfDraft)).includes('Luogo della bozza Surf') && /45\s*min/.test(await text(surfDraft)), 'Bozze exposes the prepared note place and timing');
    assert((await text(corsaDraft)).includes('Bozza Corsa da conservare prima dello scarto totale'), 'A second activity keeps its own prepared details');
    screenshots.push(await screenshot('06-drafts-prepared-dates-and-details'));
    await tap(`draft-delete-${detailedSurf.category_id}`, 180);
    assert(await $(surfDraft).count() === 0 && await $(corsaDraft).isVisible() && await $('drafts-selection').isVisible(), 'Discarding one activity draft preserves the shared dates and the other activity');
    await expectSelection();
    await tap('drafts-clear-selection', 180);
    assert(await $('drafts-selection').count() === 0 && await $(corsaDraft).isVisible(), 'Discarding shared dates preserves prepared activity details');
    await expectSelection([]);
    await tap('drafts-clear-all', 100);
    await h.visible('drafts-confirm-clear-all');
    await tap('drafts-cancel-clear-all', 100);
    assert(await $(corsaDraft).isVisible(), 'Cancelling discard-all retains the remaining draft');
    await tap('drafts-clear-all', 100);
    await tap('drafts-confirm-clear-all', 180);
    await h.visible('drafts-empty');
    assert((await text('drafts-empty')).includes('Nessuna bozza'), 'Discard-all leaves an honest empty state');
    await waitForRows((result) => result.length === 0, 'All draft snapshots are removed durably', 'category_drafts');
    await tap('sheet-close', 150);
    await reload();
    await expectSelection([]);
    equalRows(await rows(), baseline, 'Discarding drafts and reloading preserves every complete saved session row');
    equalRows(await rows('named_periods'), [savedPeriod], 'Discarding drafts also preserves named period metadata');
    await openDrafts();
    await h.visible('drafts-empty');
    assert(await $('drafts-selection').count() === 0 && await rows('category_drafts').then((result) => result.length === 0), 'Reload restores neither the shared dates nor stale activity draft snapshots');
    assert(dialogs.length === 0 && h.errors.length === 0, 'Shared Sessioni and Bozze have no unexpected confirmation or runtime error');
  });
  console.log(`Screenshots:\n${screenshots.join('\n')}`);
} finally {
  await h.finish();
}
