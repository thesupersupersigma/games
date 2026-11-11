import { defineConfig } from 'vite';
import games from './src/games.json' with { type: 'json' };
import { renderGames } from './src/games.ts';

const count = `${games.length} game${games.length === 1 ? '' : 's'}`;

export default defineConfig({
  base: './',
  plugins: [
    {
      name: 'games-html',
      // Fills the <!--games--> and <!--count--> placeholders in index.html.
      transformIndexHtml: (html) =>
        html.replace('<!--games-->', renderGames(games)).replaceAll('<!--count-->', count),
    },
  ],
});
