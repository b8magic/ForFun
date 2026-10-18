// 1.3 regressions against the production web bundle and its persisted SQLite.
// Browser plugin not available: use the repository's installed Playwright.
// The flow under test is Home -> compact details / real toast gestures /
// inline history / explicit bulk editing -> exact saved data and drafts survive.
// tools/build-web.sh && node tools/e2e-v13.mjs
import initSqlJs from 'sql.js';
import fs from 'node:fs';
import path from 'node:path';
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v13');
const { page, $, tap, fill, text, label, body, home, reload, switchTo, jumpMonth, details, save, screenshot } = h;
const SQL = await initSqlJs();
const mapUrl = 'https://www.google.com/maps/place/Livorno/@43.5485,10.3106,15z';
const history = () => $('time-place');
const historyItem = (id) => history().getByTestId(id).first();
const inlineRows = () => $('history-day-details').locator('[role="button"][data-testid^="session-"]');
const selected = async (date) => /selezionato, da salvare/.test(await label(`day-${date}`));
const equalRows = (actual, expected, message) => assert(JSON.stringify(actual) === JSON.stringify(expected), message);
const revealDiagnostics = [];
const revealProblems = [];
async function check(name, run) {
  await h.check(name, async () => {
    await run();
    if (name.startsWith('inline history keeps') && revealProblems.length) throw new Error(`Inline reveal clips saved details: ${JSON.stringify(revealProblems)}`);
  });
  if (h.results.at(-1)?.error?.startsWith('Inline reveal clips')) return;
  // Every later journey declares fixtures created above. Preserve the original
  // failure and finish its report instead of producing dependent timeouts.
  assert(h.results.at(-1)?.ok, `Prerequisite journey failed: ${name}`);
}

// Read the real persisted database. Touch gestures must not merely leave a
// painted marker behind while accidentally undoing or editing a saved row.
async function persistedBytes() {
  return page.evaluate(() => new Promise((resolve, reject) => {
    const open = indexedDB.open('serie', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const request = database.transaction('sqlite', 'readonly').objectStore('sqlite').get('db');
      request.onerror = () => { database.close(); reject(request.error); };
      request.onsuccess = () => { database.close(); resolve(Array.from(new Uint8Array(request.result))); };
    };
  }));
}
async function sessionRows() {
  const database = new SQL.Database(new Uint8Array(await persistedBytes()));
  try {
    const statement = database.prepare('SELECT * FROM sessions ORDER BY id');
    const rows = [];
    try { while (statement.step()) rows.push(statement.getAsObject()); }
    finally { statement.free(); }
    return rows;
  } finally { database.close(); }
}
async function categoryId(name) {
  const database = new SQL.Database(new Uint8Array(await persistedBytes()));
  try {
    const statement = database.prepare('SELECT id FROM categories WHERE name = ?');
    try {
      statement.bind([name]);
      assert(statement.step(), `Category ${name} exists`);
      return statement.getAsObject().id;
    } finally { statement.free(); }
  } finally { database.close(); }
}
async function seedSavedSeconds(id, seconds) {
  // This isolated fixture models a pre-existing/imported duration with seconds.
  // Runtime app code remains unchanged; the next load uses the real driver.
  const database = new SQL.Database(new Uint8Array(await persistedBytes()));
  let bytes;
  try {
    database.run('UPDATE sessions SET declared_sec = ?, duration_sec = ? WHERE id = ?', [seconds, seconds, id]);
    assert(database.getRowsModified() === 1, 'The precision fixture changes exactly one saved session');
    bytes = Array.from(database.export());
  } finally { database.close(); }
  await page.evaluate((contents) => new Promise((resolve, reject) => {
    const open = indexedDB.open('serie', 1);
    open.onerror = () => reject(open.error);
    open.onsuccess = () => {
      const database = open.result;
      const transaction = database.transaction('sqlite', 'readwrite');
      transaction.objectStore('sqlite').put(new Uint8Array(contents).buffer, 'db');
      transaction.oncomplete = () => { database.close(); resolve(); };
      transaction.onerror = () => { database.close(); reject(transaction.error); };
    };
  }), bytes);
}
async function fit(ids) {
  const width = page.viewportSize().width;
  for (const id of ids) {
    const box = await $(id).boundingBox();
    assert(box && box.width > 0 && box.x >= -1 && box.x + box.width <= width + 1, `${id} fits ${width}px: ${JSON.stringify(box)}`);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
}
async function openInline(date, wait = 850) {
  await historyItem(`mini-${date}`).scrollIntoViewIfNeeded();
  await historyItem(`mini-${date}`).tap();
  await h.visible('history-day-details');
  await page.waitForTimeout(wait);
  assert(await $(`history-day-${date}`).isVisible(), `Inline selection belongs to ${date}`);
  assert(await $('day-sheet').count() === 0, 'Consulting history does not open a day sheet');
}
async function dismissMessage() {
  if (await $('toast-dismiss').count()) await tap('toast-dismiss', 200);
}
async function physicalDrag(id, dx, dy) {
  await h.visible(id);
  const box = await $(id).boundingBox();
  assert(box, `${id} has a physical touch target`);
  const viewport = page.viewportSize();
  const start = { x: box.x + box.width / 2, y: box.y + box.height / 2 };
  const end = { x: Math.max(4, Math.min(viewport.width - 4, start.x + dx)), y: Math.max(4, Math.min(viewport.height - 4, start.y + dy)) };
  const cdp = await h.context.newCDPSession(page);
  let paint;
  try {
    const points = (x, y) => [{ x, y, radiusX: 3, radiusY: 3, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: points(start.x, start.y) });
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: points(start.x + (end.x - start.x) * step / 12, start.y + (end.y - start.y) * step / 12) });
      await page.waitForTimeout(18);
    }
    paint = await $('toast-swipe').evaluate((node) => {
      const matrix = new DOMMatrixReadOnly(getComputedStyle(node).transform);
      return { x: matrix.m41, y: matrix.m42 };
    });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(190);
  } finally { await cdp.detach(); }
  return { dx: end.x - start.x, dy: end.y - start.y, paint };
}

