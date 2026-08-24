# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Games_Hub is a Spanish-language browser games and drinking games platform. The frontend is pure static HTML/CSS/JS (no build step), served by nginx. The backend is a small Node.js/Express API that reads and writes JSON files — no database — deployed via Docker.

## Development Commands

**Run locally with Docker (full stack):**
```bash
cp .env.example .env      # set ADMIN_TOKEN, or /admin stays disabled (503)
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```
- Frontend available at `http://localhost:8080`
- API available at `http://localhost:8080/api/`
- Content editor at `http://localhost:8080/admin/`
- Content files appear in `./datos-juegos/` (gitignored)

**Frontend only (no Docker):**
```bash
python -m http.server 8080
# or: npx serve .
```

**API only:**
```bash
cd api && npm install && node server.js
```

**Production deploy:** Push to `main` → GitHub Actions builds and pushes images to GHCR → Watchtower on the server auto-updates within 5 minutes.

### Production runs a single container

`Dockerfile.todo-en-uno` builds nginx **and** the Node API into one image (`juegos-juan-todo-en-uno`), run by supervisord. `nginx.todo-en-uno.conf` proxies `/api/` to `127.0.0.1:3000`.

This exists because the two-container split kept failing on the server: nginx had to find the API through Docker's internal DNS (`juegos-api:3000`), and when CasaOS didn't place both containers on the same user-defined network the name never resolved, so every `/api/` call returned 502. Talking over loopback removes that entire failure class — and makes a local run behave identically to the server, which the split setup did not.

The static files are copied **path by path** (`COPY css/`, `COPY games/`, …) rather than `COPY .` + delete. The compose files contain the real `ADMIN_TOKEN` in production, so a copy-everything step risks publishing them at `/docker-compose.casaos.yml`.

⚠️ **CasaOS's "Custom Install" editor does not read a `.env` file.** `${VAR}` in a pasted compose is never interpolated — Docker receives the literal string, which is what caused *invalid mount config for type bind*. Production therefore uses **`docker-compose.casaos.yml`**: literal values, no variables. The committed copy keeps a placeholder token; the operator edits only the `ADMIN_TOKEN=` line, and that edited version must never come back into the repo.

`docker-compose.yml` (two containers, `${…}` + `.env`) remains for local development, and the separate `juegos-juan` / `juegos-juan-api` images are still built.

**Watchtower** uses the `nickfedor/watchtower` fork. The original `containrrr/watchtower` has been unmaintained since 2023 and its client speaks Docker API 1.25, which modern daemons reject (`client version 1.25 is too old`) — the container starts, fails, and dies, silently killing auto-deploy. Do not switch back, and do not "fix" an unhealthy watchtower by disabling its healthcheck: that only hides a broken deploy pipeline (and CasaOS then errors with *has no healthcheck configured*).

**Healthcheck gotchas**, all three hit in production:
- Use `127.0.0.1`, never `localhost` — busybox/glibc resolve it to `::1` first, while nginx (`listen 80;`) and the API (`listen(PORT, '0.0.0.0')`) bind IPv4 only.
- The API image is `node:20-slim`, which has **neither `wget` nor `curl`**. Its healthcheck runs `node -e "fetch(…)"` instead. Don't reintroduce a `wget` healthcheck there.
- nginx resolves `proxy_pass` targets at startup, so a hardcoded upstream name makes the whole site refuse to boot when the API is down (`host not found in upstream`). `nginx.conf` puts the upstream in a variable with `resolver 127.0.0.11 ipv6=off` so resolution happens per request — `ipv6=off` matters, or the AAAA lookup hangs until the client aborts.

## Architecture

```
Games_Hub/
├── index.html              # Hub landing page — dynamically renders game grid
├── games/                  # One subdirectory per game (standalone HTML pages)
│   └── yo-nunca/           # "Never Have I Ever" drinking game
├── admin/index.html        # Content editor (token-gated) — edits the JSON per game
├── api/                    # Node.js Express backend (no database)
│   ├── server.js           # All routes
│   ├── store.js            # JSON file access: read/save/validate/seed
│   └── datos-por-defecto.js # Bundled defaults, only used to seed a missing file
├── data/games.json         # Game registry — add games here to appear on the hub
├── css/
│   ├── styles.css          # Hub comic/cartoon design system
│   ├── game-engine.css     # Shared styles for all card/phrase games
│   └── ads.css             # AdSense slots + consent banner
├── js/
│   ├── main.js             # Hub JS: loads games.json, renders cards, category filter
│   ├── game-engine.js      # Shared engine for all card/phrase games
│   └── ads.js              # AdSense module (no-op in dev)
├── nginx.conf              # Reverse proxy, static caching, gzip
├── Dockerfile              # Web/nginx container
└── docker-compose.yml      # Production (pulls from GHCR)
    docker-compose.override.yml  # Dev override (builds locally)
```

**How the hub works:** `js/main.js` fetches `data/games.json` and renders a card grid. To add a new game, add an entry to `games.json` and create a new `games/<slug>/` directory with its own `index.html`.

### Game Engine

Card/phrase-style games (Yo Nunca, Quién es más probable, Verdad o Reto…) all share `js/game-engine.js` + `css/game-engine.css`. Each game's `index.html` is just a `<head>` with fonts, the two engine files, and an inline `window.GAME_CONFIG` object. The engine builds all DOM dynamically from config.

**`GAME_CONFIG` fields:**

