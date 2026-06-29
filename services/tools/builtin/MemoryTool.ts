import { Tool } from '../types';
import { memoryStore } from '../memory/MemoryStore';

/** Exposes the MemoryStore (remember / recall / forget) to the model (#6). */
export const MemoryTool: Tool = {
  name: 'memory',
  description:
    'Persist facts about the user across sessions. action="remember" needs key+value; "recall" takes an optional key (omit to list all); "forget" needs key. Use it to remember preferences the user shares.',
  parameters: {
    type: 'object',
    properties: {
      action: { type: 'string', enum: ['remember', 'recall', 'forget'] },
      key: { type: 'string', description: 'Short identifier, e.g. "home_city"' },
      value: { type: 'string', description: 'Value to store (for remember)' },
    },
    required: ['action'],
  },
  isAvailable: () => true,
  async execute(args) {
    const action = String(args.action);
    try {
      if (action === 'remember') {
        if (!args.key || args.value === undefined) {
          return { success: false, humanReadable: 'To remember something I need both a key and a value.', error: 'missing_args' };
        }
        await memoryStore.remember(String(args.key), String(args.value));
        return { success: true, humanReadable: `Got it — I'll remember ${args.key}.` };
      }
      if (action === 'recall') {
        const items = await memoryStore.recall(args.key ? String(args.key) : undefined);
        return {
          success: true,
          data: items,
          humanReadable: items.length ? items.map((i) => `${i.key}: ${i.value}`).join('; ') : 'Nothing remembered yet.',
        };
      }
      if (action === 'forget') {
        if (!args.key) return { success: false, humanReadable: 'Tell me which key to forget.', error: 'missing_args' };
        await memoryStore.forget(String(args.key));
        return { success: true, humanReadable: `Forgotten: ${args.key}.` };
      }
      return { success: false, humanReadable: `Unknown memory action: ${action}`, error: 'bad_action' };
    } catch (e) {
      return { success: false, humanReadable: 'That memory operation failed.', error: e instanceof Error ? e.message : 'error' };
    }
  },
};
