import { ProviderMessage, ProviderToolCall, ToolContext, ToolResult } from './types';
import { ToolRegistry } from './ToolRegistry';
import { logToolExecution } from './logger';

function safe(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Basic required-argument validation against the tool's schema. */
function validateArgs(required: string[] | undefined, args: Record<string, unknown>): string | null {
  for (const key of required ?? []) {
    if (args[key] === undefined || args[key] === null || args[key] === '') {
      return `Missing required argument: "${key}"`;
    }
  }
  return null;
}

/**
 * Executes tool calls coming from the LLM: validates args, runs the tool, times
 * it, logs it, and normalizes failures into a ToolResult the model can recover
 * from. Multiple calls in one turn run in PARALLEL (#5).
 */
class ToolRouterImpl {
  async executeOne(
    name: string,
    args: Record<string, unknown>,
    ctx: ToolContext
  ): Promise<ToolResult> {
    const start = Date.now();
    const tool = ToolRegistry.get(name);

    if (!tool) {
      logToolExecution({ tool: name, args, success: false, latencyMs: 0, error: 'unknown_tool', at: start });
      return { success: false, humanReadable: `Unknown tool: ${name}`, error: 'unknown_tool', executionTime: 0 };
    }

    const validationError = validateArgs(tool.parameters.required, args);
    if (validationError) {
      const executionTime = Date.now() - start;
      logToolExecution({ tool: name, args, success: false, latencyMs: executionTime, error: validationError, at: start });
      return { success: false, humanReadable: validationError, error: 'invalid_args', executionTime };
    }

    try {
      const result = await tool.execute(args, ctx);
      const executionTime = Date.now() - start;
      logToolExecution({
        tool: name,
        args,
        success: result.success,
        latencyMs: executionTime,
        result: result.data,
        error: result.error,
        at: start,
      });
      return { ...result, executionTime };
    } catch (e) {
      const executionTime = Date.now() - start;
      const error = e instanceof Error ? e.message : String(e);
      logToolExecution({ tool: name, args, success: false, latencyMs: executionTime, error, at: start });
      return { success: false, humanReadable: `The "${name}" tool failed: ${error}`, error, executionTime };
    }
  }

  /** Run all of an LLM turn's tool calls in parallel; return tool-role messages. */
  async executeMany(calls: ProviderToolCall[], ctx: ToolContext): Promise<ProviderMessage[]> {
    const results = await Promise.all(calls.map((c) => this.executeOne(c.name, c.arguments ?? {}, ctx)));
    return calls.map((call, i) => {
      const r = results[i];
      const content = r.data !== undefined ? `${r.humanReadable}\n\nDATA: ${safe(r.data)}` : r.humanReadable;
      return { role: 'tool', toolCallId: call.id, name: call.name, content };
    });
  }
}

export const ToolRouter = new ToolRouterImpl();
