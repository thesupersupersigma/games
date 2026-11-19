# AGENTS.md

Notes for AI agents working in this repo. Written after adding ZType, so the
gotchas below are things that actually cost time.

## What this is

A personal collection of browser games, hosted as static files. There is a
landing page (Vite + TypeScript) and one folder per game under `public/`.
The whole thing ships as a single nginx image built from this repo.

The games belong to their original creators. The repo is meant to stay private;
don't publish captures or game files elsewhere.

## Commands

```sh
npm install          # once
npm run dev          # landing page at http://localhost:5173
npm run build        # tsc + vite build -> dist/
npm run preview      # serve dist/ at http://localhost:4173 (closest to production)
npm test             # checks src/games.ts
```

Node 22.18+ is required (Vite 8).

## Layout

```
public/<game>/       each game, copied verbatim into dist/
  ztype/             Typing.com Impact.js build + a small shell page
src/games.json       the catalogue shown on the landing page
src/games.ts         turns the catalogue into HTML (and validates it)
src/main.ts          landing-page animation (GSAP)
src/style.css        landing-page design
vite.config.ts       injects the catalogue into index.html at build time
nginx.conf           static serving, caching, /healthz
Dockerfile           npm build, then nginx:alpine serving dist/
tools/har_extract.py rebuild a site from a Chrome/Edge HAR file
ignored/             scratch space, git-ignored (HARs and extractions live here)
```

## Landing page

- `index.html` has two placeholders, `<!--games-->` and `<!--count-->`.
  `vite.config.ts` replaces them at build time using `renderGames()` from
  `src/games.json`. The list is real HTML, so it works without JavaScript.
- Every `.game` row gets `--accent` from the catalogue. `accent` must be a
  plain `#rrggbb`; anything else is replaced with the default yellow.
- `cover` is optional. The row fixes its height (10rem, 12.5rem on wide
  screens) and lets the width follow the image. Tall images look like a strip,
  so use a wide banner when you can.
- `path` is either `folder/` for something in `public/`, or a full `https://`
  URL. External games automatically display "on host".
- Keep `path` relative (no leading `/`) because the site may be served from a
  subdirectory.
- Run `npm test` after touching `games.ts` or the catalogue shape.

## Serving games

- `public/<folder>/` is served at `/<folder>/`; nginx uses `index.html` inside
  it. No build step touches the game files, they are copied as-is.
- All links inside a game must be relative (`webapp/x.js`, `media/x.png`, not
  `/webapp/x.js`), or they break under both the game's subfolder and the
  site root.
- `nginx.conf` returns 404 for `.md` and `.har`, blocks dotfiles, caches
  `.js/.css/images/audio/...` for 7 days, and enables autoindex only for
  PolyTrack's track folders.

## Adding a game from a HAR

1. Capture with DevTools → Network → *Disable cache* → reload → play a little →
   **Save all as HAR with content**. Save it under `ignored/`, not `public/`.
2. List the hosts:
   ```sh
   python tools/har_extract.py ignored/game.har --list
   ```
3. Extract the host that actually serves the game. `--flat` skips the
   per-host folder, which is usually what you want for one host:
   ```sh
   python tools/har_extract.py ignored/game.har ignored/out --host some.host --flat
   ```
4. Move the game's files to `public/<name>/` and make paths relative.
5. Add an entry to `src/games.json`.
6. Test with `npm run preview`: `http://localhost:4173/<name>/`.
7. Commit.

`tools/har_extract.py` only saves `200` responses with a body, so ad beacons and
analytics noise are skipped, but the output still contains a lot of third-party
crap. Copy only what the game needs.

## Gotchas that will bite you

### `npm run dev` does not serve game folders

Vite's history fallback answers `/ztype/` with the landing page. In dev, open
`/ztype/index.html` explicitly, or use `npm run preview` / a plain static
server, which serve the folder URL correctly. The README documents this too.

### The build copies everything in `public/`

There is no exclude list. A HAR or a 24 MB extraction left in `public/` ends up
in `dist/` and in the Docker image. Keep captures and `out/` folders in
`ignored/` (git-ignored). This is why ZType's HAR and extraction live in
`ignored/ztype/`.

### Files may not be what their extension says

