// Focused 1.3.2 browser verification against the single production export.
// Browser plugin not available: reuse the installed Playwright harness.
// Fixtures are created through the real UI; no synthetic app markup or data.
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v132');
const { page, $, tap, fill, text, label, body, home, switchTo, jumpMonth, details, save, screenshot } = h;
const history = () => $('time-place');
const inHistory = (id) => history().getByTestId(id).first();
const missingTiming = /durata (?:non (?:specificata|inserita|disponibile)|sconosciuta)|nessuna durata|solo data|senza orario|orario non (?:specificato|inserito)/i;
const dates = { mixed: '2026-09-08', bare: '2026-09-09', draft: '2026-09-23' };
const monthKey = '2026-09';
const screenshots = [];

// Later journeys consume the UI fixtures; stop after a failed prerequisite.
async function check(name, run) {
  await h.check(name, run);
  assert(h.results.at(-1)?.ok, `Prerequisite journey failed: ${name}`);
}
async function dismissMessage() {
  if (await $('toast-dismiss').count()) await tap('toast-dismiss', 40);
}
async function neutral() {
  if (await $('activity-switcher').count()) {
    const active = (await label('activity-switcher')).replace(/^Attività attiva: /, '');
    await tap(`activity-${active}`, 120);
  }
  assert(await $('activity-switcher').count() === 0, 'Home has neutral activity focus');
}
async function scale(value) {
  await tap(`scale-${value}`, 120);
  assert(await inHistory(`scale-${value}`).getAttribute('aria-checked') === 'true', `History is in ${value} mode`);
}
async function expectCount(expected) {
  assert(await text(`home-month-count-${monthKey}`) === expected, `September count should be ${expected}; got ${await text(`home-month-count-${monthKey}`)}`);
  assert((await label(`home-month-heading-${monthKey}`)).includes(expected), 'Month navigation announces its current session count');
}
async function expectSummary({ sessions, days, known }) {
  const summary = inHistory('history-summary');
  await summary.scrollIntoViewIfNeeded();
  const copy = (await summary.innerText()).trim();
  const spoken = await summary.getAttribute('aria-label');
  assert(copy.includes(`${sessions} ${sessions === 1 ? 'sessione' : 'sessioni'}`), `Summary reports ${sessions} saved sessions: ${copy}`);
  assert(copy.includes(`${days} ${days === 1 ? 'giorno attivo' : 'giorni attivi'}`), 'Active days stay distinct from session counts');
  assert(!/Surf|Corsa/.test(copy), 'Common totals do not repeat the selected activity name');
  if (known) {
    assert(/1\s*h\s*30\s*min/.test(copy), 'The actual ninety-minute duration remains visible');
    assert(copy.includes(`durata disponibile per 1 di ${sessions} sessioni`), 'Known durations retain honest partial coverage');
    assert(spoken.includes(`durata disponibile per 1 di ${sessions} sessioni`), 'Partial duration coverage remains accessible');
  } else {
    assert(!/durata|tempo registrato|\b0\s*(?:h|min)\b/i.test(`${copy} ${spoken}`), 'Date-only totals have no invented time or missing-duration line');
  }
  const header = summary.locator('..');
  assert(await header.getByText('Corsa', { exact: true }).count() === 1, 'Corsa appears once in the header chips, without a repeated activity label');
  assert(await header.getByText('Surf', { exact: true }).count() === 1, 'Surf appears once in the header chips, without a repeated activity label');
  const [filterBox, summaryBox, tabsBox] = await Promise.all([
    inHistory('filter-Surf').boundingBox(), summary.boundingBox(), inHistory('scale').boundingBox(),
  ]);
  assert(filterBox && summaryBox && tabsBox, 'Filter chips, common summary and scale tabs have rendered boxes');
  assert(filterBox.y + filterBox.height <= summaryBox.y + 1, 'The common summary is below the activity chips');
  assert(summaryBox.y + summaryBox.height <= tabsBox.y + 1, 'The common summary is above the scale tabs');
  const content = await history().evaluate((node) => [node.innerText, ...Array.from(node.querySelectorAll('[aria-label]'), (item) => item.getAttribute('aria-label'))].join('\n'));
  assert(!missingTiming.test(content), 'History text and accessible labels contain no missing-duration filler');
}

