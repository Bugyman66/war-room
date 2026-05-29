// Ingestion entry point
// Add polling, scraping, and normalization logic here

import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';
import { ingestTwitter } from './twitter';
import { ingestNews } from './news';
import { ingestYouTube } from './youtube';
import { ingestRSS } from './rss';

const POLL_INTERVAL_MS = 60000; // 1 minute

export async function runIngestionCycle() {
  console.log(`[${new Date().toISOString()}] Starting ingestion cycle...`);
  try {
    await Promise.allSettled([
      ingestTwitter(),
      // ingestNews(), // Disabled due to ISP block
      ingestYouTube(),
      // Nigerian News RSS Feeds
      ingestRSS('https://punchng.com/feed/'),
      ingestRSS('https://www.vanguardngr.com/feed/'),
      ingestRSS('https://www.premiumtimesng.com/feed/'),
      ingestRSS('https://www.channelstv.com/feed/')
    ]);
    console.log(`[${new Date().toISOString()}] Ingestion cycle completed.`);
  } catch (error) {
    console.error('Error during ingestion cycle:', error);
  }
}

export function startPolling() {
  console.log('Ingestion worker started.');
  // Run immediately on start
  runIngestionCycle();
  // Set up polling interval
  setInterval(runIngestionCycle, POLL_INTERVAL_MS);
}

// Only auto-start if not running in single-shot mode
if (process.env.RUN_ONCE !== 'true') {
  startPolling();
}
