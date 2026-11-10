/* Solex Tours · one deferred ES module, no dependencies.
   Every CTA is a real wa.me link without JS; this file only enhances. */

// ---------------------------------------------------------------- CONFIG (single source)
const CONFIG = {
  wa: { primary: '50248347003', secondary: '50249468883' },
  pickupOvernight: { en: '8:00 AM', es: '8:00 a. m.' }, // confirmed by the client (R2, 9 Nov 2026); from 6:30 AM on request
  // en / es: the line in the English / Spanish page's message (R2: the English message has no "(ES)" summary line)
  pickupTimes: { 800: { en: '8:00 AM (standard)', es: '8:00 a. m. (estándar)' }, 630: { en: '6:30 AM (on request)', es: '6:30 a. m. (a solicitud)' } },
  fuego: { q: 300 }, // optional Fuego hike, decided and paid at camp: never in the website total
  // en / es: the tour in the English / Spanish message · name / nameEs: short name (dock, card)
  tours: {
    overnight: { q: 750, usd: 100, en: 'Acatenango Overnight Hike (2 days / 1 night)', es: 'Caminata de 2 días al Acatenango (1 noche en cabaña)', name: 'Overnight hike', nameEs: 'Caminata de 2\u00a0días' },
    midnight: { q: 750, usd: 100, en: 'Midnight sunrise tour (leaves 10:30 PM)', es: 'Tour de medianoche (sale a las 10:30 p. m.)', name: 'Midnight sunrise', nameEs: 'Tour de medianoche' },
    sunset: { q: 750, usd: 100, en: 'Sunset tour (leaves 10:30 AM)', es: 'Tour de atardecer (sale a las 10:30 a. m.)', name: 'Sunset tour', nameEs: 'Tour de atardecer' },
    express: { q: 675, usd: 90, en: 'One-day express (leaves 5:00 AM)', es: 'Tour exprés de un día (sale a las 5:00 a. m.)', name: 'One-day express', nameEs: 'Tour exprés' },
  },
  porter: { kg: 13, up: 250, down: 250 },
  features: {
    fuegoAddon: true, // the optional Fuego hike (R2-D: legend, camp block, ticket upgrade, sunset row, FAQ, menu, builder + message);
                      // false removes every [data-feature="fuegoAddon"]; tools/build.mjs --no-fuego-hike strips them from the HTML
    reviews: true, // real Google reviews (5.0 · 25, Nov 2026)
    portrait: false, // true once a photo of Alexander at his door exists
    heroAnnotation: true, // "the view from our cabins" on the hero photo
    community: true, familyRun: true, guidesHistory: true, // proposal: Alexander approves wording before launch
    faqTomorrow: false,
  },
};

// ---------------------------------------------------------------- language: the page's <html lang> picks the table
// (English is the source page; tools/build.mjs writes es/index.html from src/i18n/es.json)
const LANG = document.documentElement.lang === 'es' ? 'es' : 'en';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const root = document.documentElement;
const MOTION = !root.classList.contains('static') && matchMedia('(prefers-reduced-motion: no-preference)').matches;
const IO = 'IntersectionObserver' in window;
const SAVE_DATA = !!(navigator.connection && navigator.connection.saveData);
const isDesk = () => matchMedia('(min-width: 960px)').matches;
const on = (el, ev, fn, o) => el && el.addEventListener(ev, fn, o);
const observe = (els, cb, opts) => {
  if (!IO) return els.forEach((el) => cb({ isIntersecting: true, target: el }, null));
  const io = new IntersectionObserver((es) => es.forEach((e) => cb(e, io)), opts);
  els.forEach((el) => el && io.observe(el));
  return io;
};

// Feature switches: one flag removes every block that carries it.
for (const el of $$('[data-feature]')) if (CONFIG.features[el.dataset.feature] === false) el.remove();
for (const el of $$('[data-cfg="pickup"]')) el.textContent = CONFIG.pickupOvernight[LANG];

// ---------------------------------------------------------------- reveals (+ 2.5 s safety net)
const reveal = $$('.settle, .band, .loom, .ticket, .foot');
const stamp = $('.stamp--ticket');
const show = (el) => el.classList.add('is-in');
const press = () => stamp && stamp.closest('.ticket').classList.add('is-pressed');
if (!MOTION || !IO) { reveal.forEach(show); press(); }
else {
  // Reveal as soon as an element's top passes 88% of the viewport (works for elements of any height).
  observe(reveal, (e, o) => { if (e.isIntersecting) { show(e.target); o.unobserve(e.target); } }, { rootMargin: '0px 0px -12% 0px' });
  // The stamp presses when its price row is well inside the viewport. (The stamp itself starts at
  // scale(1.8) and is clipped by .ticket{overflow:hidden}, so its own ratio never reaches a high threshold.)
  const priceRow = stamp && stamp.parentElement; // .ticket__price, never transformed
  if (priceRow) observe([priceRow], (e, o) => { if (e.isIntersecting) { press(); o.unobserve(e.target); } }, { threshold: 0.6, rootMargin: '0px 0px -20% 0px' });
  // Safety net: anything already in or above the viewport after 2.5 s is shown.
  setTimeout(() => {
    reveal.forEach((el) => { if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight) show(el); });
    if (priceRow && priceRow.getBoundingClientRect().top < innerHeight) press();
  }, 2500);
  addEventListener('beforeprint', () => { reveal.forEach(show); press(); });
}

