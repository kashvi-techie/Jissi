/**
 * IntentEngine — a lightweight, rule-based intent classifier.
 *
 * Maps raw transcript text to a structured {@link IntentResult}. It is a pure
 * module (no imports, no side effects), which makes it trivial to unit-test and
 * safe to call from anywhere (hooks, services, screens).
 *
 * ───────────────────────────────────────────────────────────────────────────
 * HOW TO ADD A NEW COMMAND (3 steps):
 *   1. Add the intent name to the `IntentType` union.
 *   2. Append an entry to the `INTENT_RULES` registry below (patterns + an
 *      optional `extractQuery`). Rules are evaluated top-to-bottom; first match
 *      wins, so place more specific rules above broader ones.
 *   3. If the intent triggers a device action, map it in
 *      `services/actions/types.ts -> INTENT_TO_ACTION` (and handle it in
 *      `ActionService.executeFromIntent`).
 *
 * For future scale (many commands / fuzzy matching / NLU), this rule registry
 * can be swapped for an LLM classifier behind the SAME `detectIntent` signature
 * without touching any caller.
 * ───────────────────────────────────────────────────────────────────────────
 */

/** All intents JISSI can recognize. Extend this union to add commands. */
export type IntentType =
  | 'social_greeting'
  | 'open_youtube'
  | 'open_chrome'
  | 'open_whatsapp'
  | 'search_google'
  | 'ask_ai'
  | 'unknown';

export type IntentConfidence = 'high' | 'medium' | 'low';

export interface IntentResult {
  intent: IntentType;
  confidence: IntentConfidence;
  /** Optional extracted argument (e.g. the search terms for `search_google`). */
  query?: string;
  /** Optional structured arguments for richer local capabilities. */
  entities?: {
    relationship?: string;
    name?: string;
    gender?: string;
  };
}

/** A single classification rule in the registry. */
export interface IntentRule {
  intent: IntentType;
  /** The rule fires if ANY pattern matches the trimmed text. */
  patterns: RegExp[];
  /** Optional argument extractor (e.g. pull the search query out of the text). */
  extractQuery?: (text: string) => string | undefined;
  /** Optional structured argument extractor for local capabilities. */
  extractEntities?: (text: string) => IntentResult['entities'];
}

const RELATIONSHIP_ALIASES: Record<string, string> = {
  teacher: 'teacher',
  professor: 'teacher',
  sir: 'teacher',
  maam: 'teacher',
  mam: 'teacher',
  mentor: 'mentor',
  guide: 'mentor',
  friend: 'friend',
  buddy: 'friend',
  mother: 'mother',
  mom: 'mother',
  mummy: 'mother',
  maa: 'mother',
  father: 'father',
  dad: 'father',
  papa: 'father',
  sibling: 'sibling',
  brother: 'sibling',
  sister: 'sibling',
  recruiter: 'recruiter',
  interviewer: 'interviewer',
  guest: 'guest',
  colleague: 'colleague',
  coworker: 'colleague',
  senior: 'senior',
};

function normalizeRelationship(value?: string): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[.'’]/g, '').trim();
  return RELATIONSHIP_ALIASES[key];
}

