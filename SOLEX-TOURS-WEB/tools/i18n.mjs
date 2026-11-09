// Build-time translation of src/index.html (English, the single source of truth) into other languages.
//
//   import { localize } from './i18n.mjs';
//   const { html, missing, unused } = localize(srcHtml, { lang: 'es', dict });
//
//   node tools/i18n.mjs es            # list every translation unit of the page and whether es.json covers it
//   node tools/i18n.mjs es --missing  # only the missing ones, as JSON lines ready to paste into src/i18n/es.json
//
// How the page is cut into translation units (so a translator sees whole sentences, not fragments):
//  · A unit is a run of text + inline elements (b, strong, em, small, span, a inside a sentence, br, …) inside a
//    block (p, li, h2, button, label, summary, figcaption, svg <text>, <title> …). Its key is the run's HTML with
//    every inline element replaced by a numbered placeholder: "Pickup <0>8:00&nbsp;AM</0> · <1>Café Condesa</1>".
//    The translation must use the same placeholders (it may reorder them); the build puts the original tags
//    (with their attributes) back. Void elements are "<0/>". Whitespace is collapsed; entities stay as written.
//  · <svg> icons and HTML comments split runs (so "Swipe for more <svg…>" is just "Swipe for more").
//  · Translatable attributes: alt, title, aria-label, placeholder, and <meta> description / og:* / twitter:* text.
//  · JSON-LD: "name" / "description" strings.
//  · Never translated: <script>/<style>, elements with an explicit lang="…" (already in that language, e.g.
//    <span lang="es">¡Hola!</span> outside a sentence) or translate="no", strings without letters.
//  · data-lang="xx" keeps an element on the xx page only (e.g. the "Original in English" of a translated review).
//  · data-i18n="ctx" on an element: units inside it look up "ctx|<key>" first, then "<key>" — for the rare string
//    that needs a different translation in one place (e.g. short labels inside the camp schematic).
// The dictionary (src/i18n/<lang>.json): { "keep": [strings identical in both languages], "t": { EN: XX } }.
// Every unit must be in "t" or "keep", otherwise the build fails and lists them — so an English edit can never
// ship half-translated.
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr']);
const RAW = new Set(['script', 'style']);
// inline elements that become placeholders when they sit inside a sentence
const PHRASING = new Set(['a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i', 'img', 'input', 'kbd', 'label', 'mark', 'output', 'q', 's', 'samp', 'small', 'span', 'strong', 'sub', 'sup', 'time', 'u', 'var', 'wbr']);
const ATTRS = new Set(['alt', 'title', 'aria-label', 'placeholder']);
const META_TEXT = /^(description|og:title|og:description|og:image:alt|twitter:title|twitter:description|twitter:image:alt)$/;
const HAS_LETTER = /\p{L}/u;
const WS = /[ \t\n\r\f]+/g; // not \s: a literal no-break space is content

