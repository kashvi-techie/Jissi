/**
 * Provider-agnostic LLM abstraction.
 *
 * Swapping the AI backend = providing a different `AIProvider` implementation and
 * returning it from the factory in AIService. AIService's public API and the rest
 * of the app (hooks, conversation flow, UI) are unaffected.
 *
 * Tool-calling is expressed here in provider-neutral terms so AIService never
 * touches a vendor wire format. A provider opts in by implementing `chat()`.
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  /** For role 'tool': the id of the tool call this responds to. */
  toolCallId?: string;
  /** For an assistant message that requested tools. */
  toolCalls?: ProviderToolCall[];
  /** Optional tool/function name (role 'tool'). */
  name?: string;
}

export interface ProviderGenerateConfig {
  /** Provider-specific model id. If omitted, the provider uses its own default. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

/** OpenAI/OpenRouter-compatible tool (function) schema. */
export interface ToolSchema {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>; // JSON Schema
  };
}

/** A tool the model decided to call, with parsed arguments. */
export interface ProviderToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

/** Result of a tool-capable chat turn: a final answer and/or tool calls. */
export interface ProviderChatResult {
  text: string;
  toolCalls?: ProviderToolCall[];
}

export interface AIProvider {
  /** Human-readable provider id (e.g. 'openrouter'). */
  readonly name: string;
  /**
   * Plain completion. On HTTP failure, throw an `Error` with a numeric `status`
   * so AIService's retry/classification stays provider-agnostic.
   */
  generate(messages: ProviderMessage[], config: ProviderGenerateConfig): Promise<string>;
  /**
   * OPTIONAL tool-calling chat. Providers that support function-calling implement
   * this; AIService feature-detects it. Same error contract as `generate`.
   */
  chat?(
    messages: ProviderMessage[],
    config: ProviderGenerateConfig,
    tools?: ToolSchema[]
  ): Promise<ProviderChatResult>;
}
