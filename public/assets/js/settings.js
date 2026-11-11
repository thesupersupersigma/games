/* settings.js: saved preferences + the settings panel.
 *
 * Stored in localStorage under "tsss-games-settings" (index.html reads the same key before
 * first paint so the saved theme never flashes). Every storage call is wrapped in try/catch
 * because storage can be blocked (private windows, managed devices).
 *
 *   reduce   null = follow the operating system, true/false = user override
 *   sound    UI sound effects (off by default)
 *   theme    aurora | synth | ember | matrix
 *   quality  high | medium | low | off   (the governor in loop.js may run lower than this)
 */

const KEY = 'tsss-games-settings';
const THEMES = ['aurora', 'synth', 'ember', 'matrix'];
const QUALITIES = ['high', 'medium', 'low', 'off'];
const DEFAULTS = { reduce: null, sound: false, theme: 'aurora', quality: 'high' };

export function init(ctx) {
  const { u } = ctx;
  const root = document.documentElement;
  const mq = matchMedia('(prefers-reduced-motion: reduce)');
  const s = { ...DEFAULTS };

  try {
    const saved = JSON.parse(localStorage.getItem(KEY) || '{}') || {};
    if (typeof saved.reduce === 'boolean') s.reduce = saved.reduce;
    if (typeof saved.sound === 'boolean') s.sound = saved.sound;
    if (THEMES.includes(saved.theme)) s.theme = saved.theme;
    if (QUALITIES.includes(saved.quality)) s.quality = saved.quality;
  } catch { /* storage unavailable: run with defaults */ }

  const reduced = () => (s.reduce === null ? mq.matches : s.reduce);
  ctx.reduced = reduced;

  const elReduce = u.$('#set-reduce'), elSound = u.$('#set-sound');
  const segTheme = u.$('#set-theme'), segQuality = u.$('#set-quality');
  const status = u.$('#set-status'), soundBtn = u.$('#toggle-sound');

  function paint() {
    root.dataset.theme = s.theme;
    root.dataset.motion = reduced() ? 'reduce' : 'full';
    root.dataset.sound = s.sound ? 'on' : 'off';
    elReduce.checked = reduced();
    elSound.checked = s.sound;
    soundBtn.setAttribute('aria-pressed', String(s.sound));
    for (const b of segTheme.children) b.setAttribute('aria-pressed', String(b.dataset.value === s.theme));
    for (const b of segQuality.children) b.setAttribute('aria-pressed', String(b.dataset.value === s.quality));
    paintStatus();
  }
  function paintStatus() {
    if (!ctx.loop) return;
    status.textContent = reduced()
      ? 'reduce motion is on, so animated effects are paused.'
      : ctx.loop.capped()
        ? `running at ${ctx.loop.levelName()} right now to keep the frame rate smooth.`
        : '';
  }

  function set(patch) {
    Object.assign(s, patch);
    try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* not saved, still applied */ }
    paint();
    ctx.emit('settings', s);
  }

  const overlay = u.createOverlay(u.$('#settings'), { onOpen: () => ctx.audio?.play('open'), onClose: () => ctx.audio?.play('close') });

  elReduce.addEventListener('change', () => set({ reduce: elReduce.checked }));
  elSound.addEventListener('change', () => { set({ sound: elSound.checked }); ctx.audio?.play('toggle'); });
  soundBtn.addEventListener('click', () => {
    set({ sound: !s.sound });
    ctx.audio?.play('toggle');
    ctx.toast(s.sound ? 'sound on' : 'sound off', 1400);
  });
  segTheme.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { set({ theme: b.dataset.value }); ctx.audio?.play('click'); }
  });
  segQuality.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (b) { set({ quality: b.dataset.value }); ctx.audio?.play('click'); }
  });
  u.$('#set-reset').addEventListener('click', () => { set({ ...DEFAULTS }); ctx.toast('settings reset'); });
  u.$('#open-settings').addEventListener('click', overlay.open);

  mq.addEventListener('change', () => { paint(); ctx.emit('settings', s); });
  ctx.on('quality', paintStatus);
  paint();

  return {
    get: () => s,
    set,
    open: overlay.open,
    close: overlay.close,
    nextTheme() {
      const next = THEMES[(THEMES.indexOf(s.theme) + 1) % THEMES.length];
      set({ theme: next });
      ctx.toast(`theme: ${next}`, 1400);
    },
  };
}
