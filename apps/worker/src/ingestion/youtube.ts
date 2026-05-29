import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

export async function ingestYouTube() {
  const apiKey = process.env.YOUTUBE_API_KEY;
  if (!apiKey) {
    console.warn('YOUTUBE_API_KEY not set. Skipping YouTube ingestion.');
    return;
  }

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
