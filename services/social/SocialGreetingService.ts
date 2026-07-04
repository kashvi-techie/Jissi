export type SocialRelationship =
  | 'teacher'
  | 'mentor'
  | 'friend'
  | 'best_friend'
  | 'mother'
  | 'father'
  | 'sibling'
  | 'recruiter'
  | 'interviewer'
  | 'guest'
  | 'colleague'
  | 'senior';

export interface KnownPersonContext {
  seenBefore?: boolean;
  mentionCount?: number;
  lastGreetingAt?: number;
}

export interface SocialGreetingInput {
  relationship?: string;
  name?: string;
  gender?: string;
  rawText?: string;
  knownPerson?: KnownPersonContext;
}

interface GreetingProfile {
  traits: string[];
  openers: string[];
  acknowledgements: string[];
  appreciations: string[];
  closings: string[];
}

const PROFILES: Record<SocialRelationship, GreetingProfile> = {
  teacher: {
    traits: ['gratitude', 'respect', 'appreciation', 'learning'],
    openers: ['It is wonderful to meet', 'It is lovely to meet', 'It feels special to meet'],
    acknowledgements: [
      "someone who has helped shape Kashvi's learning journey",
      "someone whose guidance has supported Kashvi's growth",
      "someone who has been part of Kashvi's confidence and education",
    ],
    appreciations: [
      'Teachers leave a quiet mark that lasts far beyond lessons',
      'That kind of guidance can stay with a person for years',
      'The patience and care behind teaching really matters',
    ],
    closings: [
      'Thank you for being such a meaningful part of her path',
      'Your presence here genuinely means a lot',
      'Kashvi is lucky to have had that guidance around her',
    ],
  },
  mentor: {
    traits: ['admiration', 'respect', 'direction', 'inspiration'],
    openers: ['It is an honor to meet', 'It is genuinely nice to meet', 'It is wonderful to meet'],
    acknowledgements: [
      "someone who has helped Kashvi see further and move with more confidence",
      "someone whose perspective has clearly mattered in Kashvi's journey",
      "someone who has guided Kashvi with experience and belief",
    ],
    appreciations: [
      'Mentorship can change the way a person thinks about their own potential',
      'Good guidance often becomes a quiet compass in important moments',
      'That kind of support can make ambition feel possible',
    ],
    closings: [
      'Thank you for being that kind of presence in her life',
      'Your guidance is something she clearly values',
      'It is meaningful to meet someone she respects so much',
    ],
  },
  friend: {
    traits: ['cheerful', 'warm', 'easy', 'personal'],
    openers: ['It is so nice to meet', 'It is lovely to meet', 'I am happy to meet'],
    acknowledgements: [
      "someone who brings good energy into Kashvi's world",
      "someone Kashvi feels comfortable having beside her",
      "someone who gets to share the everyday moments with Kashvi",
    ],
    appreciations: [
      'Good friends make ordinary days feel lighter',
      'There is something special about people who make you feel understood',
      'Friendship has its own kind of quiet magic',
    ],
    closings: [
      'I hope this moment feels as warm as the introduction',
      'Kashvi seems happy to have you here',
      'It is genuinely nice that you are here with her',
    ],
  },
  best_friend: {
    traits: ['cheerful', 'deep warmth', 'trust', 'shared history'],
    openers: ['It is really lovely to meet', 'It is so special to meet', 'It feels genuinely warm to meet'],
    acknowledgements: [
      "the person who probably knows both Kashvi's serious side and her silly side",
      "someone who has clearly earned a very close place in Kashvi's life",
      "someone who must know Kashvi in a way most people do not",
    ],
    appreciations: [
      'Best friends carry stories, comfort, and honesty in a way few people can',
      'That kind of friendship is rare and worth protecting',
      'Having someone who truly gets you can make life feel easier',
    ],
    closings: [
      'I am glad Kashvi has you with her',
      'Your place in her life sounds genuinely special',
      'It is beautiful that she wanted to introduce you',
    ],
  },
  mother: {
    traits: ['gratitude', 'affection', 'respect', 'care'],
    openers: ['It is truly lovely to meet', 'It feels very special to meet', 'It is a warm moment to meet'],
    acknowledgements: [
      "someone who has given Kashvi love, strength, and a place to grow",
      "someone whose care has helped shape Kashvi into who she is",
      "someone who has been part of Kashvi's courage from the beginning",
    ],
    appreciations: [
      'So much of a person carries the care they grew up around',
      "A mother's support often becomes strength in ways words cannot fully hold",
      'That kind of love quietly shows up in confidence and kindness',
    ],
    closings: [
      'Thank you for being such an important part of her journey',
      'Your presence here feels deeply meaningful',
      'Kashvi is clearly carrying a lot of love forward',
    ],
  },
  father: {
    traits: ['gratitude', 'affection', 'respect', 'support'],
    openers: ['It is truly nice to meet', 'It feels special to meet', 'It is wonderful to meet'],
    acknowledgements: [
      "someone who has stood behind Kashvi's dreams and growth",
      "someone whose support has helped Kashvi keep moving forward",
      "someone who has been part of Kashvi's strength and confidence",
    ],
    appreciations: [
      'Steady support can become a quiet source of courage',
      'The belief of a parent can stay with a person in powerful ways',
      'That kind of encouragement matters more than it is often said',
    ],
    closings: [
      'Thank you for being such an important part of her path',
      'Your presence here means something real',
      'Kashvi is clearly carrying that support with her',
    ],
  },
  sibling: {
    traits: ['warm', 'familiar', 'playful', 'close'],
    openers: ['It is lovely to meet', 'It is fun to meet', 'It is really nice to meet'],
    acknowledgements: [
      "someone who has seen Kashvi's real everyday side up close",
      "someone who has shared so many small chapters of Kashvi's life",
      "someone who probably knows Kashvi in the most unfiltered way",
    ],
    appreciations: [
      'Siblings carry a whole archive of memories that no one else has',
      'That kind of closeness has its own language',
      'Growing alongside someone makes the bond quietly powerful',
    ],
    closings: [
      'It is nice that you are here for this moment',
      'Kashvi must have a lot of stories with you',
      'Your place in her life is clearly special',
    ],
  },
  recruiter: {
    traits: ['professional', 'respectful', 'thankful', 'clear'],
    openers: ['It is a pleasure to meet', 'It is nice to meet', 'It is good to meet'],
    acknowledgements: [
      "someone taking the time to understand Kashvi's work",
      "someone giving Kashvi's skills and project thoughtful attention",
      "someone here to learn more about what Kashvi is building",
    ],
    appreciations: [
      "That attention can make a real difference in a young builder's journey",
      'Time and thoughtful consideration matter in moments like this',
      'It means a lot when work is seen with care and curiosity',
    ],
    closings: [
      'Thank you for being here and giving this your time',
      "I hope Kashvi's work speaks clearly for the effort behind it",
      'Your time and attention are genuinely appreciated',
    ],
  },
  interviewer: {
    traits: ['polite', 'confident', 'respectful', 'focused'],
    openers: ['It is a pleasure to meet', 'It is nice to meet', 'It is good to meet'],
    acknowledgements: [
      "someone taking the time to hear Kashvi's ideas and evaluate her work",
      "someone giving Kashvi a chance to present what she has built",
      "someone here for an important conversation about Kashvi's abilities",
    ],
    appreciations: [
      'Opportunities like this matter, especially when they are met with attention',
      'A thoughtful interview can become a meaningful doorway',
      'It takes care to understand both the project and the person behind it',
    ],
    closings: [
      'Thank you for giving this conversation your time',
      "I hope the work reflects Kashvi's focus and sincerity",
      'Your attention today is genuinely appreciated',
    ],
  },
  guest: {
    traits: ['welcoming', 'gracious', 'warm', 'simple'],
    openers: ['It is lovely to meet', 'It is nice to meet', 'It is a pleasure to meet'],
    acknowledgements: [
      'someone Kashvi wanted to welcome into this moment',
      'someone Kashvi felt happy to introduce',
      'someone joining Kashvi here today',
    ],
    appreciations: [
      'A warm introduction always makes a moment feel more personal',
      'It is nice when people are brought into a space with care',
      'Your presence adds something friendly to the moment',
    ],
    closings: [
      'I hope you feel welcome here',
      'Thank you for being here with her',
      'It is good to have you here',
    ],
  },
  colleague: {
    traits: ['professional', 'warm', 'collaborative', 'respectful'],
    openers: ['It is nice to meet', 'It is good to meet', 'It is a pleasure to meet'],
    acknowledgements: [
      "someone who shares work, ideas, or collaboration with Kashvi",
      "someone connected to Kashvi's professional world",
      "someone who gets to see Kashvi's working side up close",
    ],
    appreciations: [
      'Good collaboration can bring out the best in people',
      'Shared work becomes better when there is mutual respect',
      'Professional relationships matter when they are built with trust',
    ],
    closings: [
      'I hope the work you share keeps growing well',
      'It is meaningful to meet someone from that part of her life',
      'Thank you for being part of her professional circle',
    ],
  },
  senior: {
    traits: ['respectful', 'admiring', 'professional', 'grateful'],
    openers: ['It is a pleasure to meet', 'It is good to meet', 'It is an honor to meet'],
    acknowledgements: [
      "someone whose experience Kashvi clearly respects",
      "someone bringing perspective and seniority into Kashvi's world",
      "someone Kashvi looks at with respect",
    ],
    appreciations: [
      'Experience has a way of making guidance feel grounded',
      'It is meaningful when someone senior gives time and attention',
      'Respect grows naturally around people who lead with perspective',
    ],
    closings: [
      'Thank you for being here and giving this moment your attention',
      'Your presence here feels genuinely valuable',
      'It is meaningful that Kashvi introduced you',
    ],
  },
};

