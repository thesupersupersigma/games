/* hero.js: the big title and the "live" bits under it.
 *
 *  - splits the title into one <span class="ch"> per letter (CSS animates them in)
 *  - letters lean away from the cursor and ride a slow idle wave (medium/high quality)
 *  - random glitch flickers on the title
 *  - rotating taglines with a decode effect
 *  - ticking clock, "time on page" counter, live frame rate, and a players counter that
 *    is obviously a joke
 */

const TAGLINES = [
  'certified over-engineered',
  'every pixel here is animated. sorry.',
  'no ads. no trackers. just games.',
  'now with 400% more javascript than necessary',
  'frame rate governor included at no extra cost',
  'press ctrl+k. you know you want to.',
  'this page has a settings panel. for a list of links.',
];

export function init(ctx) {
  const { u } = ctx;
  const title = u.$('#title'), tagline = u.$('#tagline'), hero = u.$('#hero');
  const clock = u.$('#clock'), uptime = u.$('#uptime'), fpsEl = u.$('#fps'), players = u.$('#players');
  const letters = [];

  // ---- split the title into letters (screen readers get the plain text via aria-label)
  title.setAttribute('aria-label', title.textContent.replace(/\s+/g, ' ').trim());
  title.querySelectorAll('.t-line').forEach((line) => {
    const chars = [...line.textContent];
    line.textContent = '';
    line.style.setProperty('--n', chars.length);
    chars.forEach((ch, li) => {
      const el = u.h('span', { class: 'ch', 'aria-hidden': 'true', text: ch, style: `--i:${letters.length};--li:${li}` });
      line.append(el);
      letters.push({ el, x: 0, y: 0, s: 1, cx: 0, cy: 0 });
    });
  });
  title.classList.add('is-split');

  // ---- measure letter centres (page coordinates) so the loop never has to touch layout
  let radius = 140;
  function measure() {
    for (const l of letters) {
      const r = l.el.getBoundingClientRect();
      l.cx = r.left + r.width / 2 + scrollX - l.x;
      l.cy = r.top + r.height / 2 + scrollY - l.y;
    }
    radius = Math.max(90, parseFloat(getComputedStyle(title).fontSize) * 1.5);
  }
  addEventListener('resize', measure, { passive: true });
  document.fonts?.ready.then(measure);
  setTimeout(measure, 1600); // once more after the entrance animation has settled
  measure();

  let onScreen = true;
  new IntersectionObserver(([entry]) => { onScreen = entry.isIntersecting; }).observe(hero);

  // ---- per-frame work
  let moved = false, second = 0, tagTimer = 0, tagIndex = 0, glitchIn = 5, started = performance.now();

  function tickClock() {
    const now = new Date();
    clock.textContent = now.toLocaleTimeString([], { hour12: false });
    clock.dateTime = now.toISOString();
    const secs = Math.floor((performance.now() - started) / 1000);
    uptime.textContent = `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  }
  tickClock();

  ctx.loop.add((dt, t) => {
    // once a second: clock + counters
    second += dt;
    if (second >= 1) { second = 0; tickClock(); }

    if (ctx.reduced()) {
      if (moved) { for (const l of letters) { l.x = l.y = 0; l.s = 1; l.el.style.transform = ''; } moved = false; }
      return;
    }

    // rotating tagline
    tagTimer += dt;
    if (tagTimer > 4.6) {
      tagTimer = 0;
      tagIndex = (tagIndex + 1) % TAGLINES.length;
      u.scramble(ctx, tagline, TAGLINES[tagIndex], 0.8);
    }

    if (!onScreen) return;

    // occasional glitch flicker
    glitchIn -= dt;
    if (glitchIn <= 0 && ctx.q() >= 2) {
      glitchIn = 4 + Math.random() * 6;
      title.classList.add('is-glitching');
      setTimeout(() => title.classList.remove('is-glitching'), 300);
    }

    // cursor-reactive letters + idle wave
    if (ctx.q() < 2) {
      if (moved) { for (const l of letters) { l.x = l.y = 0; l.el.style.transform = ''; } moved = false; }
      return;
    }
    const px = ctx.pointer.x + scrollX, py = ctx.pointer.y + scrollY;
    const k = Math.min(1, dt * 12);
    letters.forEach((l, i) => {
      let tx = 0, ty = Math.sin(t * 1.3 + i * 0.42) * 3, ts = 1;
      if (ctx.pointer.active) {
        const dx = l.cx - px, dy = l.cy - py, d = Math.hypot(dx, dy) || 1;
        const f = Math.max(0, 1 - d / radius);
        tx += (dx / d) * f * f * 30;
        ty += (dy / d) * f * f * 30;
        ts += f * 0.22;
      }
      l.x += (tx - l.x) * k;
      l.y += (ty - l.y) * k;
      l.s += (ts - l.s) * k;
      l.el.style.transform = `translate3d(${l.x.toFixed(2)}px,${l.y.toFixed(2)}px,0) scale(${l.s.toFixed(3)})`;
    });
    moved = true;
  });

  // ---- live stats
  ctx.on('fps', (fps) => { fpsEl.textContent = ctx.reduced() ? 'paused' : `${Math.round(fps)} fps`; });
  ctx.on('games:loaded', (games) => {
    u.$('#game-count').textContent = `${games.length} ${games.length === 1 ? 'game' : 'games'}`;
  });
  // The players counter: every so often it "detects" a second player, then admits it was wrong.
  setInterval(() => {
    if (document.hidden || ctx.reduced()) return;
    u.scramble(ctx, players, '2', 0.4);
    setTimeout(() => u.scramble(ctx, players, '1', 0.4), 1400);
  }, 23000);

  u.$('#random').addEventListener('click', () => ctx.games?.random());
}
