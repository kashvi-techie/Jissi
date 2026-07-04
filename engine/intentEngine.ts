/**
 * IntentEngine - a lightweight, rule-based intent classifier.
 *
 * Maps raw transcript text to a structured IntentResult. It is pure, has no
 * side effects, and is safe to call from hooks, services, or UI.
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
  /** Optional extracted argument, such as search terms for search_google. */
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
  /** The rule fires if any pattern matches the trimmed text. */
  patterns: RegExp[];
  /** Optional argument extractor, such as pulling a search query from text. */
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
  'best friend': 'best_friend',
  bestie: 'best_friend',
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

const RELATIONSHIP_WORDS = Object.keys(RELATIONSHIP_ALIASES).sort((a, b) => b.length - a.length);
const RELATIONSHIP_PATTERN = RELATIONSHIP_WORDS.join('|');

function normalizeRelationship(value?: string): string | undefined {
  if (!value) return undefined;
  const key = value.toLowerCase().replace(/[.']/g, '').replace(/\s+/g, ' ').trim();
  return RELATIONSHIP_ALIASES[key];
}

function titleCaseName(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .replace(/\b(my|the|a|an|is|here|standing|beside|with|me|please|greet|meet|this|for|as|regarding|favourite|favorite)\b/gi, ' ')
    .replace(/[,.!?]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned || cleaned.length < 2) return undefined;
  return cleaned
    .split(' ')
    .slice(0, 4)
    .map((part) => {
      const lower = part.toLowerCase();
      if (['sir', 'mam', 'maam', 'mr', 'mrs', 'ms', 'dr'].includes(lower)) {
        if (lower === 'maam' || lower === 'mam') return "ma'am";
        if (lower === 'mr') return 'Mr.';
        if (lower === 'mrs') return 'Mrs.';
        if (lower === 'ms') return 'Ms.';
        if (lower === 'dr') return 'Dr.';
        return part;
      }
      return part.charAt(0).toUpperCase() + part.slice(1);
    })
    .join(' ');
}

function inferGender(text: string, relationship?: string, name?: string): string | undefined {
  const source = `${text} ${name ?? ''}`.toLowerCase();
  if (/\b(he|him|his|sir|mr|father|dad|papa|brother)\b/.test(source)) return 'male';
  if (/\b(she|her|mam|maam|mrs|ms|mother|mom|mummy|maa|sister)\b/.test(source)) return 'female';
  if (relationship === 'mother') return 'female';
  if (relationship === 'father') return 'male';
  return undefined;
}

function extractSocialGreetingEntities(text: string): IntentResult['entities'] {
  const normalized = text.trim();
  const relationshipMatch = normalized.match(new RegExp(`\\b(${RELATIONSHIP_PATTERN})\\b`, 'i'));
  const relationship = normalizeRelationship(relationshipMatch?.[1]);

  const namePatterns = [
    /\b(?:this is|meet|here'?s|here is|introducing)\s+([a-z][a-z.']*(?:\s+[a-z][a-z.']*){0,2}\s+(?:sir|mam|maam))\b/i,
    new RegExp(`\\b(?:this is|meet|here'?s|here is|introducing)\\s+([a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3})\\s*,?\\s*(?:my\\s+)?(?:favo[u]?rite\\s+)?(?:${RELATIONSHIP_PATTERN})\\b`, 'i'),
    new RegExp(`\\b(?:my\\s+)?(?:favo[u]?rite\\s+)?(?:${RELATIONSHIP_PATTERN})\\s+([a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3})\\s+(?:is\\s+)?(?:here|with|standing|beside)\\b`, 'i'),
    new RegExp(`\\b(?:please\\s+)?greet\\s+(?:my\\s+)?(?:favo[u]?rite\\s+)?(?:${RELATIONSHIP_PATTERN})\\s*,?\\s*([a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3})?`, 'i'),
    new RegExp(`\\b(?:regarding|for|as)\\s+(?:my\\s+)?(?:favo[u]?rite\\s+)?(?:${RELATIONSHIP_PATTERN})\\b.*\\b(?:this is|meet|here'?s|here is|introducing)\\s+([a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3})\\b`, 'i'),
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
 * The intent registry - the single place to add or modify commands.
 * Evaluated in order; the first matching rule wins.
 */
export const INTENT_RULES: IntentRule[] = [
  {
    intent: 'social_greeting',
    patterns: [
      new RegExp(`\\b(this is|meet|greet|introducing|here'?s|here is)\\s+(my\\s+)?(favo[u]?rite\\s+)?(${RELATIONSHIP_PATTERN})\\b`, 'i'),
      new RegExp(`\\b(my\\s+)?(favo[u]?rite\\s+)?(${RELATIONSHIP_PATTERN})\\s+(is\\s+)?(here|with me|standing beside me|beside me)\\b`, 'i'),
      new RegExp(`\\b(this is|meet|here'?s|here is|introducing)\\s+[a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3}\\s*,?\\s*(my\\s+)?(favo[u]?rite\\s+)?(${RELATIONSHIP_PATTERN})\\b`, 'i'),
      /\b(this is|meet|here'?s|here is|introducing)\s+[a-z][a-z.']*(?:\s+[a-z][a-z.']*){0,2}\s+(sir|mam|maam)\b/i,
      new RegExp(`\\b(regarding|for|as)\\s+(my\\s+)?(favo[u]?rite\\s+)?(${RELATIONSHIP_PATTERN})\\b.*\\b(this is|meet|here'?s|here is|introducing)\\s+[a-z][a-z.']*(?:\\s+[a-z][a-z.']*){0,3}\\b`, 'i'),
      new RegExp(`\\bplease\\s+greet\\s+(my\\s+)?(favo[u]?rite\\s+)?(${RELATIONSHIP_PATTERN})\\b`, 'i'),
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
 * Classify a raw transcript into an IntentResult.
 *
 * @param rawText The possibly untrimmed transcript.
 * @returns The matched intent, or unknown with the text echoed as query.
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
