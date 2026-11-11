# games

Self-hosted copies of browser games, served as static files by one nginx container.
Deployed on Coolify straight from this repo (Dockerfile build pack).

Each game lives in its own folder under `public/` and is served at `/<folder>/`:

| Game      | Folder              | URL path      | Notes                                      |
|-----------|---------------------|---------------|--------------------------------------------|
| PolyTrack | `public/polytrack/` | `/polytrack/` | v0.5.2 unofficial build; leaderboards use an external backend |
| Stacktris | `public/stacktris/` | `/stacktris/` | Fancade web build (Emscripten wasm)        |

## Layout

```
public/<game>/     the games, one folder each (copied into the image as they are)
index.html, src/   the landing page (TypeScript, built with Vite)
tools/             helper scripts (not shipped in the image)
ignored/           scratch space, HAR captures, tarballs (git-ignored)
Dockerfile         builds the landing page, then nginx:alpine serves dist/
nginx.conf         static serving, gzip, caching, /healthz
```

## Adding a game

1. Capture it in Chrome/Edge: DevTools → Network → tick *Disable cache* → reload →
   play for a bit → right-click → **Save all as HAR with content** → save into `ignored/`.
2. Find which host actually serves the game:
   ```
   python tools/har_extract.py ignored/game.har --list
   ```
3. Extract only that host:
   ```
   python tools/har_extract.py ignored/game.har ignored/out --host some.host.io --flat
   ```
4. Move the folder that contains `index.html` to `public/<game-name>/`.
5. Make sure it uses relative paths (`src="webapp/x.js"`, not `src="/webapp/x.js"`),
   since every game is served from a subfolder.
6. Test locally:
   ```
   cd public
   python -m http.server 5173 --bind 127.0.0.1
   ```
   then open `http://127.0.0.1:5173/<game-name>/`.
7. Add an entry to `src/games.json` so it shows up on the landing page. Only `id`, `title` and `path` are required; `cover`, `tagline`, `tags` and `accent` are optional (they are described in `src/games.ts`). `path` can also be a full `https://` URL for a game hosted somewhere else.
8. Commit and push. Coolify rebuilds on push.

## Local Docker test

```
docker build -t games .
docker run --rm -p 127.0.0.1:5173:80 games
```

## Notes

- Keep files under 100 MB each (GitHub's hard limit). For anything bigger, use Git LFS.
- These games belong to their original creators. Keep the repo private.

## Landing page

`index.html` plus `src/`, written in TypeScript and built by [Vite](https://vite.dev). Animation is [GSAP](https://gsap.com). You need Node 22.18 or newer.

```
npm install        once
npm run dev        work on the landing page with live reload
npm run build      type-check, then write the finished site to dist/
npm run preview    serve dist/ exactly as nginx will (use this to click through to the games)
npm test           check the code that turns games.json into HTML
```

| File              | What it does                                                        |
|-------------------|---------------------------------------------------------------------|
| `index.html`      | the page; `<!--games-->` is replaced by the game list at build time |
| `src/games.json`  | the list of games                                                   |
| `src/games.ts`    | turns that list into HTML                                           |
| `src/style.css`   | how it looks                                                        |
| `src/main.ts`     | everything that moves                                               |
| `vite.config.ts`  | wires `games.json` into `index.html`                                |

In `npm run dev` the links to the games open the landing page again, because the dev server does not serve `public/<game>/index.html` for a folder URL. `npm run preview` and the real site do.

Built files get a new name whenever they change, so there are no `?v=` numbers to bump any more.
