// Optional session details, editor integrity, settings and named periods through
// the actual UI and SQLite-backed web persistence. The fixture clock is fixed.
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('flows');
const { page, $, tap, fill, text, label, body, home, switchTo, duration, jumpMonth, details, save, check, screenshot } = h;
const historyItem = (id) => page.getByTestId('time-place').getByTestId(id).first();
const monthLabel = async (key) => (await historyItem(`month-${key}`).getAttribute('aria-label')) ?? '';
const openHistory = async () => {
  await tap('history-handle', 650);
  await h.visible('time-place');
};
async function openSession(date, nth = 0) {
  await historyItem(`mini-${date}`).scrollIntoViewIfNeeded();
  await historyItem(`mini-${date}`).tap();
  await h.visible('day-sheet');
  await page.getByTestId('day-sheet').locator('[data-testid^="session-"]').nth(nth).tap();
  await h.visible('session-editor');
}
async function closeDay() {
  await h.visible('day-sheet');
  await tap('sheet-close', 350);
}
async function enterPeriod() {
  await tap('history-handle', 450);
  await tap('named-periods', 350);
  await h.visible('periods-sheet');
}
async function periodCard(name) {
  return page.getByTestId('periods-sheet').locator('[data-testid^="period-"]').filter({ hasText: name }).first();
}
async function dismissDiscard(id) {
  await Promise.all([
    page.waitForEvent('dialog').then(async (shown) => {
      assert(shown.type() === 'confirm', 'Unsaved edits require explicit discard confirmation');
      await shown.dismiss();
    }),
    $(id).tap(),
  ]);
}
async function acceptDiscard(id) {
  await Promise.all([
    page.waitForEvent('dialog').then((shown) => shown.accept()),
    $(id).tap(),
  ]);
}

