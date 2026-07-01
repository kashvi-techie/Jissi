import {
  AIMessage,
  AIServiceConfig,
  AIGenerationOptions,
  AIGenerationResult,
  DEFAULT_SYSTEM_PROMPT,
} from './types';
import { Platform } from 'react-native';
import {
  AIProvider,
  ProviderMessage,
  ProviderChatResult,
  ProviderToolCall,
  ToolSchema,
} from './providers/types';
import { OpenRouterProvider } from './providers/OpenRouterProvider';

/**
 * Generic tool bridge. AIService stays TOOL-AGNOSTIC: it knows only this contract,
 * never a concrete tool. The tool system (registry + router) is injected via
 * configureTools() at app init (services/tools/register.ts).
 */
export interface AIToolBridge {
  getSchemas(ctx: { platform: string }): Promise<ToolSchema[]>;
  execute(calls: ProviderToolCall[], ctx: { platform: string }): Promise<ProviderMessage[]>;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Pull a server-suggested retry delay (e.g. RetryInfo "retryDelay":"27s") if present. */
function parseRetryDelayMs(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const m = msg.match(/retry(?:delay)?["':\s]+(\d+(?:\.\d+)?)s/i);
  return m ? Math.round(parseFloat(m[1]) * 1000) : null;
}

export type ProviderErrorKind =
  | 'rpm'
  | 'rpd'
  | 'quota'
  | 'billing'
  | 'apikey'
  | 'transient'
  | 'network'
  | 'other';

export interface ProviderErrorInfo {
  kind: ProviderErrorKind;
  status?: number;
  retryDelayMs: number | null;
  /** Whether re-sending the SAME request could plausibly succeed soon. */
  retryable: boolean;
  detail: string;
}

/**
 * Inspect an LLM/network failure and classify it. Provider-agnostic: it keys off
 * the HTTP status carried on the thrown error plus message keywords, so it works
 * for any backend (OpenRouter today, others later).
 */
function classifyProviderError(error: unknown): ProviderErrorInfo {
  const anyErr = error as any;
  const status: number | undefined = anyErr?.status ?? anyErr?.response?.status;
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const detailsStr = safeStringify(anyErr?.errorDetails ?? '');
  const hay = `${msg} ${detailsStr}`;
  const retryDelayMs = parseRetryDelayMs(error);

  if (
    status === 401 ||
    status === 403 ||
    /api[_\s-]?key not valid|api key|unauthorized|permission denied|forbidden|no auth/i.test(hay)
  ) {
    return { kind: 'apikey', status, retryDelayMs, retryable: false, detail: 'API key invalid or restricted' };
  }
  if (status === 402 || /enable billing|free tier|billing|insufficient|credits|payment required|FAILED_PRECONDITION/i.test(hay)) {
    return { kind: 'billing', status, retryDelayMs, retryable: false, detail: 'Billing / credits required' };
  }
  if (status === 429 || /\b429\b|too many requests|resource has been exhausted|rate.?limit|quota/i.test(hay)) {
    if (/per\s*day|PerDay|RequestsPerDay/i.test(hay)) {
      return { kind: 'rpd', status: 429, retryDelayMs, retryable: false, detail: 'Daily request quota (RPD) exhausted' };
    }
    if (/per\s*minute|PerMinute|RequestsPerMinute/i.test(hay)) {
      return { kind: 'rpm', status: 429, retryDelayMs, retryable: true, detail: 'Per-minute rate limit (RPM)' };
    }
    // Unspecified rate limit: retry once (helps free-tier per-minute throttling).
    return { kind: 'quota', status: 429, retryDelayMs, retryable: true, detail: 'Rate limit / quota' };
  }
  if (status === 503 || status === 502 || /overloaded|unavailable|try again/i.test(hay)) {
    return { kind: 'transient', status, retryDelayMs, retryable: true, detail: 'Service overloaded / temporarily unavailable' };
  }
  if (/network|failed to fetch|timeout|timed out|enotfound|etimedout|offline|econn/i.test(hay)) {
    return { kind: 'network', status, retryDelayMs, retryable: true, detail: 'Network error' };
  }
  return { kind: 'other', status, retryDelayMs, retryable: false, detail: msg.slice(0, 200) };
}

/** Calm, user-facing sentence per error kind (never "I apologize…"). */
function friendlyMessageForKind(kind: ProviderErrorKind): string {
  switch (kind) {
    case 'rpd':
      return "I've reached today's limit for the AI service. Please try again later.";
    case 'rpm':
    case 'quota':
      return "I'm getting a lot of requests right now. Please wait a few seconds and try again.";
    case 'billing':
      return 'The AI service plan limit was reached. Please check the billing/credits settings.';
    case 'apikey':
      return "My AI connection isn't set up correctly. Please check the API key.";
    case 'network':
      return "I'm having trouble reaching the network. Please check your connection and try again.";
    case 'transient':
      return 'My AI service is busy at the moment. Please try again in a few seconds.';
    default:
      return 'Something went wrong on my side. Please try again in a moment.';
  }
}

// TEMP (Phase 2.3): monotonic id for each generate() call so logs can prove how
// many real network requests one user message produces.
let aiRequestCounter = 0;

/**
 * Provider factory — the ONLY place that knows which backend is active.
 * To add another backend later: implement AIProvider and return it here. Nothing
 * else in the app changes.
 */
// [NETDBG] TEMPORARY: mask a secret for safe logging. Remove with the NETDBG logs.
function maskKey(k?: string): string {
  if (!k) return 'UNDEFINED/EMPTY';
  return k.length <= 12 ? `***(len ${k.length})` : `${k.slice(0, 7)}********${k.slice(-4)} (len ${k.length})`;
}

function createProvider(): AIProvider | null {
  const openRouterKey = process.env.EXPO_PUBLIC_OPENROUTER_API_KEY?.trim();
  console.log('[EVIDENCE] OpenRouter key exists =', !!openRouterKey);
  console.log('[AI] createProvider — OpenRouter key present =', !!openRouterKey);
  console.log('[NETDBG] OpenRouter key =', maskKey(openRouterKey));
  const provider = openRouterKey ? new OpenRouterProvider(openRouterKey) : null;
  console.log('[NETDBG] provider created =', !!provider);
  return provider;
}

class AIServiceImpl {
  private provider: AIProvider | null = null;
  private config: AIServiceConfig | null = null;
  private conversationHistory: AIMessage[] = [];
  private toolBridge: AIToolBridge | null = null;
  // Tools are OFF by default → current chat behaviour is byte-for-byte preserved.
  // Set EXPO_PUBLIC_TOOLS_ENABLED=true (with a tool-capable model) to activate.
  private toolsEnabled = process.env.EXPO_PUBLIC_TOOLS_ENABLED === 'true';

  /** Inject the tool system without coupling AIService to any concrete tool. */
  configureTools(bridge: AIToolBridge): void {
    this.toolBridge = bridge;
  }

  /**
   * Initialize the AI service. Depends ONLY on OpenRouter — the active provider
   * reads EXPO_PUBLIC_OPENROUTER_API_KEY itself. Safe to call with no config.
   */
  initialize(config?: AIServiceConfig): void {
    console.log('[EVIDENCE] initialize() entered');
    console.log('[NETDBG] AIService.initialize() entered');
    this.config = config ?? null;
    this.conversationHistory = [];
    this.provider = createProvider();
    console.log('[EVIDENCE] provider/dependency created =', this.provider !== null);
    console.log(
      '[AI] initialize — provider =',
      this.provider ? this.provider.name : 'null',
      '| isInitialized =',
      this.isInitialized()
    );
    if (!this.provider) {
      console.warn(
        '[AI] No EXPO_PUBLIC_OPENROUTER_API_KEY set — AI replies disabled. ' +
          'Add an OpenRouter key (sk-or-…) to .env and restart Metro.'
      );
    }
    console.log('[EVIDENCE] initialize() returned | isInitialized =', this.isInitialized());
  }

  startNewChat(): void {
    // Stateless (OpenAI-compatible) providers carry no server-side session, so a
    // "new chat" is simply a cleared local history.
    this.conversationHistory = [];
  }

  addMessage(role: 'user' | 'assistant', content: string): AIMessage {
    const message: AIMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(message);
    return message;
  }

  getConversationHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  /** Build the provider payload: system prompt + the running conversation. */
  private buildMessages(): ProviderMessage[] {
    const system = this.config?.systemPrompt || DEFAULT_SYSTEM_PROMPT;
    const messages: ProviderMessage[] = [{ role: 'system', content: system }];
    for (const m of this.conversationHistory) {
      messages.push({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: m.content,
      });
    }
    return messages;
  }

  async generate(prompt: string, options?: AIGenerationOptions): Promise<AIGenerationResult> {
    console.log('[NETDBG] AIService.generate() entered');
    if (!this.provider) {
      console.error('[NETDBG] ❌ generate() aborted — provider is null (not initialized)');
      throw new Error('AIService not initialized (no AI provider configured).');
    }

    this.addMessage('user', prompt);

    const reqId = ++aiRequestCounter;
    const t0 = Date.now();
    console.log(
      `[REQDBG] generate() CALLED reqId=${reqId} ts=${t0} provider=${this.provider.name} promptLen=${prompt.length}`
    );

    const messages = this.buildMessages();
    const genConfig = {
      model: this.config?.model,
      maxTokens: this.config?.maxTokens ?? 1024,
      temperature: this.config?.temperature ?? 0.7,
    };

    // Tool-calling path (opt-in via flag + feature-detected via provider.chat).
    // Falls back to plain chat if the model rejects tools, so it's backward-safe.
    if (this.toolsEnabled && this.toolBridge && this.provider.chat) {
      return this.generateWithTools(messages, genConfig, reqId, t0);
    }

    // Retry ONLY genuinely transient failures (rate-limit / 5xx / network). The
    // user message is added once above, so a retry never re-sends or duplicates it.
    const MAX_RETRIES = 2;
    let lastError: unknown = null;
    let sends = 0;

    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        sends++;
        console.log(`[REQDBG] → ${this.provider.name} generate reqId=${reqId} attempt=${attempt + 1} send#=${sends} ts=${Date.now()}`);
        const text = await this.provider.generate(messages, genConfig);
        console.log(
          `[REQDBG] generate() FINISHED reqId=${reqId} ok=true sends=${sends} elapsedMs=${Date.now() - t0} textLen=${text ? text.length : 0}`
        );
        this.addMessage('assistant', text);
        return {
          text,
          finishReason: 'stop',
          usage: { promptTokens: 0, completionTokens: 0, totalTokens: 0 },
        };
      } catch (error) {
        lastError = error;
        const info = classifyProviderError(error);
        console.log(
          `[REQDBG] AI ERROR reqId=${reqId} attempt=${attempt + 1} kind=${info.kind} status=${info.status ?? '?'} retryable=${info.retryable} detail="${info.detail}" ts=${Date.now()}`
        );
        console.log('[REQDBG] AI raw error:', safeStringify(error instanceof Error ? error.message : error));
        if (attempt < MAX_RETRIES && info.retryable) {
          const delay =
            info.retryDelayMs ?? Math.min(8000, 700 * Math.pow(2, attempt)) + Math.floor(Math.random() * 250);
          console.log(`[REQDBG] retrying reqId=${reqId} in ${delay}ms (kind=${info.kind})`);
          await sleep(delay);
          continue;
        }
        break;
      }
    }

    const info = classifyProviderError(lastError);
    const message = friendlyMessageForKind(info.kind);
    console.log(
      `[REQDBG] generate() FINISHED reqId=${reqId} ok=false sends=${sends} kind=${info.kind} elapsedMs=${Date.now() - t0}`
    );
    this.addMessage('assistant', message);
    return { text: message, finishReason: 'error' };
  }

  /**
   * Tool-calling loop. The model may request one or more tools per turn (executed
   * in parallel by the bridge); results are fed back until it produces a final
   * answer. Stays generic — no tool-specific logic lives here.
   */
  private async generateWithTools(
    messages: ProviderMessage[],
    genConfig: { model?: string; maxTokens?: number; temperature?: number },
    reqId: number,
    t0: number
  ): Promise<AIGenerationResult> {
    const provider = this.provider!;
    const bridge = this.toolBridge!;
    const ctx = { platform: Platform.OS };

    let schemas: ToolSchema[] = [];
    try {
      schemas = await bridge.getSchemas(ctx);
    } catch {
      schemas = [];
    }

    const MAX_HOPS = 3;
    const convo: ProviderMessage[] = [...messages];

    for (let hop = 0; hop <= MAX_HOPS; hop++) {
      let res: ProviderChatResult;
      try {
        res = await provider.chat!(convo, genConfig, schemas);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        // The model may not support tools → fall back to plain chat (backward-safe).
        if (/tool|function|\b400\b/i.test(msg)) {
          console.log(`[REQDBG] tools unsupported reqId=${reqId} — falling back to plain chat`);
          try {
            const text = await provider.generate(messages, genConfig);
            this.addMessage('assistant', text);
            return { text, finishReason: 'stop' };
          } catch {
            /* fall through to classification below */
          }
        }
        const info = classifyProviderError(error);
        const friendly = friendlyMessageForKind(info.kind);
        this.addMessage('assistant', friendly);
        return { text: friendly, finishReason: 'error' };
      }

      if (res.toolCalls && res.toolCalls.length > 0) {
        console.log(`[REQDBG] tool hop=${hop} reqId=${reqId} calls=${res.toolCalls.map((c) => c.name).join(',')}`);
        convo.push({ role: 'assistant', content: res.text ?? '', toolCalls: res.toolCalls });
        let toolMsgs: ProviderMessage[] = [];
        try {
          toolMsgs = await bridge.execute(res.toolCalls, ctx);
        } catch (e) {
          console.log('[REQDBG] tool execution error:', e instanceof Error ? e.message : e);
        }
        convo.push(...toolMsgs);
        continue;
      }

      const text = res.text ?? '';
      console.log(`[REQDBG] generate() FINISHED (tools) reqId=${reqId} elapsedMs=${Date.now() - t0}`);
      this.addMessage('assistant', text);
      return { text, finishReason: 'stop' };
    }

    const exhausted = "I wasn't able to finish that — please try again.";
    this.addMessage('assistant', exhausted);
    return { text: exhausted, finishReason: 'error' };
  }

  async generateStream(prompt: string, options?: AIGenerationOptions): Promise<ReadableStream<string>> {
    // Streaming over RN fetch is unreliable; emit the full reply as a single
    // chunk to preserve the public API. (Not used by the current app.)
    const result = await this.generate(prompt, options);
    return new ReadableStream<string>({
      start(controller) {
        controller.enqueue(result.text);
        controller.close();
      },
    });
  }

  isInitialized(): boolean {
    return this.provider !== null;
  }

  getTokenCount(): number {
    return this.conversationHistory.length;
  }

  getConfig(): AIServiceConfig | null {
    return this.config;
  }
}

export const AIService = new AIServiceImpl();
