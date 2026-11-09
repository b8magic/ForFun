// src/ → site/ : the deployable static site, one page per language.
//
//   node tools/build.mjs                  # normal build: site/index.html (English) + site/es/index.html (Spanish)
//   node tools/build.mjs --no-fuego-hike  # same, with every <!--fuego:start-->…<!--fuego:end--> block removed (both languages)
//
// English (src/index.html) is the single source of truth. Every other language is generated from it with the
// dictionary src/i18n/<lang>.json (see tools/i18n.mjs): the build FAILS and lists every visible string, alt,
// aria-label, meta/OG text or JSON-LD string that the dictionary does not cover. Runtime strings (dock, notes,
// toasts, the WhatsApp message) live in the per-language tables of src/assets/js/site.js, chosen by <html lang>.
//
// What it does (dependency-light: sharp for media, lightningcss + esbuild for minifying):
//  1. Expands every <img data-pic="ID" …> into a <picture> (AVIF/WebP/JPEG srcset from
//     site/assets/img/manifest.json, real width/height, dominant-colour background).
//     data-wide/data-bp add an art-directed crop for viewports ≥ bp px; data-defer writes
//     data-src/data-srcset so JS can load the image later (desktop timeline panel).
//  2. Expands {{wa:KEY}} into prefilled wa.me links (every CTA works without JS).
//  3. Inlines the critical CSS (+ the first-screen textile motifs) and loads site.css async.
//  4. Writes hero <link rel=preload> tags that match the hero <source> elements exactly.
//  5. Writes one external SVG sprite (assets/svg/sprite.svg): the logo mark (twin peaks + sun) and every icon
//     and flag <symbol> of the inline sprite in src, shared and cached by every language page.
//  6. Minifies CSS and JS, adds content-hash cache busting, copies fonts/brand/root files.
// All URLs stay relative, so site/ works at a domain root or in a sub-folder.
import { readFile, writeFile, mkdir, cp, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { transform as cssTransform } from 'lightningcss';
import { transform as jsTransform } from 'esbuild';
import { localize } from './i18n.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC = path.join(ROOT, 'src');
const SITE = path.join(ROOT, 'site');
const NO_FUEGO = process.argv.includes('--no-fuego-hike');
// Languages: the first is the source. To add one: an entry here, src/i18n/<code>.json, a round flag
// <symbol id="f-<code>"> in the sprite of src/index.html, the runtime table in site.js and a WA table below.
const ORIGIN = 'https://solex-tours.com/';
const LANGS = [
  { code: 'en', dir: '', name: 'English', locale: 'en_US', label: 'Language', og: 'og-image.jpg', cash: 'Cash' },
  { code: 'es', dir: 'es/', name: 'Español', locale: 'es_GT', label: 'Idioma', og: 'og-image-es.jpg', cash: 'Efectivo' },
];
const manifest = JSON.parse(await readFile(path.join(SITE, 'assets/img/manifest.json'), 'utf8'));

// ---------------------------------------------------------------- pictures
const attr = (tag, name) => tag.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
const has = (tag, name) => new RegExp(`\\s${name}(\\s|=|>|/)`).test(tag);
const dropAttrs = (tag, names) => names.reduce((t, n) => t.replace(new RegExp(`\\s${n}(="[^"]*")?(?=[\\s/>])`), ''), tag);
const srcset = (id, fmt) => manifest[id].widths.map((w) => `assets/img/${id}-${w.w}.${fmt} ${w.w}w`).join(', ');

function need(id, where) {
  if (!manifest[id]) throw new Error(`image "${id}" (${where}) is not in the manifest — add it to tools/media.config.mjs and run npm run media`);
  return manifest[id];
}

function picture(tag) {
  const id = attr(tag, 'data-pic');
  const wide = attr(tag, 'data-wide');
  const bp = attr(tag, 'data-bp') ?? '900';
  const sizes = attr(tag, 'sizes') ?? '100vw';
  const wideSizes = attr(tag, 'data-wide-sizes') ?? sizes;
  const defer = has(tag, 'data-defer');
  const S = defer ? 'data-srcset' : 'srcset';
  const m = need(id, tag);
  if (wide) need(wide, tag);
  const fallback = m.widths.find((w) => w.w >= 960) ?? m.widths.at(-1);
  const sources = [];
  if (wide) {
    const media = `(min-width: ${bp}px)`;
    sources.push(`<source media="${media}" type="image/avif" ${S}="${srcset(wide, 'avif')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" type="image/webp" ${S}="${srcset(wide, 'webp')}" sizes="${wideSizes}">`);
    sources.push(`<source media="${media}" ${S}="${srcset(wide, 'jpg')}" sizes="${wideSizes}">`);
  }
  sources.push(`<source type="image/avif" ${S}="${srcset(id, 'avif')}" sizes="${sizes}">`);
  sources.push(`<source type="image/webp" ${S}="${srcset(id, 'webp')}" sizes="${sizes}">`);
  let img = dropAttrs(tag, ['data-pic', 'data-wide', 'data-bp', 'data-wide-sizes', 'sizes', 'data-defer', 'data-picture-class']);
  const style = `background-color:${m.color}`;
  // The <img> carries only the JPEG fallback src: every browser that reads srcset also takes an AVIF/WebP
  // <source> above, so a JPEG srcset on the <img> would be dead weight in the HTML.
  img = img.replace(/^<img/, `<img ${defer ? 'data-src' : 'src'}="assets/img/${id}-${fallback.w}.jpg" width="${fallback.w}" height="${fallback.h}"`);
  img = /\sstyle="/.test(img) ? img.replace(/\sstyle="/, ` style="${style};`) : img.replace(/\s*\/?>$/, ` style="${style}">`);
  if (!/\sdecoding=/.test(img)) img = img.replace(/>$/, ' decoding="async">');
  const pClass = attr(tag, 'data-picture-class');
  return `<picture${pClass ? ` class="${pClass}"` : ''}>${sources.join('')}${img}</picture>`;
}