// ---------------------------------------------------------------- state + message
const KEY = 'solex-note';
const state = Object.assign({ tour: 'overnight', date: '', flex: false, people: 2, pickup: '', time: '800', after: 'antigua', fuego: false, x: [], name: '', touched: false },
  (() => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const WD_ES_L = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MO_ES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const pad = (n) => String(n).padStart(2, '0');
const parseDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return isNaN(d) ? null : d; };
const dateEN = (d, year = true) => `${WD_EN[d.getUTCDay()]} ${d.getUTCDate()} ${MO_EN[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`;
const dateEsLong = (d) => `${WD_ES_L[d.getUTCDay()]} ${d.getUTCDate()} de ${MO_ES[d.getUTCMonth()]} de ${d.getUTCFullYear()}`;
const dateEsShort = (d) => `${WD_ES[d.getUTCDay()]} ${d.getUTCDate()} ${MO_ES[d.getUTCMonth()].slice(0, 3)}`;
let GT; // the formatter is built once, on first use (Intl setup is costly during module evaluation)
const todayGT = () => (GT ||= new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' })).format(new Date());
const maxDate = () => { const t = parseDate(todayGT()); const day = t.getUTCDate(); t.setUTCMonth(t.getUTCMonth() + 18); if (t.getUTCDate() !== day) t.setUTCDate(0); return t.toISOString().slice(0, 10); };
const money = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); // integers only (prices × people); avoids toLocaleString's ICU cost
const PICKUP = { condesa: 'Café Condesa, Parque Central (Antigua)', parada: 'Café La Parada, Parque La Merced (Antigua)' }; // place names: the same in both messages

// Runtime strings, one table per language (the HTML strings are translated at build time).
const TXT = {
  en: {
    tour: (t) => t.name,
    people: (n) => `${n} ${n === 1 ? 'person' : 'people'}`,
    guides: (n, g) => (n === 1 ? '1 person · ask Alexander about joining a group'
      : `${n} people · ${g} local guide${g > 1 ? 's go (max 8 hikers per guide)' : ''}` + (n > 24 ? '. Big group of friends? Tell Alexander in your note.' : '')),
    far: 'Please pick a date in the next 18 months.', past: 'Please pick today or a later date.',
    today: 'Today? Message Alexander right away; he’ll tell you if there’s still space.',
    send: (q) => `Send on WhatsApp · Q${q}`, sent: 'WhatsApp opened ✓', copied: 'Message copied', hold: 'Press and hold to copy',
    min: 'Minimum 1 person', max: 'Maximum 60 people',
    day: (d) => dateEN(d, false), flexible: 'Date flexible', check: 'Check your date', dockSend: 'Send →', dockCta: 'Check a date',
    perPerson: (usd) => `per person · ≈ US$${usd}`,
    play: 'Play cabin video', playSave: 'Play cabin video (≈ 0.4 MB)', pause: 'Pause cabin video',
  },
  es: {
    tour: (t) => t.nameEs,
    people: (n) => `${n} ${n === 1 ? 'persona' : 'personas'}`,
    guides: (n, g) => (n === 1 ? '1 persona · pregúntale a Alexander si puedes unirte a un grupo'
      : `${n} personas · ${g === 1 ? '1 guía local' : g + ' guías locales (máx. 8 personas por guía)'}` + (n > 24 ? '. ¿Un grupo grande de amigos? Cuéntaselo a Alexander en tu mensaje.' : '')),
    far: 'Elige una fecha dentro de los próximos 18 meses.', past: 'Elige hoy o una fecha posterior.',
    today: '¿Hoy? Escríbele a Alexander ya mismo y te dirá si todavía hay espacio.',
    send: (q) => `Enviar por WhatsApp · Q${q}`, sent: 'WhatsApp abierto ✓', copied: 'Mensaje copiado', hold: 'Mantén presionado para copiar',
    min: 'Mínimo 1 persona', max: 'Máximo 60 personas',
    day: dateEsShort, flexible: 'Fecha flexible', check: 'Revisa la fecha', dockSend: 'Enviar →', dockCta: 'Consultar',
    perPerson: (usd) => `por persona · ≈ US$${usd}`,
    play: 'Reproducir el video de la cabaña', playSave: 'Reproducir el video de la cabaña (≈ 0.4 MB)', pause: 'Pausar el video de la cabaña',
  },
}[LANG];
const RENT = { jacket: ['jacket', 'chaqueta'], backpack: ['backpack', 'mochila'], headlamp: ['headlamp', 'linterna'], poles: ['poles', 'bastones'], shoes: ['shoes', 'zapatos'] };

function totals() {
  const t = CONFIG.tours[state.tour] || CONFIG.tours.overnight;
  return { t, q: t.q * state.people, usd: t.usd * state.people };
}
function dateCheck() {
  if (!state.date) return 'empty';
  const d = parseDate(state.date);
  if (!d) return 'invalid';
  const today = todayGT();
  if (state.date < today) return 'past';
  if (state.date > maxDate()) return 'far';
  return state.date === today ? 'today' : 'ok';
}
function message() {
  const { t, q, usd } = totals();
  const d = dateCheck() === 'ok' || dateCheck() === 'today' ? parseDate(state.date) : null;
  const n = state.people;
  const xs = state.x || [];
  const rent = Object.keys(RENT).filter((k) => xs.includes(k));
  const xEN = [xs.includes('porterUp') && `porter up (${CONFIG.porter.kg} kg)`, xs.includes('porterDown') && `porter down (${CONFIG.porter.kg} kg)`, rent.length && 'rent: ' + rent.map((k) => RENT[k][0]).join(', ')].filter(Boolean);
  const ov = state.tour === 'overnight'; // pickup time, Panajachel and the Fuego hike belong to the overnight hike
  const pana = ov && state.after === 'pana';
  const time = ov ? CONFIG.pickupTimes[state.time] || CONFIG.pickupTimes[800] : null;
  const fuego = ov && CONFIG.features.fuegoAddon && !!state.fuego; // interest only: decided and paid at camp, not in the total
  const name = (state.name || '').replace(/[\r\n]+/g, ' ').trim();
  const pk = PICKUP[state.pickup];
  if (LANG === 'es') { // the Spanish page writes the whole message in Spanish
    const rentEs = rent.map((k) => RENT[k][1]); // "alquiler de chaqueta y linterna" (no colon inside the "Extras:" line)
    const xMsg = [xs.includes('porterUp') && `porteador de subida (${CONFIG.porter.kg} kg)`, xs.includes('porterDown') && `porteador de bajada (${CONFIG.porter.kg} kg)`, rent.length && 'alquiler de ' + (rentEs.length > 1 ? rentEs.slice(0, -1).join(', ') + ' y ' + rentEs.at(-1) : rentEs[0])].filter(Boolean);
    const M = [
      '¡Hola, Alexander! Encontré Solex Tours en tu página web y quiero reservar.',
      '',
      `Tour: ${t.es}`,
      `Fecha: ${d ? dateEsLong(d) : 'todavía sin definir'}${state.flex ? ' (mis fechas son flexibles)' : ''}`,
      `Personas: ${n}`,
      `Recogida: ${pk || 'todavía no sé (Café Condesa o Café La Parada)'}`,
    ];
    if (time) M.push(`Hora de recogida: ${time.es}`);
    if (pana) M.push('Después del tour: seguir hacia Panajachel / Lago de Atitlán (extra a solicitud)');
    if (fuego) M.push(`Caminata opcional al Fuego: me interesa (+Q${CONFIG.fuego.q} por persona, se paga en el campamento)`);
    if (xMsg.length) M.push(`Extras: ${xMsg.join(', ')}`);
    if (name) M.push(`Nombre: ${name}`);
    M.push('', `Precio en la web: Q${money(t.q)} por persona = Q${money(q)} en total (≈ US$${money(usd)}).`, '¿Hay espacio? ¿Me confirmas la hora y el lugar exactos de recogida? ¡Gracias!');
    return M.join('\n');
  }
  const L = [
    "Hi Alexander! I found Solex Tours on your website and I'd like to book.",
    '',
    `Tour: ${t.en}`,
    `Date: ${d ? dateEN(d) : 'not fixed yet'}${state.flex ? ' (my dates are flexible)' : ''}`,
    `People: ${n}`,
    `Pickup: ${pk || 'not sure yet (Café Condesa or Café La Parada)'}`,
  ];
  if (time) L.push(`Pickup time: ${time.en}`);
  if (pana) L.push('After the tour: on toward Panajachel / Lake Atitlán (add-on on request)');
  if (fuego) L.push(`Optional Fuego hike: I'm interested (+Q${CONFIG.fuego.q} per person, paid at camp)`);
  if (xEN.length) L.push(`Extras: ${xEN.join(', ')}`);
  if (name) L.push(`Name: ${name}`);
  // R2 (client): no "(ES)" summary line: anything suggesting the site is separate from Alexander looks bad
  L.push('', `Website price: Q${money(t.q)} per person = Q${money(q)} total (≈ US$${money(usd)}).`, 'Is there space? Could you confirm the exact pickup time and place? Thank you!');
  return L.join('\n');
}
const waLink = (num = CONFIG.wa.primary) => `https://wa.me/${num}?text=${encodeURIComponent(message())}`;

// ---------------------------------------------------------------- form wiring
const form = $('#slip');
const dateIn = $('#f-date');
const dateMsg = $('#date-msg');
const send = $('#send');
const dock = $('#dock');

function setDateMsg(kind, announce) {
  const err = kind === 'past' || kind === 'invalid' || kind === 'far';
  dateIn.setAttribute('aria-invalid', String(err));
  dateMsg.className = 'field__msg' + (err ? ' is-error' : kind === 'today' ? ' is-info' : '');
  dateMsg.textContent = kind === 'far' ? TXT.far : err ? TXT.past : kind === 'today' ? TXT.today : '';
  if (announce && err) dateMsg.setAttribute('role', 'alert'); else dateMsg.removeAttribute('role');
}

function renderPeople() {
  const n = state.people, g = Math.ceil(n / 8);
  for (const s of $$('[data-stepper]')) {
    $('[data-people]', s).textContent = n;
    const figs = $('[data-figs]', s);
    let h = '<i></i>'.repeat(Math.min(n, 24)) + '<i class="g"></i>'.repeat(Math.min(g, 3)) + (g > 3 ? `<span class="more">+${g - 3}</span>` : '');
    if (n > 24) h += `<span class="more">×${n}</span>`;
    figs.innerHTML = h;
    const note = $('[data-guide-note]', s);
    note.textContent = TXT.guides(n, g);
    note.classList.toggle('is-big', n > 24);
    for (const b of $$('[data-step]', s)) {
      const atEdge = (+b.dataset.step < 0 && n <= 1) || (+b.dataset.step > 0 && n >= 60);
      b.setAttribute('aria-disabled', String(atEdge));
    }
  }
  for (const el of $$('[data-people-text]')) el.textContent = TXT.people(n);
}

function render() {
  const { t, q, usd } = totals();
  $('#bubble').textContent = message();
  send.href = waLink();
  for (const a of $$('[data-send-alt]')) a.href = waLink(CONFIG.wa.secondary);
  $('[data-send-label]').textContent = TXT.send(money(q));
  for (const o of $$('[data-total]')) o.textContent = `Q${money(q)} ≈ US$${money(usd)}`;
  const sum = $('[data-card-sum]');
  if (sum) sum.textContent = `${TXT.tour(CONFIG.tours[state.tour])} · ${TXT.people(state.people)}`;
  for (const f of $$('[data-overnight-only]')) f.hidden = state.tour !== 'overnight';
  renderPeople();
  // dock: live booking once anything was chosen
  if (dock) {
    const live = state.touched;
    dock.classList.toggle('is-live', live);
    const d = parseDate(state.date);
    const ok = d && (dateCheck() === 'ok' || dateCheck() === 'today');
    $('[data-dock-l1]').textContent = live ? `${ok ? TXT.day(d) : (dateCheck() === 'empty' ? TXT.flexible : TXT.check)} · ${TXT.people(state.people)}` : `${TXT.tour(t)} · Q${money(t.q)}`;
    $('[data-dock-l2]').textContent = live ? `Q${money(q)} ≈ US$${money(usd)}` : TXT.perPerson(t.usd);
    const cta = $('[data-dock-cta]');
    $('[data-dock-cta-label]').textContent = live ? TXT.dockSend : TXT.dockCta;
    if (live) { cta.href = waLink(); cta.target = '_blank'; cta.rel = 'noopener'; } else cta.removeAttribute('target');
  }
  save();
}

function applyStateToForm() {
  for (const r of $$('input[name="tour"]', form)) r.checked = r.value === state.tour;
  for (const r of $$('input[name="pickup"]', form)) r.checked = r.value === state.pickup;
  for (const r of $$('input[name="after"]', form)) r.checked = r.value === state.after;
  for (const r of $$('input[name="time"]', form)) r.checked = r.value === state.time;
  const fz = $('#f-fuego'); if (fz) fz.checked = !!state.fuego;
  for (const c of $$('input[name="x"]', form)) c.checked = (state.x || []).includes(c.value);
  dateIn.value = state.date || '';
  $('#f-flex').checked = !!state.flex;
  $('#f-name').value = state.name || '';
}

// Non-critical enhancements run when the main thread is idle (keeps the first long task short).
const idle = (fn) => ('requestIdleCallback' in window ? requestIdleCallback(fn, { timeout: 1500 }) : setTimeout(fn, 200));

if (form) {
  const pv = $('.preview', form);
  if (pv && !isDesk()) pv.open = false; // phones: the message stays one tap away; WhatsApp shows it again before sending
  const setRange = () => { dateIn.min = todayGT(); dateIn.max = maxDate(); };
  idle(setRange);
  on(dateIn, 'focus', setRange, { once: true });
  applyStateToForm();
  on(form, 'submit', (e) => e.preventDefault());
  on(form, 'change', (e) => {
    for (const el of $$('.slip__after')) el.hidden = true; // the note changed: the "didn't open?" fallbacks refer to the old one
    const el = e.target;
    if (el.name === 'tour') state.tour = el.value;
    else if (el.name === 'pickup') state.pickup = el.value;
    else if (el.name === 'after') state.after = el.value;
    else if (el.name === 'time') state.time = el.value;
    else if (el.name === 'fuego') state.fuego = el.checked;
    else if (el.name === 'x') state.x = $$('input[name="x"]:checked', form).map((c) => c.value);
    else if (el.name === 'flex') state.flex = el.checked;
    else if (el.name === 'date') { state.date = el.value; setDateMsg(dateCheck()); }
    state.touched = true;
    render();
  });
  on(form, 'input', (e) => {
    if (e.target.name === 'name') { state.name = e.target.value.replace(/[\r\n]+/g, ' ').slice(0, 40); state.touched = true; render(); }
    if (e.target.name === 'date') { state.date = e.target.value; setDateMsg(dateCheck()); render(); }
  });
  if (state.date) setDateMsg(dateCheck());
  // Send: never disabled. Only an invalid/past date blocks, with focus + an announced error.
  on(send, 'click', (e) => {
    const k = dateCheck();
    if (k === 'past' || k === 'invalid' || k === 'far') {
      e.preventDefault();
      setDateMsg(k, true);
      dateIn.focus();
      return;
    }
    send.href = waLink();
    const label = $('[data-send-label]');
    send.classList.add('is-sent');
    label.textContent = TXT.sent;
    for (const el of $$('.slip__after')) el.hidden = false;
    clearTimeout(send._t);
    send._t = setTimeout(() => { send.classList.remove('is-sent'); render(); }, 6000);
  });
  on($('[data-copy]'), 'click', async () => {
    try { await navigator.clipboard.writeText(message()); toast(TXT.copied); }
    catch {
      const pv = $('.preview', form); if (pv) pv.open = true;
      const r = document.createRange(); r.selectNodeContents($('#bubble'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      $('#bubble').scrollIntoView({ block: 'nearest' });
      toast(TXT.hold);
    }
  });
}

// steppers (loom + slip share one state)
for (const b of $$('[data-step]')) on(b, 'click', () => {
  const n = Math.max(1, Math.min(60, state.people + +b.dataset.step));
  if (n === state.people) { toast(n <= 1 ? TXT.min : TXT.max); return; }
  state.people = n;
  state.touched = true;
  render();
});

let toastT;
function toast(text) {
  const t = $('[data-toast]');
  if (!t) return;
  // a modal dialog lives in the top layer: move the toast inside it so it is not painted underneath
  const host = [...document.querySelectorAll('dialog[open]')].pop() || document.body;
  if (t.parentNode !== host) host.append(t);
  t.textContent = text;
  t.classList.add('is-on');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('is-on'), 2500);
}

// ---------------------------------------------------------------- dialogs: sheet + menu
const sheet = $('#note'), menu = $('#menu');
const home = $('[data-form-home]'), sheetBody = $('[data-form-sheet]');
let opener = null;
const canDialog = sheet && typeof sheet.showModal === 'function';

function openSheet(from, opts = {}) {
  if (!canDialog || !form) return false;
  opener = from;
  if (opts.tour && CONFIG.tours[opts.tour]) state.tour = opts.tour;
  if (opts.fuego && CONFIG.features.fuegoAddon) { state.fuego = true; state.touched = true; }
  if (opts.tour || opts.fuego) { applyStateToForm(); render(); }
  sheetBody.appendChild(form);
  sheet.showModal();
  sheetBody.scrollTop = 0;
  const to = opts.gear ? $('#f-extras', form) : opts.fuego ? $('#f-fuego-field', form) : null;
  if (to) to.scrollIntoView({ block: 'start' });
  $('#note-h').focus({ preventScroll: true });
  setDock();
  return true;
}
if (canDialog) {
  on(sheet, 'close', () => { home.appendChild(form); setDock(); if (opener && opener.isConnected) opener.focus({ preventScroll: !opener.closest('.dock') && !isVisible(opener) }); });
  on(sheet, 'click', (e) => { if (e.target === sheet) sheet.close(); });
  on(menu, 'click', (e) => { if (e.target === menu) menu.close(); });
  for (const b of $$('[data-close]')) on(b, 'click', () => b.closest('dialog').close());
  on(menu, 'close', () => { setDock(); if (!menu._nav && opener && opener.isConnected) opener.focus(); menu._nav = false; });
  for (const a of $$('.menu__list a')) on(a, 'click', () => { menu._nav = true; menu.close(); });
}
function isVisible(el) { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; }

on(document, 'click', (e) => {
  const a = e.target.closest('[data-book], [data-open-sheet], [data-open-menu]');
  if (!a) return;
  if (e.ctrlKey || e.metaKey || e.shiftKey || e.altKey || e.button !== 0) return; // new tab / window: follow the real link
  if (a.matches('[data-open-menu]')) {
    if (!canDialog || isDesk()) return;
    e.preventDefault();
    opener = a;
    if (sheet.open) sheet.close();
    menu.showModal();
    setDock();
    return;
  }
  if (a.matches('[data-dock-cta]') && dock.classList.contains('is-live')) { // live dock = real send link, unless the date is wrong
    const k = dateCheck();
    if (k === 'past' || k === 'invalid' || k === 'far') { e.preventDefault(); openSheet(a); setDateMsg(k, true); dateIn.focus(); }
    return;
  }
  if (menu.open) { menu._nav = true; menu.close(); }
  if (openSheet(a.closest('.dock') ? a.closest('.dock').querySelector('.dock__btn') : a, { tour: a.dataset.tour, gear: a.hasAttribute('data-gear'), fuego: a.hasAttribute('data-fuego') })) e.preventDefault();
});
for (const m of $$('[data-open-menu]')) {
  m.setAttribute('role', 'button'); m.setAttribute('aria-haspopup', 'dialog');
  on(m, 'keydown', (e) => { if (e.key === ' ') { e.preventDefault(); m.click(); } }); // role=button: Space activates too
}

// ---------------------------------------------------------------- dock visibility
let pastHero = false, atBook = false, atFoot = false, kb = false, headerShown = false;
function setDock() {
  if (!dock) return;
  const visible = pastHero && !atBook && !atFoot && !kb && !headerShown && !(sheet && sheet.open) && !(menu && menu.open) && !isDesk();
  dock.hidden = false;
  dock.classList.toggle('is-on', visible);
  dock.inert = !visible;
  dock.setAttribute('aria-hidden', String(!visible));
}
if (dock) {
  observe([$('#hero-cta')], (e) => { pastHero = !e.isIntersecting && e.boundingClientRect.top < 0; setDock(); });
  observe([$('#book')], (e) => { atBook = e.isIntersecting; setDock(); }, { threshold: 0.05 });
  observe([$('#footer')], (e) => { atFoot = e.isIntersecting; setDock(); });
  if (window.visualViewport) on(visualViewport, 'resize', () => { kb = visualViewport.height < innerHeight - 150; setDock(); });
  on(window, 'resize', setDock);
  setDock();
}

// ---------------------------------------------------------------- header: compact + hide on scroll-down (mobile)
idle(() => {
  const topBar = $('#top-bar');
  let lastY = null, ticking = false;
  on(window, 'scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      const y = scrollY;
      if (lastY === null) lastY = y;
      if (isDesk()) { headerShown = false; lastY = y; return; }
      const fixed = y > 600;
      topBar.classList.toggle('is-fixed', fixed);
      if (!fixed) { topBar.classList.remove('is-shown'); headerShown = false; }
      else if (Math.abs(y - lastY) > 8) { headerShown = y < lastY; topBar.classList.toggle('is-shown', headerShown); }
      root.classList.toggle('has-top', headerShown);
      if (Math.abs(y - lastY) > 8) lastY = y;
      setDock();
    });
  }, { passive: true });
});

