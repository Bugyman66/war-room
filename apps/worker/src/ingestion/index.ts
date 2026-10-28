// Ingestion entry point
// Add polling, scraping, and normalization logic here

import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';
import { ingestTwitter } from './twitter';
import { ingestNews } from './news';
import { ingestYouTube } from './youtube';
import { ingestRSS } from './rss';
import { ingestFacebook } from './facebook';

const POLL_INTERVAL_MS = 60000; // 1 minute

// Nigerian newspaper / broadcaster RSS feeds (free, no quota). The Nation,
// Guardian, TheCable and Independent block automated access (403), so they
// are not listed.
const RSS_FEEDS = [
  'https://punchng.com/feed/',
  'https://www.vanguardngr.com/feed/',
  'https://www.premiumtimesng.com/feed/',
  'https://www.channelstv.com/feed/',
  'https://www.thisdaylive.com/feed/',
  'https://dailytrust.com/feed/',
  'https://leadership.ng/feed/',
  'https://dailypost.ng/feed/',
  'https://businessday.ng/feed/',
  'https://www.legit.ng/rss/all.rss',
  'https://tribuneonlineng.com/feed/',
  'https://www.sunnewsonline.com/feed/',
  'https://www.blueprint.ng/feed/',
  'https://www.arise.tv/feed/',
  'https://tvcnews.tv/feed/',
];

export async function runIngestionCycle() {
  console.log(`[${new Date().toISOString()}] Starting ingestion cycle...`);
  try {
    await Promise.allSettled([
      ingestTwitter(),
      ingestFacebook(),
      // ingestNews(), // Disabled due to ISP block
      ingestYouTube(),
      ...RSS_FEEDS.map(url => ingestRSS(url)),
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
