/* Solex Tours · one deferred ES module, no dependencies.
   Every CTA is a real wa.me link without JS; this file only enhances. */

// ---------------------------------------------------------------- CONFIG (single source)
const CONFIG = {
  wa: { primary: '50248347003', secondary: '50249468883' },
  pickupOvernight: '~8:00 AM', // [CONFIRM pickup] latest voice note 8:00; old site 6:30
  tours: {
    overnight: { q: 750, usd: 100, en: 'Acatenango Overnight (2 days / 1 night)', es: 'Tour 2D/1N (acampar)', name: 'Overnight' },
    midnight: { q: 750, usd: 100, en: 'Midnight sunrise tour (leaves 10:30 PM)', es: 'Tour de media noche', name: 'Midnight sunrise' },
    sunset: { q: 750, usd: 100, en: 'Sunset tour (leaves 10:30 AM)', es: 'Tour de atardecer', name: 'Sunset tour' },
    express: { q: 675, usd: 90, en: 'One-day express (leaves 5:00 AM)', es: 'Tour de un día', name: 'One-day express' },
  },
  porter: { kg: 13, up: 250, down: 250 },
  features: {
    fuegoAddon: true, // client directive; tools/build.mjs --no-fuego-hike strips all three mentions
    reviews: true, // real Google reviews (5.0 · 25, Nov 2026)
    portrait: false, // true once a photo of Alexander at his door exists
    heroAnnotation: true, // "the view from our cabins" on the hero photo
    community: true, familyRun: true, guidesHistory: true, // proposal: Alexander approves wording before launch
    faqTomorrow: false,
  },
};

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
for (const el of $$('[data-cfg="pickup"]')) el.textContent = CONFIG.pickupOvernight;

// ---------------------------------------------------------------- reveals (+ 2.5 s safety net)
const reveal = $$('.settle, .band, .loom, .ticket, .foot');
const stamp = $('.stamp--ticket');
const show = (el) => el.classList.add('is-in');
const press = () => stamp && stamp.closest('.ticket').classList.add('is-pressed');
if (!MOTION || !IO) { reveal.forEach(show); press(); }
else {
  // Reveal as soon as an element's top passes 88% of the viewport (works for elements of any height).
  observe(reveal, (e, o) => { if (e.isIntersecting) { show(e.target); o.unobserve(e.target); } }, { rootMargin: '0px 0px -12% 0px' });
  // The stamp presses when the stamp itself is well inside the viewport.
  observe([stamp], (e, o) => { if (e.isIntersecting) { press(); o.unobserve(e.target); } }, { threshold: 0.9, rootMargin: '0px 0px -20% 0px' });
  // Safety net: anything already in or above the viewport after 2.5 s is shown.
  setTimeout(() => reveal.forEach((el) => { if (!el.classList.contains('is-in') && el.getBoundingClientRect().top < innerHeight) show(el); }), 2500);
  addEventListener('beforeprint', () => { reveal.forEach(show); press(); });
}

// ---------------------------------------------------------------- state + message
const KEY = 'solex-note';
const state = Object.assign({ tour: 'overnight', date: '', flex: false, people: 2, pickup: '', after: 'antigua', x: [], name: '', touched: false },
  (() => { try { return JSON.parse(sessionStorage.getItem(KEY)) || {}; } catch { return {}; } })());
const save = () => { try { sessionStorage.setItem(KEY, JSON.stringify(state)); } catch {} };