// ---------------------------------------------------------------- parse (offsets into the source string)
export function parse(src) {
  const root = { type: 'root', children: [], start: 0, end: src.length };
  const stack = [root];
  const top = () => stack[stack.length - 1];
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  let i = 0;
  while (i < src.length) {
    if (src.startsWith('<!--', i)) {
      const end = src.indexOf('-->', i + 4);
      if (end < 0) throw new Error(`unclosed comment at line ${lineOf(i)}`);
      top().children.push({ type: 'comment', start: i, end: end + 3, parent: top() });
      i = end + 3;
    } else if (src.startsWith('<!', i)) {
      const end = src.indexOf('>', i);
      top().children.push({ type: 'doctype', start: i, end: end + 1, parent: top() });
      i = end + 1;
    } else if (src.startsWith('</', i)) {
      const end = src.indexOf('>', i);
      const tag = src.slice(i + 2, end).trim().toLowerCase();
      const el = top();
      if (el.tag !== tag) throw new Error(`</${tag}> at line ${lineOf(i)} closes <${el.tag}> opened at line ${lineOf(el.start ?? 0)}`);
      el.closeStart = i; el.end = end + 1;
      stack.pop();
      i = end + 1;
    } else if (src[i] === '<' && /[a-zA-Z]/.test(src[i + 1])) {
      let j = i + 1;
      while (j < src.length && !/[\s/>]/.test(src[j])) j++;
      const tag = src.slice(i + 1, j).toLowerCase();
      const attrs = [];
      for (;;) {
        while (/\s/.test(src[j])) j++;
        if (src[j] === '>' || src.startsWith('/>', j)) break;
        const n0 = j;
        while (j < src.length && !/[\s=/>]/.test(src[j])) j++;
        if (j === n0) { j++; continue; } // stray "/"
        const name = src.slice(n0, j).toLowerCase();
        let value = null, vStart = -1, vEnd = -1;
        if (src[j] === '=') {
          j++;
          if (src[j] === '"' || src[j] === "'") { const q = src[j]; vStart = j + 1; vEnd = src.indexOf(q, vStart); j = vEnd + 1; }
          else { vStart = j; while (j < src.length && !/[\s>]/.test(src[j])) j++; vEnd = j; }
          value = src.slice(vStart, vEnd);
        }
        attrs.push({ name, value, start: n0, vStart, vEnd });
      }
      const selfClose = src.startsWith('/>', j);
      const openEnd = j + (selfClose ? 2 : 1);
      const el = { type: 'el', tag, attrs, start: i, openEnd, children: [], parent: top() };
      top().children.push(el);
      if (selfClose || VOID.has(tag)) { el.end = openEnd; el.closeStart = openEnd; }
      else if (RAW.has(tag)) {
        const close = src.toLowerCase().indexOf(`</${tag}`, openEnd);
        el.closeStart = close; el.end = src.indexOf('>', close) + 1;
        el.rawText = { start: openEnd, end: close };
      } else stack.push(el);
      i = el.end && (selfClose || VOID.has(tag) || RAW.has(tag)) ? el.end : openEnd;
    } else {
      let end = src.indexOf('<', i);
      if (end < 0) end = src.length;
      top().children.push({ type: 'text', start: i, end, parent: top() });
      i = end;
    }
  }
  if (stack.length > 1) throw new Error(`<${top().tag}> opened at line ${lineOf(top().start)} is never closed`);
  return root;
}

const attr = (el, name) => el.attrs?.find((a) => a.name === name)?.value ?? null;

