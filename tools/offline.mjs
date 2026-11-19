// Turns dist-offline/games (the offline build of the site, see vite.config.ts) into a
// download that runs by double-clicking index.html, then zips it to dist/games-offline.zip.
//
// Each game gets an offline.js holding its files as base64 plus tools/offline-shim.js,
// loaded before anything else in its index.html. Run by `npm run build`.
import { execFileSync } from 'node:child_process';
import { readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import games from '../src/games.json' with { type: 'json' };

const out = 'dist-offline';
const site = join(out, 'games');
const zip = join('dist', 'games-offline.zip');

// Loaded by markup or CSS, which works from disk, so they don't need embedding.
const NOT_EMBEDDED = /\.(html|css|md)$/i;
// Only ever fetched by script, so the embedded copy is the only one needed.
const NOT_KEPT = /\.(wasm|data|glb|swf|track)$/i;

const shim = readFileSync('tools/offline-shim.js', 'utf8');

for (const game of games) {
  if (/^https?:/i.test(game.path)) continue; // hosted elsewhere, not in the download
  const dir = join(site, game.path);
  const files = {};
  for (const entry of readdirSync(dir, { recursive: true, withFileTypes: true })) {
    if (!entry.isFile() || NOT_EMBEDDED.test(entry.name)) continue;
    const file = join(entry.parentPath, entry.name);
    files[relative(dir, file).replaceAll('\\', '/')] = readFileSync(file).toString('base64');
    if (NOT_KEPT.test(entry.name)) rmSync(file);
  }
  writeFileSync(join(dir, 'offline.js'), `${shim}(${JSON.stringify(files)}, new URL('.', location.href).href, '');\n`);

  const page = join(dir, 'index.html');
  const html = readFileSync(page, 'utf8')
    // crossorigin makes the browser ask file:// for CORS headers, which it can't give.
    .replace(/\s+crossorigin(="[^"]*")?/gi, '')
    .replace(/<head[^>]*>/i, (head) => `${head}\n<script src="offline.js"></script>`);
  if (!html.includes('offline.js')) throw new Error(`${page}: no <head> to put offline.js in`);
  writeFileSync(page, html);
  console.log(`offline: ${game.path} (${Object.keys(files).length} files embedded)`);
}

rmSync(zip, { force: true });
// Windows' tar writes zips (-a picks the format from the name); Linux and macOS have zip.
if (process.platform === 'win32') execFileSync('tar', ['-a', '-cf', relative(out, zip), 'games'], { cwd: out });
else execFileSync('zip', ['-qr', relative(out, zip), 'games'], { cwd: out });
console.log(`offline: wrote ${zip}`);
