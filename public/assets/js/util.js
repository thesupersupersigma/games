/* util.js: small shared helpers. No side effects; everything is handed out through ctx.u. */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const $ = (sel, scope = document) => scope.querySelector(sel);

/** Deterministic string hash (FNV-1a). Used to give each game a stable procedural look. */
export function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/** Seeded random number generator (mulberry32): same seed, same sequence. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Create an element. h('a', { class: 'x', text: 'hi', onclick: fn }, child, [more, children]) */
export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
  return el;
}

/** Minimal pub/sub. on() returns an unsubscribe function. */
export function createBus() {
  const map = new Map();
  return {
    on(evt, fn) {
      if (!map.has(evt)) map.set(evt, new Set());
      map.get(evt).add(fn);
      return () => map.get(evt).delete(fn);
    },
    emit(evt, data) {
      for (const fn of map.get(evt) || []) {
        try { fn(data); } catch (err) { console.warn(`[games] listener for "${evt}" threw`, err); }
      }
    },
  };
}

/** Reads the three theme colours from CSS (--a1/--a2/--a3 are "R G B") as [[r,g,b], ...] in 0..255. */
export function themeColors() {
  const cs = getComputedStyle(document.documentElement);
  return ['--a1', '--a2', '--a3'].map((name) => {
    const parts = cs.getPropertyValue(name).trim().split(/[\s,]+/).map(Number);
    return parts.length === 3 && parts.every(Number.isFinite) ? parts : [94, 225, 255];
  });
}

export function createToast(el) {
  let timer = 0;
  return (msg, ms = 2600) => {
    el.textContent = msg;
    el.classList.add('is-on');
    clearTimeout(timer);
    timer = setTimeout(() => el.classList.remove('is-on'), ms);
  };
}

const GLYPHS = '!<>-_\\/[]{}=+*^?#01';

/** "Decode" text effect: old text scrambles into the new text, left to right. */
export function scramble(ctx, el, text, dur = 0.7) {
  if (el.__stopScramble) el.__stopScramble();
  if (ctx.reduced()) { el.textContent = text; return; }
  const from = el.textContent || '';
  const len = Math.max(from.length, text.length);
  let t = 0;
  const stop = ctx.loop.add((dt) => {
    t += dt;
    const p = Math.min(t / dur, 1);
    let out = '';
    for (let i = 0; i < len; i++) {
      const start = (i / len) * 0.6; // each character starts a little later than the one before
      if (p >= start + 0.4) out += text[i] ?? '';
      else if (p >= start) out += text[i] === ' ' ? ' ' : GLYPHS[(Math.random() * GLYPHS.length) | 0];
      else out += from[i] ?? '';
    }
    el.textContent = out;
    if (p >= 1) { el.textContent = text; stop(); el.__stopScramble = null; }
  });
  el.__stopScramble = stop;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Modal overlay behaviour: open/close, Escape, click-outside, focus trap, focus restore. */
export function createOverlay(el, { onOpen, onClose } = {}) {
  let prev = null;
  const api = {
    isOpen: () => !el.hidden,
    open() {
      if (!el.hidden) return;
      prev = document.activeElement;
      el.hidden = false;
      (el.querySelector('[data-autofocus]') || el.querySelector(FOCUSABLE))?.focus();
      onOpen?.();
    },
    close() {
      if (el.hidden) return;
      el.hidden = true;
      onClose?.();
      if (prev && document.contains(prev)) prev.focus();
      prev = null;
    },
    toggle() { el.hidden ? api.open() : api.close(); },
  };
  el.addEventListener('pointerdown', (e) => { if (e.target === el) api.close(); });
  el.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); api.close(); return; }
    if (e.key !== 'Tab') return;
    const items = [...el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  el.querySelectorAll('[data-close]').forEach((b) => b.addEventListener('click', api.close));
  return api;
}

/** True while a modal (settings, palette, intro, launch screen) is covering the page. */
export function modalOpen() {
  return !!document.querySelector('.overlay:not([hidden]), #launch:not([hidden])') || document.documentElement.classList.contains('intro-pending');
}

/** True when the user is typing in a field, so global hotkeys should stay out of the way. */
export function typing(e) {
  const t = e.target;
  return t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));
}