const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WD_ES = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const pad = (n) => String(n).padStart(2, '0');
const parseDate = (v) => { const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v || ''); if (!m) return null; const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])); return isNaN(d) ? null : d; };
const dateEN = (d, year = true) => `${WD_EN[d.getUTCDay()]} ${d.getUTCDate()} ${MO_EN[d.getUTCMonth()]}${year ? ' ' + d.getUTCFullYear() : ''}`;
const dateES = (d) => `${WD_ES[d.getUTCDay()]} ${pad(d.getUTCDate())}/${pad(d.getUTCMonth() + 1)}/${d.getUTCFullYear()}`;
const todayGT = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const maxDate = () => { const t = parseDate(todayGT()); t.setUTCMonth(t.getUTCMonth() + 18); return t.toISOString().slice(0, 10); };
const money = (n) => n.toLocaleString('en-US');
const PICKUP = { condesa: { en: 'Café Condesa, Parque Central (Antigua)', es: 'Café Condesa' }, parada: { en: 'Café La Parada, Parque La Merced (Antigua)', es: 'Café La Parada' } };
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
  const xES = [xs.includes('porterUp') && 'porteador subida', xs.includes('porterDown') && 'porteador bajada', rent.length && 'alquiler: ' + rent.map((k) => RENT[k][1]).join(', ')].filter(Boolean);
  const pana = state.tour === 'overnight' && state.after === 'pana';
  const name = (state.name || '').replace(/[\r\n]+/g, ' ').trim();
  const pk = PICKUP[state.pickup];
  const L = [
    "Hi Alexander! I found Solex Tours on your website and I'd like to book.",
    '',
    `Tour: ${t.en}`,
    `Date: ${d ? dateEN(d) : 'not fixed yet'}${state.flex ? ' (my dates are flexible)' : ''}`,
    `People: ${n}`,
    `Pickup: ${pk ? pk.en : 'not sure yet (Café Condesa or Café La Parada)'}`,
  ];
  if (pana) L.push('After the tour: heading on toward Panajachel');
  if (xEN.length) L.push(`Extras: ${xEN.join(', ')}`);
  if (name) L.push(`Name: ${name}`);
  L.push('', `Website price: Q${money(t.q)} per person = Q${money(q)} total (≈ US$${money(usd)}).`, 'Is there space? Could you confirm the pickup time? Thank you!', '');
  L.push(`(ES) Hola Alexander: ${t.es} · ${d ? dateES(d) : 'fecha por confirmar'}${state.flex ? ' (fechas flexibles)' : ''} · ${n} ${n === 1 ? 'persona' : 'personas'} · ${pk ? pk.es : 'recogida por confirmar'} · Total Q${money(q)}${pana ? ' · después: Panajachel' : ''}${xES.length ? ' · extras: ' + xES.join(', ') : ''}`);
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
  dateMsg.textContent = kind === 'far' ? 'Please pick a date in the next 18 months.' : err ? 'Please pick today or a later date.' : kind === 'today' ? 'Today? Message Alexander right away; he’ll tell you if there’s still space.' : '';
  if (announce && err) dateMsg.setAttribute('role', 'alert'); else dateMsg.removeAttribute('role');
}

function renderPeople() {
  const n = state.people, g = Math.ceil(n / 8);
  for (const s of $$('[data-stepper]')) {
    $('[data-people]', s).textContent = n;
    const figs = $('[data-figs]', s);
    let h = '<i></i>'.repeat(Math.min(n, 24)) + '<i class="g"></i>'.repeat(Math.min(g, 3));
    if (n > 24) h += `<span class="more">×${n}</span>`;
    figs.innerHTML = h;
    const note = $('[data-guide-note]', s);
    note.textContent = `${n} ${n === 1 ? 'person' : 'people'} · ${g} local guide${g > 1 ? 's go (max 8 hikers per guide)' : ''}` + (n > 24 ? '. Big group of friends? Tell Alexander in your note.' : '');
    note.classList.toggle('is-big', n > 24);
    for (const b of $$('[data-step]', s)) {
      const atEdge = (+b.dataset.step < 0 && n <= 1) || (+b.dataset.step > 0 && n >= 60);
      b.setAttribute('aria-disabled', String(atEdge));
    }
  }
  for (const el of $$('[data-people-text]')) el.textContent = `${n} ${n === 1 ? 'person' : 'people'}`;
}

function render() {
  const { t, q, usd } = totals();
  const msg = message();
  $('#bubble').textContent = msg;
  send.href = waLink();
  $('[data-send-label]').textContent = `Send on WhatsApp · Q${money(q)}`;
  $('[data-total]').textContent = `Q${money(q)} ≈ US$${money(usd)}`;
  const after = $('[data-after]');
  if (after) after.hidden = state.tour !== 'overnight';
  renderPeople();
  // dock: live booking once anything was chosen
  if (dock) {
    const live = state.touched;
    dock.classList.toggle('is-live', live);
    const d = parseDate(state.date);
    const ok = d && (dateCheck() === 'ok' || dateCheck() === 'today');
    $('[data-dock-l1]').textContent = live ? `${ok ? dateEN(d, false) : 'Date flexible'} · ${state.people} ${state.people === 1 ? 'person' : 'people'}` : `${t.name === 'Overnight' ? 'Overnight' : t.name} · Q${money(t.q)}`;
    $('[data-dock-l2]').textContent = live ? `Q${money(q)} ≈ US$${money(usd)}` : `per person · ≈ US$${t.usd}`;
    const cta = $('[data-dock-cta]');
    $('[data-dock-cta-label]').textContent = live ? 'Send →' : 'Check a date';
    if (live) { cta.href = waLink(); cta.target = '_blank'; cta.rel = 'noopener'; } else cta.removeAttribute('target');
  }
  save();
}

