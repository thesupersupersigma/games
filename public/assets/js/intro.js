/* intro.js: the fake "boot sequence" shown on the first visit of a browser session.
 *
 * index.html decides before first paint whether it plays (adds .intro-pending to <html>).
 * Skippable with any key, click or tap. Never plays with reduced motion. Remembered in
 * sessionStorage so it shows once per session. The command palette can replay it.
 */

const KEY = 'tsss-games-intro';
const STEP = 0.3; // seconds between log lines

export function init(ctx) {
  const { u } = ctx;
  const root = document.documentElement;
  const log = u.$('#intro-log'), bar = u.$('#intro-bar'), logo = u.$('#intro-logo');
  let stopTask = null, finished = true, gameCount = null;

  ctx.on('games:loaded', (games) => { gameCount = games.length; });

  // Lines are functions so the games count is read at the moment the line appears.
  const LINES = [
    ['ok', () => 'waking up tsss-server'],
    ['ok', () => 'counting polygons .......... too many'],
    ['ok', () => 'calibrating fun levels'],
    ['ok', () => `reading games.json ......... ${gameCount == null ? 'ok' : `${gameCount} found`}`],
    ['warn', () => 'productivity module not found (skipping)'],
    ['ok', () => 'over-engineering landing page ... 100%'],
    ['ok', () => 'ready.'],
  ];

  function finish() {
    if (finished) return;
    finished = true;
    stopTask?.();
    removeEventListener('keydown', skip, true);
    removeEventListener('pointerdown', skip, true);
    root.classList.add('intro-leaving'); // CSS fades the overlay out
    ctx.emit('intro:done');              // page entrance animations start underneath
    setTimeout(() => root.classList.remove('intro-pending', 'intro-leaving'), 520);
  }

  function skip(e) {
    if (e.type === 'keydown' && (e.metaKey || e.ctrlKey || e.altKey)) return; // let browser shortcuts through
    finish();
  }

  function play(force = false) {
    const wanted = force || (root.classList.contains('intro-pending') && !ctx.reduced());
    if (!wanted) {
      root.classList.remove('intro-pending');
      ctx.emit('intro:done');
      return;
    }
    try { sessionStorage.setItem(KEY, '1'); } catch { /* it will simply play again next load */ }
    finished = false;
    log.textContent = '';
    logo.textContent = '';
    bar.style.transform = 'scaleX(0)';
    root.classList.remove('intro-leaving');
    root.classList.add('intro-pending');

    const total = LINES.length * STEP;
    let t = 0, shown = 0, logoStarted = false;
    stopTask = ctx.loop.add((dt) => {
      t += dt;
      while (shown < LINES.length && t >= (shown + 1) * STEP) {
        const [kind, text] = LINES[shown++];
        log.append(u.h('span', { class: kind, text: kind === 'ok' ? '[ ok ] ' : '[warn] ' }), `${text()}\n`);
        ctx.audio.play('type');
      }
      bar.style.transform = `scaleX(${Math.min(t / total, 1)})`;
      if (!logoStarted && t >= total + 0.1) {
        logoStarted = true;
        u.scramble(ctx, logo, 'thesupersupersigma / games', 0.8);
      }
      if (t >= total + 1.5) finish();
    });
    addEventListener('keydown', skip, true);
    addEventListener('pointerdown', skip, true);
  }

  ctx.intro = { replay: () => play(true) };
  play();
}
