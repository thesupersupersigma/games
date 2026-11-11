/* audio.js: UI sound effects synthesised with the Web Audio API (no audio files).
 *
 * Muted by default; the toggle lives in settings. Browsers only allow audio to start after
 * a real click or key press, so the AudioContext is created inside one of those (or at the
 * moment the user switches sound on) and never from a hover. Until then play() does nothing.
 */

export function init(ctx) {
  let ac = null, master = null;
  const enabled = () => ctx.settings.get().sound;

  function unlock() {
    if (!enabled()) return;
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.16;
        master.connect(ac.destination);
      } catch { ac = null; return; }
    }
    if (ac.state === 'suspended') ac.resume().catch(() => {});
  }
  addEventListener('pointerdown', unlock, { capture: true, passive: true });
  addEventListener('keydown', unlock, { capture: true });
  // Turning sound on happens inside a click, which counts as the user gesture we need.
  ctx.on('settings', () => { if (navigator.userActivation?.isActive) unlock(); });

  /** One short note. `to` slides the pitch, `at` delays the start (seconds). */
  function tone(freq, dur, { type = 'sine', at = 0, vol = 1, to = 0 } = {}) {
    const t0 = ac.currentTime + at;
    const osc = ac.createOscillator();
    const gain = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.03);
  }

  const SFX = {
    hover:  () => tone(1250, 0.045, { vol: 0.22 }),
    click:  () => tone(620, 0.07, { type: 'triangle', to: 880, vol: 0.5 }),
    toggle: () => { tone(520, 0.06, { type: 'triangle', vol: 0.5 }); tone(780, 0.08, { type: 'triangle', at: 0.06, vol: 0.5 }); },
    open:   () => tone(340, 0.14, { to: 720, vol: 0.45 }),
    close:  () => tone(720, 0.12, { to: 320, vol: 0.4 }),
    type:   () => tone(1700 + Math.random() * 400, 0.02, { type: 'square', vol: 0.08 }),
    launch: () => [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.16, { type: 'triangle', at: i * 0.07, vol: 0.5 })),
    party:  () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.12, { type: 'square', at: i * 0.09, vol: 0.22 })),
    error:  () => tone(220, 0.22, { type: 'sawtooth', to: 110, vol: 0.3 }),
  };

  return {
    play(name) {
      if (!enabled() || !ac || ac.state === 'closed') return;
      try { SFX[name]?.(); } catch { /* a failed beep must never break the page */ }
    },
  };
}
