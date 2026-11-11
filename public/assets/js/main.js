/* main.js: entry point. Builds the shared `ctx` object and loads every other module.
 *
 * HOW MODULES ARE WIRED
 * nginx caches .js for 7 days, so every module URL needs the same ?v= as this file.
 * To keep that to ONE number (the ?v= in index.html), modules never `import` each other.
 * main.js loads each one with a dynamic import that carries the version along, and hands
 * them a shared `ctx` object instead:
 *
 *   ctx.u          helpers from util.js (h, clamp, scramble, themeColors ...)
 *   ctx.on/emit    tiny event bus. Events: settings, quality, fps, games:loaded, intro:done
 *   ctx.settings   get() / set(patch) / open()          (settings.js)
 *   ctx.reduced()  true when motion should be reduced   (settings.js)
 *   ctx.loop       add(fn) to the single shared requestAnimationFrame loop (loop.js)
 *   ctx.q()        effective effects quality: 0 off, 1 low, 2 medium, 3 high (loop.js)
 *   ctx.audio      play(name)                           (audio.js)
 *   ctx.pointer    { x, y, active, fine } live mouse position
 *   ctx.toast(msg) little status pill at the bottom
 *   ctx.games      list() / launch(id) / random()       (cards.js)
 *   ctx.fx         burst() / rain() particle effects    (particles.js, may be undefined)
 *   ctx.stats      numbers the dev HUD shows
 *
 * Load order: core -> content (so the page is usable fast) -> heavy effects when idle.
 */

const V = new URL(import.meta.url).searchParams.get('v') || '0';
const load = (name) => import(`./${name}.js?v=${V}`);
const root = document.documentElement;

async function boot() {
  const [u, settings, loop, audio] = await Promise.all(['util', 'settings', 'loop', 'audio'].map(load));
  const bus = u.createBus();
  const ctx = {
    V, u,
    on: bus.on,
    emit: bus.emit,
    stats: {},
    pointer: {
      x: innerWidth / 2, y: innerHeight / 3, active: false,
      fine: matchMedia('(hover: hover) and (pointer: fine)').matches,
    },
    toast: u.createToast(document.getElementById('toast')),
  };

  ctx.settings = settings.init(ctx);
  ctx.loop = loop.init(ctx);
  ctx.audio = audio.init(ctx);

  addEventListener('pointermove', (e) => {
    ctx.pointer.x = e.clientX;
    ctx.pointer.y = e.clientY;
    ctx.pointer.active = e.pointerType !== 'touch';
  }, { passive: true });
  root.addEventListener('pointerleave', () => { ctx.pointer.active = false; });

  ctx.on('intro:done', () => root.classList.add('ready'));

  // Content first: these make the page usable.
  const [intro, hero, cards] = await Promise.all(['intro', 'hero', 'cards'].map(load));
  window.__tsssBooted = true; // tells the inline safety net in index.html that we made it
  intro.init(ctx);
  hero.init(ctx);
  await cards.init(ctx);

  // Decoration last, when the browser has a spare moment. Each one is optional:
  // if a module fails, the page still works without that effect.
  const whenIdle = window.requestIdleCallback || ((fn) => setTimeout(fn, 200));
  whenIdle(() => {
    for (const name of ['background', 'particles', 'cursor', 'palette', 'eggs', 'favicon']) {
      load(name).then((m) => m.init(ctx)).catch((err) => console.warn(`[games] optional module "${name}" did not start`, err));
    }
  });
}

boot().catch((err) => {
  console.error('[games] could not start the launcher', err);
  root.classList.remove('intro-pending');
  root.classList.add('ready', 'boot-failed');
});
