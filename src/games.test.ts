// Self-check for the game list markup. Run with: npm test
import { renderGames } from './games.ts';

const check = (ok: boolean, what: string) => {
  if (!ok) throw new Error(`FAIL: ${what}`);
};

const html = renderGames([
  { id: 'a', title: 'A <b>"bold"</b> game', path: 'a/', accent: 'red;background:url(x)', tags: ['<i>'] },
  { id: 'b', title: 'B', path: 'https://example.com/play', accent: '#00ff88' },
]);

check(html.includes('on example.com') && html.split('game-host').length === 2, 'only the external game names its site');
check(!html.includes('<b>') && !html.includes('<i>'), 'titles and tags are escaped');
check(!html.includes('url(x)'), 'a bad accent colour is replaced, not printed');
check(html.includes('--accent:#00ff88'), 'a valid accent colour is used');
check(html.includes('>01<') && html.includes('>02<'), 'rows are numbered');

let threw = false;
try {
  renderGames([{ id: 'c', title: '', path: 'c/' }]);
} catch {
  threw = true;
}
check(threw, 'an entry without a title stops the build');

console.log('games.ts: all checks passed');
