import { AIProvider, ProviderMessage, ProviderGenerateConfig } from './types';

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

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
    const res = await fetch(OPENROUTER_URL, {
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

    if (!res.ok) {
      let body = '';
      try {
        body = await res.text();
      } catch {
        /* ignore body read failure */
      }
      const err = new Error(`OpenRouter ${res.status}: ${body.slice(0, 600)}`) as Error & { status?: number };
      err.status = res.status;
      throw err;
    }

    const data: any = await res.json();
    return data?.choices?.[0]?.message?.content ?? '';
  }
}
