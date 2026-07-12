import { memoryStore } from '@/services/tools/memory/MemoryStore';
import type {
  RelationshipCommandResult,
  RelationshipKind,
  RelationshipProfile,
  RelationshipTimelineEvent,
  RelationshipTimelineType,
} from './types';

const INDEX_KEY = 'relationships:index';
const PROFILE_PREFIX = 'relationships:profile:';

const RELATIONSHIPS: RelationshipKind[] = [
  'teacher',
  'mentor',
  'mother',
  'father',
  'friend',
  'best_friend',
  'sibling',
  'recruiter',
  'interviewer',
  'doctor',
  'manager',
  'guest',
  'senior',
  'colleague',
  'unknown',
];

const RELATIONSHIP_ALIASES: Record<string, RelationshipKind> = {
  mom: 'mother',
  mum: 'mother',
  maa: 'mother',
  mother: 'mother',
  dad: 'father',
  papa: 'father',
  father: 'father',
  sir: 'teacher',
  mam: 'teacher',
  maam: 'teacher',
  teacher: 'teacher',
  mentor: 'mentor',
  friend: 'friend',
  'best friend': 'best_friend',
  recruiter: 'recruiter',
  interviewer: 'interviewer',
  senior: 'senior',
  colleague: 'colleague',
  guest: 'guest',
  manager: 'manager',
  doctor: 'doctor',
};

function now(): string {
  return new Date().toISOString();
}

function id(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugName(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '') || 'unknown';
}

function normalizeRelationship(value?: string): RelationshipKind {
  if (!value) return 'unknown';
  const normalized = value.toLowerCase().replace(/[-_]+/g, ' ').trim();
  return RELATIONSHIP_ALIASES[normalized] ?? (RELATIONSHIPS.includes(normalized as RelationshipKind) ? normalized as RelationshipKind : 'unknown');
}