| Field | Type | Purpose |
|---|---|---|
| `id` | string | Game slug — used as the localStorage key for "Mis frases" (`jj_misfrases_<id>`) |
| `title` | string | Game title (`\n` → `<br>`) |
| `bgColor` | string | Body background color |
| `phraseLabel` | string | Label above the phrase card (e.g. `"YO NUNCA HE..."`) |
| `intro` | string | Home screen subtitle (HTML allowed) |
| `endIcon` | string | Emoji on end screen |
| `endText` | string | End screen heading (`\n` → `<br>`) |
| `endSubtext` | string | End screen subheading |
| `apiEndpoint` | string | GET endpoint for phrases (`categorias=…` appended with `?` or `&`, so the URL may already carry a query — e.g. `/api/frases?juego=<slug>`) |
| `configEndpoint` | string | GET endpoint for the game's categories (`/api/config?juego=<slug>`) |
| `userPhrases` | `{id, name, emoji, desc, hint, placeholder}`? | Local "Mis frases" pseudo-category — omit to hide that feature |
| `categories` | `{id, name, emoji, desc}[]` | **Offline fallback only.** The live categories come from `configEndpoint`, so they can be edited in `/admin/` without touching code. These are used when the API is unreachable |
| `fallback` | `{texto, categoria}[]` | Offline fallback phrases |

**API endpoints** (all prefixed `/api/`, proxied by nginx to `http://juegos-api:3000/`):

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/frases?juego=yo-nunca&categorias=suave,fiesta` | GET | — | Phrases for one game, shuffled. `juego` falls back to `yo-nunca` when missing or unknown (keeps the healthcheck and stale cached frontends working); `categorias` is validated against the ids in that game's own JSON |
| `/config?juego=yo-nunca` | GET | — | That game's `categorias`, so the engine can render the toggles |
| `/admin/juegos` | GET | 🔒 | Editable game ids |
| `/admin/juego/:id` | GET | 🔒 | Full JSON document |
| `/admin/juego/:id` | PUT | 🔒 | Validate and save |

**"Mis frases":** user-authored phrases are stored client-side only, in `localStorage` under `jj_misfrases_<gameId>` (see `js/game-engine.js`). They never reach the server — the pseudo-category id is filtered out before calling `apiEndpoint` and merged into the shuffled deck locally.

### Content storage — JSON files, no database

There is **no database**. Each game's content is one JSON file in `DATA_DIR` (`/data` in the container), bind-mounted to a real folder on the host so it lives outside the image:

```json
{
  "categorias": [{ "id": "suave", "name": "Suave", "emoji": "🍺", "desc": "…" }],
  "frases":     [{ "texto": "he mentido para salir de un compromiso", "categoria": "suave" }]
}
```

Categories live here, **not** in the game's HTML — that's what lets `/admin/` create them without a deploy. `GAME_CONFIG.categories` is only the offline fallback.

**Phrase text convention:** stored *without* the game's prefix, because the card renders `phraseLabel` above it. Yo Nunca reads `he mentido…` / `me he quedado…` under the label `YO NUNCA...`.

`api/store.js` owns all file access:

- **Seeding is create-only.** `sembrarSiFalta()` writes a file only if it doesn't exist and **never overwrites**. This is the guarantee that a deploy can't wipe phrases added through the panel — do not "fix" it into an upsert.
- **Writes are atomic**: temp file + `rename`, plus a `<juego>.bak` copy of the previous version. A truncated JSON would take a whole game down.
- **Validation rejects the whole save** if any phrase references a category that doesn't exist, listing the offenders. That's what makes deleting a category safe from a raw-JSON editor.
- Reads hit the disk every request (files are a few KB), so editing a JSON over SSH takes effect immediately.

### Admin panel

`admin/index.html`, served publicly but gated by `Authorization: Bearer $ADMIN_TOKEN`. The token is typed in once and kept in `sessionStorage` (`jj_admin_token`); the game list doubles as the login probe.

`ADMIN_TOKEN` comes from `.env` locally (see `.env.example`; `.env` is gitignored) and from a literal value in `docker-compose.casaos.yml` in production.

**It fails closed**, and `tokenDeEntorno()` in `api/server.js` rejects more than just an empty value — each of these disables `/admin/*` with a 503 that says why:

- **Uninterpolated syntax** (`${ADMIN_TOKEN:-}`). This is the dangerous one: the string is non-empty, so a naive `if (!token)` would treat the panel as configured and leave it open with a password published in the repo. It is exactly what CasaOS produces.
- Known placeholders (`cambia…`, `PON-AQUI…`, `dev-token-inseguro` — the old insecure default).
- Anything under 12 characters.

Admin routes are rate-limited and the token is compared with `crypto.timingSafeEqual`.

⚠️ **Asset caching:** `nginx.conf` serves `.js`/`.css` with `expires 1y; immutable` and the filenames carry no hash. When you change a shared file (`js/game-engine.js`, `css/styles.css`…), bump the `?v=N` query in every `<script>`/`<link>` that references it, or returning visitors keep the old copy.

## Design System

All games share the comic/cartoon aesthetic defined in `css/styles.css`:
- Fonts: `Bangers` (headings), `Fredoka` (body)
- CSS variables for color palette: `--rojo`, `--azul`, `--amarillo`, `--verde`, `--morado`, `--naranja`
- Hard-edged drop shadows (`8px 8px 0 #111`), thick black borders (`4px solid #111`), no gradients
- Ads handled by `css/ads.css` + `js/ads.js` — ads are no-ops in development (AdSense only loads in production)

## Adding a New Game

**Card/phrase game (Yo Nunca style):**
1. Add entry to `data/games.json`
2. Create `games/<slug>/index.html` — copy `games/yo-nunca/index.html` and change only `<title>` and `window.GAME_CONFIG`
3. Add categories and fallback phrases to the config; the engine handles everything else

**Other game type:**
1. Add entry to `data/games.json`
2. Create `games/<slug>/index.html` with its own self-contained logic
3. Link `css/game-engine.css` for shared styles if the visual design is similar