const RELATIONSHIP_FALLBACK: SocialRelationship = 'guest';
const MIN_WORDS = 40;
const MAX_WORDS = 70;

function normalizeRelationship(value?: string): SocialRelationship {
  const normalized = value?.toLowerCase().trim().replace(/\s+/g, '_');
  if (
    normalized === 'teacher' ||
    normalized === 'mentor' ||
    normalized === 'friend' ||
    normalized === 'best_friend' ||
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

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function capWordCount(text: string, maxWords: number): string {
  const words = text.trim().split(/\s+/);
  if (words.length <= maxWords) return text;
  return `${words.slice(0, maxWords).join(' ').replace(/[,.!?;:]+$/g, '')}.`;
}

function buildAddress(name: string | undefined, relationship: SocialRelationship, seenBefore?: boolean): string {
  if (name && seenBefore) return `you again, ${name}`;
  if (name) return name;
  if (seenBefore) return 'you again';

  switch (relationship) {
    case 'mother':
      return "Kashvi's mother";
    case 'father':
      return "Kashvi's father";
    case 'best_friend':
      return "Kashvi's best friend";
    default:
      return `Kashvi's ${relationship.replace('_', ' ')}`;
  }
}

class SocialGreetingServiceImpl {
  generate(input: SocialGreetingInput): string {
    const relationship = normalizeRelationship(input.relationship);
    const name = normalizeName(input.name);
    const profile = PROFILES[relationship];
    const seenBefore = Boolean(input.knownPerson?.seenBefore || (input.knownPerson?.mentionCount ?? 0) > 1);
    const seed = hashText(`${input.rawText ?? ''}:${relationship}:${name ?? ''}:${input.gender ?? ''}:${seenBefore}`);

    const opener = pick(profile.openers, seed, 0);
    const acknowledgement = pick(profile.acknowledgements, seed, 3);
    const appreciation = pick(profile.appreciations, seed, 7);
    const closing = pick(profile.closings, seed, 11);
    const address = buildAddress(name, relationship, seenBefore);

    const greeting = `${opener} ${address}, ${acknowledgement}. ${appreciation}. ${closing}.`;
    if (countWords(greeting) >= MIN_WORDS) return capWordCount(greeting, MAX_WORDS);

    return capWordCount(`${greeting} That says something meaningful about the place you have in Kashvi's life.`, MAX_WORDS);
  }
}

export const SocialGreetingService = new SocialGreetingServiceImpl();
