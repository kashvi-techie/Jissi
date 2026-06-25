export type IntentType =
  | 'open_youtube'
  | 'open_chrome'
  | 'open_whatsapp'
  | 'search_google'
  | 'ask_ai'
  | 'unknown';

export interface IntentResult {
  intent: IntentType;
  confidence: 'high' | 'medium' | 'low';
  query?: string;
}

interface IntentRule {
  intent: IntentType;
  patterns: RegExp[];
  extractQuery?: (text: string) => string | undefined;
}

const RULES: IntentRule[] = [
  {
    intent: 'open_youtube',
    patterns: [
      /\b(open|launch|start|go\s+to|show)\s+youtube\b/i,
      /\byoutube\b/i,
    ],
  },
  {
    intent: 'open_chrome',
    patterns: [
      /\b(open|launch|start)\s+(chrome|google\s+chrome|browser)\b/i,
    ],
  },
  {
    intent: 'open_whatsapp',
    patterns: [
      /\b(open|launch|start|go\s+to|show)\s+whatsapp\b/i,
      /\bwhatsapp\b/i,
    ],
  },
  {
    intent: 'search_google',
    patterns: [
      /\b(search|search\s+for|look\s+up|google|find)\s+(.+)/i,
      /\bsearch\b/i,
    ],
    extractQuery: (text: string) => {
      const m = text.match(
        /\b(?:search\s+for|search|look\s+up|google|find)\s+(.+)/i
      );
      return m ? m[1].trim() : text.trim();
    },
  },
  {
    intent: 'ask_ai',
    patterns: [
      /^(what|who|where|when|why|how|is|are|can|could|would|should|do|does|did|tell\s+me|explain|define|describe)\b/i,
      /\?$/,
    ],
    extractQuery: (text: string) => text.trim(),
  },
];

export function detectIntent(rawText: string): IntentResult {
  const text = rawText.trim();
  if (!text) return { intent: 'unknown', confidence: 'low' };

  for (const rule of RULES) {
    const matched = rule.patterns.some((p) => p.test(text));
    if (matched) {
      const query = rule.extractQuery ? rule.extractQuery(text) : undefined;
      return { intent: rule.intent, confidence: 'high', query };
    }
  }

  return { intent: 'unknown', confidence: 'low', query: text };
}