function titleCaseName(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .replace(/\b(my|the|a|an|is|here|standing|beside|with|me|please|greet|meet|this)\b/gi, ' ')
    .replace(/[,.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return undefined;
  return cleaned
    .split(' ')
    .slice(0, 4)
    .map((part) => {
      const lower = part.toLowerCase();
      if (['sir', 'mam', 'maam', 'ma’am', 'mr', 'mrs', 'ms', 'dr'].includes(lower)) {
        return lower === 'maam' ? 'maam' : part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function inferGender(text: string, relationship?: string, name?: string): string | undefined {
  const source = `${text} ${name ?? ''}`.toLowerCase();
  if (/\b(he|him|his|sir|mr|father|dad|papa|brother)\b/.test(source)) return 'male';
  if (/\b(she|her|mam|maam|ma’am|mrs|ms|mother|mom|mummy|maa|sister)\b/.test(source)) return 'female';
  if (relationship === 'mother') return 'female';
  if (relationship === 'father') return 'male';
  return undefined;
}

function extractSocialGreetingEntities(text: string): IntentResult['entities'] {
  const normalized = text.trim();
  const relPattern = Object.keys(RELATIONSHIP_ALIASES).join('|');

  const relationshipMatch = normalized.match(new RegExp(`\\b(${relPattern})\\b`, 'i'));
  const relationship = normalizeRelationship(relationshipMatch?.[1]);

  const namePatterns = [
    new RegExp(`\\b(?:this is|meet|here'?s|here is|introducing)\\s+([a-z][a-z.'’]*(?:\\s+[a-z][a-z.'’]*){0,3})\\s*,?\\s*(?:my\\s+)?(?:${relPattern})\\b`, 'i'),
    new RegExp(`\\b(?:my\\s+)?(?:${relPattern})\\s+([a-z][a-z.'’]*(?:\\s+[a-z][a-z.'’]*){0,3})\\s+(?:is\\s+)?(?:here|with|standing|beside)\\b`, 'i'),
    new RegExp(`\\b(?:please\\s+)?greet\\s+(?:my\\s+)?(?:${relPattern})\\s*,?\\s*([a-z][a-z.'’]*(?:\\s+[a-z][a-z.'’]*){0,3})?`, 'i'),
  ];

  let name: string | undefined;
  for (const pattern of namePatterns) {
    const match = normalized.match(pattern);
    if (match?.[1]) {
      name = titleCaseName(match[1]);
      break;
    }
  }

  return {
    relationship,
    name,
    gender: inferGender(normalized, relationship, name),
  };
}

/**
 * The intent registry — the single place to add/modify commands.
 * Evaluated in order; the first matching rule wins.
 */
export const INTENT_RULES: IntentRule[] = [
  {
    intent: 'social_greeting',
    patterns: [
      /\b(this is|meet|greet|introducing|here'?s|here is)\s+(my\s+)?(teacher|professor|mentor|guide|friend|buddy|mother|mom|mummy|maa|father|dad|papa|sibling|brother|sister|recruiter|interviewer|guest|colleague|coworker|senior)\b/i,
      /\b(my\s+)?(teacher|professor|mentor|guide|friend|buddy|mother|mom|mummy|maa|father|dad|papa|sibling|brother|sister|recruiter|interviewer|guest|colleague|coworker|senior)\s+(is\s+)?(here|with me|standing beside me|beside me)\b/i,
      /\b(this is|meet|here'?s|here is|introducing)\s+[a-z][a-z.'’]*(?:\s+[a-z][a-z.'’]*){0,3}\s*,?\s*(my\s+)?(teacher|professor|mentor|guide|friend|buddy|mother|mom|mummy|maa|father|dad|papa|sibling|brother|sister|recruiter|interviewer|guest|colleague|coworker|senior)\b/i,
      /\b(this is|meet|here'?s|here is|introducing)\s+[a-z][a-z.'’]*(?:\s+[a-z][a-z.'’]*){0,2}\s+(sir|mam|maam|ma’am)\b/i,
      /\b(regarding|for|as)\s+(my\s+)?(teacher|professor|mentor|guide|friend|buddy|mother|mom|mummy|maa|father|dad|papa|sibling|brother|sister|recruiter|interviewer|guest|colleague|coworker|senior)\b.*\b(this is|meet|here'?s|here is|introducing)\s+[a-z][a-z.'’]*(?:\s+[a-z][a-z.'’]*){0,3}\b/i,
      /\bplease\s+greet\s+(my\s+)?(teacher|professor|mentor|guide|friend|buddy|mother|mom|mummy|maa|father|dad|papa|sibling|brother|sister|recruiter|interviewer|guest|colleague|coworker|senior)\b/i,
    ],
    extractQuery: (text) => text.trim(),
    extractEntities: extractSocialGreetingEntities,
  },
  {
    intent: 'open_youtube',
    patterns: [/\b(open|launch|start|go\s+to|show)\s+youtube\b/i, /\byoutube\b/i],
  },
  {
    intent: 'open_chrome',
    patterns: [/\b(open|launch|start)\s+(chrome|google\s+chrome|browser)\b/i],
  },
  {
    intent: 'open_whatsapp',
    patterns: [/\b(open|launch|start|go\s+to|show)\s+whatsapp\b/i, /\bwhatsapp\b/i],
  },
  {
    intent: 'search_google',
    patterns: [/\b(search|search\s+for|look\s+up|google|find)\s+(.+)/i, /\bsearch\b/i],
    extractQuery: (text) => {
      const match = text.match(/\b(?:search\s+for|search|look\s+up|google|find)\s+(.+)/i);
      return match ? match[1].trim() : text.trim();
    },
  },
  {
    intent: 'ask_ai',
    patterns: [
      /^(what|who|where|when|why|how|is|are|can|could|would|should|do|does|did|tell\s+me|explain|define|describe)\b/i,
      /\?$/,
    ],
    extractQuery: (text) => text.trim(),
  },
];

/**
 * Classify a raw transcript into an {@link IntentResult}.
 *
 * @param rawText The (possibly untrimmed) transcript.
 * @returns The matched intent, or `unknown` (with the text echoed as `query`).
 */
export function detectIntent(rawText: string): IntentResult {
  const text = rawText.trim();
  if (!text) return { intent: 'unknown', confidence: 'low' };

  for (const rule of INTENT_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(text))) {
      return {
        intent: rule.intent,
        confidence: 'high',
        query: rule.extractQuery ? rule.extractQuery(text) : undefined,
        entities: rule.extractEntities ? rule.extractEntities(text) : undefined,
      };
    }
  }

  return { intent: 'unknown', confidence: 'low', query: text };
}
