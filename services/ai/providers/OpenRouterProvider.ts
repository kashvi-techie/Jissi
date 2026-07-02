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
 * Read a non-2xx response body exactly once and return it, so the caller can
 * build its error message / parse a Retry-After without re-reading the
 * (already consumed) stream.
 */
async function dumpNon200(res: Response, _requestBody: Record<string, unknown>): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '(failed to read response body)';
  }
}

/**
 * Ordered list of capable FREE models. The provider walks this list on every
 * request and uses the first one that answers — so a single model being
 * rate-limited upstream (HTTP 429) no longer takes the whole app down.
 * Reorder / extend freely; index 0 is always tried first.
 */
const FALLBACK_MODELS = [
  // Verified live on OpenRouter's free tier (tested with tool-calling payload).
  // OpenRouter retires free slugs without notice — if these start returning 404
  // ("unavailable for free"), re-test and refresh this list.
  'openai/gpt-oss-20b:free',
  'nvidia/nemotron-nano-9b-v2:free',
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.2-3b-instruct:free',
];

/** Optional single-model override (e.g. a paid model id). Tried before the list. */
const ENV_MODEL_OVERRIDE = process.env.EXPO_PUBLIC_OPENROUTER_MODEL?.trim() || null;

/** Backward-compatible export: the model tried first by default. */
export const DEFAULT_OPENROUTER_MODEL = ENV_MODEL_OVERRIDE ?? FALLBACK_MODELS[0];

/** initial attempt + exactly one retry after a fully rate-limited pass. */
const MAX_PASSES = 2;
/** Fallback wait when the server gives no Retry-After hint. */
const DEFAULT_RETRY_WAIT_SECONDS = 5;

/** Error thrown by a single model request, carrying HTTP status + retry hint. */
interface ProviderRequestError extends Error {
  status?: number;
  retryAfterSeconds?: number | null;
}

type FailureKind = 'auth' | 'rate-limit' | 'retryable';

/**
 * Classify a single-request failure so the model manager knows what to do:
 *  - 'auth'       → invalid API key (401): no model can succeed, fail fast.
 *  - 'rate-limit' → 429: try the next model, remember the Retry-After hint.
 *  - 'retryable'  → network error / timeout / 5xx / provider unavailable /
 *                   model-specific 4xx: try the next model.
 */
function classifyRequestError(error: unknown): {
  kind: FailureKind;
  status?: number;
  retryAfterSeconds: number | null;
} {
  const status = (error as ProviderRequestError | undefined)?.status;
  const retryAfterSeconds = (error as ProviderRequestError | undefined)?.retryAfterSeconds ?? null;
  if (status === 401) return { kind: 'auth', status, retryAfterSeconds };
  if (status === 429) return { kind: 'rate-limit', status, retryAfterSeconds };
  return { kind: 'retryable', status, retryAfterSeconds };
}

/** Read a Retry-After hint from the response header or the JSON error body. */
function parseRetryAfterSeconds(res: Response, rawBody: string): number | null {
  const header = res.headers.get('retry-after');
  if (header) {
    const asNumber = Number(header);
    if (Number.isFinite(asNumber)) return Math.max(0, Math.ceil(asNumber));
    const asDate = Date.parse(header);
    if (!Number.isNaN(asDate)) return Math.max(0, Math.ceil((asDate - Date.now()) / 1000));
  }
  // OpenRouter commonly embeds e.g. "retry_after_seconds: 26" in the body text.
  const match = rawBody.match(/retry_?after_?(?:seconds)?["\s:]*?(\d+)/i);
  if (match) return Number(match[1]);
  return null;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  /**
   * Build the ordered model chain for one call: an explicit per-call model and the
   * env override are tried first (if set), then the FALLBACK_MODELS, de-duplicated.
   */
  private resolveModelChain(config: ProviderGenerateConfig): string[] {
    const preferred = [config.model, ENV_MODEL_OVERRIDE].filter(
      (m): m is string => typeof m === 'string' && m.trim().length > 0
    );
    const chain: string[] = [];
    for (const model of [...preferred, ...FALLBACK_MODELS]) {
      if (!chain.includes(model)) chain.push(model);
    }
    return chain;
  }

  /**
   * Single request to ONE model. Returns the parsed JSON on success, or throws a
   * ProviderRequestError (status + Retry-After) on any non-2xx. This is the one
   * place that talks to the network — both chat() and generate() go through it.
   */
  private async executeRequest(
    model: string,
    messages: ProviderMessage[],
    config: ProviderGenerateConfig,
    tools?: ToolSchema[]
  ): Promise<any> {
    const body: Record<string, unknown> = {
      model,
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
      const rawBody = await dumpNon200(res, body);
      const error: ProviderRequestError = new Error(
        `OpenRouter ${res.status}: ${rawBody.slice(0, 600)}`
      );
      error.status = res.status;
      error.retryAfterSeconds = parseRetryAfterSeconds(res, rawBody);
      throw error;
    }

    return res.json();
  }

  /**
   * Model manager: walk the model chain and return the first success. On 401 it
   * aborts immediately; on 429 / transient failures it advances to the next model.
   * If (and only if) every model was rate-limited, it waits Retry-After (or a
   * default) and retries the whole chain exactly ONCE. No infinite loops.
   */
  private async runWithFallback(
    config: ProviderGenerateConfig,
    request: (model: string) => Promise<any>
  ): Promise<any> {
    const models = this.resolveModelChain(config);

    for (let pass = 0; pass < MAX_PASSES; pass++) {
      let everyModelRateLimited = true;
      let lastRetryAfter: number | null = null;

      for (const model of models) {
        console.log('[MODEL MANAGER] Trying model:', model);
        try {
          const data = await request(model);
          console.log('[MODEL MANAGER] Model succeeded:', model);
          return data;
        } catch (error) {
          const failure = classifyRequestError(error);

          if (failure.kind === 'auth') {
            // Invalid API key — no other model can succeed. Fail fast.
            console.log('[MODEL MANAGER] Model failed (authentication 401) — aborting fallback.');
            throw error;
          }

          console.log(
            '[MODEL MANAGER] Model failed:',
            model,
            `(${failure.kind}${failure.status ? ' ' + failure.status : ''})`
          );

          if (failure.kind === 'rate-limit') {
            if (failure.retryAfterSeconds != null) lastRetryAfter = failure.retryAfterSeconds;
          } else {
            everyModelRateLimited = false;
          }

          console.log('[MODEL MANAGER] Trying next model...');
        }
      }

      // Whole chain failed this pass. Only retry when EVERY model was rate-limited,
      // and only for the single extra pass allowed by MAX_PASSES.
      const isLastPass = pass === MAX_PASSES - 1;
      if (isLastPass || !everyModelRateLimited) break;

      const waitSeconds = lastRetryAfter ?? DEFAULT_RETRY_WAIT_SECONDS;
      console.log(`[MODEL MANAGER] All models rate-limited. Waiting ${waitSeconds}s, then retrying once...`);
      await sleep(waitSeconds * 1000);
    }

    throw new Error('All AI providers are temporarily unavailable.');
  }

  async generate(messages: ProviderMessage[], config: ProviderGenerateConfig): Promise<string> {
    const data = await this.runWithFallback(config, (model) =>
      this.executeRequest(model, messages, config)
    );
    return data?.choices?.[0]?.message?.content ?? '';
  }

  async chat(
    messages: ProviderMessage[],
    config: ProviderGenerateConfig,
    tools?: ToolSchema[]
  ): Promise<ProviderChatResult> {
    const data = await this.runWithFallback(config, (model) =>
      this.executeRequest(model, messages, config, tools)
    );

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
