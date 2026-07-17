import { ContextEngine } from '@/services/context';
import type { ContextObject } from '@/services/context';

export type HumanConversationType =
  | 'celebration'
  | 'apology'
  | 'empathy'
  | 'explanation'
  | 'instruction'
  | 'casual_chat'
  | 'question'
  | 'encouragement';

export type HumanConversationTone =
  | 'warm'
  | 'calm'
  | 'supportive'
  | 'excited'
  | 'professional'
  | 'playful';

export interface HumanConversationInput {
  userInput: string;
  response: string;
}

export interface HumanConversationResult {
  detectedTone: HumanConversationTone;
  conversationType: HumanConversationType;
  appliedModifiers: string[];
  responseBefore: string;
  responseAfter: string;
  memoryCallback: string | null;
}

const SHORT_THANKS = ['Anytime.', 'Of course.', 'Glad it helped.'];
const SHORT_ACKS = ['Got it.', 'Absolutely.', 'Makes sense.'];

const TRANSITIONS: Record<HumanConversationType, string[]> = {
  celebration: ["That's amazing.", 'That is genuinely lovely.', 'Big moment.'],
  apology: ['I am sorry about that.', 'Ah, I see the issue.', 'That did not land right.'],
  empathy: ['I get that.', 'That sounds heavy.', 'I am with you.'],
  explanation: ['Good question.', "Let's see.", 'Here is the clean version.'],
  instruction: ['Sure.', "Let's do it step by step.", 'Here is the path.'],
  casual_chat: ['Absolutely.', 'Sure.', 'I hear you.'],
  question: ['Quick thought.', 'I think so.', 'The short answer is yes.'],
  encouragement: ["You're getting closer.", 'That progress matters.', 'Keep going.'],
};

const ROBOTIC_OPENERS: RegExp[] = [
  /^as an ai(?: language model| assistant)?,?\s*/i,
  /^i can help you(?: with| to)?\s*/i,
  /^i'd be happy to\s*/i,
  /^i would be happy to\s*/i,
  /^here is your answer[:,]?\s*/i,
  /^certainly[:,]?\s*i can\s*/i,
];

function hashText(text: string): number {
  let hash = 0;
  for (let i = 0; i < text.length; i += 1) {
    hash = (hash * 31 + text.charCodeAt(i)) >>> 0;
  }
  return hash;
}

function pick(items: string[], seed: string): string {
  return items[hashText(seed) % items.length];
}

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

function wordCount(value: string): number {
  return value.trim().split(/\s+/).filter(Boolean).length;
}

function startsNaturally(value: string): boolean {
  return /^(sure|absolutely|got it|good question|quick thought|that's amazing|that is amazing|i get that|i am sorry|i'm sorry|okay|of course|anytime)[.!,:]?/i.test(value.trim());
}

function userIsThanks(value: string): boolean {
  return /^(thanks|thank you|thx|ty|thankyou|appreciate it|thanks a lot)$/.test(normalize(value));
}

function userIsAck(value: string): boolean {
  return /^(ok|okay|k|cool|done|fine|alright|yes|yeah|yep|sure)$/.test(normalize(value));
}

function detectConversationType(userInput: string, response: string): HumanConversationType {
  const user = normalize(userInput);
  const reply = response.toLowerCase();

  if (/\b(selected|got selected|passed|won|completed|finished|cracked|accepted|offer|achievement|milestone)\b/i.test(user)) {
    return 'celebration';
  }
  if (/\b(sorry|apologize|couldn't|could not|unable|failed|error)\b/i.test(reply)) {
    return 'apology';
  }
  if (/\b(sad|tired|stressed|worried|anxious|frustrated|lonely|confused|overwhelmed|stuck)\b/i.test(user)) {
    return user.includes('confused') || user.includes('stuck') ? 'encouragement' : 'empathy';
  }
  if (/\b(step|first|second|third|then|after that|follow these|do this)\b/i.test(reply) || /^\s*\d+[.)]/m.test(response)) {
    return 'instruction';
  }
  if (response.trim().endsWith('?')) {
    return 'question';
  }
  if (/\b(goal|learn|study|gate|react|fitness|practice|prepare|improve|roadmap)\b/i.test(user)) {
    return 'encouragement';
  }
  if (wordCount(response) > 45 || /\b(because|means|reason|why|how|explain|understand)\b/i.test(reply)) {
    return 'explanation';
  }
  return 'casual_chat';
}

