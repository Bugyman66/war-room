// RSS ingestion example
// Add real RSS fetching and normalization logic here

import Parser from 'rss-parser';
import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

const parser = new Parser();

export async function ingestRSS(feedUrl: string) {
  console.log(`Polling RSS feed: ${feedUrl}...`);
  try {
    const feed = await parser.parseURL(feedUrl);
    for (const item of feed.items) {
      const signal: Signal = {
        id: item.guid || item.link || '',
        title: item.title || '',
        content: item.contentSnippet || '',
        source: feedUrl,
        timestamp: item.isoDate || new Date().toISOString(),
        sentiment: 0, // TODO: Add sentiment analysis
        type: 'rss',
      };
      await publishSignal(signal);
    }
    console.log(`Published ${feed.items.length} RSS signals.`);
  } catch (error) {
    console.error(`Error in RSS ingestion for ${feedUrl}:`, error);
  }
}
