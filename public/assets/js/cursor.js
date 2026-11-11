/* cursor.js: pointer micro-interactions.
 *
 *  - click ripple on buttons and chips (works with touch too)
 *  - custom cursor: a dot that sits exactly on the pointer plus a ring that trails it on a
 *    spring, and changes shape over links, buttons and text fields
 *  - "magnetic" elements ([data-magnetic]) that lean toward the cursor when it gets close
 * The custom cursor and magnets only exist on devices with a real mouse, and switch off
 * with reduced motion or effects quality "off" (the normal system cursor comes back).
 */

export function init(ctx) {
  const root = document.documentElement;

  // ---- ripple (all devices)
  document.addEventListener('pointerdown', (e) => {
    const host = e.target.closest?.('.btn, .icon-btn, .chip');
    if (!host || ctx.reduced()) return;
    const r = host.getBoundingClientRect();
    const dot = ctx.u.h('span', { class: 'ripple', style: `left:${e.clientX - r.left}px;top:${e.clientY - r.top}px` });
    dot.addEventListener('animationend', () => dot.remove(), { once: true });
    host.append(dot);
  }, { passive: true });

  if (!ctx.pointer.fine) return; // touch device: nothing else to do

  // ---- custom cursor
  const dot = ctx.u.h('div', { class: 'cur-dot', 'aria-hidden': 'true' });
  const ring = ctx.u.h('div', { class: 'cur-ring', 'aria-hidden': 'true' });
  document.body.append(ring, dot);
  let rx = ctx.pointer.x, ry = ctx.pointer.y, vx = 0, vy = 0, scale = 1, targetScale = 1, down = false;

  const enabled = () => !ctx.reduced() && ctx.q() > 0;
  const sync = () => root.classList.toggle('has-cursor', enabled());
  ctx.on('settings', sync);
  ctx.on('quality', sync);
  sync();

  addEventListener('pointermove', (e) => { if (e.pointerType === 'mouse') root.classList.add('cursor-on'); }, { passive: true });
  root.addEventListener('pointerleave', () => root.classList.remove('cursor-on'));
  addEventListener('pointerdown', () => { down = true; }, { passive: true });
  addEventListener('pointerup', () => { down = false; }, { passive: true });
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    if (!(t instanceof Element)) return;
    const text = t.closest('input[type="text"], input[type="search"]');
    const hot = !text && t.closest('a, button, label, .switch, .palette li');
    ring.classList.toggle('is-text', !!text);
    ring.classList.toggle('is-hover', !!hot);
    targetScale = text ? 0.5 : hot ? 1.7 : 1;
  }, { passive: true });

  // ---- magnets
  const magnets = [...document.querySelectorAll('[data-magnetic]')].map((el) => ({ el, x: 0, y: 0, tx: 0, ty: 0, live: false }));
  addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || !enabled()) return;
    for (const m of magnets) {
      const r = m.el.getBoundingClientRect();
      if (!r.width) continue;
      // measure against the resting position (undo the offset we applied ourselves)
      const cx = r.left + r.width / 2 - m.x, cy = r.top + r.height / 2 - m.y;
      const dx = e.clientX - cx, dy = e.clientY - cy;
      const inside = Math.abs(dx) < r.width / 2 + 26 && Math.abs(dy) < r.height / 2 + 26;
      m.tx = inside ? dx * 0.28 : 0;
      m.ty = inside ? dy * 0.28 : 0;
      if (inside) m.live = true;
    }
  }, { passive: true });

  ctx.loop.add((dt) => {
    if (!enabled()) {
      for (const m of magnets) if (m.live) { m.x = m.y = m.tx = m.ty = 0; m.live = false; m.el.style.transform = ''; }
      return;
    }
    // ring: a damped spring chasing the pointer (stiffness 170, damping 20)
    const px = ctx.pointer.x, py = ctx.pointer.y;
    vx += ((px - rx) * 170 - vx * 20) * dt;
    vy += ((py - ry) * 170 - vy * 20) * dt;
    rx += vx * dt;
    ry += vy * dt;
    scale += ((down ? targetScale * 0.75 : targetScale) - scale) * Math.min(1, dt * 14);
    dot.style.transform = `translate3d(${px}px,${py}px,0)`;
    ring.style.transform = `translate3d(${rx.toFixed(1)}px,${ry.toFixed(1)}px,0) scale(${scale.toFixed(3)})`;

    const k = Math.min(1, dt * 12);
    for (const m of magnets) {
      if (!m.live) continue;
      m.x += (m.tx - m.x) * k;
      m.y += (m.ty - m.y) * k;
      if (!m.tx && !m.ty && Math.abs(m.x) < 0.1 && Math.abs(m.y) < 0.1) { m.x = m.y = 0; m.live = false; m.el.style.transform = ''; continue; }
      m.el.style.transform = `translate3d(${m.x.toFixed(2)}px,${m.y.toFixed(2)}px,0)`;
    }
  });
}