// ---------------------------------------------------------------- prefilled WhatsApp links (no-JS path)
const enc = (s) => encodeURIComponent(s).replace(/[!'()*]/g, (c) => '%' + c.charCodeAt(0).toString(16).toUpperCase());
const NUM = { primary: '50248347003', secondary: '50249468883' };
// Prefilled texts per language. The overnight hike also asks for the pickup time: 8:00 AM standard,
// 6:30 AM on request (R2-B3). "fuego" is only used inside <!--fuego:start-->…<!--fuego:end-->.
const waTable = ({ ask, overnight, midnight, sunset, express, time, gear, fuego, question, hi }) => {
  const OV = ask(overnight) + time;
  return {
    overnight: [NUM.primary, OV], overnight2: [NUM.secondary, OV],
    midnight: [NUM.primary, ask(midnight)], sunset: [NUM.primary, ask(sunset)], express: [NUM.primary, ask(express)],
    gear: [NUM.primary, OV + gear], fuego: [NUM.primary, OV + fuego],
    question: [NUM.primary, question], hi: [NUM.primary, hi], hi2: [NUM.secondary, hi],
  };
};
const WA = {
  en: waTable({
    ask: (what) => `Hi Alexander! I'd like to check a date for the ${what}.\nDate: \nPeople: \nPickup: Café Condesa or Café La Parada`,
    overnight: 'Acatenango Overnight Hike (2 days / 1 night, Q750 per person)', time: '\nPickup time: 8:00 AM (or 6:30 AM on request)',
    midnight: 'Midnight sunrise tour (leaves 10:30 PM, Q750 per person)', sunset: 'Sunset tour (leaves 10:30 AM, Q750 per person)',
    express: 'One-day express (leaves 5:00 AM, Q675 per person)',
    gear: "\nFor rent: I'd like to rent gear (jacket, backpack, headlamp, poles or shoes)",
    fuego: "\nOptional Fuego hike: I'm interested (+Q300 per person, paid at camp)",
    question: 'Hi Alexander! I have a question about Acatenango.', hi: 'Hi Alexander!',
  }),
  es: waTable({
    ask: (what) => `¡Hola, Alexander! Quiero consultar una fecha para ${what}.\nFecha: \nPersonas: \nRecogida: Café Condesa o Café La Parada`,
    overnight: 'la caminata de 2 días al Acatenango (1 noche en cabaña, Q750 por persona)', time: '\nHora de recogida: 8:00 a. m. (o 6:30 a. m. a solicitud)',
    midnight: 'el tour de medianoche (sale a las 10:30 p. m., Q750 por persona)', sunset: 'el tour de atardecer (sale a las 10:30 a. m., Q750 por persona)',
    express: 'el tour exprés de un día (sale a las 5:00 a. m., Q675 por persona)',
    gear: '\nAlquiler de equipo: me interesa (chaqueta, mochila, linterna, bastones o zapatos)',
    fuego: '\nCaminata opcional al Fuego: me interesa (+Q300 por persona, se paga en el campamento)',
    question: '¡Hola, Alexander! Tengo una pregunta sobre el Acatenango.', hi: '¡Hola, Alexander!',
  }),
};
const waHref = (lang, key) => {
  if (!WA[lang]?.[key]) throw new Error(`unknown {{wa:${key}}} (${lang})`);
  const [n, text] = WA[lang][key];
  return `https://wa.me/${n}?text=${enc(text)}`;
};

// ---------------------------------------------------------------- CSS + JS
const TARGETS = { chrome: 100 << 16, safari: (15 << 16) | (4 << 8), firefox: 100 << 16, ios_saf: (15 << 16) | (4 << 8), samsung: 18 << 16 };
// lightningcss keeps the source spacing of values it cannot parse (anything with var()): tighten those too, and write
// the motion prefix ".js:not(.static) " as ".m " (the <head> script sets html.m exactly when it sets .js without .static)
const tight = (css) => {
  for (const [q] of css.matchAll(/"[^"]*"/g)) if (/, | \/ |transparent|\.js:not/.test(q)) throw new Error(`tight(): the CSS string ${q.slice(0, 60)} would change`);
  return css.replace(/,\s+/g, ',').replace(/\s+\/\s+/g, '/').replace(/\btransparent\b/g, '#0000').split('.js:not(.static) ').join('.m ');
};
const minCss = (code, filename) => tight(cssTransform({ filename, code: Buffer.from(code), minify: true, targets: TARGETS }).code.toString());
const read = (p) => readFile(path.join(SRC, p), 'utf8');
const criticalSrc = (await read('assets/css/textile-critical.css')) + (await read('assets/css/critical.css'));
const criticalCss = minCss(criticalSrc, 'critical.css');
// language-specific layout tweaks (longer strings): src/assets/css/critical-<lang>.css, inlined into that page only
const criticalFor = async (code) => { try { return minCss(criticalSrc + (await read(`assets/css/critical-${code}.css`)), 'critical.css'); } catch (e) { if (e.code === 'ENOENT') return criticalCss; throw e; } };
const siteCss = minCss((await read('assets/css/textile.css')) + (await read('assets/css/site.css')), 'site.css');
let js = await read('assets/js/site.js');
if (NO_FUEGO) js = js.replace('fuegoAddon: true', 'fuegoAddon: false');
const siteJs = (await jsTransform(js, { minify: true, format: 'esm', target: ['es2020', 'chrome100', 'safari15'] })).code;
const hash = (s) => createHash('sha256').update(s).digest('hex').slice(0, 10);

// ---------------------------------------------------------------- HTML, one page per language
const srcHtml = (await read('index.html'));
const base = NO_FUEGO ? srcHtml.replace(/<!--fuego:start-->[\s\S]*?<!--fuego:end-->/g, '') : srcHtml;

// One external sprite for every page: the logo mark plus the icons/flags written as <symbol>s in src's inline
// <svg class="sprite"> (kept there so src stays readable). <use href="#id"> becomes <use href="assets/svg/sprite.svg?v=…#id">.
const mark = JSON.parse(await readFile(path.join(ROOT, 'tools/mark-paths.json'), 'utf8'));
const inlineSprite = base.match(/<svg class="sprite"[^>]*>([\s\S]*?)<\/svg>\n?/);
const spriteSvg = `<svg xmlns="http://www.w3.org/2000/svg">` +
  `<symbol id="mark-sun" viewBox="${mark.viewBox}"><path transform="${mark.sun.t}" d="${mark.sun.d}"/></symbol>` +
  `<symbol id="mark-peaks" viewBox="${mark.viewBox}"><path transform="${mark.peaks.t}" d="${mark.peaks.d}"/></symbol>` +
  inlineSprite[1].replace(/<!--[\s\S]*?-->/g, '').replace(/\s*\n\s*/g, '') + `</svg>`;
const spriteIds = new Set([...spriteSvg.matchAll(/<symbol id="([\w-]+)"/g)].map((m) => m[1]));
const spriteHref = `assets/svg/sprite.svg?v=${hash(spriteSvg)}`;
const cssHref = `assets/css/site.css?v=${hash(siteCss)}`;
const pre = (id, sizes, media) => `<link rel="preload" as="image" type="image/avif" imagesrcset="${srcset(id, 'avif')}" imagesizes="${sizes}" media="${media}" fetchpriority="high">`;
const flag = (code, size = 24) => `<svg class="flag" width="${size}" height="${size}" aria-hidden="true"><use href="${spriteHref}#f-${code}"/></svg>`;
const rel = (from, to) => (from.dir ? '../' : './') + to.dir; // page → page, relative (works in a sub-folder too)

// Round flag button + small menu (a <details>, so it opens without JS too). site.js keeps the #hash.
const switcher = (L) => `<details class="lang" data-lang-menu><summary class="lang__btn">${flag(L.code, 30)}<span class="vh">${L.label}: ${L.name}</span></summary>` +
  `<ul class="lang__list">${LANGS.map((o) => `<li><a href="${rel(L, o)}" hreflang="${o.code}" lang="${o.code}"${o === L ? ' aria-current="true"' : ''}>${flag(o.code)}<span>${o.name}</span></a></li>`).join('')}</ul></details>`;

const dicts = {};
for (const L of LANGS.slice(1)) dicts[L.code] = JSON.parse(await readFile(path.join(SRC, `i18n/${L.code}.json`), 'utf8'));
const pages = [];
const problems = [];
for (const L of LANGS) {
  const r = localize(base, { lang: L.code, dict: dicts[L.code], source: LANGS[0].code });
  if (r.missing.length) {
    const seen = new Set();
    problems.push(`${r.missing.length} untranslated string(s) for "${L.code}" — add them to src/i18n/${L.code}.json ("t" or "keep"):\n` +
      r.missing.filter((m) => !seen.has(m.key) && seen.add(m.key)).map((m) => `    ${JSON.stringify(m.key)}: "",   // ${m.where}`).join('\n'));
  }
  if (r.bad.length) problems.push(`malformed translations in src/i18n/${L.code}.json:\n    ` + r.bad.join('\n    '));
  if (r.unused.length && !NO_FUEGO) console.warn(`i18n ${L.code}: ${r.unused.length} dictionary entr${r.unused.length > 1 ? 'ies are' : 'y is'} no longer used on the page: ${r.unused.slice(0, 8).map((u) => JSON.stringify(u)).join(', ')}${r.unused.length > 8 ? ' …' : ''}`);
  pages.push([L, r.html]);
}
if (problems.length) { console.error(problems.join('\n\n')); process.exit(1); }

let count = 0;
for (const [L, src] of pages) {
  let html = src;
  const url = ORIGIN + L.dir;
  html = html.replace(/<img\b[^>]*\sdata-pic="[^"]+"[^>]*>/g, (tag) => { count++; return picture(tag); });
  html = html.replace(/\{\{wa:(\w+)\}\}/g, (_, k) => waHref(L.code, k));
  html = html.replace(inlineSprite[0], '');
  html = html.replace(/href="#([\w-]+)"/g, (m, id) => (spriteIds.has(id) ? `href="${spriteHref}#${id}"` : m));
  html = html.replace('<!--preload:hero-->', pre('hero-m', 'calc(100vw - 40px)', '(max-width: 959px)') + '\n' + pre('hero-d', '(min-width: 1280px) 540px, 42vw', '(min-width: 960px)'));
  html = html.replace('<link rel="stylesheet" href="assets/css/critical.css" data-inline>', `<style>${await criticalFor(L.code)}</style>`);
  html = html.replace('<link rel="stylesheet" href="assets/css/site.css" data-async>',
    `<link rel="preload" href="${cssHref}" as="style"><link rel="stylesheet" href="${cssHref}" media="print" onload="this.media='all'"><noscript><link rel="stylesheet" href="${cssHref}"></noscript>`);
  html = html.replace('src="assets/js/site.js"', `src="assets/js/site.js?v=${hash(siteJs)}"`);
  // per-page URL, language alternates, share image
  html = html.replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${url}">\n` +
    LANGS.map((o) => `<link rel="alternate" hreflang="${o.code}" href="${ORIGIN + o.dir}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${ORIGIN}">`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*"/, `$1${url}"`);
  html = html.replace(/<meta property="og:locale" content="[^"]*">/, `<meta property="og:locale" content="${L.locale}">` + LANGS.filter((o) => o !== L).map((o) => `\n<meta property="og:locale:alternate" content="${o.locale}">`).join(''));
  html = html.replace(/(<meta property="og:image" content=")[^"]*"/, `$1${ORIGIN + L.og}"`);
  html = html.replace(/("offers":\{[^}]*"url":")[^"]*"/, `$1${url}"`);
  // JSON-LD: this page's share image and the payment method in its language (TravelAgency)
  html = html.replace(/(<script type="application\/ld\+json">)([\s\S]*?)(<\/script>)/, (_, a, json, b) => {
    const data = JSON.parse(json);
    for (const n of data['@graph'] ?? [data]) {
      if (n.image === ORIGIN + LANGS[0].og) n.image = ORIGIN + L.og;
      if (n.paymentAccepted) n.paymentAccepted = L.cash;
    }
    return a + '\n' + JSON.stringify(data) + '\n' + b;
  });
  html = html.replace('<!--lang-switcher-->', switcher(L));
  html = html.replace(/\sdata-confirm="[^"]*"/g, ''); // review annotations (see the CONFIRM comment in src) are not shipped
  html = html.replace(/\sdata-(lang|i18n)="[^"]*"/g, ''); // per-language elements / translation contexts were handled by localize()
  html = html.replace(/<!--(?! Proposal build)[\s\S]*?-->/g, ''); // comments (CONFIRM list, section markers, fuego markers) stay in src only; the D5 'Proposal build' launch reminder stays in the output
  html = html.replace(/\n[ \t]+/g, '\n').replace(/\n{2,}/g, '\n');
  if (L.dir) {
    // a page in a sub-folder: every site-relative URL gets "../" (CSS inlined in <style> too); page-to-page
    // links ("./", "../") and #fragments are already right
    const up = (u) => (/^(#|\.|\/|[a-z][a-z0-9+.-]*:)/i.test(u) || !u ? u : '../' + u);
    html = html.replace(/(\s(?:src|href|data-src|data-poster|data-src-webm|data-src-mp4|poster)=")([^"]*)"/g, (_, a, u) => `${a}${up(u)}"`);
    html = html.replace(/(\s(?:srcset|imagesrcset|data-srcset)=")([^"]*)"/g, (_, a, v) => `${a}${v.split(/,\s*/).map((c) => up(c)).join(', ')}"`);
    html = html.replace(/url\((?!["']?(?:data:|#|\.|\/|https?:))(["']?)/g, 'url($1../');
    html = html.replace('href="../site.webmanifest"', 'href="site.webmanifest"'); // the page's own manifest (see below)
    html = html.replace(/(<(?!html\b)[a-z][^>]*?)\slang="(\w+)"/g, (m, t, l) => (l === L.code && !/hreflang/.test(m.slice(-30)) ? t : m)); // lang= equal to the page's is redundant
  }
  const left = html.match(/\{\{[^}]+\}\}|data-pic=|<!--lang-/g);
  if (left) throw new Error(`${L.code}: unexpanded placeholders: ` + left.join(', '));
  if (NO_FUEGO) { // every Fuego-hike mention (both languages) must sit inside the markers
    const stray = html.match(/Fuego hike|caminata (opcional )?al Fuego|Q300|fuegoAddon|data-fuego|id="(fuego|upgrade)"|#fuego\b|f-fuego|legal and safety|legales y de seguridad/gi);
    if (stray) throw new Error(`--no-fuego-hike left Fuego-hike content outside <!--fuego:start/end--> (${L.code}): ` + [...new Set(stray)].join(', '));
  }
  L.html = html;
}

await mkdir(SITE, { recursive: true });
for (const L of LANGS) {
  await mkdir(path.join(SITE, L.dir), { recursive: true });
  await writeFile(path.join(SITE, L.dir, 'index.html'), L.html);
}
for (const dir of ['css', 'js', 'fonts', 'svg', 'brand']) await rm(path.join(SITE, 'assets', dir), { recursive: true, force: true });
await mkdir(path.join(SITE, 'assets/css'), { recursive: true });
await mkdir(path.join(SITE, 'assets/js'), { recursive: true });
await writeFile(path.join(SITE, 'assets/css/site.css'), siteCss);
await writeFile(path.join(SITE, 'assets/js/site.js'), siteJs);
await mkdir(path.join(SITE, 'assets/svg'), { recursive: true });
await writeFile(path.join(SITE, 'assets/svg/sprite.svg'), spriteSvg);
for (const dir of ['fonts', 'brand']) await cp(path.join(SRC, 'assets', dir), path.join(SITE, 'assets', dir), { recursive: true }).catch(() => {});
for (const f of ['favicon.svg', 'favicon.ico', 'apple-touch-icon.png', 'og-image.jpg', 'og-image-es.jpg', 'robots.txt', 'site.webmanifest', 'icon-192.png', 'icon-512.png']) {
  await cp(path.join(SRC, f), path.join(SITE, f)).catch(() => {});
}
// each other language gets its own manifest (name/description in that language, icons from the root)
const webmanifest = JSON.parse(await read('site.webmanifest'));
for (const L of LANGS.slice(1)) {
  const t = (s) => dicts[L.code].manifest?.[s] ?? s;
  const m = { ...webmanifest, lang: L.code, name: t(webmanifest.name), description: t(webmanifest.description), icons: webmanifest.icons.map((i) => ({ ...i, src: '../' + i.src })) };
  for (const k of ['name', 'description']) if (m[k] === webmanifest[k]) throw new Error(`site.webmanifest "${k}" has no ${L.code} translation (src/i18n/${L.code}.json "manifest")`);
  await writeFile(path.join(SITE, L.dir, 'site.webmanifest'), JSON.stringify(m, null, 2) + '\n');
}
const gz = async (s) => (await import('node:zlib')).gzipSync(s, { level: 9 }).length;
for (const L of LANGS) console.log(`site/${L.dir}index.html written (${L.code})${NO_FUEGO ? ' (no Fuego hike)' : ''} — html ${(await gz(L.html)) / 1000} KB gz`);
console.log(`${count} pictures · critical CSS ${(await gz(criticalCss)) / 1000} KB gz · site.css ${(await gz(siteCss)) / 1000} KB gz · site.js ${(await gz(siteJs)) / 1000} KB gz`);
