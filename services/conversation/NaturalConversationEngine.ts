import { OnboardingService } from '@/services/onboarding';
import { ContextEngine } from '@/services/context';
import type { ContextObject } from '@/services/context';

type ConversationStyle = 'formal' | 'warm' | 'funny' | 'professional';

export interface NaturalConversationResult {
  handled: true;
  reply: string;
  reason: 'greeting' | 'thanks' | 'farewell' | 'wellbeing' | 'acknowledgement';
}

const GREETINGS: Record<ConversationStyle, string[]> = {
  formal: ['Good to see you.', 'Welcome back.', 'Good day. Ready when you are.'],
  warm: ['Hey {name}.', 'Welcome back.', 'Nice to see you again.', 'Ready to continue?'],
  funny: ['Hey {name}. Tiny brain booted, ready.', 'Welcome back. I saved your seat.', 'Nice to see you again.'],
  professional: ['Welcome back.', 'Good to see you.', 'Ready when you are.'],
};

const THANKS: Record<ConversationStyle, string[]> = {
  formal: ['You are welcome.', 'Glad I could help.', 'Of course.'],
  warm: ['Anytime.', 'Of course.', 'Happy to help.', 'Always.'],
  funny: ['Anytime. That one goes in the win column.', 'Of course.', 'Happy to help.'],
  professional: ['Of course.', 'Glad to help.', 'You are welcome.'],
};

const ACKS: Record<ConversationStyle, string[]> = {
  formal: ['Understood.', 'Certainly.', 'That makes sense.'],
  warm: ['Got it.', 'Absolutely.', 'Makes sense.', "I'm on it.", 'Sure.'],
  funny: ['Got it.', "I'm on it.", 'Absolutely. Small mission accepted.'],
  professional: ['Got it.', 'Understood.', 'On it.', 'Makes sense.'],
};

const WELLBEING: Record<ConversationStyle, string[]> = {
  formal: ['I am here and ready to help.', 'I am doing well, thank you. How can I help?'],
  warm: ['I am here with you. What should we do next?', 'Doing good. Better now that we are talking.'],
  funny: ['Running on focus and a suspicious amount of optimism. What are we doing?', 'Doing well. No coffee required. Yet.'],
  professional: ['Ready to help. What would you like to work on?', 'I am ready. What is next?'],
};

const FAREWELLS: Record<ConversationStyle, string[]> = {
  formal: ['I will be here whenever you need.', 'Take care. We can continue anytime.'],
  warm: ['I am here whenever you need.', 'Rest well. We can continue anytime.', 'Want to continue later?'],
  funny: ['I will keep the lights warm. See you soon.', 'Rest well. I will pretend not to miss the productivity.'],
  professional: ['We can continue anytime.', 'I will be ready when you return.'],
};

const THINKING: Record<ConversationStyle, string[]> = {
  formal: ['Let me think this through.', 'I will look through the context.'],
  warm: ['Let me think...', 'One second...', "I've got an idea."],
  funny: ['One second. Connecting the dots.', 'Let me think before I sound too confident.'],
  professional: ['One second.', 'Looking through the context.', 'Let me think.'],
};

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

function clean(input: string): string {
  return input.trim().toLowerCase().replace(/[.!?]+$/g, '').replace(/\s+/g, ' ');
}

function fillName(text: string, name?: string): string {
  return text.replace('{name}', name ? name : 'there');
}

function titleCase(value: string): string {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function styleFromPersonality(personality?: string): ConversationStyle {
  const normalized = personality?.toLowerCase();
  if (normalized === 'professional') return 'professional';
  if (normalized === 'funny') return 'funny';
  if (normalized === 'mentor' || normalized === 'calm') return 'formal';
  return 'warm';
}

function isGreeting(value: string): boolean {
  return /^(hi|hey|hello|helo|good morning|good afternoon|good evening|gm|namaste|hii+)$/.test(value);
}

function isThanks(value: string): boolean {
  return /^(thanks|thank you|thx|ty|thankyou|appreciate it)$/.test(value);
}

function isFarewell(value: string): boolean {
  return /^(bye|goodbye|good night|gn|see you|see ya|talk later|exit|stop)$/.test(value);
}

function isWellbeing(value: string): boolean {
  return /^(how are you|how r u|how are u|kaisi ho|what's up|whats up)$/.test(value);
}

function isAcknowledgement(value: string): boolean {
  return /^(ok|okay|k|alright|fine|cool|done|yes|yeah|yep|sure)$/.test(value);
}

function likelyLongResponse(value: string): boolean {
  return /\b(explain|teach|compare|plan|roadmap|strategy|why|how|build|design|debug|review|summarize|prepare)\b/i.test(value)
    || value.trim().split(/\s+/).length >= 12;
}

class NaturalConversationEngineImpl {
  async resolveStyle(): Promise<{ style: ConversationStyle; name?: string }> {
    const profile = await OnboardingService.getProfile().catch(() => null);
    return {
      style: styleFromPersonality(profile?.personality),
      name: profile?.nickname || profile?.name,
    };
  }

  async detectSmallTalk(input: string): Promise<NaturalConversationResult | null> {
    const normalized = clean(input);
    const { style, name } = await this.resolveStyle();
    const contextLine = await this.contextCallback(input);
    const seed = `${normalized}:${style}:${name ?? ''}`;

    if (isGreeting(normalized)) {
      const greeting = fillName(pick(GREETINGS[style], seed), name);
      return { handled: true, reason: 'greeting', reply: contextLine ? `${greeting} ${contextLine}` : greeting };
    }
    if (isThanks(normalized)) {
      return { handled: true, reason: 'thanks', reply: pick(THANKS[style], seed) };
    }
    if (isFarewell(normalized)) {
      return { handled: true, reason: 'farewell', reply: pick(FAREWELLS[style], seed) };
    }
    if (isWellbeing(normalized)) {
      return { handled: true, reason: 'wellbeing', reply: pick(WELLBEING[style], seed) };
    }
    if (isAcknowledgement(normalized)) {
      return { handled: true, reason: 'acknowledgement', reply: pick(ACKS[style], seed) };
    }
    return null;
  }

  async thinkingFiller(input: string): Promise<string | null> {
    if (!likelyLongResponse(input)) return null;
    const { style } = await this.resolveStyle();
    return pick(THINKING[style], input);
  }

  async endingPrompt(seed: string): Promise<string> {
    const { style } = await this.resolveStyle();
    const options = style === 'professional'
      ? ['Need help with anything else?', 'Want to continue?']
      : ['Want to continue?', 'I am here whenever you need.', 'Need help with something else?'];
    return pick(options, seed);
  }

  async contextCallback(seed: string): Promise<string | null> {
    const context: ContextObject | null = await ContextEngine.getCurrentContext().catch(() => null);
    if (!context) return null;

    if (context.task && context.task.confidence > 0.78) {
      return `We were on ${context.task.label.toLowerCase()}.`;
    }

    const relationship = context.relationships.find((item) => item.confidence > 0.78 && (item.name || item.relationship !== 'unknown'));
    if (relationship) {
      return relationship.name
        ? `You mentioned ${relationship.name} before.`
        : `You mentioned your ${titleCase(relationship.relationship).toLowerCase()} before.`;
    }

    const reference = context.resolvedReferences.find((item) => item.confidence > 0.78);
    if (reference) {
      return `Last time we were talking about ${reference.resolvedTo}.`;
    }

    return seed.length > 0 ? null : null;
  }
}

export const NaturalConversationEngine = new NaturalConversationEngineImpl();