// ---------------------------------------------------------------- units
// walks the tree and returns { units, attrs, jsonld, drop } for one target language
function collect(src, root, lang) {
  const units = [], attrUnits = [], drop = [], jsonld = [];
  const isText = (n) => n.type === 'text';
  const textOf = (n) => src.slice(n.start, n.end);

  function attrsOf(el) {
    for (const a of el.attrs) {
      if (a.value == null || !HAS_LETTER.test(a.value)) continue;
      const metaKey = el.tag === 'meta' && a.name === 'content' && (attr(el, 'name') || attr(el, 'property'));
      if (ATTRS.has(a.name) || (metaKey && META_TEXT.test(metaKey))) attrUnits.push({ el, a, key: a.value.replace(WS, ' ').trim() });
    }
  }

  function visitEl(el) {
    const dl = attr(el, 'data-lang');
    if (dl && dl !== lang) { drop.push(el); return; }
    if (RAW.has(el.tag)) {
      if (el.tag === 'script' && attr(el, 'type') === 'application/ld+json') jsonld.push(el);
      return;
    }
    attrsOf(el);
    if (attr(el, 'translate') === 'no' || (attr(el, 'lang') && el.tag !== 'html')) { markAttrsDeep(el); return; }
    visitChildren(el);
  }
  // attributes inside skipped subtrees are still translated (an alt on an image inside lang="es" is English)
  function markAttrsDeep(el) { for (const c of el.children || []) if (c.type === 'el') { attrsOf(c); markAttrsDeep(c); } }

  function visitChildren(el) {
    let run = [];
    const flush = () => {
      if (run.some((n) => isText(n) && textOf(n).trim())) makeUnit(run); // text in the run: one sentence
      else for (const n of run) if (n.type === 'el') visitEl(n); // only elements: each is its own block
      run = [];
    };
    for (const c of el.children) {
      if (c.type === 'text') run.push(c);
      else if (c.type === 'el' && PHRASING.has(c.tag) && !(attr(c, 'data-lang') && attr(c, 'data-lang') !== lang)) run.push(c);
      else { flush(); if (c.type === 'el') visitEl(c); }
    }
    flush();
  }

  function makeUnit(run) {
    // trim whitespace-only text at both ends
    while (run.length && isText(run[0]) && !textOf(run[0]).trim()) run.shift();
    while (run.length && isText(run.at(-1)) && !textOf(run.at(-1)).trim()) run.pop();
    if (!run.length) return;
    const first = run[0], last = run.at(-1);
    const start = isText(first) ? first.start + (textOf(first).length - textOf(first).replace(/^[ \t\n\r\f]+/, '').length) : first.start;
    const end = isText(last) ? last.start + textOf(last).replace(/[ \t\n\r\f]+$/, '').length : last.end;
    const ph = [];
    const ser = (nodes) => nodes.map((n) => {
      if (n.type === 'text') return textOf(n).replace(WS, ' ');
      if (n.type === 'comment') return '';
      const k = ph.push(n) - 1;
      if (n.closeStart === n.openEnd && !n.children.length && (VOID.has(n.tag) || src[n.openEnd - 2] === '/')) return `<${k}/>`;
      if (n.tag === 'svg' || !PHRASING.has(n.tag) || !n.children.length) { n.atomic = true; return `<${k}/>`; } // icons, empty decorative spans
      return `<${k}>${ser(n.children)}</${k}>`;
    }).join('');
    const key = ser(run).replace(WS, ' ').trim();
    let ctx = null;
    for (let a = first.parent; a && !ctx; a = a.parent) ctx = attr(a, 'data-i18n');
    if (HAS_LETTER.test(key.replace(/<\/?\d+\/?>/g, ''))) { units.push({ start, end, key, ph, ctx }); for (const n of ph) markAttrs(n); }
    else for (const n of run) if (n.type === 'el') { attrsOf(n); markAttrsDeep(n); } // e.g. "5.0", "Q1,500 ≈ US$200"
  }
  // attributes of elements inside a unit are translated when their tag is re-emitted
  function markAttrs(el) {
    el.inUnit = true;
    for (const c of el.children || []) if (c.type === 'el') markAttrs(c);
  }

  visitChildren(root);
  return { units, attrUnits, drop, jsonld };
}

