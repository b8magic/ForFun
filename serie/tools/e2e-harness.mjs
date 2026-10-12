// Browser plugin not available in the implementation environment: use the
// installed Playwright workflow. Anchor Date to a fixture and retain native
// timer/performance/RAF behavior so Reanimated and export jobs keep advancing.
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { chromium } from 'playwright';

export const FIXED_TIME = '2026-10-13T12:00:00.000Z';
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.wasm': 'application/wasm',
  '.ttf': 'font/ttf', '.png': 'image/png', '.json': 'application/json',
  '.ico': 'image/x-icon', '.svg': 'image/svg+xml', '.css': 'text/css',
};

export function assert(condition, message) {
  if (!condition) throw new Error(message);
}

export async function createHarness(suite, defaultRoot = 'dist-web') {
  const root = path.resolve(process.env.E2E_ROOT || defaultRoot);
  const shots = path.join(process.env.E2E_SHOTS || path.join(os.tmpdir(), 'serie-e2e'), suite);
  fs.mkdirSync(shots, { recursive: true });
  const externalUrl = process.env.E2E_URL;
  if (!externalUrl) assert(fs.existsSync(path.join(root, 'index.html')), `Missing web bundle at ${root}; run tools/build-web.sh first`);
  const server = externalUrl ? null : http.createServer((req, res) => {
    let pathname;
    try {
      pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    } catch {
      res.writeHead(400).end();
      return;
    }
    let file = path.resolve(root, `.${pathname}`);
    if (!file.startsWith(root + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      file = path.join(root, 'index.html');
    }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  if (server) await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const url = externalUrl ? externalUrl.replace(/\/*$/, '/') : `http://127.0.0.1:${server.address().port}/`;
  const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
    (fs.existsSync('/usr/bin/chromium') ? '/usr/bin/chromium' : undefined);
  let browser;
  try {
    browser = await chromium.launch({
      executablePath,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    });
  } catch (error) {
    if (server) await new Promise((resolve) => server.close(resolve));
    throw error;
  }
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 }, deviceScaleFactor: 2,
    hasTouch: true, isMobile: true, timezoneId: 'UTC',
  });
  await context.addInitScript((fixedTime) => {
    const NativeDate = globalThis.Date;
    const started = NativeDate.now();
    const fixture = NativeDate.parse(fixedTime);
    const now = () => fixture + NativeDate.now() - started;
    function FixtureDate(...args) {
      if (!new.target) return new NativeDate(now()).toString();
      return Reflect.construct(NativeDate, args.length ? args : [now()], new.target);
    }
    Object.setPrototypeOf(FixtureDate, NativeDate);
    FixtureDate.prototype = NativeDate.prototype;
    FixtureDate.now = now;
    globalThis.Date = FixtureDate;
  }, FIXED_TIME);
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  const errors = [];
  const warnings = [];
  const results = [];
  page.on('pageerror', (error) => errors.push({ kind: 'pageerror', message: error.message, stack: error.stack }));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push({ kind: 'console.error', message: message.text(), location: message.location() });
    if (message.type() === 'warning') warnings.push(message.text());
  });

  // Stacked form sheets intentionally reuse controls such as sheet-close.
  // Only the visible route owns the action; covered sheets remain in the DOM.
  const $ = (id) => page.getByTestId(id).filter({ visible: true }).first();
  const visible = (id, timeout = 15000) => $(id).waitFor({ state: 'visible', timeout });
  const label = async (id) => (await $(id).getAttribute('aria-label')) ?? '';
  const text = async (id) => (await $(id).innerText()).trim();
  const body = () => page.locator('body').innerText();
  const tap = async (id, wait = 220) => {
    await visible(id);
    await $(id).scrollIntoViewIfNeeded();
    await $(id).tap();
    if (wait) await page.waitForTimeout(wait);
  };
  const fill = async (id, value) => {
    await $(id).scrollIntoViewIfNeeded();
    await $(id).fill(value);
    await $(id).blur();
    await page.waitForTimeout(120);
  };
  const screenshot = async (name) => {
    const filename = path.join(shots, `${name}.png`);
    await page.screenshot({ path: filename });
    return filename;
  };
  async function go(route = '') {
    await page.goto(url + route);
    if (!route) await visible('lineup', 30000);
    await page.waitForTimeout(550);
  }
  async function reload() {
    await page.reload();
    await visible('lineup', 30000);
    await page.waitForTimeout(550);
  }
  async function switchTo(name) {
    // Activity chips are directly available in the calendar header.
    if ((await label('activity-switcher')).includes(`Attività attiva: ${name}`)) return;
    await tap(`activity-${name}`, 450);
    assert((await label('activity-switcher')).includes(`Attività attiva: ${name}`), `Active activity should be ${name}`);
  }
  async function jumpMonth(year, month, trigger = 'month-title') {
    await tap(trigger, 350);
    await visible('jump-sheet');
    const id = `jump-year-${year}`;
    for (let attempts = 0; !(await $(id).count()) && attempts < 10; attempts++) await tap('jump-earlier', 100);
    await tap(id, 150);
    await tap(`jump-month-${month}`, 500);
  }
  async function save() {
    await tap('save', 900);
    assert((await $('save').getAttribute('aria-disabled')) === 'true', 'Saved draft must clear its selected dates');
  }
  async function details(edit) {
    await tap('details-link', 350);
    await visible('details-sheet');
    await edit();
    await tap('details-apply', 350);
    await visible('lineup');
  }
  async function check(name, fn) {
    const started = Date.now();
    const before = errors.length;
    try {
      await fn();
      assert(errors.length === before, `Runtime errors: ${errors.slice(before).map((e) => e.message).join('\n')}`);
      results.push({ name, ok: true, ms: Date.now() - started });
      console.log(`✓ ${name}`);
    } catch (error) {
      const message = String(error?.message ?? error).slice(0, 1200);
      results.push({ name, ok: false, error: message, ms: Date.now() - started });
      console.log(`✗ ${name}\n   ${message}`);
      await screenshot(`fail-${name.replace(/\W+/g, '_')}`).catch(() => {});
    }
  }
  async function finish() {
    const uniqueErrors = [...new Map(errors.map((error) => [JSON.stringify(error), error])).values()];
    console.log(`\n${results.filter((result) => result.ok).length}/${results.length} checks passed`);
    if (uniqueErrors.length) console.error('Runtime errors:\n' + uniqueErrors.map((error) => `${error.kind}: ${error.message}`).join('\n'));
    fs.writeFileSync(path.join(shots, 'results.json'), JSON.stringify({
      suite, url, root, viewport: { width: 390, height: 844 }, fixedTime: FIXED_TIME,
      browser: executablePath || 'Playwright Chromium', browserPlugin: 'not available',
      results, errors: uniqueErrors, warnings: [...new Set(warnings)],
    }, null, 2));
    const passed = results.length > 0 && results.every((result) => result.ok) && !uniqueErrors.length;
    if (passed) {
      // A successful rerun supersedes failure captures from this suite's older
      // attempts; keep final evidence unambiguous for the candidate artifact.
      for (const filename of fs.readdirSync(shots)) {
        if (filename.startsWith('fail-') && filename.endsWith('.png')) fs.unlinkSync(path.join(shots, filename));
      }
    }
    await browser.close();
    if (server) await new Promise((resolve) => server.close(resolve));
    if (!passed) process.exitCode = 1;
  }
  return { page, context, url, shots, results, errors, $, visible, label, text, body, tap, fill, screenshot, go, home: () => go(), reload, switchTo, jumpMonth, save, details, check, finish };
}