try {
  await home();
  await check('timing acceptance: four sessions yield 3 h 30 min and duration coverage 2 of 4', async () => {
    await switchTo('Allenamento');
    await jumpMonth(2026, 9);
    await tap('day-2026-09-01');
    await save();
    await tap('day-2026-09-02');
    await details(async () => {
      await tap('details-timing-mode-start_only');
      await fill('details-timing-start', '08:00');
    });
    await save();
    await tap('day-2026-09-03');
    await details(async () => {
      await tap('details-timing-mode-interval');
      await fill('details-timing-start', '09:00');
      await fill('details-timing-end', '11:00');
    });
    await save();
    await tap('day-2026-09-04');
    await details(async () => {
      await tap('details-timing-mode-duration_only');
      await duration('details-timing', '1', '30');
    });
    await save();
    await openHistory();
    const value = await monthLabel('2026-09');
    assert(/4 sessioni · 4 giorni attivi/.test(value), `Counts: ${value}`);
    assert(/3 h 30 min di tempo registrato/.test(value), `Duration: ${value}`);
    assert(/durata disponibile per 2 di 4 sessioni/.test(value), `Coverage: ${value}`);
    await screenshot('01-timing-acceptance');
  });

  await check('editing an interval to start-only recalculates honest duration coverage', async () => {
    await openSession('2026-09-03');
    await tap('session-timing-mode-start_only');
    if (await $('session-timing-confirm').isVisible()) await tap('session-timing-confirm');
    await tap('session-save', 650);
    await closeDay();
    const value = await monthLabel('2026-09');
    assert(/1 h 30 min di tempo registrato/.test(value) && /1 di 4/.test(value), `After edit: ${value}`);
  });

  await check('deleting the last known duration yields an unavailable duration, preserving other sessions', async () => {
    await openSession('2026-09-04');
    await tap('session-delete');
    await tap('session-delete-yes', 650);
    await closeDay();
    const value = await monthLabel('2026-09');
    assert(/3 sessioni/.test(value) && /Nessuna durata registrata/.test(value), `After delete: ${value}`);
    await tap('back-to-log', 450);
  });

  await check('one duration applied to two dates remains independent and clears after saving', async () => {
    await jumpMonth(2026, 10);
    await tap('day-2026-10-05');
    await tap('day-2026-10-06');
    await details(async () => {
      await tap('details-timing-mode-duration_only');
      await duration('details-timing', '1', '0');
    });
    await save();
    await tap('day-2026-10-07');
    await save();
    await openHistory();
    const value = await monthLabel('2026-10');
    assert(/3 sessioni/.test(value) && /2 h di tempo registrato/.test(value) && /2 di 3/.test(value), `Separate durations and plain save: ${value}`);
    await tap('back-to-log', 450);
  });

  await check('activity management rejects duplicate names, saves color, and remembers the selected activity', async () => {
    await tap('manage-activities', 350);
    await h.visible('activities-sheet');
    await tap('activity-new');
    await fill('activity-name', 'surf');
    await tap('activity-submit');
    assert(/esiste già|già/i.test(await body()), 'Duplicate name rejected');
    await fill('activity-name', 'Nuoto');
    await tap('color-kelp');
    await tap('activity-submit', 450);
    await h.visible('manage-activity-Nuoto');
    await tap('manage-activity-Nuoto');
    assert((await $('color-kelp').getAttribute('aria-checked')) === 'true', 'Chosen color is persisted in the edit form');
    await screenshot('02-created-activity');
    await tap('activity-use', 550);
    await home();
    assert(/Attività attiva: Nuoto/.test(await label('activity-switcher')), 'Remembered selection persisted');
  });

  await check('activity editing guards dirty forms and deletion removes only that activity draft', async () => {
    await jumpMonth(2026, 10);
    await tap('day-2026-10-03');
    await details(async () => fill('details-notes', 'Bozza Nuoto da eliminare'));
    await tap('manage-activities', 350);
    await tap('manage-activity-Nuoto');
    await fill('activity-name', 'Nuoto modificato');
    await dismissDiscard('activity-cancel');
    assert(await $('activity-form').isVisible(), 'Keep editing retains the form');
    await acceptDiscard('activity-cancel');
    await tap('manage-activity-Nuoto');
    assert((await $('activity-name').inputValue()) === 'Nuoto', 'Discard retains the saved activity name');
    await tap('activity-delete');
    await tap('delete-confirm', 650);
    await home();
    assert(!/Nuoto/.test(await label('activity-switcher')), 'Deleted remembered activity falls back');
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Deleted activity draft cannot leak into the fallback');
    await tap('manage-activities', 350);
    await tap('activity-new');
    await fill('activity-name', 'Nuoto');
    await tap('activity-submit', 450);
    await tap('manage-activity-Nuoto');
    await tap('activity-use', 550);
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Recreated activity has no obsolete draft');
    await details(async () => assert((await $('details-notes').inputValue()) === '', 'Deleted draft notes do not reappear'));
    await switchTo('Allenamento');
  });

  await check('month jump reaches another year and explicit draft clearing survives restart', async () => {
    await jumpMonth(2025, 3);
    assert(/Marzo 2025/.test(await label('month-title')), await label('month-title'));
    await tap('day-2025-03-15');
    assert(/Salva 1 sessione/i.test(await text('save')), 'Past date can be selected');
    await tap('clear-selection');
    await home();
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Explicit clear persists');
    await jumpMonth(2026, 10);
  });

  await check('dark and cream themes, calendar scope and reduced motion apply immediately and persist', async () => {
    await screenshot('03-cream-calendar');
    await tap('menu', 350);
    await tap('theme-pref-dark');
    await tap('home-activities-active');
    await tap('motion-pref-reduced');
    await tap('sheet-close', 400);
    const darkBackground = await $('lineup').evaluate((node) => getComputedStyle(node).backgroundColor);
    assert(darkBackground === 'rgb(12, 11, 9)', `Dark calendar background: ${darkBackground}`);
    await screenshot('04-dark-calendar');
    await home();
    await tap('menu', 350);
    for (const id of ['theme-pref-dark', 'home-activities-active', 'motion-pref-reduced']) {
      assert((await $(id).getAttribute('aria-checked')) === 'true', `${id} persisted`);
    }
    await tap('theme-pref-cream');
    await tap('home-activities-all');
    await tap('sheet-close', 400);
    const creamBackground = await $('lineup').evaluate((node) => getComputedStyle(node).backgroundColor);
    assert(creamBackground === 'rgb(246, 242, 233)', `Cream calendar background: ${creamBackground}`);
    await tap('day-2026-10-08');
    await save();
    assert(/1 sessione registrata/.test(await label('day-2026-10-08')), 'Reduced-motion logging still saves');
  });

  await check('Maps rejects unrelated links, resolves coordinates, and saves the original link verbatim', async () => {
    await tap('day-2026-10-09');
    await details(async () => {
      await fill('details-place-name', 'Bagni Fiume');
      await fill('details-place-link', 'https://example.com/spot');
      await h.visible('details-place-status-unsupported', 5000);
      await fill('details-place-link', 'https://www.google.com/maps/place/Livorno/@43.5485,10.3106,15z');
      await h.visible('details-place-status-resolved', 5000);
      await screenshot('05-details-place');
    });
    await save();
    await openHistory();
    await openSession('2026-10-09');
    assert((await $('session-place-name').inputValue()) === 'Bagni Fiume', 'Place name saved');
    await h.visible('session-place-status-resolved', 5000);
    assert((await $('session-place-link').inputValue()) === 'https://www.google.com/maps/place/Livorno/@43.5485,10.3106,15z', 'Original link preserved');
  });

  await check('discarding unsaved session notes keeps the stored session and returns to the same day', async () => {
    await fill('session-notes', 'Questa modifica non va salvata');
    await dismissDiscard('sheet-close');
    assert(await $('session-editor').isVisible(), 'Continue editing retains the editor');
    await acceptDiscard('sheet-close');
    await h.visible('day-sheet');
    await page.getByTestId('day-sheet').locator('[data-testid^="session-"]').first().tap();
    await h.visible('session-editor');
    assert((await $('session-notes').inputValue()) === '', 'Discarded notes were not saved');
    await tap('sheet-close', 350);
    await closeDay();
    await tap('back-to-log', 450);
  });

  await check('named period validates its inclusive range and previews real session counts and durations', async () => {
    await enterPeriod();
    await tap('periods-create');
    await h.visible('period-form');
    await fill('period-name', 'Vacanza ottobre');
    await fill('period-start', '2026-10-09');
    await fill('period-end', '2026-10-05');
    await tap('period-save');
    assert(await $('period-form').isVisible(), 'Reversed dates do not save');
    assert(!await page.getByTestId('period-detail').isVisible(), 'Invalid range does not become a stored period');
    await fill('period-start', '2026-10-05');
    await fill('period-end', '2026-10-09');
    await fill('period-note', 'Allenamento e mare');
    const preview = await text('period-preview-summary');
    assert(/5 sessioni · 5 giorni attivi/.test(preview), `Inclusive actual sessions: ${preview}`);
    assert(/2 h/.test(preview) && /2 di 5/.test(preview), `Known duration and coverage: ${preview}`);
    await $('period-preview-summary').scrollIntoViewIfNeeded();
    await screenshot('06-period-preview');
    await tap('period-save', 500);
    await h.visible('period-detail');
    assert(/Vacanza ottobre/.test(await text('period-detail')), 'Named period saved');
    await home();
    await enterPeriod();
    await (await periodCard('Vacanza ottobre')).tap();
    await h.visible('period-detail');
    assert(/Allenamento e mare/.test(await text('period-detail')), 'Period metadata survives restart');
  });

  await check('period edit scopes by activity and range while keeping unknown durations honest', async () => {
    await tap('period-edit');
    await fill('period-name', 'Settembre allenamento');
    await fill('period-start', '2026-09-01');
    await fill('period-end', '2026-09-03');
    await tap('period-scope-selected');
    const activeCheckbox = page.locator('[data-testid^="period-activity-"]').filter({ hasText: 'Allenamento' }).first();
    // Activity scope uses stable ids; find the row by its visible activity name.
    if ((await activeCheckbox.getAttribute('aria-checked')) !== 'true') await activeCheckbox.tap();
    const preview = await text('period-preview-summary');
    assert(/3 sessioni · 3 giorni attivi/.test(preview), `Scoped period count: ${preview}`);
    assert(/Nessuna durata registrata/.test(preview), 'Date-only and start-only do not invent duration');
    await tap('period-save', 500);
    await h.visible('period-detail');
    assert(/Settembre allenamento/.test(await text('period-detail')), 'Updated metadata displayed');
  });

  await check('overlapping named periods coexist and deleting period metadata retains every session', async () => {
    await home();
    await enterPeriod();
    await tap('periods-create');
    await fill('period-name', 'Altro periodo sovrapposto');
    await fill('period-start', '2026-09-02');
    await fill('period-end', '2026-10-06');
    await tap('period-save', 500);
    await h.visible('period-detail');
    await home();
    await enterPeriod();
    assert(await (await periodCard('Altro periodo sovrapposto')).isVisible(), 'Overlapping period is stored');
    await (await periodCard('Settembre allenamento')).tap();
    await tap('period-delete');
    await tap('period-delete-cancel');
    assert(await $('period-detail').isVisible(), 'Cancelling deletion keeps the period');
    await tap('period-delete');
    await tap('period-delete-confirm', 500);
    await h.visible('periods-sheet');
    assert(await (await periodCard('Settembre allenamento')).count() === 0, 'Deleted metadata disappears');
    assert(await (await periodCard('Altro periodo sovrapposto')).isVisible(), 'Other period remains');
    await home();
    await openHistory();
    assert(/3 sessioni/.test(await monthLabel('2026-09')), 'All September sessions remain after period deletion');
    assert(/5 sessioni/.test(await monthLabel('2026-10')), 'All October sessions remain after period deletion');
    await screenshot('07-sessions-survive-period-delete');
  });
} finally {
  await h.finish();
}
