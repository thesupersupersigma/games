/* cards.js: loads games.json and runs everything about the game grid.
 *
 * games.json SCHEMA (an array of objects, shown in the order written):
 *   id       (required) unique string, e.g. "polytrack"
 *   title    (required) display name
 *   path     (required) folder URL relative to the site root, e.g. "polytrack/"
 *   cover    (optional) image path. Missing or broken -> a cover is drawn procedurally
 *   icon     (optional) small icon path shown next to the card number
 *   tagline  (optional) one-line description
 *   tags     (optional) array of strings; they become the filter chips
 *   accent   (optional) "#rrggbb" glow colour. Missing -> derived from the id
 * Entries missing a required field, or pointing at another website, are skipped.
 *
 * What lives here: rendering, 3D tilt + glare, search + tag filter + sort (animated with
 * the FLIP technique), arrow-key navigation, and the launch transition.
 */

const SORTS = ['featured', 'a to z', 'z to a'];
const HEX = /^#[0-9a-f]{6}$/i;
const TIPS = [
  'tip: blinking is allowed',
  'tip: ctrl+k works on the launcher',
  'tip: the frame rate governor is watching',
  'tip: stretch your hands first',
  'tip: the back button brings you home',
];

export async function init(ctx) {
  const { u } = ctx;
  const grid = u.$('#grid'), stateEl = u.$('#grid-state'), search = u.$('#search');
  const chips = u.$('#chips'), sortBtn = u.$('#sort'), countEl = u.$('#count'), launchEl = u.$('#launch');
  let games = [], cards = [], query = '', tag = null, sortMode = 0, launching = false;

  // ------------------------------------------------------------------ data
  function normalize(g, order) {
    if (!g || typeof g !== 'object' || !g.id || !g.title || !g.path) return null;
    let url;
    try { url = new URL(String(g.path), location.href); } catch { return null; }
    if (url.origin !== location.origin) return null; // only ever link to our own games
    const id = String(g.id);
    return {
      id, order,
      title: String(g.title),
      path: String(g.path),
      cover: g.cover ? String(g.cover) : null,
      icon: g.icon ? String(g.icon) : null,
      tagline: g.tagline ? String(g.tagline) : '',
      tags: Array.isArray(g.tags) ? g.tags.map(String) : [],
      accent: HEX.test(g.accent || '') ? g.accent : `hsl(${u.hash(id) % 360}, 90%, 66%)`,
    };
  }

  async function fetchGames() {
    // nginx doesn't long-cache .json, but the timestamp + no-store make sure of it.
    const res = await fetch(`games.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data)) throw new Error('games.json must be an array');
    return data.map(normalize).filter(Boolean);
  }

  // ------------------------------------------------------------------ procedural cover
  // Used when a game has no cover (or the image fails). Same game -> same artwork, because
  // the random numbers are seeded from the game's id.
  function proceduralCover(g) {
    const cv = u.h('canvas', { class: 'card-cover', width: 640, height: 440, 'aria-hidden': 'true' });
    const c = cv.getContext('2d');
    const rand = u.rng(u.hash(g.id + g.title));
    c.fillStyle = '#070912';
    c.fillRect(0, 0, 640, 440);
    const glow = c.createRadialGradient(640 * rand(), 440 * rand(), 0, 320, 220, 520);
    glow.addColorStop(0, g.accent);
    glow.addColorStop(1, 'rgba(7,9,18,0)');
    c.globalAlpha = 0.55;
    c.fillStyle = glow;
    c.fillRect(0, 0, 640, 440);
    c.strokeStyle = g.accent;
    c.fillStyle = g.accent;
    for (let i = 0; i < 14; i++) {
      const x = rand() * 640, y = rand() * 440, s = 20 + rand() * 120, kind = (rand() * 3) | 0;
      c.globalAlpha = 0.08 + rand() * 0.22;
      c.lineWidth = 1 + rand() * 3;
      c.beginPath();
      if (kind === 0) c.arc(x, y, s / 2, 0, Math.PI * 2);
      else if (kind === 1) c.rect(x - s / 2, y - s / 2, s, s);
      else { c.moveTo(x, y - s / 2); c.lineTo(x + s / 2, y + s / 2); c.lineTo(x - s / 2, y + s / 2); c.closePath(); }
      rand() > 0.5 ? c.stroke() : c.fill();
    }
    const initials = g.title.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    c.globalAlpha = 0.9;
    c.font = '900 230px system-ui, sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = 'rgba(255,255,255,.92)';
    c.fillText(initials, 320, 215);
    return cv;
  }

  // ------------------------------------------------------------------ rendering
  function buildCard(g, i) {
    const media = u.h('span', { class: 'card-media' });
    if (g.cover) {
      const img = u.h('img', { class: 'card-cover', src: g.cover, alt: '', loading: 'lazy', decoding: 'async', draggable: 'false' });
      img.addEventListener('error', () => img.replaceWith(proceduralCover(g)), { once: true });
      media.append(img);
    } else media.append(proceduralCover(g));
    media.append(u.h('span', { class: 'card-shade' }), u.h('span', { class: 'card-glare' }));

    let icon = null;
    if (g.icon) {
      icon = u.h('img', { src: g.icon, alt: '', width: 18, height: 18, loading: 'lazy' });
      icon.addEventListener('error', () => icon.remove(), { once: true });
    }
    const body = u.h('span', { class: 'card-body' },
      u.h('span', { class: 'card-kicker' }, icon, u.h('span', { text: String(i + 1).padStart(2, '0') })),
      u.h('span', { class: 'card-title', text: g.title }),
      g.tagline && u.h('span', { class: 'card-tagline', text: g.tagline }),
      g.tags.length > 0 && u.h('span', { class: 'card-tags' }, g.tags.map((t) => u.h('span', { class: 'tag', text: t }))),
    );
    const tilt = u.h('span', { class: 'card-tilt' }, media, body, u.h('span', { class: 'card-play', 'aria-hidden': 'true', text: 'play ▶' }));
    // A real <a href>: middle-click, open-in-new-tab and no-JS all still work.
    const el = u.h('a', {
      class: 'card is-entering', href: g.path, 'data-id': g.id,
      style: `--acc:${g.accent};--i:${i}`,
      'aria-label': `Play ${g.title}${g.tagline ? `. ${g.tagline}` : ''}`,
    }, tilt);

    const card = { g, el, tilt, live: false, rx: 0, ry: 0, px: 0, py: 0, trx: 0, try_: 0, tpx: 0, tpy: 0,
      hay: `${g.title} ${g.id} ${g.tagline} ${g.tags.join(' ')}`.toLowerCase() };

    el.addEventListener('animationend', (e) => { if (e.animationName === 'card-in') el.classList.remove('is-entering'); });
    el.addEventListener('pointerenter', () => ctx.audio.play('hover'));
    el.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse' || ctx.reduced() || ctx.q() === 0) return;
      const r = el.getBoundingClientRect();
      card.tpx = (e.clientX - r.left) / r.width - 0.5;
      card.tpy = (e.clientY - r.top) / r.height - 0.5;
      card.try_ = card.tpx * 16;  // rotateY follows horizontal position
      card.trx = -card.tpy * 12;  // rotateX follows vertical position
      card.live = true;
    });
    el.addEventListener('pointerleave', () => { card.trx = card.try_ = card.tpx = card.tpy = 0; });
    return card;
  }

  // Tilt easing runs in the shared loop; a card only costs anything while it is moving.
  ctx.loop.add((dt) => {
    const k = Math.min(1, dt * 10);
    for (const c of cards) {
      if (!c.live) continue;
      c.rx += (c.trx - c.rx) * k; c.ry += (c.try_ - c.ry) * k;
      c.px += (c.tpx - c.px) * k; c.py += (c.tpy - c.py) * k;
      const resting = !c.trx && !c.try_ && Math.abs(c.rx) < 0.02 && Math.abs(c.ry) < 0.02;
      if (resting) { c.rx = c.ry = c.px = c.py = 0; c.live = false; }
      const st = c.el.style;
      st.setProperty('--rx', `${c.rx.toFixed(2)}deg`);
      st.setProperty('--ry', `${c.ry.toFixed(2)}deg`);
      st.setProperty('--px', c.px.toFixed(3));
      st.setProperty('--py', c.py.toFixed(3));
    }
  });

  // ------------------------------------------------------------------ FLIP layout animation
  // First: remember where every card is. Last: apply the change. Invert + Play: start each
  // card from its old position and let it glide to the new one.
  function flip(mutate) {
    if (ctx.reduced()) { mutate(); return; }
    const first = new Map();
    for (const c of cards) if (!c.el.hidden) first.set(c, c.el.getBoundingClientRect());
    mutate();
    for (const c of cards) {
      if (c.el.hidden) continue;
      const from = first.get(c), to = c.el.getBoundingClientRect();
      if (!from) {
        c.el.animate([{ opacity: 0, transform: 'scale(.86)' }, { opacity: 1, transform: 'none' }], { duration: 380, easing: 'cubic-bezier(.2,.8,.2,1)' });
      } else if (Math.abs(from.left - to.left) > 1 || Math.abs(from.top - to.top) > 1) {
        c.el.animate([{ transform: `translate(${from.left - to.left}px,${from.top - to.top}px)` }, { transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.2,.9,.2,1)' });
      }
    }
  }

  function applyFilter() {
    const tokens = query.toLowerCase().split(/\s+/).filter(Boolean);
    const keep = (c) => (!tag || c.g.tags.includes(tag)) && tokens.every((t) => c.hay.includes(t));
    flip(() => { for (const c of cards) c.el.hidden = !keep(c); });
    const shown = cards.filter((c) => !c.el.hidden).length;
    countEl.textContent = cards.length ? `showing ${shown} of ${cards.length}` : '';
    if (cards.length && !shown) {
      stateEl.hidden = false;
      stateEl.replaceChildren(u.h('div', { class: 'state-box' },
        u.h('strong', { text: 'nothing matches that' }),
        u.h('p', { text: 'try fewer letters, or a different tag.' }),
        u.h('button', { class: 'btn', type: 'button', text: 'clear filters', onclick: clearFilters })));
    } else if (cards.length) stateEl.hidden = true;
  }

  function clearFilters() {
    query = ''; tag = null; search.value = '';
    paintChips();
    applyFilter();
  }

  function applySort() {
    const dir = sortMode === 2 ? -1 : 1;
    const sorted = [...cards].sort(sortMode === 0 ? (a, b) => a.g.order - b.g.order : (a, b) => a.g.title.localeCompare(b.g.title) * dir);
    flip(() => sorted.forEach((c) => grid.append(c.el)));
    sortBtn.textContent = `sort: ${SORTS[sortMode]}`;
  }

  function paintChips() {
    for (const b of chips.children) b.setAttribute('aria-pressed', String((b.dataset.tag || null) === tag));
  }
  function buildChips() {
    const tags = [...new Set(games.flatMap((g) => g.tags))].sort();
    chips.replaceChildren();
    if (!tags.length) return;
    chips.append(u.h('button', { class: 'chip', type: 'button', text: 'all', 'data-tag': '' }), ...tags.map((t) => u.h('button', { class: 'chip', type: 'button', text: t, 'data-tag': t })));
    paintChips();
  }

  // ------------------------------------------------------------------ launch transition
  function launch(g, cardEl) {
    if (launching) return;
    const href = new URL(g.path, location.href).href;
    if (ctx.reduced()) { location.href = href; return; }
    launching = true;
    ctx.audio.play('launch');
    launchEl.style.setProperty('--acc', g.accent);
    u.$('#launch-title').textContent = g.title;
    u.$('#launch-tip').textContent = TIPS[(Math.random() * TIPS.length) | 0];

    let gone = false;
    const go = () => { if (!gone) { gone = true; setTimeout(() => { location.href = href; }, 380); } };
    setTimeout(go, 2500); // safety net: never leave someone stuck on the launch screen

    if (cardEl && document.startViewTransition) {
      // View Transitions API: the card and the launch screen share a name, so the browser
      // morphs one into the other.
      cardEl.style.viewTransitionName = 'launch-card';
      const vt = document.startViewTransition(() => {
        cardEl.style.viewTransitionName = '';
        launchEl.style.viewTransitionName = 'launch-card';
        launchEl.hidden = false;
      });
      vt.finished.then(go, go);
    } else {
      // Manual fallback: a circle wipe that grows out of the card (or the screen centre).
      const r = cardEl?.getBoundingClientRect();
      const x = r ? r.left + r.width / 2 : innerWidth / 2, y = r ? r.top + r.height / 2 : innerHeight / 2;
      launchEl.hidden = false;
      launchEl.animate([{ clipPath: `circle(0px at ${x}px ${y}px)` }, { clipPath: `circle(150vmax at ${x}px ${y}px)` }], { duration: 650, easing: 'cubic-bezier(.7,0,.2,1)' }).finished.then(go, go);
    }
  }

  // Coming back with the browser's Back button can restore this page from memory with the
  // launch screen still showing. Put everything back.
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    launching = false;
    launchEl.hidden = true;
    launchEl.style.viewTransitionName = '';
  });

  // ------------------------------------------------------------------ events
  grid.addEventListener('click', (e) => {
    const a = e.target.closest('a.card');
    // Only take over a plain left click. Ctrl/middle-click etc. keep their normal meaning.
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const card = cards.find((c) => c.el === a);
    if (!card || ctx.reduced()) return;
    e.preventDefault();
    launch(card.g, a);
  });

  grid.addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(e.key)) return;
    const list = [...grid.querySelectorAll('.card:not([hidden])')];
    const i = list.indexOf(document.activeElement);
    if (i < 0) return;
    let next = i;
    if (e.key === 'ArrowRight') next = i + 1;
    else if (e.key === 'ArrowLeft') next = i - 1;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = list.length - 1;
    else {
      // Up/Down: nearest card in the row above/below (works for any number of columns).
      const r = list[i].getBoundingClientRect(), dir = e.key === 'ArrowDown' ? 1 : -1;
      let best = -1, bestScore = Infinity;
      list.forEach((el, j) => {
        const o = el.getBoundingClientRect(), dy = (o.top - r.top) * dir;
        if (dy < 10) return;
        const score = dy * 3 + Math.abs(o.left - r.left);
        if (score < bestScore) { bestScore = score; best = j; }
      });
      if (best < 0) return; // no row that way: let the page scroll normally
      next = best;
    }
    next = u.clamp(next, 0, list.length - 1);
    if (next === i) return;
    e.preventDefault();
    list[next].focus();
    ctx.audio.play('hover');
  });

  search.addEventListener('input', () => { query = search.value; applyFilter(); });
  search.addEventListener('keydown', (e) => { if (e.key === 'Escape' && search.value) { e.preventDefault(); search.value = ''; query = ''; applyFilter(); } });
  chips.addEventListener('click', (e) => {
    const b = e.target.closest('.chip');
    if (!b) return;
    tag = b.dataset.tag || null;
    paintChips();
    applyFilter();
    ctx.audio.play('click');
  });
  sortBtn.addEventListener('click', () => { sortMode = (sortMode + 1) % SORTS.length; applySort(); ctx.audio.play('click'); });
  document.addEventListener('keydown', (e) => {
    if (e.key === '/' && !u.typing(e) && !u.modalOpen() && !e.ctrlKey && !e.metaKey) { e.preventDefault(); search.focus(); }
  });

  // ------------------------------------------------------------------ start
  async function start() {
    stateEl.hidden = true;
    grid.replaceChildren(u.h('div', { class: 'skeleton' }), u.h('div', { class: 'skeleton' }));
    try {
      games = await fetchGames();
    } catch (err) {
      games = []; cards = [];
      grid.replaceChildren();
      countEl.textContent = '';
      stateEl.hidden = false;
      stateEl.replaceChildren(u.h('div', { class: 'state-box is-error', role: 'alert' },
        u.h('strong', { text: 'the game list did not load' }),
        u.h('p', { text: `games.json said: ${err.message}` }),
        u.h('button', { class: 'btn', type: 'button', text: 'try again', onclick: start })));
      console.warn('[games] could not load games.json', err);
      ctx.audio.play('error');
      ctx.emit('games:loaded', games);
      return;
    }
    cards = games.map(buildCard);
    grid.replaceChildren(...cards.map((c) => c.el));
    buildChips();
    applyFilter();
    if (!games.length) {
      stateEl.hidden = false;
      stateEl.replaceChildren(u.h('div', { class: 'state-box' }, u.h('strong', { text: 'no games yet' }), u.h('p', { text: 'add an entry to games.json and it will show up here.' })));
    }
    ctx.emit('games:loaded', games);
  }

  ctx.games = {
    list: () => games,
    launch(id) {
      const card = cards.find((c) => c.g.id === id);
      if (card) launch(card.g, card.el.hidden ? null : card.el);
    },
    random() {
      if (!games.length) { ctx.toast('no games to pick from'); return; }
      const g = games[(Math.random() * games.length) | 0];
      ctx.toast(`rolling the dice: ${g.title}`, 1500);
      ctx.games.launch(g.id);
    },
  };

  await start();
}
