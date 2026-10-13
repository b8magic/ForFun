// Real web UI journeys: durable activity drafts, logging, mixed days and archive.
// tools/build-web.sh && node tools/e2e.mjs
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('core');
const { page, $, tap, text, label, body, fill, check, home, reload, switchTo, jumpMonth, details, save, screenshot } = h;
const history = () => page.getByTestId('time-place');
const historyItem = (id) => history().getByTestId(id).first();
const historyLabel = async (key) => (await historyItem(`month-${key}`).getAttribute('aria-label')) ?? '';
const selected = async (date) => /selezionat/i.test(await label(`day-${date}`));
const hasCount = async (date, count) => {
  const value = await label(`day-${date}`);
  assert(new RegExp(`\\b${count} session${count === 1 ? 'e' : 'i'} registrat`).test(value), `${date}: ${value}`);
};
const mixedDayPaint = async (date) => $(`day-${date}`).evaluate((day) => {
  const triangle = [...day.querySelectorAll('div')].find((node) => {
    const style = getComputedStyle(node);
    return parseFloat(style.borderTopWidth) > 4 && style.borderTopWidth === style.borderRightWidth;
  });
  if (!triangle) return null;
  const other = [...triangle.parentElement.children].find((node) => {
    const style = getComputedStyle(node);
    return node !== triangle && style.borderTopWidth === '0px' && style.zIndex === '0';
  });
  const style = getComputedStyle(triangle);
  return { background: style.backgroundColor, upper: style.borderTopColor, lower: other && getComputedStyle(other).backgroundColor };
});

