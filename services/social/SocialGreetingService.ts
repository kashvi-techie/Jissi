export type SocialRelationship =
  | 'teacher'
  | 'mentor'
  | 'friend'
  | 'mother'
  | 'father'
  | 'sibling'
  | 'recruiter'
  | 'interviewer'
  | 'guest'
  | 'colleague'
  | 'senior';

export interface SocialGreetingInput {
  relationship?: string;
  name?: string;
  gender?: string;
  rawText?: string;
}

interface GreetingProfile {
  openers: string[];
  appreciation: string[];
  closings: string[];
}

const PROFILES: Record<SocialRelationship, GreetingProfile> = {
  teacher: {
    openers: ['Hello', 'It is lovely to meet you', 'I am really glad to meet you'],
    appreciation: [
      "thank you for helping shape Kashvi's learning journey",
      'thank you for guiding and encouraging Kashvi as she grows',
      "thank you for being part of Kashvi's education and confidence",
    ],
    closings: ['I am Jissi, and it is a pleasure to greet you', 'I am Jissi, happy to be here today'],
  },
  mentor: {
    openers: ['Hello', 'It is an honor to meet you', 'I am glad to meet you'],
    appreciation: [
      'thank you for guiding Kashvi with your experience and perspective',
      'thank you for helping Kashvi think bigger and move with confidence',
      "thank you for being a steady source of direction in Kashvi's journey",
    ],
    closings: ['I am Jissi, and I am happy to greet you', 'I am Jissi, glad to be here with you'],
  },
  friend: {
    openers: ['Hey', 'Hi', 'Hello'],
    appreciation: [
      'it is so nice to meet someone who brings good energy around Kashvi',
      "I am glad Kashvi has you here with her",
      'you seem like someone Kashvi is happy to have around',
    ],
    closings: ['I am Jissi, and I hope we get along beautifully', 'I am Jissi, nice to meet you'],
  },
  mother: {
    openers: ['Hello', 'It is really lovely to meet you', 'I am so glad to meet you'],
    appreciation: [
      'thank you for the love and strength you give Kashvi',
      "thank you for everything you have poured into Kashvi's journey",
      'thank you for the care and support that helped Kashvi become who she is',
    ],
    closings: ['I am Jissi, and it is a privilege to greet you', 'I am Jissi, happy to meet you'],
  },
  father: {
    openers: ['Hello', 'It is really nice to meet you', 'I am glad to meet you'],
    appreciation: [
      'thank you for the support and strength you give Kashvi',
      "thank you for standing behind Kashvi's dreams and growth",
      'thank you for the care and encouragement that helped Kashvi move forward',
    ],
    closings: ['I am Jissi, and it is a privilege to greet you', 'I am Jissi, happy to meet you'],
  },
  sibling: {
    openers: ['Hey', 'Hi', 'Hello'],
    appreciation: [
      "it is lovely to meet someone who knows Kashvi's real everyday side",
      'I am happy to meet someone so close to Kashvi',
      "you must have seen Kashvi's journey up close, and that makes this special",
    ],
    closings: ['I am Jissi, nice to meet you', 'I am Jissi, glad you are here'],
  },
  recruiter: {
    openers: ['Hello', 'It is nice to meet you', 'I am glad to meet you'],
    appreciation: [
      "thank you for taking the time to know Kashvi's work",
      "thank you for giving Kashvi's project your attention today",
      'thank you for being here and taking the time to connect',
    ],
    closings: ['I am Jissi, happy to greet you', 'I am Jissi, pleased to meet you'],
  },
  interviewer: {
    openers: ['Hello', 'It is nice to meet you', 'I am glad to meet you'],
    appreciation: [
      "thank you for taking the time to speak with Kashvi and understand her work",
      "thank you for giving Kashvi's ideas your attention today",
      "thank you for being here and listening to Kashvi's project",
    ],
    closings: ['I am Jissi, happy to greet you', 'I am Jissi, pleased to meet you'],
  },
  guest: {
    openers: ['Hello', 'It is lovely to meet you', 'I am glad to meet you'],
    appreciation: [
      'thank you for being here with Kashvi today',
      'it is nice to have you here in this moment',
      'I am happy Kashvi introduced you to me',
    ],
    closings: ['I am Jissi, happy to greet you', 'I am Jissi, nice to meet you'],
  },
  colleague: {
    openers: ['Hello', 'It is nice to meet you', 'I am glad to meet you'],
    appreciation: [
      'it is good to meet someone who shares work and ideas with Kashvi',
      "thank you for being part of Kashvi's professional circle",
      'I am happy to meet someone Kashvi works and collaborates with',
    ],
    closings: ['I am Jissi, happy to greet you', 'I am Jissi, pleased to meet you'],
  },
  senior: {
    openers: ['Hello', 'It is a pleasure to meet you', 'I am glad to meet you'],
    appreciation: [
      'thank you for bringing your experience and perspective here',
      "thank you for taking the time to meet Kashvi's project",
      'it is meaningful to greet someone Kashvi respects',
    ],
    closings: ['I am Jissi, happy to greet you', 'I am Jissi, pleased to meet you'],
  },
};

const RELATIONSHIP_FALLBACK: SocialRelationship = 'guest';

function normalizeRelationship(value?: string): SocialRelationship {
  const normalized = value?.toLowerCase().trim();
  if (
    normalized === 'teacher' ||
    normalized === 'mentor' ||
    normalized === 'friend' ||
    normalized === 'mother' ||
    normalized === 'father' ||
    normalized === 'sibling' ||
    normalized === 'recruiter' ||
    normalized === 'interviewer' ||
    normalized === 'guest' ||
    normalized === 'colleague' ||
    normalized === 'senior'
  ) {
    return normalized;
  }
  return RELATIONSHIP_FALLBACK;
}

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick<T>(items: T[], seed: number, salt: number): T {
  return items[(seed + salt) % items.length];
}

function normalizeName(name?: string): string | undefined {
  if (!name) return undefined;
  const cleaned = name
    .replace(/\bmaam\b/gi, "ma'am")
    .replace(/\bmam\b/gi, "ma'am")
    .replace(/\bmr\b/gi, 'Mr.')
    .replace(/\bmrs\b/gi, 'Mrs.')
    .replace(/\bms\b/gi, 'Ms.')
    .replace(/\bdr\b/gi, 'Dr.')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned.length > 1 ? cleaned : undefined;
}

function capWordCount(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ').replace(/[,.!?;:]+$/g, '')}.`;
}

class SocialGreetingServiceImpl {
  generate(input: SocialGreetingInput): string {
    const relationship = normalizeRelationship(input.relationship);
    const name = normalizeName(input.name);
    const profile = PROFILES[relationship];
    const seed = hashText(`${input.rawText ?? ''}:${relationship}:${name ?? ''}:${input.gender ?? ''}`);

    const opener = pick(profile.openers, seed, 0);
    const appreciation = pick(profile.appreciation, seed, 3);
    const closing = pick(profile.closings, seed, 7);
    const address = name ? ` ${name}` : '';
    const greeting = `${opener}${address}, ${appreciation}. ${closing}.`;

    return capWordCount(greeting, 70);
  }
}

export const SocialGreetingService = new SocialGreetingServiceImpl();
