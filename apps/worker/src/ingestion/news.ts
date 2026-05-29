import { publishSignal } from '../../../../packages/redis/publisher';
import { Signal } from '../../../../packages/types';

export async function ingestNews() {
  const apiKey = process.env.GNEWS_API_KEY;
  if (!apiKey) {
    console.warn('GNEWS_API_KEY not set. Skipping News ingestion. (Get one free at gnews.io)');
    return;
  }

  console.log('Polling GNews API...');
  
  try {
    const query = encodeURIComponent('nigeria politics');
    const response = await fetch(`https://gnews.io/api/v4/search?q=${query}&lang=en&max=10&apikey=${apiKey}`);

    if (!response.ok) {
      throw new Error(`GNews API error: ${response.statusText}`);
    }

    const data = await response.json();
    const articles = data.articles || [];

    for (const article of articles) {
      const signal: Signal = {
        id: article.url,
        title: article.title || 'Untitled Article',
        content: article.description || article.content || '',
        source: 'gnews',
        timestamp: article.publishedAt || new Date().toISOString(),
        sentiment: 0,
        type: 'news',
        raw: article
      };
      
      await publishSignal(signal);
    }
    console.log(`Published ${articles.length} News signals via GNews.`);
  } catch (error) {
    console.error('Error in News ingestion:', error);
  }
}
