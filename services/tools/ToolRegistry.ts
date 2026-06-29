import { Tool, ToolContext, ToolPlugin, ToolSchema } from './types';

/**
 * The Tool Registry. Tools register themselves here (built-ins via register.ts;
 * future installable/remote plugins via `registerPlugin`). The registry is
 * capability-aware: it only exposes tools whose `isAvailable(ctx)` is true, so the
 * model is never offered a tool that can't run on the current platform.
 */
class ToolRegistryImpl {
  private tools = new Map<string, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.name)) {
      console.warn(`[ToolRegistry] overwriting existing tool "${tool.name}"`);
    }
    this.tools.set(tool.name, tool);
  }

  registerPlugin(plugin: ToolPlugin): void {
    plugin.tools.forEach((t) => this.register(t));
  }

  unregister(name: string): void {
    this.tools.delete(name);
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return [...this.tools.values()];
  }

  /** Tools usable on the current platform / with current config + permissions. */
  async availableTools(ctx: ToolContext): Promise<Tool[]> {
    const out: Tool[] = [];
    for (const tool of this.tools.values()) {
      try {
        if (await tool.isAvailable(ctx)) out.push(tool);
      } catch {
        /* a tool that errors during availability check is treated as unavailable */
      }
    }
    return out;
  }

  /** OpenAI/OpenRouter function schemas for the available tools (handed to the LLM). */
  async toSchemas(ctx: ToolContext): Promise<ToolSchema[]> {
    const available = await this.availableTools(ctx);
    return available.map((t) => ({
      type: 'function',
      function: {
        name: t.name,
        description: t.description,
        // ToolParametersSchema is a valid JSON Schema object; widen to the
        // provider-neutral Record type at this boundary.
        parameters: t.parameters as unknown as Record<string, unknown>,
      },
    }));
  }
}

export const ToolRegistry = new ToolRegistryImpl();
