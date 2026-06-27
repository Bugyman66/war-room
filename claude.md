# Nigerian Political War Room v2.0 - Project Context

## Project Overview
The "Nigerian Political War Room" is a real-time, AI-powered OSINT (Open Source Intelligence) engine. It autonomously ingests political signals from various Nigerian news sources and social media, evaluates their sentiment, clusters them into active narratives, generates AI strategic summaries, and broadcasts critical anomalies (volume spikes/sentiment crashes) to a high-density, dark-themed military command dashboard.

## Tech Stack
- **Monorepo Manager:** `npm` workspaces (root has `package-lock.json`; `package.json` declares pnpm but npm is what's actually used). Turbo is installed but optional.
- **Frontend:** Next.js 16 (App Router, Turbopack), React, Tailwind CSS, Lucide React, Recharts.
- **API/Gateway:** Node.js, Fastify, Socket.io (Socket.io attaches to Fastify's raw HTTP server)
- **Microservices/Workers:** Node.js (executed via `tsx`), Child Process spawning.
- **Database:** PostgreSQL (managed via Prisma ORM)
- **Message Broker:** Redis (Streams for raw data queue, Pub/Sub for alerts)
- **AI Engine:** Google Gemini (`gemini-3.1-flash-lite` via REST API)

## Architecture & Data Flow
1. **Ingestion Worker (`apps/worker`):** Polls data every 60s. Pulls from 4 Nigerian RSS feeds (Punch, Vanguard, Premium Times, Channels TV), the YouTube Data API search, and Twitter (via RapidAPI Twitter154). GNews ingestion (`news.ts`) exists but is currently disabled (ISP block). Publishes raw signals to Redis Stream (`signals`).
2. **Intelligence Engine (`services/intelligence-service`):** Consumes the `signals` Redis Stream using Consumer Groups. Analyzes basic sentiment, assigns the signal to a political Narrative using rules loaded from the DB (`AppConfig.narrative_rules`, falling back to `DEFAULT_NARRATIVE_RULES` in `packages/db/config.ts`), and saves it to Postgres.
3. **AI Orchestrator (`services/ai-service`):** Polls Postgres every 5 mins for unsummarized or "stale" narratives (cooldown of 15 mins). Bundles the 10 most recent signals and sends them to Gemini to generate a 1-2 sentence strategic summary. The prompt template is loaded from the DB (`AppConfig.ai_prompt_template`, falling back to `DEFAULT_PROMPT_TEMPLATE`).
4. **Alert Engine (`services/alert-service`):** Periodically scans Postgres. If a narrative spikes in volume (≥20 signals/hr) or its sentiment crashes (≤ -2.0), it publishes a JSON alert to the Redis Pub/Sub `system-alerts` channel.
5. **API Gateway (`apps/api`):** Serves REST endpoints (`/api/narratives`, `/api/health`) on port 4000 via Fastify, and maintains WebSocket connections (Socket.io) with the frontend. It listens to the Redis `system-alerts` channel and instantly forwards those payloads to connected web clients.
6. **Frontend Dashboard (`apps/web`):** A dense, WorldMonitor.app-inspired UI. Features live Nigerian news YouTube embeds (Channels TV, Arise, TVC, NTA, Al Jazeera), a scrolling global sitrep ticker, an AI strategic summary feed, live Recharts telemetry, and a flashing priority alert log.

## Directory Structure
```
war-room/
├── apps/
│   ├── api/                 # Express + Socket.io Gateway (Port 4000)
│   ├── web/                 # Next.js 16 OSINT Dashboard (Port 3000)
│   └── worker/              # Ingestion engine (Twitter, RSS, YouTube)
├── packages/
│   ├── db/                  # Prisma schema, migrations, DB client, runtime config (config.ts)
│   ├── redis/               # Redis Publisher/Consumer utilities
│   ├── types/               # Shared TypeScript interfaces
│   └── ui/                  # Shared UI stub
├── services/
│   ├── ai-service/          # Gemini LLM summarization polling
│   ├── alert-service/       # Anomaly detection & alerting rule engine
│   └── intelligence-service/# Redis Stream consumer, sentiment scoring
├── local-dev.ts             # Monolith runner consolidating all 4 background workers
├── start.js                 # Low-memory boot script orchestrating local-dev, api, web
└── package.json
```
Note: `apps/workers/` (plural) is an empty abandoned stub; the real ingestion lives in `apps/worker/` (singular).

## Running the Project Locally
To prevent PC crashing/hanging from spawning 6 heavy Node.js instances simultaneously, the local development environment relies on a "Monolith" approach for the background workers.
- **Command:** `npm run dev` (from the root folder)
- **What it does:** Executes `node start.js`. This script spawns exactly 3 child processes:
  1. `tsx local-dev.ts`: Dynamically imports the 4 background workers (Ingestion, Intelligence, AI, Alerts) into a *single* Node.js memory space to save RAM.
  2. `npm run dev:api`: Starts the Express gateway.
  3. `npm run dev:web`: Starts the Next.js frontend.

## Known Issues & Current State
- **Gemini API Rate Limiting Loop (FIXED):** Previously, a `429 Quota Exceeded` from Gemini was caught inside `analyzeNarratives`, saved as `"Error generating AI summary."`, and re-picked on the very next loop — an infinite quota-burning loop. Fixed in `services/ai-service/src/index.ts`: (1) quota/429 errors now rethrow so `analyzeWithCooldown` engages a 10-min backoff; (2) errored summaries are only retried after the 15-min cooldown; (3) a 15s throttle sits between live Gemini calls so one cycle can't exhaust the 15 RPM quota.
- **Runtime config via DB:** The AI prompt template and narrative-matching rules are stored in the `app_config` Postgres table (model `AppConfig`) and read through `packages/db/config.ts`. Both fall back to hardcoded defaults if the table is empty/unreachable. This is the backend for an admin site that edits them without a redeploy.
- **YouTube Live Stream Embeds:** The Dashboard uses direct YouTube Video IDs to embed live Nigerian news streams (since `live_stream?channel=ID` is blocked by some networks). Because live stream IDs change when streams restart, they may occasionally display "Video Unavailable" and need to be updated with the latest static video ID.
- **Modified Next.js (`apps/web`):** Per `apps/web/AGENTS.md`, this Next.js has breaking changes vs. stock — read `node_modules/next/dist/docs/` before writing frontend code.
