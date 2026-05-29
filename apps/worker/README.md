# Ingestion Worker

This service ingests data from external sources (APIs, RSS, scraping), normalizes it, and publishes to Redis Streams for downstream processing.

- Add new sources in `src/ingestion/`
- Use `packages/redis/` for stream publishing
- Use `packages/types/` for shared types