try {
  await home();
  await check('real UI saves count duplicate Surf and mixed date-only sessions', async () => {
    assert(page.url() === h.url && typeof await page.title() === 'string', 'The intended app page loads');
    assert(/Surf/.test(await body()) && !/Uncaught Error|Failed to compile|Something went wrong/i.test(await body()), 'Home renders meaningful app content without a framework overlay');
    await switchTo('Surf');
    await jumpMonth(2026, 9);
    await expectCount('0 sessioni di Surf');
    await tap(`day-${dates.mixed}`, 100);
    await details(async () => {
      await tap('details-timing-mode-duration_only', 100);
      await fill('details-timing-duration-input', '130');
    });
    await save();
    await dismissMessage();
    await tap(`day-${dates.mixed}`, 100);
    await save();
    await dismissMessage();
    await tap(`day-${dates.bare}`, 100);
    await save();
    await dismissMessage();
    await expectCount('3 sessioni di Surf');
    await switchTo('Corsa');
    await tap(`day-${dates.mixed}`, 100);
    await save();
    await dismissMessage();
    await expectCount('1 sessione di Corsa');
    assert((await label(`day-${dates.mixed}`)).includes('3 sessioni registrate'), 'One date contains three distinct saved sessions, including the duplicate Surf');
    assert((await label(`day-${dates.bare}`)).includes('1 sessione registrata'), 'The other date contains its saved date-only session');
  });

  await check('Home month counts follow activity focus and exclude unsaved draft dates', async () => {
    await switchTo('Surf');
    await expectCount('3 sessioni di Surf');
    await tap(`day-${dates.draft}`, 100);
    assert((await label(`day-${dates.draft}`)).includes('selezionato'), 'An unsaved draft date is selected');
    await expectCount('3 sessioni di Surf');
    await switchTo('Corsa');
    await expectCount('1 sessione di Corsa');
    await neutral();
    await expectCount('4 sessioni totali');
    assert(await $('save').getAttribute('aria-disabled') === 'true', 'Neutral saving stays disabled');
    screenshots.push(await screenshot('01-home-neutral-saved-count'));
  });

  await check('common history totals stay below chips and above every scale with actual partial duration', async () => {
    await tap('history-handle', 850);
    await h.visible('time-place');
    await tap('filter-Surf', 120);
    for (const value of ['month', 'year', 'all']) {
      await scale(value);
      await expectSummary({ sessions: 3, days: 2, known: true });
      if (value === 'year') screenshots.push(await screenshot('02-history-summary-year'));
    }
  });

  await check('date-only history omits missing-duration filler in month year and progress', async () => {
    await tap('filter-Corsa', 120);
    for (const value of ['month', 'year', 'all']) {
      await scale(value);
      await expectSummary({ sessions: 1, days: 1, known: false });
    }
  });

  await check('year mosaic shows twelve months December to January and drills into the correct month', async () => {
    await scale('year');
    const year = inHistory('year-2026');
    const tiles = year.locator('[data-testid^="year-month-2026-"]');
    const ids = await tiles.evaluateAll((nodes) => nodes.map((node) => node.getAttribute('data-testid')));
    const expected = Array.from({ length: 12 }, (_, index) => `year-month-2026-${String(12 - index).padStart(2, '0')}`);
    assert(JSON.stringify(ids) === JSON.stringify(expected), `Year mosaic order is December through January: ${ids.join(', ')}`);
    const boxes = await tiles.evaluateAll((nodes) => nodes.map((node) => { const box = node.getBoundingClientRect(); return { x: box.x, y: box.y }; }));
    assert(boxes.every((box, index) => index === 0 || box.y > boxes[index - 1].y + 1 || Math.abs(box.y - boxes[index - 1].y) < 1 && box.x > boxes[index - 1].x), 'The descending months also follow the rendered grid reading order');
    assert(!(await inHistory('year-month-2026-12').innerText()).includes('—'), 'Future months do not show a placeholder dash');
    assert((await inHistory('year-month-2026-09').getAttribute('aria-label')).startsWith('Settembre 2026: 1 sessione'), 'September announces the focused Corsa count');
    await tap('year-month-2026-09', 500);
    assert(await inHistory('scale-month').getAttribute('aria-checked') === 'true', 'A recorded year tile opens monthly history');
    const month = inHistory(`month-${monthKey}`);
    await month.scrollIntoViewIfNeeded();
    assert((await month.getAttribute('aria-label')).startsWith('Settembre 2026: 1 sessione'), 'Drilldown targets September with the same activity scope');
    await inHistory(`mini-${dates.mixed}`).tap();
    await h.visible(`history-day-${dates.mixed}`);
    await page.waitForTimeout(350);
    const panel = inHistory('history-day-details');
    assert(await panel.locator('[data-testid^="session-"][role="button"]').count() === 1, 'The focused day opens its one recorded Corsa session');
    assert(!missingTiming.test(await panel.innerText()), 'The date-only inline session preview also omits missing-duration filler');
    await tap('back-to-log', 550);
  });

  await check('320 pixel Home keeps month title and focused count readable without overlap', async () => {
    await page.setViewportSize({ width: 320, height: 740 });
    await switchTo('Surf');
    await $('home-month-count-2026-09').scrollIntoViewIfNeeded();
    await page.waitForTimeout(150);
    await expectCount('3 sessioni di Surf');
    const [headingBox, titleBox, countBox] = await Promise.all([
      $('home-month-heading-2026-09').boundingBox(), $('home-month-title-2026-09').boundingBox(), $('home-month-count-2026-09').boundingBox(),
    ]);
    assert(headingBox && titleBox && countBox, 'Month title and count render at the small-phone viewport');
    assert(titleBox.x + titleBox.width + 4 <= countBox.x + 1, 'The count has its own horizontal space after the month title');
    assert(titleBox.x >= 0 && countBox.x + countBox.width <= 320, 'Month title and count stay inside the viewport');
    assert(countBox.y >= headingBox.y - 1 && countBox.y + countBox.height <= headingBox.y + headingBox.height + 1, 'The wrapped count remains within the month heading');
    assert(countBox.height <= 33 && countBox.width > 40, 'The count stays within two readable lines');
    screenshots.push(await screenshot('03-home-320-focused-count'));
  });
  console.log(`Screenshots:\n${screenshots.join('\n')}`);
} finally {
  await h.finish();
}