// ---------------------------------------------------------------- sightline toggle (+ one swing on first view)
idle(() => {
  const sight = $('.sight');
  if (sight) {
    const set = (side) => {
      sight.dataset.side = side;
      for (const b of $$('[data-side-btn]', sight)) b.setAttribute('aria-pressed', String(b.dataset.sideBtn === side));
      for (const c of $$('[data-cap]', sight)) c.hidden = c.dataset.cap !== side;
    };
    for (const b of $$('[data-side-btn]', sight)) on(b, 'click', () => { sight._user = true; set(b.dataset.sideBtn); });
    let swung = false;
    observe([sight], (e) => {
      sight.classList.toggle('is-live', e.isIntersecting);
      if (e.isIntersecting && MOTION && !swung) {
        swung = true;
        set('many');
        setTimeout(() => { if (!sight._user) set('ours'); }, 1200);
      }
    }, { threshold: 0.4 });
  }
});

// ---------------------------------------------------------------- the Cabin Door: one view, three shows
idle(() => {
  const door = $('.door');
  if (door) {
    const zones = $$('.door__zone', door);
    const setState = (i) => {
      door.dataset.state = i;
      for (const c of $$('.door__chips button', door)) c.setAttribute('aria-current', String(c.dataset.go === String(i)));
    };
    observe(zones, (e) => { if (e.isIntersecting) setState(e.target.dataset.i); }, { rootMargin: '-50% 0px -50% 0px' });
    for (const c of $$('.door__chips button', door)) on(c, 'click', () => {
      const z = zones[+c.dataset.go - 1];
      const r = z.getBoundingClientRect();
      scrollTo({ top: scrollY + r.top + Math.min(r.height / 2, innerHeight * 0.3) - innerHeight / 2 + 2, behavior: MOTION ? 'smooth' : 'auto' });
      setState(c.dataset.go);
    });
    // warm the other two shows once the section is near
    observe([door], (e, o) => { if (e.isIntersecting) { $$('img', door).forEach((im) => (im.loading = 'eager')); o && o.disconnect(); } }, { rootMargin: '600px 0px' });
  }
});

