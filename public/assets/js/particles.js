/* particles.js: the floating dust layer on <canvas id="fx">.
 *
 *  - ambient particles drift on a slow flow field, get pushed away by the cursor, and (on
 *    high quality) link up with thin lines when they are close to each other
 *  - "sparks" are short-lived particles: the cursor trail, click bursts, and the easter
 *    eggs (confetti, falling symbols) all use them through ctx.fx
 * Particle count scales with quality; reduced motion and "off" draw nothing.
 */

const COUNT = [0, 20, 44, 78];   // ambient particles per quality level
const MAX_SPARKS = 260;

export function init(ctx) {
  const cv = document.getElementById('fx');
  const c = cv.getContext('2d');
  let W = 0, H = 0, parts = [], sparks = [], rgb = '94,225,255', rgb2 = '167,139,250', painted = false;
  let lastTrailX = 0, lastTrailY = 0;

  const make = () => ({ x: Math.random() * W, y: Math.random() * H, vx: 0, vy: 0, r: 0.6 + Math.random() * 1.6, ph: Math.random() * 6.28 });

  function resize() {
    const dpr = Math.min(devicePixelRatio || 1, ctx.q() >= 3 ? 1.5 : 1);
    W = innerWidth;
    H = innerHeight;
    cv.width = Math.round(W * dpr);
    cv.height = Math.round(H * dpr);
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function reseed() {
    const n = ctx.reduced() ? 0 : COUNT[ctx.q()];
    while (parts.length < n) parts.push(make());
    parts.length = n;
    ctx.stats.particles = n;
  }
  function recolor() {
    const cols = ctx.u.themeColors();
    rgb = cols[0].join(',');
    rgb2 = cols[1].join(',');
  }

  function spark(x, y, o = {}) {
    if (sparks.length >= MAX_SPARKS) sparks.shift();
    const a = Math.random() * 6.283, sp = (o.speed ?? 120) * (0.3 + Math.random());
    sparks.push({
      x, y,
      vx: o.vx ?? Math.cos(a) * sp, vy: o.vy ?? Math.sin(a) * sp,
      life: 0, max: o.life ?? 0.5 + Math.random() * 0.5,
      size: o.size ?? 1.5 + Math.random() * 2,
      g: o.gravity ?? 0, hue: o.hue ?? null, ch: o.ch ?? null,
    });
  }

  // Public effects API, used by eggs.js.
  ctx.fx = {
    burst(x, y, n = 14, o = {}) {
      if (ctx.reduced() || ctx.q() === 0) return;
      for (let i = 0; i < n; i++) spark(x, y, { speed: 260, life: 0.7 + Math.random() * 0.7, gravity: 380, size: 2 + Math.random() * 3, hue: o.rainbow ? Math.random() * 360 : null });
    },
    rain(ch, n = 60) {
      if (ctx.reduced() || ctx.q() === 0) return;
      for (let i = 0; i < n; i++) spark(Math.random() * W, -20 - Math.random() * H * 0.8, { vx: (Math.random() - 0.5) * 30, vy: 180 + Math.random() * 240, life: 4, size: 14 + Math.random() * 22, hue: Math.random() * 360, ch });
    },
  };

  addEventListener('resize', () => { resize(); reseed(); }, { passive: true });
  ctx.on('quality', () => { resize(); reseed(); });
  ctx.on('settings', () => { recolor(); reseed(); });
  addEventListener('pointermove', (e) => {
    if (e.pointerType === 'touch' || ctx.reduced() || ctx.q() < 2) return;
    // cursor trail: one spark every ~26px of travel
    if (Math.hypot(e.clientX - lastTrailX, e.clientY - lastTrailY) < 26) return;
    lastTrailX = e.clientX;
    lastTrailY = e.clientY;
    spark(e.clientX, e.clientY, { speed: 26, life: 0.5, size: 1.6 });
  }, { passive: true });
  addEventListener('pointerdown', (e) => { if (ctx.q() >= 2) ctx.fx.burst(e.clientX, e.clientY, 10); }, { passive: true });

  resize();
  recolor();
  reseed();

  ctx.loop.add((dt, t) => {
    if (!parts.length && !sparks.length) {
      if (painted) { c.clearRect(0, 0, W, H); painted = false; }
      return;
    }
    painted = true;
    c.clearRect(0, 0, W, H);
    const q = ctx.q(), px = ctx.pointer.x, py = ctx.pointer.y, near = ctx.pointer.active;

    // ---- ambient particles
    for (const p of parts) {
      const ang = Math.sin(p.x * 0.004 + t * 0.2) + Math.cos(p.y * 0.005 - t * 0.15) + p.ph;
      p.vx += Math.cos(ang) * 14 * dt;
      p.vy += Math.sin(ang) * 14 * dt - 3 * dt; // slight upward drift
      if (near) {
        const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
        if (d2 < 19600 && d2 > 1) { // inside 140px: push away, stronger when closer
          const d = Math.sqrt(d2), f = (1 - d / 140) * 900 * dt;
          p.vx += (dx / d) * f;
          p.vy += (dy / d) * f;
        }
      }
      const damp = Math.exp(-1.6 * dt);
      p.vx *= damp;
      p.vy *= damp;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.x < -10) p.x = W + 10; else if (p.x > W + 10) p.x = -10;
      if (p.y < -10) p.y = H + 10; else if (p.y > H + 10) p.y = -10;
      c.fillStyle = `rgba(${rgb},${0.25 + 0.3 * Math.sin(t * 1.6 + p.ph * 3) ** 2})`;
      c.beginPath();
      c.arc(p.x, p.y, p.r, 0, 6.283);
      c.fill();
    }

    // ---- constellation lines (high quality only: this is the O(n^2) part)
    if (q >= 3) {
      c.lineWidth = 1;
      for (let i = 0; i < parts.length; i++) {
        const a = parts[i];
        for (let j = i + 1; j < parts.length; j++) {
          const b = parts[j], dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
          if (d2 > 12100) continue; // further than 110px
          c.strokeStyle = `rgba(${rgb2},${0.16 * (1 - Math.sqrt(d2) / 110)})`;
          c.beginPath();
          c.moveTo(a.x, a.y);
          c.lineTo(b.x, b.y);
          c.stroke();
        }
      }
    }

    // ---- sparks
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life >= s.max || s.y > H + 60) { sparks.splice(i, 1); continue; }
      s.vy += s.g * dt;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      const alpha = 1 - s.life / s.max;
      c.fillStyle = s.hue == null ? `rgba(${rgb},${alpha})` : `hsla(${s.hue},95%,65%,${alpha})`;
      if (s.ch) {
        c.font = `700 ${s.size}px ui-monospace, monospace`;
        c.fillText(s.ch, s.x, s.y);
      } else {
        c.beginPath();
        c.arc(s.x, s.y, s.size * alpha, 0, 6.283);
        c.fill();
      }
    }
  });
}