try {
  await home();
  await check('first launch has a cream calendar, active Surf and disabled Save', async () => {
    assert(page.url() === h.url, 'Correct entry route');
    assert(/Surf/.test(await body()), 'Meaningful app content');
    assert(!/Uncaught Error|Failed to compile|Something went wrong/i.test(await body()), 'No framework error overlay');
    assert(/Attività attiva: Surf/.test(await label('activity-switcher')), 'First activity is Surf');
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'No dates selected');
    assert(/Ottobre 2026/.test(await label('month-title')), 'The fixture clock controls the calendar month');
    await screenshot('01-first-launch');
  });

  await check('month jump and multi-date save record each date once', async () => {
    await jumpMonth(2026, 9);
    for (const date of ['2026-09-03', '2026-09-10', '2026-09-24']) await tap(`day-${date}`);
    assert(/Salva 3 sessioni/i.test(await text('save')), await text('save'));
    await save();
    for (const date of ['2026-09-03', '2026-09-10', '2026-09-24']) await hasCount(date, 1);
    await screenshot('02-multiple-dates-saved');
  });

  await check('drafts retain their dates and details independently across activity switches and restart', async () => {
    await tap('day-2026-09-17');
    await details(async () => fill('details-notes', 'Bozza Surf: onda lunga'));
    await switchTo('Corsa');
    await jumpMonth(2026, 9);
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'New activity starts with its own empty draft');
    await tap('day-2026-09-18');
    await details(async () => fill('details-notes', 'Bozza Corsa: lungomare'));
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    assert(await selected('2026-09-17'), 'Surf selected date restored');
    assert(!(await selected('2026-09-18')), 'Corsa selected date stays separate');
    await reload();
    assert(/Attività attiva: Surf/.test(await label('activity-switcher')), 'Remembered activity restored');
    await jumpMonth(2026, 9);
    assert(await selected('2026-09-17'), 'Surf draft survives restart');
    await details(async () => assert((await $('details-notes').inputValue()) === 'Bozza Surf: onda lunga', 'Surf notes survive restart'));
    await switchTo('Corsa');
    await jumpMonth(2026, 9);
    assert(await selected('2026-09-18'), 'Corsa draft survives restart');
    await details(async () => assert((await $('details-notes').inputValue()) === 'Bozza Corsa: lungomare', 'Corsa notes survive restart'));
    await save();
    await hasCount('2026-09-18', 1);
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    assert(await selected('2026-09-17'), 'Saving Corsa leaves the Surf draft intact');
    await save();
    await hasCount('2026-09-17', 1);
    await details(async () => assert((await $('details-notes').inputValue()) === '', 'Saved draft details are cleared'));
    await screenshot('03-draft-after-restart');
  });

  await check('rapid repeated Save cannot duplicate a draft, but deliberate repeated logging can', async () => {
    await tap('day-2026-09-05');
    await tap('save', 0);
    // The first press may already disable Save. A second physical press must
    // still be harmless rather than waiting for the button to become enabled.
    await $('save').tap({ force: true });
    await page.waitForTimeout(900);
    await hasCount('2026-09-05', 1);
    await tap('day-2026-09-05');
    await save();
    await hasCount('2026-09-05', 2);
  });

  await check('future dates stay disabled and do not enter a draft', async () => {
    await jumpMonth(2026, 10);
    assert(/data futura/i.test(await label('day-2026-10-30')), 'Future day is explained accessibly');
    assert((await $('day-2026-10-30').getAttribute('aria-disabled')) === 'true', 'Future day disabled');
    await $('day-2026-10-30').tap({ force: true });
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Future tap cannot select a date');
  });

  await check('mixed activity markers remain visible and day details list both actual sessions', async () => {
    await switchTo('Corsa');
    await jumpMonth(2026, 9);
    await tap('day-2026-09-10');
    await save();
    await hasCount('2026-09-10', 2);
    const value = await label('day-2026-09-10');
    assert(/Surf/.test(value) && /Corsa/.test(value), `Both activity colors have accessible names: ${value}`);
    // This is the same mounted Surf segment changing from a full square to a
    // triangle. A stale animated background used to cover the new Corsa region.
    let paint = await mixedDayPaint('2026-09-10');
    assert(paint?.background === 'rgba(0, 0, 0, 0)', `Mixed day must expose its second activity: ${JSON.stringify(paint)}`);
    assert(paint.upper === 'rgb(250, 164, 138)' && paint.lower === 'rgb(201, 240, 106)', `Corsa focus retains muted Surf and bright Corsa: ${JSON.stringify(paint)}`);
    await switchTo('Surf');
    paint = await mixedDayPaint('2026-09-10');
    assert(paint?.background === 'rgba(0, 0, 0, 0)', `Changing focus must keep the second region visible: ${JSON.stringify(paint)}`);
    assert(paint.upper === 'rgb(255, 77, 31)' && paint.lower === 'rgb(225, 241, 173)', `Surf focus retains bright Surf and muted Corsa: ${JSON.stringify(paint)}`);
    await switchTo('Corsa');
    await screenshot('04-mixed-activity-calendar');
    // Tapping a recorded day continues to select it for logging.
    await tap('day-2026-09-10');
    assert(await selected('2026-09-10'), 'Recorded date can be selected for another session');
    await tap('selected-day-details', 350);
    await h.visible('day-sheet');
    const sheet = page.getByTestId('day-sheet');
    assert(/2 sessioni/.test(await sheet.getByTestId('day-total').innerText()), 'Full day total includes both activities');
    assert(await sheet.getByRole('button', { name: /Surf, sessione/ }).count() === 1, 'Surf session is listed');
    assert(await sheet.getByRole('button', { name: /Corsa, sessione/ }).count() === 1, 'Corsa session is listed');
    await screenshot('05-mixed-day-details');
  });

  await check('editing a session returns to its day and closing restores the calendar draft', async () => {
    const sheet = page.getByTestId('day-sheet');
    await sheet.getByRole('button', { name: /Surf, sessione/ }).tap();
    await h.visible('session-editor');
    await fill('session-notes', 'Aggiornata dalla giornata');
    await tap('session-save', 650);
    await h.visible('day-sheet');
    assert(/Aggiornata dalla giornata/.test(await page.getByTestId('day-sheet').innerText()), 'Day rows refresh after edit');
    await tap('sheet-close', 400);
    await h.visible('lineup');
    assert(await selected('2026-09-10'), 'Entering a day and editing a saved session does not lose the logging draft');
    await tap('clear-selection');
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Explicitly clearing the draft clears its dates');
  });

  await check('long press opens a saved day without changing the logging draft', async () => {
    const box = await $('day-2026-09-10').boundingBox();
    assert(box, 'Saved day has a touch target');
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(750);
    await page.mouse.up();
    await h.visible('day-sheet');
    assert(/2 sessioni/.test(await page.getByTestId('day-sheet').getByTestId('day-total').innerText()), 'Long press reveals actual sessions');
    await tap('sheet-close', 400);
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Long press leaves the draft empty');
  });

  await check('history shows only populated months and can filter an empty activity honestly', async () => {
    await switchTo('Surf');
    await jumpMonth(2026, 7);
    await tap('day-2026-07-01');
    await save();
    await tap('history-handle', 700);
    await h.visible('time-place');
    await tap('filter-Surf', 300);
    const september = await historyLabel('2026-09');
    assert(/6 sessioni · 5 giorni attivi/.test(september), `September counts: ${september}`);
    assert(/Nessuna durata registrata/.test(september), `Honest duration: ${september}`);
    assert(await historyItem('month-2026-08').count() === 0, 'Empty August has no archive row');
    assert(await historyItem('mini-2026-09-03').count(), 'Populated month calendar is open without a disclosure tap');
    await tap('filter-Allenamento', 400);
    assert(!/6 sessioni/.test(await history().innerText()), 'Empty filter does not retain Surf totals');
    assert(/0 sessioni|Nessuna sessione|non hai ancora/i.test(await history().innerText()), 'Empty filter is explicit');
    await tap('filter-Tutte le attività', 400);
    assert(/8 sessioni/.test(await historyLabel('2026-09')), 'All-activity count comes from both activities');
    await tap('filter-Surf', 350);
    await screenshot('06-history-month');
  });

  await check('year mosaic includes twelve months and disables empty and future drill-downs', async () => {
    await tap('scale-year', 600);
    assert(await history().locator('[data-testid^="year-month-2026-"]').count() === 12, 'All twelve miniature month calendars rendered');
    assert((await historyItem('year-month-2026-08').getAttribute('aria-disabled')) === 'true', 'Empty August disabled');
    assert((await historyItem('year-month-2026-12').getAttribute('aria-disabled')) === 'true', 'Future December disabled');
    assert((await historyItem('year-month-2026-09').getAttribute('aria-disabled')) !== 'true', 'Recorded September opens');
    await screenshot('07-history-year');
    await tap('year-month-2026-09', 600);
    assert((await $('scale-month').getAttribute('aria-checked')) === 'true', 'Year selection returns to month mode');
    await historyItem('mini-2026-09-10').scrollIntoViewIfNeeded();
    await historyItem('mini-2026-09-10').tap();
    await h.visible('day-sheet');
    assert(/2 sessioni/.test(await page.getByTestId('day-sheet').getByTestId('day-total').innerText()), 'History day opens the full mixed-activity detail');
    await tap('sheet-close', 400);
  });

  await check('Progressi uses actual data and the three history scales remain navigable', async () => {
    await tap('scale-all', 650);
    const content = await history().innerText();
    assert(/Progressi/i.test(content), 'Progressi is named visibly');
    assert(/SESSIONI TOTALI/i.test(content) && /TRAGUARDI/i.test(content), 'Actual totals and milestones rendered');
    await screenshot('08-history-progress');
    await tap('scale-month', 400);
    await tap('back-to-log', 500);
    await h.visible('lineup');
    assert(/Attività attiva: Surf/.test(await label('activity-switcher')), 'Return to the remembered activity');
  });

  await check('history month jump reaches an older recorded year after several populated months', async () => {
    await jumpMonth(2021, 3);
    await tap('day-2021-03-12');
    await save();
    await jumpMonth(2023, 12);
    await tap('day-2023-12-20');
    await save();
    await tap('history-handle', 600);
    await tap('filter-Surf', 300);
    await jumpMonth(2021, 3, 'jump-history');
    const value = await historyLabel('2021-03');
    assert(/Marzo 2021: 1 sessione/.test(value), `Requested old month: ${value}`);
    await historyItem('mini-2021-03-12').scrollIntoViewIfNeeded();
    await screenshot('09-history-far-year-jump');
    await historyItem('mini-2021-03-12').tap();
    await h.visible('day-sheet');
    assert(/2021/.test(await page.getByTestId('day-sheet').innerText()), 'The opened day belongs to the requested older year');
    assert(/1 sessione/.test(await page.getByTestId('day-sheet').getByTestId('day-total').innerText()), 'Older session is actually preserved and visible');
    await tap('sheet-close', 350);
    await tap('back-to-log', 450);
  });
} finally {
  await h.finish();
}
