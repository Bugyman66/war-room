import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

export async function ingestFacebook() {
  // We use the environment variable if available, otherwise fallback to the user-provided key.
  const rapidApiKey = process.env.RAPIDAPI_KEY || '4fefe80663mshd56edca56e306f1p18d792jsn3ee4d3f6f20a';

  if (!rapidApiKey) {
    console.warn('RAPIDAPI_KEY not set. Skipping Facebook ingestion.');
    return;
  }

  console.log('Polling Facebook via RapidAPI (facebook-scraper3)...');

  try {
    // Modify query to focus on Nigerian political context rather than "pizza"
    const query = encodeURIComponent('Tinubu OR Peter Obi OR Nigeria Election OR APC OR PDP');
    const country = 'NG'; // Nigeria
    
    const response = await fetch(`https://facebook-scraper3.p.rapidapi.com/ads/autocomplete?query=${query}&country=${country}`, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': rapidApiKey,
        'x-rapidapi-host': 'facebook-scraper3.p.rapidapi.com',
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`RapidAPI Facebook error: ${response.statusText} (${response.status})`);
    }

    const data = await response.json();
    
    // Depending on the API's exact response structure, it could be an array directly or nested.
    // We safely extract whatever array it returns.
    const items = Array.isArray(data) ? data : (data.results || data.data || data.suggestions || []);

    for (const item of items) {
      // Create a unique ID if the API doesn't provide one
      const uniqueId = item.id || `fb_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Determine the best fields to use for title/content based on typical Ad Library JSON structures
      const itemTitle = item.name || item.page_name || item.title || 'Facebook Entity';
      const itemContent = item.snippet || item.text || item.description || JSON.stringify(item).substring(0, 150);

      const signal: Signal = {
        id: uniqueId,
        title: `Facebook: ${itemTitle}`,
        content: itemContent,
        source: 'facebook',
        timestamp: new Date().toISOString(),
        sentiment: 0,
        type: 'facebook',
        raw: item
      };

      await publishSignal(signal);
    }
    
    console.log(`Published ${items.length} Facebook signals via RapidAPI.`);
  } catch (error) {
    console.error('Error in Facebook RapidAPI ingestion:', error);
  }
}
