import { publishSignal, claimPollSlot } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

export async function ingestYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set. Skipping YouTube ingestion.');
    return;
  }

  // Each search costs 100 of the 10,000 daily quota units, so poll far less
  // often than the 60s ingestion cycle (15 min = ~9,600 units/day).
  const intervalMs = Number(process.env.YOUTUBE_POLL_MINUTES || 15) * 60 * 1000;
  if (!(await claimPollSlot('youtube', intervalMs))) return;

  console.log('Polling YouTube API...');
  
  try {
    const query = encodeURIComponent('nigeria politics');
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${query}&type=video&order=date&key=${apiKey}`);

    if (!response.ok) {
      throw new Error(`YouTube API error: ${response.statusText}`);
    }

    const data = await response.json();
    const items = data.items || [];

    for (const item of items) {
      const snippet = item.snippet;
      const signal: Signal = {
        id: item.id.videoId,
        title: snippet.title,
        content: snippet.description,
        source: 'youtube',
        timestamp: snippet.publishedAt,
        sentiment: 0,
        type: 'youtube',
        raw: item
      };
      
      await publishSignal(signal);
    }
    console.log(`Published ${items.length} YouTube signals.`);
  } catch (error) {
    console.error('Error in YouTube ingestion:', error);
  }
}
