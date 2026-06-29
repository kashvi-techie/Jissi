import type { ProviderToolCall, ProviderMessage, ToolSchema } from '@/services/ai/providers/types';

export type { ProviderToolCall, ProviderMessage, ToolSchema };

/** Result returned by every tool. */
export interface ToolResult {
  success: boolean;
  /** Natural-language summary fed back to the LLM (and potentially spoken). */
  humanReadable: string;
  /** Structured payload (for UI cards, chaining, caching). */
  data?: unknown;
  metadata?: Record<string, unknown>;
  /** Whether the result may be cached. */
  cacheable?: boolean;
  /** Cache time-to-live in seconds (when cacheable). */
  ttl?: number;
  error?: string;
  /** Filled in by the ToolRouter (ms). */
  executionTime?: number;
}

/** Runtime context passed to tools (platform gating, cancellation). */
export interface ToolContext {
  platform: string;
  signal?: AbortSignal;
}

/** Minimal JSON-Schema-ish parameter descriptor (OpenAI function params). */
export interface ToolParametersSchema {
  type: 'object';
  properties: Record<string, { type: string; description?: string; enum?: string[] }>;
  required?: string[];
}

/** An independent capability. Implement this to add a tool — nothing else changes. */
export interface Tool {
  name: string;
  /** The LLM reads this to decide WHEN to call the tool — write it well. */
  description: string;
  parameters: ToolParametersSchema;
  /** Platform / permission / config gate. Unavailable tools are never shown to the LLM. */
  isAvailable(ctx: ToolContext): boolean | Promise<boolean>;
  execute(args: Record<string, unknown>, ctx: ToolContext): Promise<ToolResult>;
  /** Destructive tools (send email, delete file) should require explicit confirmation. */
  requiresConfirmation?: boolean;
}

/** Structured record of one tool execution (for logging/telemetry). */
export interface ToolExecutionLog {
  tool: string;
  args: Record<string, unknown>;
  success: boolean;
  latencyMs: number;
  result?: unknown;
  error?: string;
  at: number;
}

/**
 * A pluggable bundle of tools. Built-ins are installed via register.ts; in future
 * these can come from installable/remote (MCP-style) plugins — the registry treats
 * them identically.
 */
export interface ToolPlugin {
  id: string;
  tools: Tool[];
}
