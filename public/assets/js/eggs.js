/* eggs.js: the hidden stuff. COMPLETE LIST (so future-me knows what is in here):
 *
 *  1. KONAMI CODE   up up down down left right left right B A
 *                   -> "party mode" for ~10s: rainbow hue cycling, wiggling cards, confetti.
 *  2. TYPE "sigma"  (anywhere, not in a text field) -> a rain of sigma symbols.
 *  3. TYPE "barrel" -> the whole page does a barrel roll.
 *  4. CLICK THE LOGO 7 TIMES quickly (top-left) -> toggles a developer HUD showing live
 *                   frame rate, effects quality (chosen -> actual), particle count, renderer.
 *  5. DO NOTHING FOR 75 SECONDS -> a screensaver: the handle bounces around the screen and
 *                   changes colour every time it hits an edge. Any input dismisses it.
 *  6. OPEN THE BROWSER CONSOLE -> a styled hello message with hints for the above.
 *
 * All of them respect reduced motion (they either do nothing or show a calm toast).
 */

const KONAMI = ['arrowup', 'arrowup', 'arrowdown', 'arrowdown', 'arrowleft', 'arrowright', 'arrowleft', 'arrowright', 'b', 'a'];
const IDLE_SECONDS = 75;

export function init(ctx) {
  const { u } = ctx;
  const root = document.documentElement;
  const calm = () => ctx.reduced() || ctx.q() === 0;

  // ---- 1. konami -> party mode
  let partying = false;
  function party() {
    if (partying) return;
    ctx.audio.play('party');
    if (calm()) { ctx.toast('party mode (calm edition). imagine confetti.'); return; }
    partying = true;
    ctx.toast('party mode engaged', 3000);
    root.classList.add('party');
    let acc = 0, bursts = 0;
    const stop = ctx.loop.add((dt) => {
      acc += dt;
      if (acc < 0.35) return;
      acc = 0;
      ctx.fx?.burst(Math.random() * innerWidth, Math.random() * innerHeight * 0.7, 24, { rainbow: true });
      if (++bursts > 28) { stop(); root.classList.remove('party'); partying = false; }
    });
  }

  // ---- 2 + 3. typed words, and the konami sequence, share one key listener
  let typed = '', konamiAt = 0;
  document.addEventListener('keydown', (e) => {
    if (u.typing(e) || u.modalOpen() || e.ctrlKey || e.metaKey || e.altKey) return;
    const key = e.key.toLowerCase();

    konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
    if (konamiAt === KONAMI.length) { konamiAt = 0; party(); }

    if (key.length !== 1) return;
    typed = (typed + key).slice(-12);
    if (typed.endsWith('sigma')) {
      typed = '';
      if (calm()) ctx.toast('Σ');
      else { ctx.fx?.rain('Σ'); ctx.toast('it is raining sigmas'); ctx.audio.play('launch'); }
    } else if (typed.endsWith('barrel')) {
      typed = '';
      if (calm()) ctx.toast('barrel roll skipped (reduced motion)');
      else {
        u.$('#app').animate([{ transform: 'rotate(0deg)' }, { transform: 'rotate(360deg)' }], { duration: 1400, easing: 'cubic-bezier(.6,0,.3,1)' });
        ctx.audio.play('open');
      }
    }
  });

  // ---- 4. logo x7 -> developer HUD
  const hud = u.$('#hud');
  let clicks = 0, clickTimer = 0;
  const paintHud = () => {
    if (hud.hidden) return;
    hud.textContent = [
      `fps        ${Math.round(ctx.loop.fps()) || '--'}`,
      `quality    ${ctx.stats.quality ?? '--'}`,
      `particles  ${ctx.stats.particles ?? 0}`,
      `renderer   ${ctx.stats.renderer ?? '--'}`,
      `motion     ${ctx.reduced() ? 'reduced' : 'full'}`,
    ].join('\n');
  };
  u.$('#logo').addEventListener('click', () => {
    clearTimeout(clickTimer);
    clickTimer = setTimeout(() => { clicks = 0; }, 1800);
    if (++clicks < 7) return;
    clicks = 0;
    hud.hidden = !hud.hidden;
    ctx.toast(hud.hidden ? 'developer hud off' : 'developer hud on');
    ctx.audio.play('toggle');
    paintHud();
  });
  ctx.on('fps', paintHud);
  ctx.on('quality', paintHud);

  // ---- 5. idle screensaver
  let idle = 0, saver = null;
  function endSaver() {
    idle = 0;
    if (!saver) return;
    saver.el.remove();
    saver.dim.remove();
    saver = null;
  }
  for (const evt of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart', 'scroll']) {
    addEventListener(evt, endSaver, { passive: true, capture: true });
  }
  ctx.loop.add((dt) => {
    if (calm() || u.modalOpen()) { idle = 0; return; }
    if (!saver) {
      idle += dt;
      if (idle < IDLE_SECONDS) return;
      const dim = u.h('div', { class: 'saver-dim', 'aria-hidden': 'true' });
      const el = u.h('div', { class: 'saver', 'aria-hidden': 'true', text: 'thesupersupersigma' });
      document.body.append(dim, el);
      saver = { el, dim, x: 40, y: 40, vx: 150, vy: 110, hue: 190, w: el.offsetWidth, h: el.offsetHeight };
    }
    const s = saver;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
    let hit = false;
    if (s.x <= 0 || s.x + s.w >= innerWidth) { s.vx *= -1; s.x = u.clamp(s.x, 0, innerWidth - s.w); hit = true; }
    if (s.y <= 0 || s.y + s.h >= innerHeight) { s.vy *= -1; s.y = u.clamp(s.y, 0, innerHeight - s.h); hit = true; }
    if (hit) { s.hue = (s.hue + 67) % 360; s.el.style.setProperty('--hue', s.hue); }
    s.el.style.transform = `translate3d(${s.x.toFixed(1)}px,${s.y.toFixed(1)}px,0)`;
  });

  // ---- 6. console hello
  console.log(
    '%c thesupersupersigma / games %c\nyou opened the console. respect.\nhints: an old cheat code works here. so does typing "sigma" or "barrel".\nthe logo likes being clicked. and try doing absolutely nothing for a while.',
    'font: 800 16px ui-monospace, monospace; color: #05060d; background: linear-gradient(90deg,#5ee1ff,#a78bfa,#6effbe); padding: 6px 10px; border-radius: 6px;',
    'font: 12px ui-monospace, monospace; color: #9aa7c7;',
  );
}
