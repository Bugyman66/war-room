// Runtime-editable configuration backed by the AppConfig key/value table.
// Lets the admin site tune the AI prompt and narrative rules without a redeploy.
// Every getter falls back to a hardcoded default so services keep running even
// if the table is empty or the migration hasn't been applied yet.

import { db } from './client';

export const DEFAULT_PROMPT_TEMPLATE = `You are an expert political intelligence analyst working for the Peter Obi campaign team.
Based on the following recent real-time signals regarding "{{title}}", provide a VERY SHORT strategic summary.
Rules:
1. Focus only on how these signals relate to: the upcoming election, the Peter Obi campaign, the OK Movement, or opposition parties.
2. The summary must be exactly 1 to 2 sentences.
3. Provide exactly 1 short, actionable recommendation for the campaign.

Recent Signals:
{{signals}}

Short Summary and Recommendation:`;

export interface NarrativeRule {
  id: string;
  title: string;
  keywords: string[];
}

export const DEFAULT_NARRATIVE_RULES: NarrativeRule[] = [
  { id: 'tier1_candidate_core', keywords: ['peter obi', 'peterobi', 'obi2027', 'mr peter obi', 'poo', 'obi presidency', 'president obi'], title: 'Tier 1: Candidate Core' },
  { id: 'tier2_movement', keywords: ['obidient', 'obi-kwankwaso', 'obikwankwaso', 'adc presidential', 'adc2027', 'african democratic congress', 'kwankwaso coalition', 'village movement', 'labour defection'], title: 'Tier 2: Movement & Coalition' },
  { id: 'tier3_attack_narratives', keywords: ['party hopper', 'adc betrayal', 'obi atiku vp', 'obi vice president', 'obi running mate', 'obi not serious', 'igbo candidate only', 'cannot win north', 'sec chairman', 'obi certificate', 'abandoned labour'], title: 'Tier 3: Attack Narratives' },
  { id: 'tier4_issues', keywords: ['nigeria insecurity', 'abduct', 'benue killing', 'naira dollar rate', 'fuel price', 'asuu strike', 'nigeria inflation', 'food price', 'nigeria corruption', 'inec 2027', 'presidential election 2027', 'nigeria hardship', 'tinubu failure', 'apc performance'], title: 'Tier 4: Issues Obi Owes' },
];

async function readKey(key: string): Promise<string | null> {
  try {
    const row = await db.appConfig.findUnique({ where: { key } });
    return row?.value ?? null;
  } catch {
    // Table missing / DB down -> caller uses its default.
    return null;
  }
}

export async function setConfig(key: string, value: string): Promise<void> {
  await db.appConfig.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}

export async function getPromptTemplate(): Promise<string> {
  return (await readKey('ai_prompt_template')) ?? DEFAULT_PROMPT_TEMPLATE;
}

export async function getNarrativeRules(): Promise<NarrativeRule[]> {
  const raw = await readKey('narrative_rules');
  if (!raw) return DEFAULT_NARRATIVE_RULES;
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) return parsed as NarrativeRule[];
  } catch {
    // Corrupt JSON -> fall back rather than crash the consumer.
  }
  return DEFAULT_NARRATIVE_RULES;
}
