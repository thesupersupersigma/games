/* loop.js: the ONE requestAnimationFrame loop for the whole page, plus the quality governor.
 *
 * Every animated system registers a callback with ctx.loop.add(fn). fn(dt, t) gets the
 * seconds since the last frame (capped) and the time in seconds. One loop means one place
 * to pause everything when the tab is hidden.
 *
 * QUALITY GOVERNOR
 * Effective quality = min(what the user picked in settings, what this machine can handle).
 * Every 1.5s we look at the average frame rate:
 *   below 42 fps          -> step the cap down one level (never below "low")
 *   above 56 fps for ~9s  -> step back up (at most twice, so it can't flip-flop forever)
 * The result is written to <html data-quality="..."> for CSS and announced as a "quality" event.
 */

const LEVELS = ['off', 'low', 'medium', 'high'];

export function init(ctx) {
  const tasks = new Set();
  const root = document.documentElement;
  let raf = 0, last = 0, started = 0;
  let cap = 3, acc = 0, frames = 0, fps = 0, goodWindows = 0, stepUps = 0;

  const userLevel = () => Math.max(0, LEVELS.indexOf(ctx.settings.get().quality));
  const q = () => Math.min(userLevel(), cap);
  ctx.q = q;

  function apply() {
    root.dataset.quality = LEVELS[q()];
    ctx.stats.quality = `${LEVELS[userLevel()]} -> ${LEVELS[q()]}`;
    ctx.emit('quality', q());
  }

  function govern() {
    ctx.emit('fps', fps);
    if (ctx.reduced() || userLevel() === 0) return;
    if (fps < 42 && q() > 1) { cap = q() - 1; goodWindows = 0; apply(); }
    else if (fps > 56 && cap < 3 && stepUps < 2) {
      if (++goodWindows >= 6) { cap++; stepUps++; goodWindows = 0; apply(); }
    } else goodWindows = 0;
  }

  function frame(now) {
    raf = requestAnimationFrame(frame);
    const ms = now - last;
    last = now;
    if (ms <= 0 || ms > 250) return; // first frame, or we were paused: don't count it
    acc += ms;
    frames++;
    if (acc >= 1500) {
      fps = (frames * 1000) / acc;
      acc = 0;
      frames = 0;
      if (now - started > 3500) govern(); // ignore the janky first seconds of page load
    }
    const dt = Math.min(ms / 1000, 0.05);
    const t = now / 1000;
    for (const fn of tasks) fn(dt, t);
  }

  function start() {
    if (raf) return;
    last = performance.now();
    acc = 0;
    frames = 0;
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    cancelAnimationFrame(raf);
    raf = 0;
  }

  // Hidden tab: stop everything. No point burning battery on effects nobody can see.
  document.addEventListener('visibilitychange', () => (document.hidden ? stop() : start()));

  // A manual change in settings resets the governor so the new choice gets a fair try.
  let lastUser = userLevel();
  ctx.on('settings', () => {
    if (userLevel() !== lastUser) { lastUser = userLevel(); cap = 3; stepUps = 0; goodWindows = 0; }
    apply();
  });

  started = performance.now();
  apply();
  if (!document.hidden) start();

  return {
    add(fn) { tasks.add(fn); return () => tasks.delete(fn); },
    fps: () => fps,
    capped: () => q() < userLevel(),
    levelName: () => LEVELS[q()],
  };
}
