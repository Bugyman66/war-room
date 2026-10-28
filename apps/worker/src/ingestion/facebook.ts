import { publishSignal, claimPollSlot } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

// Pulls the top-engagement Facebook posts from the last 48h for each search
// query via RapidAPI facebook-scraper3. Each query costs 1 request; the free
// plan allows 100/month, so the defaults (3 queries every 24h = ~90/month) fit
// it. Raise FACEBOOK_POLL_HOURS frequency only after upgrading the plan.
const DEFAULT_QUERIES = ['Peter Obi', 'NDC Nigeria', 'Tinubu 2027'];
const LOOKBACK_DAYS = 2;

function getQueries(): string[] {
  const fromEnv = process.env.FACEBOOK_QUERIES?.split(',').map(q => q.trim()).filter(Boolean);
  return fromEnv && fromEnv.length > 0 ? fromEnv : DEFAULT_QUERIES;
}

export async function ingestFacebook() {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    console.warn('RAPIDAPI_KEY not set. Skipping Facebook ingestion.');
    return;
  }

  const intervalMs = Number(process.env.FACEBOOK_POLL_HOURS || 24) * 60 * 60 * 1000;
  if (!(await claimPollSlot('facebook', intervalMs))) return;

  const startDate = new Date(Date.now() - LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const queries = getQueries();
  console.log(`Polling Facebook trending posts via RapidAPI (${queries.length} queries since ${startDate})...`);

  let published = 0;
  for (const q of queries) {
    try {
      const response = await fetch(
        `https://facebook-scraper3.p.rapidapi.com/search/posts?query=${encodeURIComponent(q)}&start_date=${startDate}`,
        {
          headers: {
            'x-rapidapi-key': rapidApiKey,
            'x-rapidapi-host': 'facebook-scraper3.p.rapidapi.com',
          },
        }
      );

      if (!response.ok) {
        throw new Error(`RapidAPI Facebook error: ${response.statusText} (${response.status})`);
      }

      const data = await response.json();
      const posts = data.results || [];

      for (const post of posts) {
        if (!post.post_id || !post.message) continue;

        const signal: Signal = {
          id: `fb_${post.post_id}`,
          title: `Facebook: ${post.author?.name || 'Unknown'}`,
          content: post.message,
          source: 'facebook',
          timestamp: post.timestamp ? new Date(post.timestamp * 1000).toISOString() : new Date().toISOString(),
          sentiment: 0,
          type: 'facebook',
          // Keep only what downstream needs; the full payload is very large.
          raw: {
            url: post.url,
            query: q,
            author: post.author?.name,
            group: post.associated_group?.name,
            reactions: post.reactions_count ?? 0,
            comments: post.comments_count ?? 0,
            shares: post.reshare_count ?? 0,
          },
        };

        await publishSignal(signal);
        published++;
      }
    } catch (error) {
      console.error(`Error in Facebook RapidAPI ingestion for "${q}":`, error);
    }
  }

  console.log(`Published ${published} Facebook signals via RapidAPI.`);
}
