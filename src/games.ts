/* The game list. `games.json` is turned into HTML at build time (see vite.config.ts),
 * so the list is real markup: it works with JavaScript off and never pops in late. */

export interface Game {
  /** Unique name, e.g. "polytrack". */
  id: string;
  title: string;
  /** Folder under public/ with a trailing slash, e.g. "polytrack/", or a full https:// URL for a game hosted elsewhere. */
  path: string;
  cover?: string;
  tagline?: string;
  tags?: string[];
  /** "#rrggbb". The row fills with this colour on hover. */
  accent?: string;
}

const HEX = /^#[0-9a-f]{6}$/i;
const esc = (text: string) => text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

const ARROW =
  '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.5"/></svg>';

export function renderGames(games: Game[]): string {
  return games
    .map((game, i) => {
      if (!game.id || !game.title || !game.path) {
        throw new Error(`games.json: entry ${i + 1} needs an id, a title and a path`);
      }
      const accent = game.accent && HEX.test(game.accent) ? game.accent : '#ffd84d';
      const tags = (game.tags ?? []).map((tag) => `<li>${esc(tag)}</li>`).join('');
      // Games on another site say so, so nobody is surprised to leave this one.
      const host = /^https?:\/\//i.test(game.path) ? new URL(game.path).host : '';
      return `
        <li class="game" style="--accent:${accent}">
          <a class="game-link" href="${esc(game.path)}" data-title="${esc(game.title)}">
            <span class="game-wipe" aria-hidden="true"></span>
            <span class="game-no" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
            <h2 class="game-title display">${esc(game.title)}</h2>
            ${game.tagline ? `<p class="game-tagline">${esc(game.tagline)}</p>` : ''}
            <div class="game-foot">
              <span class="game-go">Play ${ARROW}</span>
              ${host ? `<span class="game-host">on ${esc(host)}</span>` : ''}
              ${tags ? `<ul class="tags">${tags}</ul>` : ''}
            </div>
            ${game.cover ? `<img class="game-cover" src="${esc(game.cover)}" alt="" loading="lazy" decoding="async">` : ''}
          </a>
        </li>`;
    })
    .join('');
}