The Typing.com assets captured from the CDN are **WebP data with `.png` names**
(Cloudflare image conversion). Browsers sniff the content so the game works, but
`System.Drawing`/PIL and other strict readers fail, and `file` will say WebP.
Check with `ffprobe` when in doubt, and don't "fix" the extensions unless you
also rewrite the game's paths.

### Asset cache is 7 days

nginx sets `expires 7d` on `.js`, `.css`, images and audio. If you patch a game
file in place, returning visitors can keep the old one. Rename/version the file
(or accept it) rather than being surprised by stale behaviour.

### Windows/PowerShell

The shell here is PowerShell, so `&&`, `||` and `touch` don't work in the usual
form. `Move-Item` can fail on large extracted trees with "access denied"; use
`robocopy <src> <dst> /E /MOVE` instead (exit code 1 means success).

## ZType specifics

`public/ztype/` is Typing.com's Impact.js build of Phoboslab's ZType.

- Files:
  - `index.html` – our shell; creates the container and starts the game.
  - `app.min.746.js` – the game (Impact engine + game code), unmodified.
  - `media/` – sprites, bitmap fonts, backgrounds, sounds, music.
  - `cover.jpg` – generated landing-page banner (starfield + logo).
- The original `ztype.har` and full extraction are in `ignored/ztype/`.

### Entry point

The game does **not** start itself. It registers:

```js
window.bootstrapGlobals.ztype(width, height, resourceRoot, parent)
```

and typing.com calls it with `(480, 720, '/dist/student/extras/game_files/ztype/', container)`.
Our shell calls it with an empty resource root because the game files sit next
to `index.html`; that sets `ig.prefix = ''` and makes the game's `media/...`
paths resolve relative to the page.

### Impact's modules wait for DOM ready

`ig.module(...).defines(...)` queues the body until `dom.ready`, so
`bootstrapGlobals` does not exist while the page is parsing. Calling it from an
inline script before the DOM is ready throws
`Cannot read properties of undefined (reading 'ztype')`. Start the game on
`window.load` (or DOMContentLoaded), as `index.html` does.

### Canvas and sizing

The game appends a `<canvas id="ztype-canvas">` to the parent, 480×720 internal.
Scale it with CSS only; Impact's mouse code converts client coordinates using
`canvas.offsetWidth / realWidth`, so uneven CSS scaling is fine. Our CSS uses
`width: min(100vw, 66.6667vh, 640px)` with `!important` to override the inline
sizes the game sets on mobile.

### Audio rules

- WebAudio is unlocked by Impact on the first `click`/`touchend`. Until then the
  audio context stays suspended; starting the game with the keyboard is fine
  because the context can be resumed by then.
- **The loader throws on any resource whose callback reports failure.**
  Multichannel sounds are decoded through WebAudio, so a missing one aborts the
  whole load. Single-channel sounds (`new ig.Sound(path, false)`) use HTML5
  audio, whose error handler reports success, so a missing one is silent.
  Images likewise abort the loader if they fail.
- Music is added with `ig.music.add()` *outside* the loader, so a missing music
  file does not abort but logs a rejected `play()` promise when a run starts.

### Missing media and what was regenerated

The HAR had no music and no `emp.ogg`; everything else was captured.

- `media/sounds/emp.ogg` – regenerated (descending sine + noise burst).
- `media/music/endure.ogg`, `media/music/orientation.ogg` – regenerated as
  seamless two-note ambient drones (periodic waveforms, no fades), 24 s each.

They are placeholders standing in for the original soundtrack. If the real
files turn up, drop them in with the same names and delete this paragraph.

The ffmpeg recipes used (ffmpeg is available on this machine):

```sh
ffmpeg -f lavfi -i "aevalsrc='0.6*sin(2*PI*(1500*t-600*t*t))*exp(-4*t)+0.25*(random(0)*2-1)*exp(-16*t)':s=44100:d=1.4" \
  -ac 2 -c:a libvorbis -q:a 4 public/ztype/media/sounds/emp.ogg
ffmpeg -f lavfi -i "aevalsrc='0.10*sin(2*PI*55*t)+0.055*sin(2*PI*82.5*t)+0.035*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*t/12))|0.10*sin(2*PI*55*t+0.4)+0.055*sin(2*PI*82.5*t+0.9)+0.035*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*t/12+1.2))':s=44100:d=24" \
  -af "lowpass=f=800" -ac 2 -c:a libvorbis -q:a 3 public/ztype/media/music/endure.ogg
```