function toneForType(type: HumanConversationType): HumanConversationTone {
  if (type === 'celebration') return 'excited';
  if (type === 'empathy' || type === 'encouragement') return 'supportive';
  if (type === 'instruction' || type === 'explanation') return 'calm';
  if (type === 'apology') return 'warm';
  if (type === 'question') return 'professional';
  return 'warm';
}

function removeRoboticRepetition(response: string, appliedModifiers: string[]): string {
  let next = response.trim().replace(/\s+/g, ' ');
  for (const opener of ROBOTIC_OPENERS) {
    if (opener.test(next)) {
      next = next.replace(opener, '').trim();
      appliedModifiers.push('removed_robotic_opener');
    }
  }
  next = next.replace(/\b(I can help you|I'd be happy to|As an AI)\b[:,]?\s*/gi, '').trim();
  next = next.replace(/^(sure\.?\s*){2,}/i, 'Sure. ');
  return next;
}

function ensureSentence(value: string): string {
  const next = value.trim();
  if (!next) return next;
  return /[.!?]$/.test(next) ? next : `${next}.`;
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function buildMemoryCallback(context: ContextObject | null, type: HumanConversationType): Promise<string | null> {
  if (!context || type === 'casual_chat' || type === 'apology' || type === 'question') return null;

  if (context.task && context.task.confidence >= 0.84) {
    return `You're getting closer to ${context.task.label.toLowerCase()}.`;
  }

  const relationship = context.relationships.find((item) => item.confidence >= 0.84 && (item.name || item.relationship !== 'unknown'));
  if (relationship?.name) {
    return `You mentioned ${relationship.name} before.`;
  }
  if (relationship) {
    return `You mentioned your ${titleCase(relationship.relationship).toLowerCase()} before.`;
  }

  return null;
}

class HumanConversationEngineImpl {
  private lastResult: HumanConversationResult = {
    detectedTone: 'warm',
    conversationType: 'casual_chat',
    appliedModifiers: [],
    responseBefore: '',
    responseAfter: '',
    memoryCallback: null,
  };

  async process(input: HumanConversationInput): Promise<HumanConversationResult> {
    const appliedModifiers: string[] = [];
    const responseBefore = input.response;
    const seed = `${input.userInput}:${input.response}`;

    if (userIsThanks(input.userInput)) {
      const responseAfter = pick(SHORT_THANKS, seed);
      appliedModifiers.push('short_thanks_reply');
      return this.remember({
        detectedTone: 'warm',
        conversationType: 'casual_chat',
        appliedModifiers,
        responseBefore,
        responseAfter,
        memoryCallback: null,
      });
    }

    if (userIsAck(input.userInput) && wordCount(input.response) > 8) {
      const responseAfter = pick(SHORT_ACKS, seed);
      appliedModifiers.push('short_acknowledgement_reply');
      return this.remember({
        detectedTone: 'warm',
        conversationType: 'casual_chat',
        appliedModifiers,
        responseBefore,
        responseAfter,
        memoryCallback: null,
      });
    }

    const conversationType = detectConversationType(input.userInput, input.response);
    const detectedTone = toneForType(conversationType);
    let responseAfter = removeRoboticRepetition(input.response, appliedModifiers);

    if (conversationType === 'celebration' && !/^that'?s amazing/i.test(responseAfter)) {
      responseAfter = `That's amazing. ${responseAfter}`;
      appliedModifiers.push('celebration_warmth');
    } else if (!startsNaturally(responseAfter) && wordCount(responseAfter) > 10) {
      responseAfter = `${pick(TRANSITIONS[conversationType], seed)} ${responseAfter}`;
      appliedModifiers.push('natural_transition');
    }

    const context = await ContextEngine.getCurrentContext().catch(() => null);
    const memoryCallback = await buildMemoryCallback(context, conversationType);
    if (memoryCallback && wordCount(responseAfter) > 18 && !responseAfter.includes(memoryCallback)) {
      responseAfter = `${memoryCallback} ${responseAfter}`;
      appliedModifiers.push('high_confidence_memory_callback');
    }

    responseAfter = ensureSentence(responseAfter);

    return this.remember({
      detectedTone,
      conversationType,
      appliedModifiers,
      responseBefore,
      responseAfter,
      memoryCallback,
    });
  }

  getLastResult(): HumanConversationResult {
    return this.lastResult;
  }

  private remember(result: HumanConversationResult): HumanConversationResult {
    this.lastResult = result;
    return result;
  }
}

export const HumanConversationEngine = new HumanConversationEngineImpl();