// ---------------------------------------------------------------- translate one page
export function localize(src, { lang, dict, source = 'en' }) {
  const root = parse(src);
  const { units, attrUnits, drop, jsonld } = collect(src, root, lang);
  const T = dict?.t ?? {}, KEEP = new Set(dict?.keep ?? []);
  const missing = [], used = new Set(), bad = [];
  const isSource = lang === source;
  const look = (key, where, ctx) => {
    if (isSource) return key;
    if (ctx && Object.hasOwn(T, `${ctx}|${key}`)) { used.add(`${ctx}|${key}`); return T[`${ctx}|${key}`]; }
    if (Object.hasOwn(T, key)) { used.add(key); return T[key]; }
    if (KEEP.has(key)) { used.add(key); return key; }
    if (!HAS_LETTER.test(key.replace(/<\/?\d+\/?>/g, ''))) return key;
    missing.push({ key, where });
    return key;
  };
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  const edits = [];

  // translated value of an attribute (for re-emitted tags and standalone attributes)
  const attrVal = (el, a) => {
    if (isSource || a.value == null || !HAS_LETTER.test(a.value)) return a.value;
    const metaKey = el.tag === 'meta' && a.name === 'content' && (attr(el, 'name') || attr(el, 'property'));
    if (!(ATTRS.has(a.name) || (metaKey && META_TEXT.test(metaKey)))) return a.value;
    const v = look(a.value.replace(WS, ' ').trim(), `line ${lineOf(a.start)} <${el.tag} ${a.name}>`);
    if (/["<>]/.test(v)) bad.push(`attribute translation must not contain " < >: ${v}`);
    return v;
  };
  const openTag = (el) => {
    let out = '', p = el.start;
    for (const a of el.attrs) {
      if (a.vStart < 0) continue;
      const v = attrVal(el, a);
      if (v !== a.value) { out += src.slice(p, a.vStart) + v; p = a.vEnd; }
    }
    return out + src.slice(p, el.openEnd);
  };

  for (const el of drop) edits.push([el.start, el.end, '']);
  for (const { el, a } of attrUnits) if (!el.inUnit && !drop.some((d) => d.start <= el.start && el.end <= d.end)) {
    const v = attrVal(el, a);
    if (v !== a.value) edits.push([a.vStart, a.vEnd, v]);
  }
  for (const u of units) {
    const value = look(u.key, `line ${lineOf(u.start)}`, u.ctx);
    if (isSource) continue;
    if (value === u.key && !u.ph.some((n) => n.attrs.some((a) => ATTRS.has(a.name)))) continue; // nothing to change
    // rebuild: placeholders → original tags (attributes translated), text → as written in the dictionary
    const seen = new Set();
    const out = value.replace(/<(\/?)(\d+)(\/?)>/g, (m, close, k, self) => {
      const n = u.ph[+k];
      if (!n) { bad.push(`"${u.key}": unknown placeholder ${m} in "${value}"`); return ''; }
      if (self || n.atomic) { seen.add(k); return n.atomic ? src.slice(n.start, n.end).replace(src.slice(n.start, n.openEnd), openTag(n)) : openTag(n); }
      if (close) return src.slice(n.closeStart, n.end);
      seen.add(k);
      return openTag(n);
    });
    if (seen.size !== u.ph.length) bad.push(`"${u.key}": the translation must keep every placeholder <0>…<${u.ph.length - 1}> exactly once → "${value}"`);
    if (/[<>]/.test(value.replace(/<\/?\d+\/?>/g, ''))) bad.push(`"${u.key}": stray < or > in "${value}"`);
    if (/&(?![a-zA-Z]+;|#\d+;|#x[0-9a-fA-F]+;)/.test(value)) bad.push(`"${u.key}": escape & as &amp; in "${value}"`);
    edits.push([u.start, u.end, out]);
  }
  // JSON-LD: translate "name" / "description"
  for (const el of jsonld) {
    if (isSource) continue;
    const raw = src.slice(el.rawText.start, el.rawText.end);
    const data = JSON.parse(raw);
    const walk = (o) => {
      if (Array.isArray(o)) return o.forEach(walk);
      if (!o || typeof o !== 'object') return;
      for (const [k, v] of Object.entries(o)) {
        if (typeof v === 'string' && (k === 'name' || k === 'description' || k === 'alternateName')) o[k] = look(v, 'JSON-LD ' + k);
        else walk(v);
      }
    };
    walk(data);
    edits.push([el.rawText.start, el.rawText.end, '\n' + JSON.stringify(data) + '\n']);
  }

  edits.sort((a, b) => b[0] - a[0]);
  let html = src;
  let prev = Infinity;
  for (const [s, e, v] of edits) {
    if (e > prev) throw new Error(`overlapping translation edits at line ${lineOf(s)}`);
    html = html.slice(0, s) + v + html.slice(e);
    prev = s;
  }
  if (!isSource) html = html.replace(/<html\b([^>]*)\slang="[^"]*"/, `<html$1 lang="${lang}"`);
  const unused = isSource ? [] : [...Object.keys(T), ...KEEP].filter((k) => !used.has(k));
  return { html, units: units.map((u) => u.key), missing, unused, bad };
}

// ---------------------------------------------------------------- CLI: coverage report
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const lang = process.argv[2] || 'es';
  const src = await readFile(path.join(ROOT, 'src/index.html'), 'utf8');
  let dict = { t: {}, keep: [] };
  try { dict = JSON.parse(await readFile(path.join(ROOT, `src/i18n/${lang}.json`), 'utf8')); } catch {}
  const r = localize(src, { lang, dict });
  if (process.argv.includes('--missing')) {
    const seen = new Set();
    for (const m of r.missing) if (!seen.has(m.key)) { seen.add(m.key); console.log(`    ${JSON.stringify(m.key)}: "",`); }
  } else {
    console.log(`${r.missing.length} missing · ${r.unused.length} unused · ${r.bad.length} malformed`);
    for (const m of r.missing) console.log(`MISSING  ${m.where}: ${m.key}`);
    for (const u of r.unused) console.log(`UNUSED   ${u}`);
    for (const b of r.bad) console.log(`BAD      ${b}`);
  }
}
