// Monolith runner: loads all 4 background workers into ONE Node process to keep
// local-dev memory low (instead of spawning 4 separate tsx instances).
//
// Two modes, selected by the RUN_ONCE env var (set by start.js):
//   RUN_ONCE=true  -> run each stage exactly once, in order, then exit.
//   (unset)        -> import the workers so their internal loops auto-start and
//                     run forever.

import 'dotenv/config';

async function runOnce() {
  console.log('🧩 [Monolith] One-shot pipeline run starting...');

  // 1. Ingest: pull from all sources and publish to the Redis stream.
  const { runIngestionCycle } = await import('./apps/worker/src/ingestion/index');
  await runIngestionCycle();

  // 2. Intelligence: drain the stream, score sentiment, link narratives, persist.
  const { runIntelligenceOnce } = await import('./services/intelligence-service/src/index');
  await runIntelligenceOnce();

  // 3. AI: summarize stale/new narratives (respects its own cooldown).
  const { analyzeWithCooldown } = await import('./services/ai-service/src/index');
  await analyzeWithCooldown().catch(err => console.error('[Monolith] AI stage error:', err?.message || err));

  // 4. Alerts: scan for anomalies and publish to system-alerts.
  const { runAlertEngine } = await import('./services/alert-service/src/index');
  await runAlertEngine();

  console.log('🧩 [Monolith] One-shot pipeline complete. Exiting.');
  process.exit(0);
}

async function runContinuous() {
  console.log('🧩 [Monolith] Continuous mode: starting all workers in one process...');
  // Each module self-starts its loop on import when RUN_ONCE !== 'true'.
  await import('./apps/worker/src/ingestion/index');
  await import('./services/intelligence-service/src/index');
  await import('./services/ai-service/src/index');
  await import('./services/alert-service/src/index');
}

if (process.env.RUN_ONCE === 'true') {
  runOnce().catch(err => {
    console.error('[Monolith] Fatal error in one-shot run:', err);
    process.exit(1);
  });
} else {
  runContinuous().catch(err => {
    console.error('[Monolith] Fatal error in continuous run:', err);
    process.exit(1);
  });
}
