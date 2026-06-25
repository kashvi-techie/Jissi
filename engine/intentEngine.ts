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
}

/** A single classification rule in the registry. */
export interface IntentRule {
  intent: IntentType;
  /** The rule fires if ANY pattern matches the trimmed text. */
  patterns: RegExp[];
  /** Optional argument extractor (e.g. pull the search query out of the text). */
  extractQuery?: (text: string) => string | undefined;
}

/**
 * The intent registry — the single place to add/modify commands.
 * Evaluated in order; the first matching rule wins.
 */
export const INTENT_RULES: IntentRule[] = [
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
      };
    }
  }

  return { intent: 'unknown', confidence: 'low', query: text };
}
