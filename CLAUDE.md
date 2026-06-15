# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Games_Hub is a Spanish-language browser games and drinking games platform. The frontend is pure static HTML/CSS/JS (no build step), served by nginx. The backend is a Node.js/Express API with SQLite, deployed via Docker.

## Development Commands

**Run locally with Docker (full stack):**
```bash
docker-compose -f docker-compose.yml -f docker-compose.override.yml up --build
```
- Frontend available at `http://localhost`
- API available at `http://localhost/api/`

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

## Architecture

```
Games_Hub/
├── index.html              # Hub landing page — dynamically renders game grid
├── games/                  # One subdirectory per game (standalone HTML pages)
│   └── yo-nunca/           # "Never Have I Ever" drinking game
├── admin/index.html        # Moderation panel (Bearer token protected)
├── api/                    # Node.js Express backend
│   ├── server.js           # All routes
│   ├── db.js               # SQLite init and schema
│   └── frases-seed.js      # Initial seed phrases
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
| `title` | string | Game title (`\n` → `<br>`) |
| `bgColor` | string | Body background color |
| `phraseLabel` | string | Label above the phrase card (e.g. `"YO NUNCA HE..."`) |
| `intro` | string | Home screen subtitle (HTML allowed) |
| `endIcon` | string | Emoji on end screen |
| `endText` | string | End screen heading (`\n` → `<br>`) |
| `endSubtext` | string | End screen subheading |
| `apiEndpoint` | string | GET endpoint for phrases (`?categorias=…` appended) |
| `submitEndpoint` | string? | POST endpoint for suggestions — omit to hide that feature |
| `submitHint` | string? | Hint shown next to the textarea label |
| `submitPlaceholder` | string? | Textarea placeholder |
| `categories` | `{id, name, emoji, desc}[]` | Toggleable categories on the category screen |
| `fallback` | `{texto, categoria}[]` | Offline fallback phrases |

**API endpoints** (all prefixed `/api/`, proxied by nginx to `http://juegos-api:3000/`):

| Endpoint | Method | Auth | Purpose |
|---|---|---|---|
| `/frases?categorias=suave,fiesta` | GET | — | Fetch approved phrases |
| `/sugerencias` | POST | — | Submit phrase (rate-limited: 5/min/IP) |
| `/admin/sugerencias` | GET | Bearer | List pending phrases |
| `/admin/sugerencias/:id/aprobar` | POST | Bearer | Approve phrase |
| `/admin/sugerencias/:id/rechazar` | POST | Bearer | Reject phrase |

**Admin auth:** `ADMIN_TOKEN` env var (no default in prod — must be set).

**Database:** SQLite (`frases` table), auto-initialized on API startup from `db.js`. Schema: `id, texto, categoria (suave|fiesta|picante), estado (aprobada|pendiente|rechazada), creada`.

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
