import { ToolRegistry } from './ToolRegistry';
import { ToolRouter } from './ToolRouter';
import { AIService } from '@/services/ai';
import { CalculatorTool } from './builtin/CalculatorTool';
import { WeatherTool } from './builtin/WeatherTool';
import { NewsTool } from './builtin/NewsTool';
import { WebSearchTool } from './builtin/WebSearchTool';
import { MemoryTool } from './builtin/MemoryTool';

/**
 * Composition root for tools. Import this once at app startup (app/_layout) to:
 *  1. install the built-in tools into the registry, and
 *  2. bridge the generic registry + router into AIService.
 *
 * Future installable/remote (MCP-style) plugins register the same way:
 *   ToolRegistry.registerPlugin(plugin)
 */
ToolRegistry.register(CalculatorTool);
ToolRegistry.register(WeatherTool);
ToolRegistry.register(NewsTool);
ToolRegistry.register(WebSearchTool);
ToolRegistry.register(MemoryTool);

AIService.configureTools({
  getSchemas: (ctx) => ToolRegistry.toSchemas(ctx),
  execute: (calls, ctx) => ToolRouter.executeMany(calls, ctx),
});
