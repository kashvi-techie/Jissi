import { Tool } from '../types';

/** Pure, dependency-free, always-available math tool. */
export const CalculatorTool: Tool = {
  name: 'calculator',
  description:
    'Evaluate a basic arithmetic expression (+, -, *, /, parentheses, decimals). Use this for any math the user asks instead of computing it yourself.',
  parameters: {
    type: 'object',
    properties: {
      expression: { type: 'string', description: 'e.g. "12.5 * (3 + 4)"' },
    },
    required: ['expression'],
  },
  isAvailable: () => true,
  async execute(args) {
    const expression = String(args.expression ?? '').trim();
    // Hard allow-list: only digits, whitespace, and arithmetic operators — so the
    // expression can never contain arbitrary code.
    if (!/^[0-9\s+\-*/().]+$/.test(expression)) {
      return { success: false, humanReadable: 'That is not a valid arithmetic expression.', error: 'invalid_expression' };
    }
    try {
      // eslint-disable-next-line no-new-func
      const value = Function(`"use strict"; return (${expression});`)() as number;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        return { success: false, humanReadable: 'Could not compute that expression.', error: 'not_a_number' };
      }
      return { success: true, data: { value }, humanReadable: `${expression} = ${value}`, cacheable: true };
    } catch (e) {
      return { success: false, humanReadable: 'Could not compute that expression.', error: e instanceof Error ? e.message : 'error' };
    }
  },
};
