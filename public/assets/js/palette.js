/* palette.js: the command palette (Ctrl+K / Cmd+K, or the search button in the top bar).
 *
 * Type to fuzzy-search games and commands, arrow keys to move, Enter to run, Esc to close.
 * "Fuzzy" means the letters only have to appear in order: "plt" finds "PolyTrack".
 * Built as an ARIA combobox + listbox so screen readers announce the highlighted result.
 */

/** Returns a score (higher is better) or -1 when `q` is not a subsequence of `text`. */
function fuzzy(q, text) {
  if (!q) return 0;
  const t = text.toLowerCase();
  let ti = 0, score = 0, streak = 0;
  for (const ch of q.toLowerCase()) {
    if (ch === ' ') continue;
    const idx = t.indexOf(ch, ti);
    if (idx < 0) return -1;
    streak = idx === ti ? streak + 1 : 0;               // consecutive letters score more
    const wordStart = idx === 0 || t[idx - 1] === ' ';  // so do starts of words
    score += 1 + streak * 2 + (wordStart ? 3 : 0) - (idx - ti) * 0.1;
    ti = idx + 1;
  }
  return score;
}

export function init(ctx) {
  const { u } = ctx;
  const input = u.$('#palette-input'), list = u.$('#palette-list');
  let results = [], selected = 0;

  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || '');
  u.$('#palette-kbd').textContent = isMac ? '⌘ K' : 'Ctrl K';

  const items = () => [
    ...ctx.games.list().map((g) => ({
      label: g.title, hint: g.tags.join(' · ') || 'game', keys: `${g.title} ${g.id} ${g.tags.join(' ')}`,
      run: () => ctx.games.launch(g.id),
    })),
    { label: 'surprise me', hint: 'launch a random game', keys: 'surprise random dice', run: () => ctx.games.random() },
    { label: 'toggle sound effects', hint: ctx.settings.get().sound ? 'currently on' : 'currently off', keys: 'toggle sound audio mute', run: () => ctx.settings.set({ sound: !ctx.settings.get().sound }) },
    { label: 'toggle reduce motion', hint: ctx.reduced() ? 'currently on' : 'currently off', keys: 'toggle reduce motion animation', run: () => ctx.settings.set({ reduce: !ctx.reduced() }) },
    { label: 'next theme', hint: ctx.settings.get().theme, keys: 'next theme colour color', run: () => ctx.settings.nextTheme() },
    { label: 'open settings', hint: 'panel', keys: 'open settings preferences options', run: () => ctx.settings.open() },
    { label: 'replay intro', hint: 'boot sequence', keys: 'replay intro boot', run: () => ctx.intro?.replay() },
  ];

  function render() {
    const q = input.value.trim();
    results = items()
      .map((it) => ({ it, score: fuzzy(q, it.keys) }))
      .filter((r) => r.score >= 0)
      .sort((a, b) => b.score - a.score)
      .map((r) => r.it);
    selected = u.clamp(selected, 0, Math.max(0, results.length - 1));
    list.replaceChildren(...(results.length
      ? results.map((it, i) => u.h('li', { role: 'option', id: `pal-${i}`, 'aria-selected': String(i === selected), 'data-i': i },
          u.h('span', { text: it.label }), u.h('span', { text: it.hint })))
      : [u.h('li', { class: 'palette-empty', text: 'nothing found. even fuzzy search has limits.' })]));
    if (results.length) input.setAttribute('aria-activedescendant', `pal-${selected}`);
    else input.removeAttribute('aria-activedescendant');
    list.querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest' });
  }

  const overlay = u.createOverlay(u.$('#palette'), {
    onOpen: () => { input.value = ''; selected = 0; render(); ctx.audio.play('open'); },
    onClose: () => ctx.audio.play('close'),
  });

  function run(i) {
    const it = results[i];
    if (!it) return;
    overlay.close();
    it.run();
  }

  input.addEventListener('input', () => { selected = 0; render(); });
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      if (!results.length) return;
      selected = (selected + (e.key === 'ArrowDown' ? 1 : -1) + results.length) % results.length;
      render();
      ctx.audio.play('hover');
    } else if (e.key === 'Enter') {
      e.preventDefault();
      run(selected);
    }
  });
  list.addEventListener('click', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li) run(Number(li.dataset.i));
  });
  list.addEventListener('pointermove', (e) => {
    const li = e.target.closest('li[data-i]');
    if (li && Number(li.dataset.i) !== selected) { selected = Number(li.dataset.i); render(); }
  });

  u.$('#open-palette').addEventListener('click', overlay.open);
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && !e.altKey && e.key.toLowerCase() === 'k') {
      e.preventDefault(); // otherwise some browsers jump to the address bar
      if (document.documentElement.classList.contains('intro-pending')) return;
      overlay.toggle();
    }
  });

  ctx.palette = { open: overlay.open, close: overlay.close };
}
