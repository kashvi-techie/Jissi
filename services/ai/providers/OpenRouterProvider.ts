import {
  AIProvider,
  ProviderMessage,
  ProviderGenerateConfig,
  ProviderChatResult,
  ProviderToolCall,
  ToolSchema,
} from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

/** Serialize our neutral messages into OpenAI/OpenRouter wire format. */
function toWireMessages(messages: ProviderMessage[]): Record<string, unknown>[] {
  return messages.map((m) => {
    if (m.role === 'tool') {
      return { role: 'tool', tool_call_id: m.toolCallId, content: m.content };
    }
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: m.content || null,
        tool_calls: m.toolCalls.map((c) => ({
          id: c.id,
          type: 'function',
          function: { name: c.name, arguments: JSON.stringify(c.arguments ?? {}) },
        })),
      };
    }
    return { role: m.role, content: m.content };
  });
}

function safeParseArgs(raw: unknown): Record<string, unknown> {
  if (typeof raw !== 'string') return (raw as Record<string, unknown>) ?? {};
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Default model — a capable FREE model so the app works without billing.
 * Override with EXPO_PUBLIC_OPENROUTER_MODEL (e.g. a paid model id).
 */
export const DEFAULT_OPENROUTER_MODEL =
  process.env.EXPO_PUBLIC_OPENROUTER_MODEL?.trim() || 'meta-llama/llama-3.3-70b-instruct:free';

/**
 * OpenRouter backend (OpenAI-compatible Chat Completions). Stateless: the full
 * message history is sent on every call. Uses global `fetch` only, so it works in
 * React Native / Expo without any extra native dependency.
 */
export class OpenRouterProvider implements AIProvider {
  readonly name = 'openrouter';
  private readonly apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async generate(messages: ProviderMessage[], config: ProviderGenerateConfig): Promise<string> {
    // [NETDBG] TEMPORARY network instrumentation — logging only; logic unchanged,
    // the original error is re-thrown so AIService's retry loop behaves identically.
    const url = OPENROUTER_URL;
    const model = config.model || DEFAULT_OPENROUTER_MODEL;
    const t0 = Date.now();
    let phase = 'before-fetch';
    console.log('[NETDBG] → request URL =', url);
    console.log('[NETDBG] → model =', model);
    console.log('[NETDBG] → body (no key) =', JSON.stringify({ model, messageCount: messages.length, max_tokens: config.maxTokens ?? 1024, temperature: config.temperature ?? 0.7 }));
    try {
      phase = 'during-fetch';
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          // Optional attribution headers recommended by OpenRouter.
          'HTTP-Referer': 'https://jissi.app',
          'X-Title': 'JISSI',
        },
        body: JSON.stringify({
          model: config.model || DEFAULT_OPENROUTER_MODEL,
          messages,
          max_tokens: config.maxTokens ?? 1024,
          temperature: config.temperature ?? 0.7,
        }),
      });
      phase = 'after-fetch';
      console.log('[NETDBG] HTTP status =', res.status, '| elapsedMs =', Date.now() - t0);

      if (!res.ok) {
        let body = '';
        try {
          body = await res.text();
        } catch {
          /* ignore body read failure */
        }
        console.error('[NETDBG] non-200 response body =', body.slice(0, 600));
        const err = new Error(`OpenRouter ${res.status}: ${body.slice(0, 600)}`) as Error & { status?: number };
        err.status = res.status;
        throw err;
      }

      phase = 'parsing-response';
      const data: any = await res.json();
      phase = 'after-parse';
      console.log('[NETDBG] ✔ success — elapsedMs =', Date.now() - t0);
      return data?.choices?.[0]?.message?.content ?? '';
    } catch (e) {
      console.error('[NETDBG] ❌ FAILURE phase =', phase);
      console.error('[NETDBG] exception =', e instanceof Error ? e.message : String(e));
      console.error('[NETDBG] stack =', e instanceof Error ? e.stack : '(no stack)');
      console.error('[NETDBG] elapsedMs =', Date.now() - t0);
      throw e; // re-throw unchanged
    }
  }

  async chat(
    messages: ProviderMessage[],
    config: ProviderGenerateConfig,
    tools?: ToolSchema[]
  ): Promise<ProviderChatResult> {
    const body: Record<string, unknown> = {
      model: config.model || DEFAULT_OPENROUTER_MODEL,
      messages: toWireMessages(messages),
      max_tokens: config.maxTokens ?? 1024,
      temperature: config.temperature ?? 0.7,
    };
    if (tools && tools.length > 0) {
      body.tools = tools;
      body.tool_choice = 'auto';
    }

    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://jissi.app',
        'X-Title': 'JISSI',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let b = '';
      try {
        b = await res.text();
      } catch {
        /* ignore */
      }
      const err = new Error(`OpenRouter ${res.status}: ${b.slice(0, 600)}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const data: any = await res.json();
    const message = data?.choices?.[0]?.message;
    const rawCalls = message?.tool_calls;
    if (Array.isArray(rawCalls) && rawCalls.length > 0) {
      const toolCalls: ProviderToolCall[] = rawCalls.map((tc: any) => ({
        id: tc?.id ?? `call_${Math.random().toString(36).slice(2, 9)}`,
        name: tc?.function?.name ?? '',
        arguments: safeParseArgs(tc?.function?.arguments),
      }));
      return { text: message?.content ?? '', toolCalls };
    }
    return { text: message?.content ?? '' };
  }
}
