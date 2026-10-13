// v1.2 UI regressions against the production web bundle and persisted SQLite.
// tools/build-web.sh && node tools/e2e-v12.mjs
import { assert, createHarness } from './e2e-harness.mjs';

const h = await createHarness('v12');
const { page, $, tap, fill, text, label, body, home, reload, switchTo, duration, swipeLeft, jumpMonth, details, save, check, screenshot } = h;
const mixedDate = '2026-09-08';
const customName = 'Bici 1.2';
const sessionRows = () => $('day-sheet').locator('[data-testid^="session-"]');
const selected = async (date) => /selezionato, da salvare/.test(await label(`day-${date}`));
const neutral = async () => {
  assert(await $('activity-switcher').count() === 0, 'No activity is selected');
  assert(await $('save').count() === 0 && await $('details-link').count() === 0, 'Logging controls wait for an activity');
};
const mixedPaint = async () => $(`day-${mixedDate}`).evaluate((day) => {
  const triangle = [...day.querySelectorAll('div')].find((node) => {
    const style = getComputedStyle(node);
    return parseFloat(style.borderTopWidth) > 4 && style.borderTopWidth === style.borderRightWidth;
  });
  if (!triangle) return null;
  const other = [...triangle.parentElement.children].find((node) => {
    const style = getComputedStyle(node);
    return node !== triangle && style.borderTopWidth === '0px' && style.zIndex === '0';
  });
  return { background: getComputedStyle(triangle).backgroundColor, surf: getComputedStyle(triangle).borderTopColor, corsa: other && getComputedStyle(other).backgroundColor };
});
async function expectPaint(surf, corsa) {
  const paint = await mixedPaint();
  assert(paint?.background === 'rgba(0, 0, 0, 0)', `Mixed shape keeps both activities visible: ${JSON.stringify(paint)}`);
  assert(paint.surf === surf && paint.corsa === corsa, `Rendered focus colors: ${JSON.stringify(paint)}`);
}
async function closeDay() {
  await tap('sheet-close', 400);
  await h.visible('lineup');
}
async function chooseZone(prefix, query, zone) {
  await tap(`${prefix}-zone-open`);
  await h.visible(`${prefix}-zone-picker`);
  await fill(`${prefix}-zone-search`, query);
  await tap(`${prefix}-zone-option-${zone}`);
  assert(await $(`${prefix}-zone-picker`).count() === 0, 'Choosing a timezone closes the picker');
  assert((await label(`${prefix}-zone-open`)).includes(zone), `Selected timezone is ${zone}`);
}
async function fitControls(ids) {
  const viewport = page.viewportSize();
  for (const id of ids) {
    const box = await $(id).boundingBox();
    assert(box && box.width > 0, `${id} is rendered at ${viewport.width}px`);
    assert(box.x >= -1 && box.x + box.width <= viewport.width + 1, `${id} fits ${viewport.width}px: ${JSON.stringify(box)}`);
  }
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'No horizontal page overflow');
}
async function captureWidths(name, ids, focus) {
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    await page.waitForTimeout(300);
    if (focus) await $(focus).scrollIntoViewIfNeeded();
    await fitControls(ids);
    await screenshot(`${name}-${width}`);
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(300);
}

