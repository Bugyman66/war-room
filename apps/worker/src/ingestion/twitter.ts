import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

export async function ingestTwitter() {
  const rapidApiKey = process.env.RAPIDAPI_KEY;
  if (!rapidApiKey) {
    console.warn('RAPIDAPI_KEY not set. Skipping Twitter ingestion. (Subscribe to Twitter154 on RapidAPI)');
    return;
  }

  console.log('Polling Twitter via RapidAPI...');

  try {
    // Tailor the search query to track high-engagement Nigerian political sentiment
    // specifically focusing on Peter Obi, the Labour Party, and the current administration.
    const query = encodeURIComponent('("Peter Obi" OR Obidient OR kwankwaso OR Tinubu OR "NDC" OR APC OR "Cost of Living" OR #Nigeria) min_retweets:5');
    // Using Twitter154 API on RapidAPI
    const response = await fetch(`https://twitter154.p.rapidapi.com/search/search?query=${query}&section=top&limit=10&language=en`, {
      method: 'GET',
      headers: {
        'X-RapidAPI-Key': rapidApiKey,
        'X-RapidAPI-Host': 'twitter154.p.rapidapi.com'
      }
    });

    if (!response.ok) {
      throw new Error(`RapidAPI Twitter error: ${response.statusText}`);
    }

    const data = await response.json();
    const tweets = data.results || [];

    for (const tweet of tweets) {
      const signal: Signal = {
        id: tweet.tweet_id,
        title: `Tweet from ${tweet.user?.username || 'Unknown'}`,
        content: tweet.text,
        source: 'twitter',
        timestamp: tweet.creation_date || new Date().toISOString(),
        sentiment: 0,
        type: 'tweet',
        raw: tweet
      };

      await publishSignal(signal);
    }
    console.log(`Published ${tweets.length} Twitter signals via RapidAPI.`);
  } catch (error) {
    console.error('Error in Twitter RapidAPI ingestion:', error);
  }
}
