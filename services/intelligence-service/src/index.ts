import { consumeSignals, consumeSignalsOnce } from '../../../packages/redis/consumer';
import { Signal } from '../../../packages/types';
import { db } from '../../../packages/db/client';
import { getNarrativeRules, SOCIAL_TRENDING_RULE } from '../../../packages/db/config';

// ==========================================
// INTELLIGENCE SERVICE: NARRATIVE ENGINE
// ==========================================
// This service continuously listens to the Redis 'signals' stream.
// As raw tweets, news, and videos stream in, it analyzes them,
// performs basic sentiment analysis, groups them into political "Narratives",
// and finally saves both the signal and the narrative metadata into PostgreSQL.

console.log('🧠 Intelligence Service starting...');
console.log('🔗 Connected to PostgreSQL Database.');

// High-level narratives and their keywords now live in the DB (AppConfig) so
// the admin site can edit them without a redeploy. DEFAULT_NARRATIVE_RULES in
// packages/db/config.ts is the fallback when the table is empty.

/**
 * Whole-word keyword match, so 'poo' no longer matches "poor" or "pool".
 * Lookarounds (not \b) so keywords starting with '#' like '#ndc' still work.
 */
function matchesKeyword(text: string, keyword: string): boolean {
  const escaped = keyword.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(?<![a-z0-9])${escaped}(?![a-z0-9])`).test(text);
}

/**
 * Core processing function for a single incoming signal.
 * @param signal The raw signal pulled from Redis.
 */
async function processSignal(signal: Signal) {
  console.log(`\n[Intelligence] Processing new ${signal.type} signal: "${signal.title.substring(0, 50)}..."`);

  // ----------------------------------------
  // 1. Basic Sentiment Analysis
  // ----------------------------------------
  // A simplistic lexicon-based sentiment approach.
  // Will be replaced by AI-based sentiment analysis in the future.
  const text = (signal.title + ' ' + signal.content).toLowerCase();
  let sentimentScore = 0;
  if (text.includes('bad') || text.includes('crisis') || text.includes('fail') || text.includes('kill')) sentimentScore = -0.8;
  else if (text.includes('good') || text.includes('success') || text.includes('improve')) sentimentScore = 0.8;

  signal.sentiment = sentimentScore;

  // ----------------------------------------
  // 2. Narrative Detection & DB Persistence
  // ----------------------------------------
  let matchedNarrativeId: string | null = null;

  const narrativeRules = await getNarrativeRules();

  // Social posts are already pulled by political search queries, so instead of
  // dropping unmatched ones as noise they fall into a catch-all trending
  // narrative that the AI still summarizes.
  const isSocial = signal.type === 'facebook' || signal.type === 'tweet';
  const rules = isSocial ? [...narrativeRules, SOCIAL_TRENDING_RULE] : narrativeRules;

  // Check if the signal text contains any keywords for our predefined narratives
  for (const rule of rules) {
    if (rule === SOCIAL_TRENDING_RULE || rule.keywords.some(kw => matchesKeyword(text, kw))) {
      matchedNarrativeId = rule.id;

      // Upsert (Create or Update) the Narrative in the Postgres Database
      const narrative = await db.narrative.upsert({
        where: { id: rule.id },
        update: {
          sentiment: {
            // Adjust the overall narrative sentiment based on the new signal
            increment: signal.sentiment * 0.1
          },
          updatedAt: new Date()
        },
        create: {
          id: rule.id,
          title: rule.title,
          description: `Conversations around ${rule.title}`,
          sentiment: signal.sentiment,
        }
      });

      console.log(`🚨 NARRATIVE LINKED: [${rule.title}] (Current DB Sentiment: ${narrative.sentiment.toFixed(2)})`);
      break; // Only link to the first matching narrative to prevent duplication for now
    }
  }

  if (!matchedNarrativeId) {
    console.log('-> No specific narrative detected (General Noise).');
  }

  // ----------------------------------------
  // 3. Save the Signal to Database
  // ----------------------------------------
  try {
    // Persist the raw signal in Postgres, linking it to the Narrative if a match was found
    await db.signal.upsert({
      where: { id: signal.id },
      update: {},
      create: {
        id: signal.id,
        title: signal.title,
        content: signal.content,
        source: signal.source,
        timestamp: new Date(signal.timestamp),
        sentiment: signal.sentiment,
        type: signal.type,
        raw: signal.raw as any,
        ...(matchedNarrativeId ? {
          narratives: {
            connect: { id: matchedNarrativeId }
          }
        } : {})
      }
    });
    console.log('✅ Signal saved to PostgreSQL.');
  } catch (err) {
    console.error('❌ Failed to save signal to DB:', (err as Error).message);
  }
}

export async function runIntelligenceOnce() {
  console.log('[Intelligence] Running in single-shot mode...');
  await consumeSignalsOnce(processSignal);
  console.log('[Intelligence] Single-shot processing complete.');
}

// Only auto-start continuous consumption if not in single-shot mode
if (process.env.RUN_ONCE !== 'true') {
  // Start consuming the Redis Stream infinitely
  consumeSignals(processSignal).catch(err => {
    console.error('Fatal error in Intelligence Service:', err);
  });
}