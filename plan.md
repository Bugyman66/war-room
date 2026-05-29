## Plan: Roadmap.md for Nigerian Political War Room v2.0

A comprehensive, actionable roadmap to evolve the monorepo into a production-ready, real-time political intelligence and decision system, fully aligned with the v2.0 architecture.

---

### Phase 1: Foundation & Structure
1. Create missing folders: `apps/api/`, `infra/`, `packages/ui/`.
2. Define and document core shared types in `packages/types/` (Signal, Narrative, Influencer, Feedback, etc.).
3. Set up Supabase PostgreSQL and Redis in `infra/` (Docker Compose, config files).
4. Establish code standards, linting, and monorepo tooling (e.g., Turborepo, Nx).

### Phase 2: Ingestion & Stream Layer
1. Implement ingestion services in `apps/worker/`:
   - API polling (Twitter, News, YouTube)
   - Scraping (RSS fallback)
   - Data normalization
2. Integrate Redis Streams in `packages/redis/` for ingestion output.
3. Add multi-consumer processing and replay capability.

### Phase 3: Processing & Intelligence
1. Build processing workers in `apps/worker/`:
   - Cleaning, deduplication, enrichment
2. Develop Intelligence Engine in `services/intelligence-service/`:
   - Narrative detection, trend analysis, influence mapping, importance scoring
3. Implement Narrative Graph (topic relationships, influencers, sentiment evolution).

### Phase 4: Storage & Orchestration
1. Design and migrate DB schema in `packages/db/` (narratives, influencers, ai_feedback).
2. Implement AI Orchestration Layer in `services/ai-service/`:
   - Context builder, task router, smart caching, async processing
3. Integrate Claude API for advanced AI tasks.

### Phase 5: Alerting & Real-Time
1. Build Alert Engine in `services/alert-service/` (multi-signal detection, strategic alerts).
2. Set up real-time gateway in `apps/api/` using Socket.io + Redis Pub/Sub.
3. Connect real-time updates to Dashboard UI.

### Phase 6: Frontend & Control Layer
1. Expand `apps/web/` for Next.js SSR, API routes, authentication, and data aggregation.
2. Implement dark military UI, grid layout, high data density, and minimal motion (Tailwind, Zustand, Recharts).
3. Add mobile dashboard support (PWA or responsive design).

### Phase 7: Security, Feedback, & Ops
1. Add audit logs, anomaly detection, and secret rotation in backend services.
2. Implement feedback loop system (track AI usage, improve outputs).
3. Set up CI/CD, monitoring, and alerting for production readiness.

---

### Verification
- Each phase has clear deliverables and can be independently validated.
- Data flows from ingestion to dashboard in real time.
- Security, feedback, and operational excellence are built-in.

### Further Considerations
1. Prioritize shared types and interfaces early to avoid integration issues.
2. Plan for horizontal scaling of ingestion and processing workers.
3. Document all APIs and data contracts for team alignment.
