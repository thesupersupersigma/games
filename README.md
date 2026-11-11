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
public/<game>/     everything that gets served (one folder per game)
tools/             helper scripts (not shipped in the image)
ignored/           scratch space, HAR captures, tarballs (git-ignored)
Dockerfile         nginx:alpine + public/
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
7. Add an entry to `public/games.json` so it shows up on the landing page. Only `id`, `title` and `path` are required; `cover`, `icon`, `tagline`, `tags` and `accent` are optional (the full schema is at the top of `public/assets/js/cards.js`).
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

`public/index.html` plus `public/assets/` (plain HTML/CSS/JS modules, no build step). It builds the game grid from `public/games.json`.

nginx caches CSS and JS for 7 days, so after changing anything in `public/assets/`, bump every `?v=` number in `public/index.html` (they must all match). `main.js` passes that number on to every module it loads.

For JavaScript-off visitors there is a hand-written game list inside the `<noscript>` block in `index.html`; add new games there too.
