/* favicon.js: draws the tab icon on a 32px canvas so it matches the current theme, and
 * slowly rotates its ring on medium/high quality. Redrawn about twice a second (browsers
 * ignore faster favicon updates anyway). With reduced motion it is drawn once, still.
 */

export function init(ctx) {
  const link = document.querySelector('link[rel="icon"]');
  if (!link) return;
  const cv = document.createElement('canvas');
  cv.width = cv.height = 32;
  const c = cv.getContext('2d');
  let colors = ctx.u.themeColors(), angle = 0, acc = 1, dirty = true;

  function draw() {
    const [a, b, d] = colors.map((col) => `rgb(${col.join(',')})`);
    c.clearRect(0, 0, 32, 32);
    c.fillStyle = '#05060d';
    c.beginPath();
    c.roundRect ? c.roundRect(0, 0, 32, 32, 8) : c.rect(0, 0, 32, 32);
    c.fill();
    // ring made of three coloured arcs
    c.lineWidth = 3.5;
    c.lineCap = 'round';
    [a, b, d].forEach((col, i) => {
      c.strokeStyle = col;
      c.beginPath();
      c.arc(16, 16, 10.5, angle + i * 2.094 + 0.25, angle + (i + 1) * 2.094 - 0.25);
      c.stroke();
    });
    c.fillStyle = b;
    c.beginPath();
    c.arc(16, 16, 4, 0, 6.283);
    c.fill();
    try { link.href = cv.toDataURL('image/png'); } catch { /* keep the static icon */ }
  }

  ctx.on('settings', () => { colors = ctx.u.themeColors(); dirty = true; });

  ctx.loop.add((dt) => {
    const animate = !ctx.reduced() && ctx.q() >= 2;
    if (!animate) {
      if (dirty) { angle = 0; draw(); dirty = false; }
      return;
    }
    acc += dt;
    if (acc < 0.5 && !dirty) return;
    acc = 0;
    dirty = false;
    angle += 0.45;
    draw();
  });
}
