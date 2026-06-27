/**
 * Provider-agnostic LLM abstraction.
 *
 * Swapping the AI backend = providing a different `AIProvider` implementation and
 * returning it from the factory in AIService. AIService's public API and the rest
 * of the app (hooks, conversation flow, UI) are unaffected. Restoring Gemini later
 * means adding a `GeminiProvider` that implements this interface — nothing else.
 */
export interface ProviderMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ProviderGenerateConfig {
  /** Provider-specific model id. If omitted, the provider uses its own default. */
  model?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface AIProvider {
  /** Human-readable provider id (e.g. 'openrouter'). */
  readonly name: string;
  /**
   * Send the full message history and return the assistant's reply text.
   *
   * On an HTTP failure the implementation MUST throw an `Error` carrying a
   * numeric `status` property, so AIService's retry/classification stays
   * provider-agnostic.
   */
  generate(messages: ProviderMessage[], config: ProviderGenerateConfig): Promise<string>;
}