// ---------------------------------------------------------------- the day in light: sun dial + desktop photo panel
idle(() => {
  const days = $('.days');
  if (days) {
    const panel = $$('.days__panel figure');
    const load = (fig) => {
      if (!fig || fig._ok) return;
      fig._ok = true;
      for (const el of $$('[data-srcset]', fig)) { el.srcset = el.dataset.srcset; el.removeAttribute('data-srcset'); }
      for (const el of $$('[data-src]', fig)) { el.src = el.dataset.src; el.removeAttribute('data-src'); }
    };
    const segs = $$('.seg', days);
    observe(segs, (e) => {
      if (!e.isIntersecting) return;
      const s = e.target;
      days.dataset.dial = s.dataset.dial;
      if (isDesk()) {
        const i = panel.findIndex((f) => f.dataset.photo === s.dataset.phase);
        if (i >= 0) { load(panel[i]); panel.forEach((f, k) => f.classList.toggle('is-on', k === i)); if (!SAVE_DATA) load(panel[i + 1]); }
      }
    }, { rootMargin: '-50% 0px -50% 0px' });
    if (isDesk()) observe([days], (e, o) => { if (e.isIntersecting) { load(panel[0]); o && o.disconnect(); } }, { rootMargin: '100% 0px' });
  }
});

