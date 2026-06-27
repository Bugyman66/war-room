# Nigerian Political War Room v2.0

A real-time, AI-powered OSINT engine that ingests Nigerian political signals from
news and social media, scores sentiment, clusters them into political narratives,
generates AI strategic summaries (Google Gemini), and broadcasts anomaly alerts to
a dense, dark-themed command dashboard.

## Architecture

```
Ingestion ──> Redis Stream "signals" ──> Intelligence ──> Postgres
                                                              │
                              AI Orchestrator <───────────────┤
                              Alert Engine ──> Redis Pub/Sub "system-alerts"
                                                              │
                                        API Gateway (Fastify + Socket.io)
                                                              │
                                              Web Dashboard (Next.js)
```

| Component | Path | Role |
|-----------|------|------|
| Ingestion worker | `apps/worker` | Polls RSS, YouTube, Twitter every 60s; publishes to Redis stream |
| Intelligence | `services/intelligence-service` | Consumes stream, scores sentiment, matches narratives, persists to Postgres |
| AI orchestrator | `services/ai-service` | Summarizes stale/new narratives via Gemini (`gemini-3.1-flash-lite`) |
| Alert engine | `services/alert-service` | Detects volume spikes / sentiment crashes, publishes alerts |
| API gateway | `apps/api` | Fastify REST + Socket.io on port 4000; relays alerts to clients |
| Web dashboard | `apps/web` | Next.js OSINT dashboard + `/admin` config editor (port 3000) |

## Tech Stack

- **Monorepo:** npm workspaces (`package-lock.json`). Turbo installed but optional.
- **Frontend:** Next.js 16 (App Router, Turbopack), React, Tailwind CSS, Lucide, Recharts
- **API:** Fastify + Socket.io
- **Workers:** Node.js via `tsx`
- **Database:** PostgreSQL via Prisma ORM
- **Broker:** Redis (Streams for ingestion queue, Pub/Sub for alerts)
- **AI:** Google Gemini (REST API)

## Prerequisites

- Node.js 20+
- Docker (for Postgres + Redis)

## Setup

1. **Start infrastructure** (Postgres + Redis):
   ```bash
   cd infra && docker compose up -d && cd ..
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure environment** — copy `.env.example` to `.env` and fill in keys:
   ```bash
   cp .env.example .env
   ```
   Key variables:
   - `DATABASE_URL` — Postgres connection string
   - `REDIS_URL` — Redis connection string
   - `GEMINI_API_KEY` — Google Gemini key (omit to use mock summaries)
   - `RAPIDAPI_KEY` — RapidAPI key for Twitter154 ingestion
   - `YOUTUBE_API_KEY` — YouTube Data API key
   - `ADMIN_TOKEN` — shared secret protecting the `/admin` config write endpoints
   - `NEXT_PUBLIC_API_URL` — API base URL for the web app (default `http://localhost:4000`)

4. **Sync the database schema:**
   ```bash
   npx prisma db push
   ```
   This repo uses `db push` (no migration history). It is idempotent and safe to
   re-run; it creates the `signals`, `narratives`, `influencers`, and `app_config`
   tables.

## Running locally

```bash
npm run dev
```

This runs `node start.js`, which (in default low-memory mode) executes the data
pipeline once via `local-dev.ts`, then boots the API and web servers. The
background workers are consolidated into a single Node process to keep memory low.

- Run workers continuously instead of one-shot: `node start.js --loop`
- Dashboard: http://localhost:3000
- Admin config editor: http://localhost:3000/admin
- API: http://localhost:4000

### Individual services

```bash
npm run dev:ingestion     # ingestion worker
npm run dev:intelligence  # stream consumer + narrative engine
npm run dev:ai            # Gemini summarizer
npm run dev:alert         # anomaly alerts
npm run dev:api           # API gateway
npm run dev:web           # Next.js dashboard
```

## Admin configuration

The AI prompt template and narrative-matching rules are stored in the `app_config`
Postgres table and editable at runtime without a redeploy:

- **UI:** http://localhost:3000/admin (enter your `ADMIN_TOKEN` to save)
- **API:**
  - `GET  /api/config` — current prompt + rules, plus built-in defaults
  - `PUT  /api/config/prompt` — update prompt template (requires `x-admin-token` header)
  - `PUT  /api/config/rules` — update narrative rules (requires `x-admin-token` header)

If the table is empty or unreachable, services fall back to the hardcoded defaults
in `packages/db/config.ts`. The prompt template must contain the `{{title}}` and
`{{signals}}` placeholders.

## Notes

- `apps/web` runs a modified Next.js — see `apps/web/AGENTS.md` before editing frontend code.
- GNews ingestion (`apps/worker/src/ingestion/news.ts`) exists but is currently disabled.
- `apps/workers` (plural) is an abandoned empty stub; the real worker is `apps/worker` (singular).
- See `claude.md` for deeper architecture and data-flow context.
