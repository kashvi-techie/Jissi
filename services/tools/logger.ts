import { ToolExecutionLog } from './types';

const MAX_LOGS = 100;
const buffer: ToolExecutionLog[] = [];

function safe(value: unknown): string {
  try {
    return typeof value === 'string' ? value : JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Structured execution logging for every tool call (#3). */
export function logToolExecution(entry: ToolExecutionLog): void {
  buffer.push(entry);
  if (buffer.length > MAX_LOGS) buffer.shift();
  console.log(
    `[TOOL] ${entry.tool} ${entry.success ? 'ok' : 'ERR'} ${entry.latencyMs}ms args=${safe(entry.args)}` +
      (entry.error ? ` error=${entry.error}` : '')
  );
}

/** Recent tool executions (for a future debug panel / telemetry). */
export function getToolLogs(): ToolExecutionLog[] {
  return [...buffer];
}
