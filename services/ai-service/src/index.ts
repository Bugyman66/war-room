import { db } from '../../../packages/db/client';

console.log('🤖 AI Orchestration Layer starting...');

// The Google Gemini API key used for text generation. Loaded from .env
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * analyzeNarratives()
 * 
 * This is the core engine of the AI Service. It periodically scans the database
 * for Narratives that have either:
 * 1. Never been analyzed (aiSummary is null)
 * 2. Haven't been analyzed in the last hour (stale summary)
 * 
 * It then bundles the 10 most recent signals for that narrative and sends them
 * to the LLM (Gemini) to generate a concise, strategic executive summary.
 */
async function analyzeNarratives() {
  console.log('\n[AI Orchestrator] Scanning database for narratives needing analysis...');

  // Define our "staleness" threshold: 1 hour
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Fetch all narratives and their most recent signals
  const allNarratives = await db.narrative.findMany({
    include: {
      // Fetch up to 10 of the most recent signals to provide context to the LLM
      signals: {
        orderBy: { timestamp: 'desc' },
        take: 10
      }
    }
  });

  // Filter narratives that need a new AI summary.
  // A narrative needs an update if:
  // 1. It has never been summarized.
  // 2. The previous summary failed (starts with 'Error').
  // 3. The narrative has received new signals AND the last summary is at least 15 minutes old (cooldown to save API credits).

  const COOLDOWN_MS = 15 * 60 * 1000; // 15 minutes
  const now = Date.now();

  const narrativesToAnalyze = allNarratives.filter(n => {
    // Skip analysis if there are no signals to summarize
    if (!n.signals || n.signals.length === 0) return false;

    if (!n.aiSummary || n.aiSummary.startsWith('Error') || !n.aiSummaryUpdatedAt) return true;

    const hasNewData = n.updatedAt > n.aiSummaryUpdatedAt;
    const cooldownPassed = (now - n.aiSummaryUpdatedAt.getTime()) > COOLDOWN_MS;

    return hasNewData && cooldownPassed;
  });

  // Early exit if everything is up to date to save API calls
  if (narrativesToAnalyze.length === 0) {
    console.log('-> All narratives are up to date with AI analysis.');
    return;
  }

  for (const narrative of narrativesToAnalyze) {
    console.log(`\n🧠 Analyzing Narrative: [${narrative.title}]`);
    console.log(`Context: Building prompt from ${narrative.signals.length} recent signals...`);

    // 1. Build Context
    // Format the signals into a readable bulleted list for the prompt
    const contextStr = narrative.signals
      .map(s => `- [${s.source}] ${s.title}: ${s.content.substring(0, 100)}`)
      .join('\n');

    // Define the strict prompt for the LLM
    const prompt = `You are an expert political intelligence analyst working for the Peter Obi campaign team. 
Based on the following recent real-time signals regarding "${narrative.title}", provide a VERY SHORT strategic summary.
Rules:
1. Focus only on how these signals relate to: the upcoming election, the Peter Obi campaign, the OK Movement, or opposition parties.
2. The summary must be exactly 1 to 2 sentences.
3. Provide exactly 1 short, actionable recommendation for the campaign.

Recent Signals:
${contextStr}

Short Summary and Recommendation:`;

    // 2. Call Gemini API
    let aiSummary = "";

    if (GEMINI_API_KEY) {
      try {
        console.log('-> Sending context to Gemini API...');
        // We use the REST API here instead of the SDK to minimize dependencies.
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${GEMINI_API_KEY}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }]
          })
        });

        if (!response.ok) throw new Error(await response.text());
        const data = await response.json();

        // Extract the generated text from Gemini's response payload
        aiSummary = data.candidates[0].content.parts[0].text;
      } catch (err) {
        console.error('Gemini API Error:', (err as Error).message);
        aiSummary = "Error generating AI summary.";
      }
    } else {
      // Fallback mechanism if the user hasn't configured an API key yet
      console.log('-> ⚠️ GEMINI_API_KEY not found in .env! Generating mock AI summary instead...');
      await new Promise(res => setTimeout(res, 1500)); // Simulate API delay
      aiSummary = `[MOCK AI SUMMARY] The narrative surrounding "${narrative.title}" is currently seeing significant engagement. Key actors are pushing strong rhetoric, and public sentiment leans slightly negative based on recent social media signals. We recommend monitoring this closely.`;
    }

    // 3. Save to Database
    // Write the generated summary back to Postgres
    await db.narrative.update({
      where: { id: narrative.id },
      data: {
        aiSummary: aiSummary,
        aiSummaryUpdatedAt: new Date()
      }
    });

    console.log(`✅ AI Summary generated and saved to DB!`);
    console.log(`Summary snippet: "${aiSummary.substring(0, 80).replace(/\n/g, ' ')}..."`);
  }
}

// --- AI Service Rate Limit Fix ---
// Kick off the first analysis immediately, then run every 5 minutes (300000 ms)
// If a quota error is detected, wait for a cooldown before retrying

let cooldownUntil = 0;
const INTERVAL_MS = 5 * 60 * 1000; // 5 minutes

export async function analyzeWithCooldown() {
  const now = Date.now();
  if (now < cooldownUntil) {
    const wait = Math.ceil((cooldownUntil - now) / 1000);
    console.log(`[AI Orchestrator] In cooldown due to quota error. Waiting ${wait}s...`);
    return;
  }
  try {
    await analyzeNarratives();
  } catch (err: any) {
    // Check for quota/rate limit errors
    const msg = err?.message || err;
    if (typeof msg === 'string' && (msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('429'))) {
      // Wait 10 minutes before next attempt
      cooldownUntil = Date.now() + 10 * 60 * 1000;
      console.error('[AI Orchestrator] Quota error detected. Entering cooldown for 10 minutes.');
    }
    throw err;
  }
}

// Only auto-start continuous intervals if not in single-shot mode
if (process.env.RUN_ONCE !== 'true') {
  const runLoop = async () => {
    try {
      await analyzeWithCooldown();
    } catch (err) {
      console.error('[AI Orchestrator] Unhandled error in runLoop:', err);
    }
    // Prevent overlapping executions by scheduling the next run only after this one completes
    setTimeout(runLoop, INTERVAL_MS);
  };
  runLoop();
}