try {
  await home();
  await check('Home names the year, Menu keeps an accessible heading, and Progressi opens through Storia', async () => {
    assert(page.url() === h.url && typeof await page.title() === 'string', 'Expected entry page');
    assert(/Surf/.test(await body()), 'The first viewport has meaningful content');
    assert(!/Uncaught Error|Failed to compile|Something went wrong/i.test(await body()), 'No framework error overlay');
    assert((await text('month-title')) === '2026', 'The Home title is the calendar year');
    const yearSize = await $('month-title').evaluate((node) => Math.max(...[...node.querySelectorAll('div')].filter((child) => child.textContent === '2026').map((child) => parseFloat(getComputedStyle(child).fontSize))));
    assert(yearSize >= 28, `The year is a large heading (${yearSize}px)`);
    await tap('menu', 350);
    assert(await $('menu-sheet').getByRole('heading', { name: 'Menu', exact: true }).count() === 1, 'Menu remains named for assistive technology');
    assert(!/^Menu$/m.test(await text('menu-sheet')), 'Menu has no duplicated visible title');
    assert(await $('menu-history').count() === 0 && await $('menu-progress').count() === 0, 'History and progress use the Home entry point');
    await screenshot('01-menu');
    await tap('sheet-close', 400);
    await tap('history-handle', 750);
    await h.visible('time-place');
    await tap('scale-all', 450);
    assert(/Progressi/.test(await text('time-place')), 'Progressi is visible inside Storia');
    await tap('scale-month');
    await tap('back-to-log', 500);
    await screenshot('02-home-year');
  });

  await check('toggling focus exposes every stored color and a same-activity count on its own segment', async () => {
    await switchTo('Surf');
    await switchTo('Surf');
    assert(/attività attiva/.test(await label('activity-Surf')), 'Repeated switchTo does not turn the activity off');
    await jumpMonth(2026, 9);
    for (let i = 0; i < 2; i++) {
      await tap(`day-${mixedDate}`);
      await save();
    }
    await switchTo('Corsa');
    await tap(`day-${mixedDate}`);
    await save();
    await expectPaint('rgb(250, 164, 138)', 'rgb(201, 240, 106)');
    await screenshot('03-active-focus');
    await tap('activity-Corsa', 450);
    await neutral();
    await expectPaint('rgb(255, 77, 31)', 'rgb(201, 240, 106)');
    const badges = $(`day-${mixedDate}`).locator('[data-testid^="day-count-"]');
    assert(await badges.count() === 1 && (await badges.innerText()).trim() === '×2', 'Only the repeated Surf activity receives ×2');
    assert(/Surf: 2 sessioni, Corsa: 1 sessione, 3 sessioni registrate/.test(await label(`day-${mixedDate}`)), 'Accessible totals keep per-activity counts');
    await screenshot('04-neutral-vivid-colors');
    await tap(`day-${mixedDate}`, 350);
    await h.visible('day-sheet');
    assert(await sessionRows().count() === 3, 'A neutral day tap opens every saved session');
    assert((await $('day-new-session').getAttribute('aria-disabled')) === 'true', 'Logging from day details requires an activity');
    await closeDay();
  });

  await check('neutral selection survives restart and preserves separate activity dates and details', async () => {
    await switchTo('Surf');
    await tap('day-2026-09-10');
    await details(async () => fill('details-notes', 'Bozza Surf in pausa'));
    await switchTo('Corsa');
    await tap('day-2026-09-11');
    await details(async () => fill('details-notes', 'Bozza Corsa in pausa'));
    await tap('activity-Corsa', 450);
    await neutral();
    await reload();
    await neutral();
    await jumpMonth(2026, 9);
    assert(!(await selected('2026-09-10')) && !(await selected('2026-09-11')), 'Neutral view does not project either draft');
    await expectPaint('rgb(255, 77, 31)', 'rgb(201, 240, 106)');
    assert(/1 date da salvare/.test(await label('activity-Surf')) && /1 date da salvare/.test(await label('activity-Corsa')), 'Activity chips retain both drafts');
    await tap('day-2026-09-12', 350);
    await h.visible('day-empty');
    assert((await $('day-new-session').getAttribute('aria-disabled')) === 'true', 'An empty neutral day cannot mutate a draft');
    await closeDay();
    await switchTo('Surf');
    assert(await selected('2026-09-10') && !(await selected('2026-09-11')), 'Surf restores only its date');
    await details(async () => assert((await $('details-notes').inputValue()) === 'Bozza Surf in pausa', 'Surf restores its notes'));
    await switchTo('Corsa');
    assert(await selected('2026-09-11') && !(await selected('2026-09-10')), 'Corsa restores only its date');
    await details(async () => assert((await $('details-notes').inputValue()) === 'Bozza Corsa in pausa', 'Corsa restores its notes'));
    await tap('activity-Corsa', 450);
    await screenshot('05-neutral-after-restart');
  });

  await check('a real left swipe reveals deletion, cancellation retains every row, and confirmation deletes only that session', async () => {
    await tap(`day-${mixedDate}`, 350);
    await h.visible('day-sheet');
    const surf = $('day-sheet').getByRole('button', { name: /^Surf, sessione/ }).first();
    const sessionId = (await surf.getAttribute('data-testid')).slice('session-'.length);
    await swipeLeft(`session-${sessionId}`);
    // React Native Web omits aria-hidden when its value is false.
    assert((await $(`day-swipe-delete-${sessionId}`).getAttribute('aria-hidden')) !== 'true', 'Left swipe exposes the row action');
    const translation = await surf.evaluate((node) => new DOMMatrixReadOnly(getComputedStyle(node.parentElement.parentElement).transform).m41);
    assert(translation <= -90, `The physical swipe reveals the 92px action (${translation}px)`);
    assert(await sessionRows().count() === 3 && await $('day-delete-confirm').count() === 0, 'Swiping itself neither deletes nor confirms');
    await screenshot('06-swipe-reveals-delete');
    await tap(`day-swipe-delete-${sessionId}`, 350);
    await h.visible('day-delete-confirm');
    assert(/Surf/.test(await text('day-delete-confirm')), 'Confirmation identifies the chosen activity');
    await tap('day-delete-cancel', 350);
    assert(await sessionRows().count() === 3 && await $('day-delete-confirm').count() === 0, 'Cancel keeps all sessions');
    await swipeLeft(`session-${sessionId}`);
    await tap(`day-swipe-delete-${sessionId}`, 350);
    await tap('day-delete-yes', 700);
    assert(await sessionRows().count() === 2 && await $(`session-${sessionId}`).count() === 0, 'Confirmed deletion removes only the chosen id');
    assert(await $('day-sheet').getByRole('button', { name: /^Surf, sessione/ }).count() === 1 && await $('day-sheet').getByRole('button', { name: /^Corsa, sessione/ }).count() === 1, 'Other sessions from both activities remain');
    await closeDay();
    assert(await $(`day-${mixedDate}`).locator('[data-testid^="day-count-"]').count() === 0, 'Badge disappears when Surf returns to one session');
    await reload();
    await neutral();
    await jumpMonth(2026, 9);
    assert(/2 sessioni registrate/.test(await label(`day-${mixedDate}`)), 'Deletion persists across restart');
    await switchTo('Surf');
    assert(await selected('2026-09-10'), 'Deleting a saved session leaves the Surf draft');
    await tap('clear-selection');
    await switchTo('Corsa');
    assert(await selected('2026-09-11'), 'Deleting a saved session leaves the Corsa draft');
    await tap('clear-selection');
    await tap('activity-Corsa', 450);
    await screenshot('07-confirmed-delete');
  });

  await check('24 presets and continuous custom controls create and persist an exact color without clipping at 320px', async () => {
    await tap('manage-activities', 350);
    await tap('activity-new');
    await fill('activity-name', customName);
    assert(await $('color-presets').getByRole('radio').count() === 24, 'All 24 named presets are offered');
    const previous = await label('color-current');
    await captureWidths('08-color-palette', ['color-presets', 'color-mode-palette', 'color-mode-custom', 'activity-submit'], 'color-current');
    await tap('color-mode-custom');
    assert((await label('color-current')) === previous, 'Opening custom mode retains the current color');
    for (const channel of ['s', 'v']) await $(`color-slider-${channel}`).press('End');
    await $('color-slider-h').press('Home');
    await $('color-slider-h').press('ArrowRight');
    assert((await $('color-slider-h').getAttribute('aria-valuenow')) === '1', 'Keyboard supports single-degree hue adjustment');
    await $('color-slider-h').press('Shift+ArrowRight');
    assert((await $('color-slider-h').getAttribute('aria-valuenow')) === '11', 'Keyboard supports larger hue steps');
    await $('color-slider-h').scrollIntoViewIfNeeded();
    const slider = await $('color-slider-h').boundingBox();
    assert(slider, 'Hue slider has a rendered touch target');
    await page.mouse.move(slider.x + 14, slider.y + slider.height / 2);
    await page.mouse.down();
    await page.mouse.move(slider.x + 14 + (slider.width - 28) * 0.371, slider.y + slider.height / 2, { steps: 12 });
    await page.mouse.up();
    const hue = Number(await $('color-slider-h').getAttribute('aria-valuenow'));
    assert(hue >= 132 && hue <= 136, `Dragging reaches a continuous hue between coarse steps (${hue}°)`);
    for (const [channel, proportion] of [['s', 0.683], ['v', 0.763]]) {
      await $(`color-slider-${channel}`).scrollIntoViewIfNeeded();
      const box = await $(`color-slider-${channel}`).boundingBox();
      assert(box, `${channel} slider has a rendered touch target`);
      const scrollBefore = await $(`color-slider-${channel}`).evaluate((node) => {
        const offsets = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (parent.scrollHeight > parent.clientHeight) offsets.push(parent.scrollTop);
        }
        return offsets;
      });
      await page.mouse.move(box.x + 14, box.y + box.height / 2);
      await page.mouse.down();
      await page.mouse.move(box.x + 14 + (box.width - 28) * proportion, box.y + box.height / 2, { steps: 12 });
      await page.mouse.up();
      const amount = Number(await $(`color-slider-${channel}`).getAttribute('aria-valuenow'));
      assert(Math.abs(amount - proportion * 100) < 2, `Dragging reaches a continuous ${channel} value (${amount})`);
      const scrollAfter = await $(`color-slider-${channel}`).evaluate((node) => {
        const offsets = [];
        for (let parent = node.parentElement; parent; parent = parent.parentElement) {
          if (parent.scrollHeight > parent.clientHeight) offsets.push(parent.scrollTop);
        }
        return offsets;
      });
      assert(JSON.stringify(scrollBefore) === JSON.stringify(scrollAfter), 'Dragging a color track does not scroll the form');
    }
    assert(await $('activity-form').locator('canvas').count() <= 3, 'The preview and three gradients share at most three canvases');
    const chosen = (await label('color-current')).match(/#[0-9A-F]{6}/)?.[0];
    assert(chosen && (await label('look-preview')).includes(chosen), 'Slider color updates the activity preview live');
    await fill('color-hex', '#GGGGGG');
    assert((await $('activity-submit').getAttribute('aria-disabled')) === 'true', 'An invalid color cannot be saved');
    await fill('color-hex', '1A6CCB');
    assert((await label('color-current')).includes('#1A6CCB'), 'Exact HEX entry is reflected in the preview');
    await captureWidths('09-color-custom', ['activity-color-picker', 'color-slider-h', 'color-slider-s', 'color-slider-v', 'color-hex', 'activity-submit'], 'color-slider-h');
    await tap('activity-submit', 500);
    await tap(`manage-activity-${customName}`);
    assert((await $('color-mode-custom').getAttribute('aria-selected')) === 'true', 'A custom stored color reopens in the free picker');
    assert((await $('color-hex').inputValue()) === '#1A6CCB', 'Created color is stored exactly');
    await tap('activity-cancel');
    await tap('sheet-close', 400);
    await reload();
    await tap('manage-activities', 350);
    await tap(`manage-activity-${customName}`);
    assert((await $('color-hex').inputValue()) === '#1A6CCB', 'Created custom color survives a restart');
  });

  await check('editing a custom color persists it and paints the selected activity with the same RGB value', async () => {
    await fill('color-hex', '#A13BCD');
    await tap('activity-submit', 500);
    await tap('sheet-close', 400);
    await reload();
    await tap('manage-activities', 350);
    await tap(`manage-activity-${customName}`);
    assert((await $('color-hex').inputValue()) === '#A13BCD', 'Edited custom color survives a restart');
    await tap('activity-use', 550);
    await h.visible('lineup');
    const fillColor = await $(`activity-${customName}`).evaluate((node) => getComputedStyle(node).backgroundColor);
    assert(fillColor === 'rgb(161, 59, 205)', `The chip uses the exact edited color: ${fillColor}`);
    await jumpMonth(2026, 9);
    await tap('day-2026-09-15');
    await save();
    const dayHasColor = await $('day-2026-09-15').evaluate((day) => [...day.querySelectorAll('div')].some((node) => getComputedStyle(node).backgroundColor === 'rgb(161, 59, 205)'));
    assert(dayHasColor, 'The saved day renders the same custom color');
    await screenshot('10-custom-color-saved');
  });

  await check('hours and minutes save with a searchable city timezone and remain editable', async () => {
    await switchTo('Allenamento');
    await jumpMonth(2026, 9);
    await tap('day-2026-09-20');
    await details(async () => {
      await tap('details-timing-mode-start_duration');
      await fill('details-timing-start', '08:10');
      await duration('details-timing', '1', '35');
      await chooseZone('details-timing', 'Roma', 'Europe/Rome');
      assert(/1 h 35 min/.test(await text('details-timing-source')), 'The duration echo matches both fields');
      await captureWidths('11-duration-fields', ['details-timing-start', 'details-timing-duration-hours', 'details-timing-duration-minutes', 'details-timing-zone-open', 'details-apply'], 'details-timing-duration');
      await tap('details-timing-zone-open');
      await fill('details-timing-zone-search', 'Roma');
      await captureWidths('12-timezone-choice', ['details-timing-zone-picker', 'details-timing-zone-search', 'details-timing-zone-option-Europe/Rome', 'details-apply'], 'details-timing-zone-search');
      await tap('details-timing-zone-option-Europe/Rome');
    });
    await save();
    await tap('activity-Allenamento', 450);
    await tap('day-2026-09-20', 350);
    await h.visible('day-sheet');
    assert(/1 h 35 min/.test(await text('day-total')), 'Day totals use the saved duration');
    await sessionRows().first().tap();
    await h.visible('session-editor');
    assert(Number(await $('session-timing-duration-hours').inputValue()) === 1 && Number(await $('session-timing-duration-minutes').inputValue()) === 35, 'Both saved duration fields reopen');
    assert((await label('session-timing-zone-open')).includes('Europe/Rome'), 'The chosen timezone reopens');
  });

  await check('duration edits reject 60 minutes and preserve a new timezone and valid minutes across restart', async () => {
    await duration('session-timing', '2', '60');
    await tap('session-save');
    assert(await $('session-editor').isVisible(), 'An invalid duration remains in the editor');
    assert(await $('session-timing-error-duration').isVisible(), 'Invalid minutes are explained beside the fields');
    await duration('session-timing', '2', '5');
    await chooseZone('session-timing', 'New York', 'America/New_York');
    await tap('session-save', 700);
    await h.visible('day-sheet');
    assert(/2 h 05 min/.test(await text('day-total')), 'Day totals refresh after editing hours and minutes');
    await closeDay();
    await reload();
    await neutral();
    await jumpMonth(2026, 9);
    await tap('day-2026-09-20', 350);
    await sessionRows().first().tap();
    await h.visible('session-editor');
    assert(Number(await $('session-timing-duration-hours').inputValue()) === 2 && Number(await $('session-timing-duration-minutes').inputValue()) === 5, 'Edited hours and minutes survive restart');
    assert((await label('session-timing-zone-open')).includes('America/New_York'), 'Edited timezone survives restart');
    await screenshot('13-edited-timezone-after-restart');
    await tap('sheet-close', 350);
    await closeDay();
  });

  await check('four repeated activities keep separate counts, colors, and readable day numbers at 390px and 320px', async () => {
    const date = '2026-09-14';
    for (const [name, count] of [['Surf', 2], ['Corsa', 3], ['Allenamento', 2], [customName, 2]]) {
      await switchTo(name);
      for (let i = 0; i < count; i++) {
        await tap(`day-${date}`);
        await save();
      }
    }
    await tap(`activity-${customName}`, 450);
    await neutral();
    const expectedColors = ['rgb(255, 77, 31)', 'rgb(201, 240, 106)', 'rgb(185, 168, 255)', 'rgb(161, 59, 205)'];
    for (const width of [390, 320]) {
      await page.setViewportSize({ width, height: 844 });
      await page.waitForTimeout(300);
      await jumpMonth(2026, 9);
      const day = $(`day-${date}`);
      const badges = day.locator('[data-testid^="day-count-"]');
      assert(JSON.stringify(await badges.allTextContents()) === JSON.stringify(['×2', '×3', '×2', '×2']), `Four per-activity counts render at ${width}px`);
      const geometry = await day.evaluate((node) => {
        const mosaic = node.querySelector('[data-testid^="day-count-"]').parentElement.parentElement.getBoundingClientRect();
        const counts = [...node.querySelectorAll('[data-testid^="day-count-"]')].map((badge) => {
          const box = badge.getBoundingClientRect();
          return { x: box.x, y: box.y, right: box.right, bottom: box.bottom };
        });
        const fills = [...node.querySelectorAll('div')].map((child) => getComputedStyle(child).backgroundColor);
        return { mosaic: { x: mosaic.x, y: mosaic.y, width: mosaic.width, height: mosaic.height, right: mosaic.right, bottom: mosaic.bottom }, counts, fills };
      });
      const { mosaic, counts } = geometry;
      assert(mosaic.width >= 36, `Tile leaves room for count labels at ${width}px`);
      for (let i = 0; i < counts.length; i++) {
        const count = counts[i];
        assert(count.x >= mosaic.x && count.right <= mosaic.right && count.y >= mosaic.y && count.bottom <= mosaic.bottom, 'Counts fit inside the tile');
        const middleX = mosaic.x + mosaic.width / 2;
        const middleY = mosaic.y + mosaic.height / 2;
        assert(i % 2 ? count.x >= middleX : count.right <= middleX, 'Count stays in the correct horizontal segment');
        assert(i > 1 ? count.y >= middleY : count.bottom <= middleY, 'Count stays in the correct vertical segment');
      }
      assert(expectedColors.every((color) => geometry.fills.includes(color)), 'Neutral view renders every stored color vividly');
      assert(/9 sessioni registrate/.test(await label(`day-${date}`)), 'The day total remains distinct from each activity count');
      await fitControls([`day-${date}`, 'month-title', 'history-handle', 'menu']);
      await screenshot(`14-four-activity-counts-${width}`);
    }
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(300);
    await tap('history-handle', 750);
    await tap('scale-month');
    const historyDay = $('time-place').getByTestId(`mini-${date}`);
    await historyDay.scrollIntoViewIfNeeded();
    assert(JSON.stringify(await historyDay.locator('[data-testid^="day-count-"]').allTextContents()) === JSON.stringify(['×2', '×3', '×2', '×2']), 'History uses the same per-activity counts');
    await screenshot('15-four-activity-counts-history');
    await tap('back-to-log', 500);
  });
} finally {
  await h.finish();
}