`orientation.ogg` uses a D-minor-ish set: 73.5 / 110 / 147 Hz with a slower
amplitude wobble.

### Game state and extension points

- High score is stored in `localStorage['highscore']`.
- On game over the game calls `window.gameOver({ score, seconds, wave, streak,
  accuracy, level, difficulty })` if that function exists. We leave it undefined;
  typing.com used it to post scores. This is the hook for a local scoreboard.
- Modes: `0` title, `1` playing, `2` game over. Pause is a menu object, not a mode.
- Controls: Enter starts / EMP, typed letters shoot, Backspace cancels the
  current target, Esc opens the pause menu.

### Testing a canvas game without a visible window

If the browser pane is hidden, Chromium pauses `requestAnimationFrame`, so the
game never leaves the loader and key presses appear to do nothing. The game is
fine; the loop isn't running. Drive frames manually with a fake clock:

```js
const realNow = Date.now;
let fake = realNow();
Date.now = () => fake;
const step = (n) => {
  for (let i = 0; i < n; i++) {
    fake += 16;
    ig.Timer.step();
    ig.system.run();
  }
};
// step(60) advances ~1 second of game time
Date.now = realNow; // always restore
```

Synthetic `keydown` events work, but remember Impact's action locks are cleared
by `keyup`: dispatch `keyup` before the next `keydown` or the second press is
ignored.

## Offline download (`dist/games-offline.zip`)

Built by `npm run build`, linked from the landing page, released by
`.github/workflows/offline-release.yml` as the rolling `offline` release. See README.

- From `file://`, Chrome blocks fetch/XHR, module scripts, `crossorigin` tags,
  loading blob: URLs inside workers, and taints canvases with disk images.
  `tools/offline-shim.js` answers in-folder fetch/XHR/importScripts/Worker and
  script-set `src`s from the embedded base64; `tools/offline.mjs` strips
  `crossorigin` and deletes the on-disk `.wasm/.data/.glb/.swf/.track` copies
  (only ever fetched, so only the embedded copy is needed).
- A new game that loads files some other way (e.g. CSS `url()` set from script,
  module workers) may need the shim extended. Test the unzipped copy in Chrome
  from `file://` with the network off before shipping.

## Other games

- **PolyTrack** – v0.5.2 unofficial build. Leaderboards use an external backend;
  the game still runs without it. nginx enables autoindex for
  `/polytrack/tracks/{official,community}/` because the game scans those folders.
- **Stacktris** – Fancade Emscripten/wasm build, with a Poki SDK patch loaded
  from `patch/poki-sdk.js`.
- **freeasteroids** – user scratch/experiment; leave it alone unless asked.

## Before committing

1. `npm run build` passes.
2. `npm test` passes.
3. `npm run preview` and click through the game you changed.
4. Browser console is clean (no 404s, no exceptions).
5. `dist/` contains no HAR or extractions.
6. `git status` shows only intended files. Commits here are small and lowercase
   ("add ztype", "fixed rustyac link").

## Commit authorship

Every commit an AI agent makes here carries a co-author trailer naming the exact
model that did the work, plus its vendor's `noreply` address as the email:

```
Co-authored-by: <exact model name> <noreply@<vendor>.com>

Co-authored-by: DeepSeek V4.1 Flash Free <noreply@deepseek.com>
```

Rules:

- Use the model's **exact** name as reported by your harness (provider and
  variant included, e.g. "DeepSeek V4.1 Flash Free", not "DeepSeek" or "an AI").
- Use the vendor's `noreply` address in the domain, never a personal or
  scraping-harvestable address.
- One trailer, at the very end of the message, after a blank line.
- Applies to new commits only. Don't amend or rebase existing commits just to
  add it unless the user asks.

```sh
git commit -m "add ztype" -m "Body text." \
  -m "Co-authored-by: DeepSeek V4.1 Flash Free <noreply@deepseek.com>"
```
