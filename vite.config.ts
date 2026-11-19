import { defineConfig } from 'vite';
import catalogue from './src/games.json' with { type: 'json' };
import { renderGames } from './src/games.ts';

// `vite build --mode offline` builds the landing page of the offline download
// (finished by tools/offline.mjs). It has to work from file://, so: only the games in
// public/, linked to their index.html (file:// has no folder index), and a classic
// script, because browsers won't load module scripts from disk.
export default defineConfig(({ mode }) => {
  const offline = mode === 'offline';
  const games = offline
    ? catalogue.filter((g) => !/^https?:/i.test(g.path)).map((g) => ({ ...g, path: `${g.path}index.html` }))
    : catalogue;
  const count = `${games.length} game${games.length === 1 ? '' : 's'}`;
  const download = offline
    ? ''
    : ' <a href="games-offline.zip" download>Download them all</a> to play offline: unzip, then open index.html.';

  return {
    base: './',
    build: offline ? { outDir: 'dist-offline/games', cssCodeSplit: false, rolldownOptions: { output: { format: 'iife' } } } : {},
    plugins: [
      {
        name: 'games-html',
        // Fills the <!--games-->, <!--count--> and <!--download--> placeholders in index.html.
        transformIndexHtml: (html) =>
          html
            .replace('<!--games-->', renderGames(games))
            .replaceAll('<!--count-->', count)
            .replace('<!--download-->', download),
      },
      offline && {
        name: 'classic-script',
        transformIndexHtml: {
          order: 'post',
          handler: (html) => html.replaceAll(' type="module"', ' defer').replaceAll(' crossorigin', ''),
        },
      },
    ],
  };
});
