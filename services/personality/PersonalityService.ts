const ACKNOWLEDGEMENTS = [
  'Absolutely.',
  "I'd love to.",
  'Sure, I can do that.',
  "Let's do it.",
  "I'm happy to help.",
];

const OKAY_REPLIES = ['Sure.', 'Absolutely.', 'Of course.', 'Done.', 'Got it.'];

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 33 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick(items: string[], seed: string): string {
  return items[hashText(seed) % items.length];
}

class PersonalityServiceImpl {
  acknowledgement(seed = ''): string {
    return pick(ACKNOWLEDGEMENTS, seed || String(Date.now()));
  }

  warmShortReply(text: string): string {
    const normalized = text.trim().toLowerCase().replace(/[.!]+$/g, '');
    if (normalized === 'ok' || normalized === 'okay') return pick(OKAY_REPLIES, text);
    return text;
  }
}

export const PersonalityService = new PersonalityServiceImpl();