function uniq(list: string[]): string[] {
  const seen = new Set<string>();
  return list
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => {
      const key = item.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function humanList(items: string[]): string {
  if (!items.length) return 'I do not have that stored yet.';
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}

function parseJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function makeTimeline(type: RelationshipTimelineType, title: string, detail: string): RelationshipTimelineEvent {
  return { id: id('rel_event'), type, title, detail, timestamp: now() };
}

function guessRelationshipFromName(name: string): RelationshipKind {
  const lower = name.toLowerCase();
  const alias = Object.keys(RELATIONSHIP_ALIASES).find((key) => new RegExp(`\\b${key}\\b`, 'i').test(lower));
  return alias ? RELATIONSHIP_ALIASES[alias] : 'unknown';
}

function extractName(text: string): string | null {
  const patterns = [
    /\b(?:remember that|what does|what do|tell me about|does)\s+([A-Z][A-Za-z]*(?:\s+(?:Sir|Mam|Maam|Ji|[A-Z][A-Za-z]*)){0,3})\b/,
    /\b(?:meet|this is|here is|here's)\s+([A-Z][A-Za-z]*(?:\s+(?:Sir|Mam|Maam|Ji|[A-Z][A-Za-z]*)){0,3})\b/,
    /\b([A-Z][A-Za-z]*(?:\s+(?:Sir|Mam|Maam|Ji|[A-Z][A-Za-z]*)){0,3})\s+(?:likes|like|dislikes|hates|birthday|event|is my|is a)\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return match[1].trim().replace(/[?.!,]+$/, '');
  }
  return null;
}

function extractFact(text: string, verb: 'likes' | 'dislikes'): string | null {
  const source = verb === 'likes'
    ? /\b(?:likes|like|loves|is interested in)\s+(.+?)(?:[.!?]|$)/i
    : /\b(?:dislikes|does not like|doesn't like|hates)\s+(.+?)(?:[.!?]|$)/i;
  const match = text.match(source);
  return match?.[1]?.trim() ?? null;
}

class RelationshipServiceImpl {
  private async readIndex(): Promise<string[]> {
    const entries = await memoryStore.recall(INDEX_KEY);
    return parseJson<string[]>(entries[0]?.value, []);
  }

  private async writeIndex(ids: string[]): Promise<void> {
    await memoryStore.remember(INDEX_KEY, JSON.stringify(uniq(ids)));
  }

  private async readProfile(idValue: string): Promise<RelationshipProfile | null> {
    const entries = await memoryStore.recall(`${PROFILE_PREFIX}${idValue}`);
    return entries[0]?.value ? parseJson<RelationshipProfile | null>(entries[0].value, null) : null;
  }

  private async writeProfile(profile: RelationshipProfile): Promise<void> {
    await memoryStore.remember(`${PROFILE_PREFIX}${profile.id}`, JSON.stringify(profile));
    const index = await this.readIndex();
    await this.writeIndex([profile.id, ...index]);
  }

  async getProfiles(): Promise<RelationshipProfile[]> {
    const ids = await this.readIndex();
    const profiles = await Promise.all(ids.map((profileId) => this.readProfile(profileId)));
    return profiles
      .filter((profile): profile is RelationshipProfile => !!profile)
      .sort((a, b) => new Date(b.lastDiscussed).getTime() - new Date(a.lastDiscussed).getTime());
  }

  async findProfile(name: string): Promise<RelationshipProfile | null> {
    const target = slugName(name);
    const profiles = await this.getProfiles();
    return profiles.find((profile) => profile.id === target || slugName(profile.name) === target || slugName(profile.nickname ?? '') === target) ?? null;
  }

  async upsertPerson(input: { name: string; relationship?: string; nickname?: string; tags?: string[]; timeline?: RelationshipTimelineEvent }): Promise<RelationshipProfile> {
    const existing = await this.findProfile(input.name);
    const timestamp = now();
    const relationship = normalizeRelationship(input.relationship) !== 'unknown' ? normalizeRelationship(input.relationship) : guessRelationshipFromName(input.name);
    const profile: RelationshipProfile = existing ?? {
      id: slugName(input.name),
      name: input.name.trim(),
      relationship,
      firstMet: timestamp,
      lastDiscussed: timestamp,
      importantEvents: [],
      likes: [],
      dislikes: [],
      memories: [],
      tags: [],
      timeline: [makeTimeline('met', `Met ${input.name.trim()}`, `${input.name.trim()} was added to relationship memory.`)],
    };

    profile.nickname = input.nickname ?? profile.nickname;
    profile.relationship = profile.relationship === 'unknown' ? relationship : profile.relationship;
    profile.lastDiscussed = timestamp;
    profile.tags = uniq([...(input.tags ?? []), ...profile.tags, profile.relationship]);
    if (input.timeline) profile.timeline = [input.timeline, ...profile.timeline].slice(0, 60);
    await this.writeProfile(profile);
    return profile;
  }

  async rememberLike(name: string, like: string): Promise<RelationshipProfile> {
    const profile = await this.upsertPerson({
      name,
      tags: ['likes'],
      timeline: makeTimeline('remembered_like', `Remembered what ${name} likes`, like),
    });
    profile.likes = uniq([like, ...profile.likes]);
    profile.lastDiscussed = now();
    await this.writeProfile(profile);
    return profile;
  }

  async rememberDislike(name: string, dislike: string): Promise<RelationshipProfile> {
    const profile = await this.upsertPerson({
      name,
      tags: ['dislikes'],
      timeline: makeTimeline('remembered_dislike', `Remembered what ${name} dislikes`, dislike),
    });
    profile.dislikes = uniq([dislike, ...profile.dislikes]);
    profile.lastDiscussed = now();
    await this.writeProfile(profile);
    return profile;
  }

  async addMemory(name: string, memory: string, type: RelationshipTimelineType = 'note'): Promise<RelationshipProfile> {
    const profile = await this.upsertPerson({
      name,
      tags: ['memory'],
      timeline: makeTimeline(type, `Updated ${name}`, memory),
    });
    profile.memories = uniq([memory, ...profile.memories]);
    profile.lastDiscussed = now();
    await this.writeProfile(profile);
    return profile;
  }

  async handleConversation(input: string): Promise<RelationshipCommandResult | null> {
    const name = extractName(input);
    if (!name) return null;

    const like = extractFact(input, 'likes');
    if (/^remember\b/i.test(input.trim()) && like) {
      const profile = await this.rememberLike(name, like);
      return { handled: true, profile, reason: 'relationship_like_saved', reply: `Got it. I will remember that ${profile.name} likes ${like}.` };
    }

    const dislike = extractFact(input, 'dislikes');
    if (/^remember\b/i.test(input.trim()) && dislike) {
      const profile = await this.rememberDislike(name, dislike);
      return { handled: true, profile, reason: 'relationship_dislike_saved', reply: `Got it. I will remember that ${profile.name} dislikes ${dislike}.` };
    }

    if (/\bwhat does\b.+\blike\b/i.test(input) || /\bwhat do\b.+\blike\b/i.test(input)) {
      const profile = await this.findProfile(name);
      if (!profile) return { handled: true, reason: 'relationship_not_found', reply: `I do not have a relationship profile for ${name} yet.` };
      profile.timeline = [makeTimeline('asked_about', `Asked what ${profile.name} likes`, input), ...profile.timeline].slice(0, 60);
      profile.lastDiscussed = now();
      await this.writeProfile(profile);
      return { handled: true, profile, reason: 'relationship_like_recalled', reply: `${profile.name} likes ${humanList(profile.likes)}.` };
    }

    if (/\b(?:tell me about|who is)\b/i.test(input)) {
      const profile = await this.findProfile(name);
      if (!profile) return { handled: true, reason: 'relationship_not_found', reply: `I do not know ${name} well yet, but I can remember details when you tell me.` };
      profile.timeline = [makeTimeline('asked_about', `Asked about ${profile.name}`, input), ...profile.timeline].slice(0, 60);
      profile.lastDiscussed = now();
      await this.writeProfile(profile);
      return {
        handled: true,
        profile,
        reason: 'relationship_profile_recalled',
        reply: `${profile.name} is saved as ${profile.relationship.replace('_', ' ')}. I remember ${profile.memories.length} note${profile.memories.length === 1 ? '' : 's'}, ${profile.likes.length} like${profile.likes.length === 1 ? '' : 's'}, and ${profile.timeline.length} timeline event${profile.timeline.length === 1 ? '' : 's'}.`,
      };
    }

    return null;
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getProfiles(), null, 2);
  }

  async clearData(): Promise<void> {
    const ids = await this.readIndex();
    await Promise.all(ids.map((profileId) => memoryStore.forget(`${PROFILE_PREFIX}${profileId}`)));
    await memoryStore.forget(INDEX_KEY);
  }
}

export const RelationshipService = new RelationshipServiceImpl();