function applyStateToForm() {
  for (const r of $$('input[name="tour"]', form)) r.checked = r.value === state.tour;
  for (const r of $$('input[name="pickup"]', form)) r.checked = r.value === state.pickup;
  for (const r of $$('input[name="after"]', form)) r.checked = r.value === state.after;
  for (const c of $$('input[name="x"]', form)) c.checked = (state.x || []).includes(c.value);
  dateIn.value = state.date || '';
  $('#f-flex').checked = !!state.flex;
  $('#f-name').value = state.name || '';
}

if (form) {
  const pv = $('.preview', form);
  if (pv && !isDesk()) pv.open = false; // phones: the message stays one tap away; WhatsApp shows it again before sending
  dateIn.min = todayGT();
  dateIn.max = maxDate();
  applyStateToForm();
  on(form, 'submit', (e) => e.preventDefault());
  on(form, 'change', (e) => {
    const el = e.target;
    if (el.name === 'tour') state.tour = el.value;
    else if (el.name === 'pickup') state.pickup = el.value;
    else if (el.name === 'after') state.after = el.value;
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
    label.textContent = 'WhatsApp opened ✓';
    $('.slip__after').hidden = false;
    clearTimeout(send._t);
    send._t = setTimeout(() => { send.classList.remove('is-sent'); render(); }, 6000);
  });
  on($('[data-copy]'), 'click', async () => {
    try { await navigator.clipboard.writeText(message()); toast('Message copied'); }
    catch {
      const r = document.createRange(); r.selectNodeContents($('#bubble'));
      const s = getSelection(); s.removeAllRanges(); s.addRange(r);
      toast('Press and hold to copy');
    }
  });
}

// steppers (loom + slip share one state)
for (const b of $$('[data-step]')) on(b, 'click', () => {
  const n = Math.max(1, Math.min(60, state.people + +b.dataset.step));
  if (n === state.people) { toast(n <= 1 ? 'Minimum 1 person' : 'Maximum 60 people'); return; }
  state.people = n;
  state.touched = true;
  render();
});

let toastT;
function toast(text) {
  const t = $('[data-toast]');
  if (!t) return;
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
  if (opts.tour && CONFIG.tours[opts.tour]) { state.tour = opts.tour; applyStateToForm(); render(); }
  sheetBody.appendChild(form);
  sheet.showModal();
  sheetBody.scrollTop = 0;
  if (opts.gear) $('#f-extras', form).scrollIntoView({ block: 'start' });
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
  if (a.matches('[data-open-menu]')) {
    if (!canDialog || isDesk()) return;
    e.preventDefault();
    opener = a;
    if (sheet.open) sheet.close();
    menu.showModal();
    setDock();
    return;
  }
  if (a.matches('[data-dock-cta]') && dock.classList.contains('is-live')) return; // live dock = real send link
  if (menu.open) { menu._nav = true; menu.close(); }
  if (openSheet(a.closest('.dock') ? a.closest('.dock').querySelector('.dock__btn') : a, { tour: a.dataset.tour, gear: a.hasAttribute('data-gear') })) e.preventDefault();
});
for (const m of $$('[data-open-menu]')) { m.setAttribute('role', 'button'); m.setAttribute('aria-haspopup', 'dialog'); }

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
const topBar = $('#top-bar');
let lastY = scrollY, ticking = false;
on(window, 'scroll', () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const y = scrollY;
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

// ---------------------------------------------------------------- sightline toggle (+ one swing on first view)
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

// ---------------------------------------------------------------- the Cabin Door: one view, three shows
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

// ---------------------------------------------------------------- the day in light: sun dial + desktop photo panel
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

// ---------------------------------------------------------------- cabin video: in view + motion allowed only
const vid = $('.film__video'), vbtn = $('.film__toggle');
if (vid && vbtn) {
  const attach = () => {
    if (vid._src) return;
    vid._src = true;
    vid.innerHTML = `<source src="${vid.dataset.srcWebm}" type="video/webm"><source src="${vid.dataset.srcMp4}" type="video/mp4">`;
    vid.load();
  };
  const setBtn = (p) => { vbtn.setAttribute('aria-pressed', String(p)); vbtn.setAttribute('aria-label', p ? 'Pause cabin video' : SAVE_DATA ? 'Play cabin video (≈ 0.4 MB)' : 'Play cabin video'); };
  setBtn(false);
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

// ---------------------------------------------------------------- FAQ deep links open their answer
const openTarget = () => {
  const el = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
  if (el && el.tagName === 'DETAILS') { el.open = true; el.scrollIntoView({ block: 'start' }); }
};
on(window, 'hashchange', openTarget);
openTarget();

render();