// ---------------------------------------------------------------- cabin video: in view + motion allowed only
idle(() => {
  const vid = $('.film__video'), vbtn = $('.film__toggle');
  if (vid && vbtn) {
    const attach = () => {
      if (vid._src) return;
      vid._src = true;
      vid.innerHTML = `<source src="${vid.dataset.srcWebm}" type="video/webm"><source src="${vid.dataset.srcMp4}" type="video/mp4">`;
      vid.load();
    };
    const setBtn = (p) => { vbtn.setAttribute('aria-pressed', String(p)); vbtn.setAttribute('aria-label', p ? TXT.pause : SAVE_DATA ? TXT.playSave : TXT.play); };
    setBtn(false);
    // the poster is a separate request: fetch it only when the video is about a screen away
    observe([vid], (e, o) => { if (e.isIntersecting) { vid.poster = vid.dataset.poster; o && o.unobserve(vid); } }, { rootMargin: '100% 0px' });
    let userPaused = false;
    on(vbtn, 'click', () => {
      attach();
      if (vid.paused) { userPaused = false; vid.play().then(() => setBtn(true)).catch(() => setBtn(false)); }
      else { userPaused = true; vid.pause(); setBtn(false); }
    });
    if (MOTION && !SAVE_DATA) {
      observe([vid], (e) => { if (e.isIntersecting) attach(); }, { rootMargin: '100% 0px' });
      observe([vid], (e) => {
        if (e.isIntersecting && !userPaused) vid.play().then(() => setBtn(true)).catch(() => {});
        else if (!e.isIntersecting && !vid.paused) { vid.pause(); setBtn(false); }
      }, { threshold: 0.5 });
    }
  }
});