let preciseId;
let surfId;
let corsaId;
let beforeBulk;
let bulkIds;

try {
  await home();
  await check('Home year matches month typography and smaller pills retain full touch targets at 390px and 320px', async () => {
    assert(page.url() === h.url && /Serie/i.test(await page.title()), 'Correct entry page and title');
    assert(/Surf/.test(await body()), 'Meaningful first viewport');
    assert(!/Uncaught Error|Failed to compile|Something went wrong/i.test(await body()), 'No framework overlay');
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(250);
      const year = await $('home-year').evaluate((node) => ({ font: getComputedStyle(node).fontFamily, size: parseFloat(getComputedStyle(node).fontSize) }));
      const month = await $('home-month-2026-10').getByText(/^Ottobre\s+2026$/).first().evaluate((node) => getComputedStyle(node).fontFamily);
      assert(year.font === month && /SerieDisplay-Condensed/.test(year.font), `Home year shares the month font (${year.font} / ${month})`);
      assert(year.size >= 28, 'The year remains readable');
      for (const name of ['Surf', 'Corsa']) {
        const target = await $(`activity-${name}`).boundingBox();
        const pill = await $(`activity-${name}`).locator('[data-testid^="activity-pill-"]').boundingBox();
        assert(target?.height >= 44 && target.width >= 44, `${name} keeps a 44px touch target`);
        assert(pill?.height >= 34 && pill.height <= 38 && pill.height < target.height, `${name} has a compact visible pill (${pill?.height}px)`);
      }
      await fit(['home-year', 'activity-dock', 'manage-activities', 'month-list', 'menu']);
      const neighbor = await $('activity-Surf').boundingBox();
      await switchTo('Corsa');
      const after = await $('activity-Surf').boundingBox();
      assert(Math.abs(after.x - neighbor.x) <= 1, 'Choosing a visible neighboring activity does not shift the rail');
      await switchTo('Surf');
      await screenshot(`01-compact-home-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    surfId = await categoryId('Surf');
    corsaId = await categoryId('Corsa');
  });

  await check('one numeric duration formats sequential digits, paste, range edits and suffix backspace without instructional copy', async () => {
    await jumpMonth(2026, 9);
    await tap('day-2026-09-15');
    await tap('details-link', 400);
    assert(!/facoltativo/i.test(await text('details-sheet')), 'Details omit optional labels');
    assert(!(await $('details-notes').getAttribute('placeholder')), 'Notes have no placeholder');
    await fill('details-notes', 'Prima riga della nota\nSeconda riga conservata integralmente');
    await fill('details-place-name', 'Livorno');
    await fill('details-place-link', mapUrl);
    await tap('details-timing-mode-duration_only');
    const input = $('details-timing-duration-input');
    assert((await input.getAttribute('inputmode')) === 'numeric', 'The duration requests a numeric keypad');
    assert((await input.getAttribute('aria-label')) === 'Durata, ore e minuti', 'One duration field has a complete accessible name');
    assert(await $('details-timing-duration').locator('input').count() === 1, 'Duration has exactly one input');
    await input.scrollIntoViewIfNeeded();
    await input.fill('');
    await input.pressSequentially('1237', { delay: 90 });
    assert((await input.inputValue()) === '12h37m', 'Sequential numeric typing formats hours and minutes');
    await input.press('Backspace');
    assert((await input.inputValue()) === '1h23m', 'Backspace after m deletes the last numeric digit');
    await input.pressSequentially('7');
    assert((await input.inputValue()) === '12h37m', 'Appending after backspace continues the digit stream');
    await input.press('Home');
    await input.press('Shift+ArrowRight');
    await input.press('Shift+ArrowRight');
    await input.pressSequentially('3');
    assert((await input.inputValue()) === '3h37m', 'Replacing selected hour digits retains minutes');
    for (const pasted of ['1237', '12:37', '12h37m']) {
      await input.fill(pasted);
      await input.blur();
      assert((await input.inputValue()) === '12h37m', `Pasted ${pasted} represents the same duration`);
    }
    assert(await $('details-timing-source').count() === 0 && !/^= /m.test(await text('details-timing-duration')), 'Declared duration has no repeated source or echo');
    await fill('details-timing-duration-input', '130');
    await page.setViewportSize({ width: 320, height: 500 });
    await input.scrollIntoViewIfNeeded();
    await fit(['details-timing-duration-input', 'details-apply']);
    await screenshot('02-compact-duration-320');
    await tap('details-apply', 450);
    assert(await $('details-sheet').count() === 0, 'The visible footer applies and closes details');
    await page.setViewportSize({ width: 390, height: 844 });
    await save();
    await dismissMessage();
    preciseId = (await sessionRows()).find((row) => row.date === '2026-09-15').id;
  });

  await check('a saved second-precision duration survives a notes-only edit through inline history', async () => {
    await seedSavedSeconds(preciseId, 5453);
    await reload();
    await tap('history-handle', 650);
    await openInline('2026-09-15');
    await inlineRows().first().tap();
    await h.visible('session-editor');
    assert(!(await $('session-notes').getAttribute('placeholder')), 'Session notes have no placeholder');
    assert(!/facoltativo/i.test(await text('session-editor')), 'Session sections omit optional labels');
    assert((await $('session-timing-duration-input').inputValue()) === '1h30m', 'The compact input presents the existing minute component');
    assert(/53 secondi/.test(await text('session-timing-duration-precision')), 'Saved seconds remain explicitly visible');
    await fill('session-notes', 'Nota inline aggiornata\nSeconda riga ancora salvata');
    await tap('session-save', 650);
    await h.visible('history-day-details');
    assert(await $('history-day-2026-09-15').isVisible(), 'Editing returns to the same expanded history day');
    const saved = (await sessionRows()).find((row) => row.id === preciseId);
    assert(saved.declared_sec === 5453 && saved.duration_sec === 5453, 'A notes edit preserves both exact saved duration fields');
    assert(saved.notes === 'Nota inline aggiornata\nSeconda riga ancora salvata', 'Multiline notes remain complete in storage');
    await dismissMessage();
  });

  await check('inline history keeps duration, place and one note line visible at 390px and 320px and restores the editor origin', async () => {
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(300);
      for (const repetition of [1, 2, 3]) {
        await tap('history-day-close', 150);
        await openInline('2026-09-15');
        const preview = await text('history-day-details');
        assert(/1 h 31 min/.test(preview) && /Livorno/.test(preview) && /Nota inline aggiornata/.test(preview), 'Each saved detail is visible in the calendar preview; the summary rounds 5453 seconds to91 minutes');
        assert(!/Seconda riga ancora salvata/.test(preview), 'The inline preview bounds notes to their first line');
        await fit(['history-day-details', `session-place-preview-${preciseId}`, `session-notes-preview-${preciseId}`]);
        const diagnostic = {
          width, repetition, stage: 'reopen after notes-only editor return',
          viewport: await history().boundingBox(), list: await historyItem('month-list').boundingBox(),
          panel: await $('history-day-details').boundingBox(), row: await inlineRows().first().boundingBox(),
          scrollY: await historyItem('month-list').evaluate((node) => node.scrollTop), fields: {},
        };
        for (const id of [`session-place-preview-${preciseId}`, `session-notes-preview-${preciseId}`]) {
          const box = await $(id).boundingBox();
          diagnostic.fields[id] = box;
          if (box.y < 0 || box.y + box.height > page.viewportSize().height) revealProblems.push({ width, repetition, id, box });
        }
        revealDiagnostics.push(diagnostic);
        fs.writeFileSync(path.join(h.shots, 'reveal-diagnostics.json'), JSON.stringify(revealDiagnostics, null, 2));
        console.log(`Inline reveal geometry ${JSON.stringify(diagnostic)}`);
      }
      await screenshot(`03-inline-history-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await tap('filter-Surf', 350);
    assert(await $('history-day-details').count() === 0, 'Changing the filter clears the expanded day');
    await openInline('2026-09-15');
    const before = await historyItem('month-list').evaluate((node) => node.scrollTop);
    await inlineRows().first().tap();
    await h.visible('session-editor');
    assert((await $('session-notes').inputValue()) === 'Nota inline aggiornata\nSeconda riga ancora salvata', 'The editor retains every note line');
    await tap('sheet-close', 450);
    await h.visible('history-day-details');
    assert(await $('history-day-2026-09-15').isVisible() && (await $('filter-Surf').getAttribute('aria-selected')) === 'true', 'Closing the editor preserves selected day and activity filter');
    const after = await historyItem('month-list').evaluate((node) => node.scrollTop);
    assert(Math.abs(after - before) <= 2, `Closing the editor preserves history scroll (${before} -> ${after})`);
    await openInline('2026-09-16');
    assert(await $('history-day-empty').isVisible() && await inlineRows().count() === 0, 'Choosing an empty day replaces the preview honestly');
    assert(await $('history-day-2026-09-15').count() === 0, 'Only one selected day remains expanded');
    await historyItem('month-2026-09').scrollIntoViewIfNeeded();
    await historyItem('month-2026-09').tap();
    await page.waitForTimeout(350);
    assert(await $('history-day-details').count() === 0, 'Collapsing its month clears inline details');
    await historyItem('month-2026-09').tap();
    await page.waitForTimeout(350);
    await tap('back-to-log', 450);
    await jumpMonth(2026, 9);
  });

  for (const [direction, date, dx, dy] of [
    ['left', '2026-09-20', -100, 0], ['right', '2026-09-20', 100, 0],
    ['up', '2026-09-21', 0, -100], ['down', '2026-09-22', 0, 100],
  ]) {
    await check(`a real ${direction} toast swipe dismisses only the message and preserves every saved SQLite row`, async () => {
      await tap(`day-${date}`);
      if (direction === 'left') await details(async () => {
        await fill('details-notes', 'Prima sessione Surf da modificare');
        await fill('details-place-name', 'Punto originale');
        await tap('details-timing-mode-duration_only');
        await fill('details-timing-duration-input', '45');
      });
      await save();
      await h.visible('toast-action');
      const before = await sessionRows();
      const started = Date.now();
      // Starting one drag directly on Undo verifies capture cancels its press.
      const gesture = await physicalDrag(direction === 'left' ? 'toast-action' : 'toast-swipe', dx, dy);
      assert(Math.hypot(gesture.paint.x, gesture.paint.y) >= 40, `The message follows the physical ${direction} gesture: ${JSON.stringify(gesture)}`);
      await $('toast').waitFor({ state: 'hidden', timeout: 1200 });
      assert(Date.now() - started < 2200, 'The gesture dismisses before the six-second automatic expiry');
      equalRows(await sessionRows(), before, `${direction} dismissal keeps every session field and id unchanged`);
      assert((await $('save').getAttribute('aria-disabled')) === 'true', 'The saved draft stays cleared');
      const count = direction === 'right' ? 2 : 1;
      assert(new RegExp(`${count} session${count === 1 ? 'e' : 'i'} registrat`).test(await label(`day-${date}`)), 'The saved session count stays visible');
      await screenshot(`04-toast-${direction}-saved-data`);
    });
  }

  await check('a short physical drag keeps the toast and subsequent keyboard Undo removes only its own save', async () => {
    const before = await sessionRows();
    await tap('day-2026-09-23');
    await save();
    const saved = await sessionRows();
    assert(saved.length === before.length + 1, 'The Undo fixture saves exactly one session');
    await physicalDrag('toast-swipe', 20, 0);
    assert(await $('toast-action').isVisible(), 'A sub-threshold drag leaves Undo available');
    equalRows(await sessionRows(), saved, 'A short drag does not undo anything');
    await page.waitForTimeout(220);
    await $('toast-action').focus();
    await $('toast-action').press('Enter');
    await page.waitForTimeout(650);
    equalRows(await sessionRows(), before, 'Keyboard Undo removes only its captured latest batch');
    assert(/nessuna sessione registrata/.test(await label('day-2026-09-23')), 'The intentionally undone date is empty');
    await dismissMessage();
  });

  await check('tap dismissal and restart retain all four swiped saves and their complete details', async () => {
    await tap('day-2026-09-26');
    await save();
    const before = await sessionRows();
    await tap('toast-dismiss', 250);
    equalRows(await sessionRows(), before, 'Tapping the message also leaves saved data unchanged');
    await reload();
    await jumpMonth(2026, 9);
    equalRows(await sessionRows(), before, 'Every saved row survives restart');
    for (const [day, count] of [['20', 2], ['21', 1], ['22', 1]]) {
      assert(new RegExp(`${count} session${count === 1 ? 'e' : 'i'} registrat`).test(await label(`day-2026-09-${day}`)), `Restart retains ${count} session(s) on ${day}`);
    }
    await screenshot('05-swiped-saves-after-restart');
  });

  // Bulk regression checks below share only these explicit, locally-created
  // fixtures. They never reuse or modify the native upgrade/export fixture.
  await check('explicit edit mode selects duplicate sessions individually, excludes other activities and preserves the new-session draft', async () => {
    await switchTo('Corsa');
    await tap('day-2026-09-20');
    await details(async () => {
      await fill('details-notes', 'Corsa esclusa dalla modifica Surf');
      await fill('details-place-name', 'Luogo Corsa');
      await tap('details-timing-mode-duration_only');
      await fill('details-timing-duration-input', '35');
    });
    await save();
    await dismissMessage();
    await switchTo('Surf');
    await tap('day-2026-09-24');
    await details(async () => {
      await fill('details-notes', 'Bozza Surf da mantenere');
      await fill('details-place-name', 'Luogo della bozza');
      await tap('details-timing-mode-duration_only');
      await fill('details-timing-duration-input', '205');
    });
    beforeBulk = await sessionRows();
    const candidates = beforeBulk.filter((row) => row.category_id === surfId && row.date === '2026-09-20');
    assert(candidates.length === 2, 'The fixture has two separate Surf sessions on one mixed-activity day');
    const detailed = candidates.find((row) => row.notes === 'Prima sessione Surf da modificare');
    const nextDay = beforeBulk.find((row) => row.category_id === surfId && row.date === '2026-09-21');
    assert(detailed && nextDay, 'The intended records exist before editing');
    bulkIds = [detailed.id, nextDay.id];
    await tap('home-mode-edit');
    assert((await $('home-mode-edit').getAttribute('aria-checked')) === 'true', 'Existing-session mode is explicit');
    assert(await $('save').count() === 0, 'The edit footer exposes its own update action');
    assert((await $('day-2026-09-28').getAttribute('aria-disabled')) === 'true', 'An empty day cannot enter an edit selection');
    await $('day-2026-09-28').tap({ force: true });
    assert((await $('bulk-edit').getAttribute('aria-disabled')) === 'true', 'An empty-day tap leaves the edit selection empty');
    await tap('day-2026-09-20');
    await h.visible('bulk-day-sheet');
    assert(await $('bulk-day-sheet').locator('[role="checkbox"][data-testid^="bulk-day-session-"]').count() === 2, 'The checklist contains only the two active-activity records');
    const corsa = beforeBulk.find((row) => row.category_id === corsaId && row.date === '2026-09-20');
    assert(await $(`bulk-day-session-${corsa.id}`).count() === 0, 'The other activity has no checkbox in this selection');
    await tap('bulk-day-all');
    for (const row of candidates) assert((await $(`bulk-day-session-${row.id}`).getAttribute('aria-checked')) === 'true', 'Select-all selects each duplicate separately');
    await tap('bulk-day-all');
    await tap(`bulk-day-session-${detailed.id}`);
    assert((await $(`bulk-day-session-${detailed.id}`).getAttribute('aria-checked')) === 'true', 'A duplicate can be selected by its own id');
    assert((await $(`bulk-day-session-${candidates.find((row) => row.id !== detailed.id).id}`).getAttribute('aria-checked')) === 'false', 'The other duplicate remains unselected');
    await tap('bulk-day-done', 350);
    await tap('day-2026-09-21');
    assert(/2 sessioni · 2 giorni/.test(await text('bulk-selection-count')), 'The selection counts records and distinct days independently');
    equalRows(await sessionRows(), beforeBulk, 'Changing modes and selections writes no session');
    await tap('bulk-edit', 350);
  });

  await check('bulk notes update keeps timing and place, preserves every unselected row and creates no session', async () => {
    await h.visible('bulk-details-sheet');
    for (const field of ['notes', 'place', 'timing']) assert((await $(`bulk-${field}-keep`).getAttribute('aria-checked')) === 'true', 'Every field begins with explicit Keep');
    assert((await $('bulk-save').getAttribute('aria-disabled')) === 'true', 'All-Keep offers no save');
    await tap('bulk-notes-set');
    assert(!(await $('bulk-notes-input').getAttribute('placeholder')), 'Bulk notes also have no placeholder');
    await fill('bulk-notes-input', '');
    await tap('bulk-save', 250);
    assert(await $('bulk-details-sheet').isVisible() && /Scrivi una nota oppure scegli Rimuovi/.test(await text('bulk-details-sheet')), 'Empty Set requires an explicit Clear choice');
    equalRows(await sessionRows(), beforeBulk, 'An invalid empty Set changes no saved data');
    await fill('bulk-notes-input', 'Aggiornata in blocco 1.3');
    await page.setViewportSize({ width: 320, height: 500 });
    await $('bulk-notes-input').scrollIntoViewIfNeeded();
    await fit(['bulk-notes-input', 'bulk-save']);
    await screenshot('06-bulk-notes-320');
    await tap('bulk-save', 650);
    await h.visible('lineup');
    await page.setViewportSize({ width: 390, height: 844 });
    const after = await sessionRows();
    assert(after.length === beforeBulk.length && after.every((row, index) => row.id === beforeBulk[index].id), 'Bulk editing retains every original id and session count');
    for (const prior of beforeBulk) {
      const current = after.find((row) => row.id === prior.id);
      if (bulkIds.includes(prior.id)) {
        equalRows({ ...current, notes: prior.notes, updated_at: prior.updated_at }, prior, 'Setting notes keeps date, activity, timing, place, origin and save identity');
        assert(current.notes === 'Aggiornata in blocco 1.3', 'Only selected records receive the note');
      } else equalRows(current, prior, 'Every unselected duplicate and other-activity row stays byte-for-byte equivalent');
    }
    assert((await $('home-mode-edit').getAttribute('aria-checked')) === 'true' && (await $('bulk-edit').getAttribute('aria-disabled')) === 'true', 'Success remains in edit mode and clears its own selection');
    await dismissMessage();
    await tap('home-mode-new');
    assert(await selected('2026-09-24'), 'Returning to New restores the original draft date');
    await details(async () => {
      assert((await $('details-notes').inputValue()) === 'Bozza Surf da mantenere', 'Bulk editing retains draft notes');
      assert((await $('details-place-name').inputValue()) === 'Luogo della bozza', 'Bulk editing retains the draft place');
      assert((await $('details-timing-duration-input').inputValue()) === '2h05m', 'Bulk editing retains the draft duration');
    });
  });

  await check('explicit bulk clear removes only chosen fields and cancellation cannot save pending changes', async () => {
    await tap('home-mode-edit');
    await tap('day-2026-09-20');
    await h.visible('bulk-day-sheet');
    await tap(`bulk-day-session-${bulkIds[0]}`);
    await tap('bulk-day-done', 350);
    await tap('day-2026-09-21');
    await tap('bulk-edit', 350);
    const before = await sessionRows();
    await tap('bulk-place-clear');
    await tap('bulk-timing-clear');
    await Promise.all([
      page.waitForEvent('dialog').then(async (dialog) => { assert(dialog.type() === 'confirm', 'Dirty bulk fields ask before discard'); await dialog.dismiss(); }),
      $('sheet-close').tap(),
    ]);
    assert(await $('bulk-details-sheet').isVisible(), 'Keep editing retains pending Clear choices');
    equalRows(await sessionRows(), before, 'Canceling discard cannot write pending edits');
    await tap('bulk-save', 650);
    const after = await sessionRows();
    for (const prior of before) {
      const current = after.find((row) => row.id === prior.id);
      if (bulkIds.includes(prior.id)) {
        assert(current.notes === prior.notes && current.date === prior.date && current.category_id === prior.category_id && current.created_at === prior.created_at, 'Clear keeps notes and immutable identity');
        assert(current.timing_state === 'date_only' && current.duration_sec === null && current.declared_sec === null && current.duration_source === null, 'Explicit Clear restores unknown duration');
        assert(current.place_label === null && current.place_address === null && current.map_url === null && current.lat === null && current.lng === null, 'Explicit Clear removes the chosen place');
      } else equalRows(current, prior, 'Unselected rows remain exact after Clear');
    }
    assert(after.length === before.length, 'Clear never creates or deletes sessions');
    await dismissMessage();
    await tap('home-mode-new');
    assert(await selected('2026-09-24'), 'Clearing saved details keeps the unsaved draft');
    await reload();
    await jumpMonth(2026, 9);
    equalRows(await sessionRows(), after, 'Bulk updates survive restart with the same ids');
    assert(await selected('2026-09-24'), 'The independent new-session draft also survives restart');
    await details(async () => {
      assert((await $('details-notes').inputValue()) === 'Bozza Surf da mantenere', 'Restart retains draft notes after bulk Clear');
      assert((await $('details-timing-duration-input').inputValue()) === '2h05m', 'Restart retains draft duration after bulk Clear');
    });
    await screenshot('07-bulk-after-restart');
  });

  await check('a long activity name stays accessible and its compact chip is revealed within the 320px rail', async () => {
    const name = 'Allenamento sul lungomare al tramonto';
    const before = await sessionRows();
    await tap('manage-activities', 350);
    await tap('activity-new');
    await fill('activity-name', name);
    await tap('activity-submit', 450);
    await tap(`manage-activity-${name}`);
    await tap('activity-use', 450);
    await page.setViewportSize({ width: 320, height: 844 });
    await page.waitForTimeout(300);
    const rail = await $('activity-rail').boundingBox();
    const target = await $(`activity-${name}`).boundingBox();
    assert(target && rail && target.x >= rail.x - 1 && target.x + target.width <= rail.x + rail.width + 1, 'A newly selected offscreen chip is revealed in the available rail');
    assert((await label(`activity-${name}`)).includes(name), 'The complete activity name stays available to assistive technology');
    const typography = await $(`activity-${name}`).getByText(name, { exact: true }).evaluate((node) => ({ font: parseFloat(getComputedStyle(node).fontSize), width: node.getBoundingClientRect().width }));
    assert(typography.font === 14 && typography.width <= 150, 'Long labels keep the compact type size and bounded width');
    await fit(['activity-dock', 'manage-activities', 'home-year']);
    equalRows(await sessionRows(), before, 'Creating and selecting an activity never edits existing sessions');
    await screenshot('08-long-activity-320');
    await page.setViewportSize({ width: 390, height: 844 });
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    assert(await selected('2026-09-24'), 'The earlier draft survives the long-name activity switch');
  });
} finally {
  await h.finish();
}