// ---------------------------------------------------------------- language switcher (a <details>: works without JS)
// Switching keeps the visitor's place: the #hash while its target is on screen (or the visitor has not scrolled
// since following it), else the section in view. A keyboard visitor who tabs back up to the header flag scrolls the
// page to the top on the way, so the keyboard path uses the place they last scrolled to (or the #hash) instead.
const langMenu = $('[data-lang-menu]');
if (langMenu) {
  const inView = (el) => { const r = el.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight; };
  const hashTarget = () => location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  // the last section whose top has passed 35% of the viewport; hidden ones are skipped (on phones #prepare is
  // display:none, its top reads 0 and would otherwise always win)
  const sectionInView = () => {
    let id = '';
    for (const s of $$('main > section[id], .foot')) {
      if (!s.getClientRects().length) continue;
      if (s.getBoundingClientRect().top <= innerHeight * 0.35) id = s.id;
    }
    return id && id !== 'top' && scrollY > 200 ? '#' + id : '';
  };
  // the visitor's own scrolling (wheel, touch, scroll keys): remembered ~150 ms after the scroll settles
  let userMoved = false, lastPlace = null, userT = -1e9, settleT = 0;
  const settle = () => { clearTimeout(settleT); settleT = setTimeout(() => { lastPlace = sectionInView(); }, 150); };
  const moved = () => { userMoved = true; userT = performance.now(); settle(); };
  on(window, 'wheel', moved, { passive: true });
  on(window, 'touchmove', moved, { passive: true });
  const SCROLL_KEYS = new Set(['PageUp', 'PageDown', 'Home', 'End', ' ', 'ArrowUp', 'ArrowDown']);
  on(document, 'keydown', (e) => {
    // the first Tab soon after a wheel / swipe focuses "Skip to content" and scrolls the page to the top (before any
    // focus event, with reduced motion): save the place on the key, and let no scroll that follows overwrite it
    if (e.key === 'Tab' && performance.now() - userT < 1500) { clearTimeout(settleT); lastPlace = sectionInView(); userT = -1e9; }
    if (SCROLL_KEYS.has(e.key) && !(e.target.closest && e.target.closest('input, select, textarea, button, summary, [contenteditable], [data-lang-menu], dialog'))) moved();
  });
  on(window, 'scroll', () => { if (performance.now() - userT < 1500) settle(); }, { passive: true }); // smooth / momentum scrolling
  on(window, 'hashchange', () => { userMoved = false; lastPlace = null; });
  const place = () => {
    const h = hashTarget();
    if (h && (!userMoved || inView(h))) return location.hash;
    return sectionInView();
  };
  const byKeyboard = () => { try { return !!$(':focus-visible', langMenu); } catch { return false; } };
  const links = $$('a[hreflang]', langMenu);
  const aim = () => {
    const h = byKeyboard() ? lastPlace ?? (hashTarget() ? location.hash : '') : place();
    for (const a of links) a.href = a.getAttribute('href').split('#')[0] + h;
  };
  on(langMenu, 'toggle', () => { if (langMenu.open) aim(); });
  for (const a of links) {
    on(a, 'pointerdown', aim);
    on(a, 'click', (e) => { if (a.getAttribute('aria-current')) { e.preventDefault(); langMenu.open = false; } else aim(); });
  }
  on(document, 'click', (e) => { if (langMenu.open && !langMenu.contains(e.target)) langMenu.open = false; });
  // Tab out of the list closes it (only when focus lands on something else: a tap on a link that Safari does not
  // focus gives no relatedTarget, and closing then would hide the link before its click)
  on(langMenu, 'focusout', (e) => { if (langMenu.open && e.relatedTarget && !langMenu.contains(e.relatedTarget)) langMenu.open = false; });
  on(langMenu, 'keydown', (e) => {
    if (e.key === 'Escape' && langMenu.open) { e.preventDefault(); langMenu.open = false; $('summary', langMenu).focus(); }
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && langMenu.open) { // arrow keys move between the languages
      e.preventDefault();
      const items = $$('.lang__list a', langMenu);
      let i = items.indexOf(document.activeElement);
      if (i < 0) i = Math.max(0, items.findIndex((a) => a.hasAttribute('aria-current'))); // from the flag: start at the current language
      items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus();
    }
  });
}

// ---------------------------------------------------------------- the ticket's Fuego-hike card: "How it works"
// Phones keep the explanation one tap away (it is in #fuego and the FAQ too); from 600 px it is simply open,
// without its summary. (Without JS it stays a working <details> at every width.)
const upMore = $('.upgrade__more');
if (upMore) {
  const wide = matchMedia('(min-width: 600px)');
  const sync = () => { if (wide.matches) upMore.open = true; upMore.firstElementChild.style.display = wide.matches ? 'none' : ''; };
  sync();
  on(wide, 'change', sync);
}

// ---------------------------------------------------------------- FAQ deep links open their answer
const openTarget = () => {
  const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ block: 'start' }); }
};
on(window, 'hashchange', openTarget);
openTarget();
// a page opened at a #hash jumps there (html.jump, set in <head>); in-page links scroll smoothly again after load
if (root.classList.contains('jump')) {
  const smooth = () => setTimeout(() => root.classList.remove('jump'), 400);
  if (document.readyState === 'complete') smooth(); else on(window, 'load', smooth, { once: true });
}

render();
