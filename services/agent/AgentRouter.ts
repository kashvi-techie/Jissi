import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ActionExecutor, ActionRegistry } from '@/services/android-actions';
import type { AndroidActionPayload, AndroidActionRequest, AndroidActionType } from '@/services/android-actions';
import type { DecisionResult } from '@/services/decision';
import type { AgentExecutionRecord, AgentRouteInput, AgentRoutePlan, AgentRouteResult } from './types';

const HISTORY_KEY = '@jissi/agent/history';
const MAX_HISTORY = 50;
const DEFAULT_TIMEOUT_MS = 12000;
let sequence = 0;

const APP_ALIASES: Record<string, { packageName: string; appName: string }> = {
  youtube: { packageName: 'com.google.android.youtube', appName: 'YouTube' },
  chrome: { packageName: 'com.android.chrome', appName: 'Chrome' },
  browser: { packageName: 'com.android.chrome', appName: 'Chrome' },
  whatsapp: { packageName: 'com.whatsapp', appName: 'WhatsApp' },
  settings: { packageName: 'com.android.settings', appName: 'Settings' },
};

function now(): string {
  return new Date().toISOString();
}

function id(): string {
  sequence += 1;
  return `agent_${Date.now()}_${sequence}`;
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') return localStorage.getItem(key);
  return AsyncStorage.getItem(key);
}

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
    localStorage.setItem(key, value);
    return;
  }
  await AsyncStorage.setItem(key, value);
}

function normalize(input: string): string {
  return input.toLowerCase().replace(/\s+/g, ' ').trim();
}

function extractPhone(input: string): string | undefined {
  const match = input.match(/(?:\+?\d[\d\s-]{7,}\d)/);
  return match?.[0].replace(/[\s-]/g, '');
}

function extractUrl(input: string): string | undefined {
  const match = input.match(/\b((?:https?:\/\/)?(?:[a-z0-9-]+\.)+[a-z]{2,}(?:\/[^\s]*)?)\b/i);
  return match?.[1];
}

function extractQuoted(input: string): string | undefined {
  const match = input.match(/["'](.+?)["']/);
  return match?.[1]?.trim();
}

function confirmationPrompt(actionType: AndroidActionType, payload: AndroidActionPayload): string {
  if (actionType === 'call_contact') return `Call ${payload.contactName || payload.phoneNumber || 'this contact'}?`;
  if (actionType === 'send_sms') return `Send SMS to ${payload.contactName || payload.phoneNumber || 'this contact'}?`;
  return 'Do you want JISSI to continue?';
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Agent action timed out after ${timeoutMs}ms.`)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

class AgentRouterImpl {
  async route(input: AgentRouteInput): Promise<AgentRouteResult> {
    const createdAt = now();
    const record: AgentExecutionRecord = {
      id: id(),
      input: input.input,
      state: 'pending',
      decision: input.decision,
      attempts: 0,
      createdAt,
      updatedAt: createdAt,
    };

    const plan = this.plan(input.input, input.decision, input.payload);
    if (!plan) {
      record.state = 'failed';
      record.error = 'No Android action could be mapped from the decision and input.';
      record.updatedAt = now();
      return { record, handled: false, message: record.error };
    }

    record.plan = plan;
    const actionRequest: AndroidActionRequest = {
      type: plan.actionType,
      payload: plan.payload,
      confirmed: input.confirmed,
    };
    record.actionRequest = actionRequest;

    if (plan.sensitive && !input.confirmed) {
      record.state = 'asking_confirmation';
      record.updatedAt = now();
      await this.saveRecord(record);
      return {
        record,
        handled: true,
        message: plan.confirmationPrompt ?? confirmationPrompt(plan.actionType, plan.payload),
      };
    }

    return this.executeRecord(record, input.timeoutMs ?? DEFAULT_TIMEOUT_MS);
  }

  async confirm(recordId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<AgentRouteResult> {
    const record = (await this.getHistory()).find((item) => item.id === recordId);
    if (!record?.actionRequest) {
      const message = 'No pending agent action was found for confirmation.';
      return { handled: false, message, record: this.failedShell(message) };
    }
    return this.executeRecord({ ...record, actionRequest: { ...record.actionRequest, confirmed: true } }, timeoutMs);
  }

  async retry(recordId: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<AgentRouteResult> {
    const record = (await this.getHistory()).find((item) => item.id === recordId);
    if (!record?.actionRequest) {
      const message = 'No previous agent action is available to retry.';
      return { handled: false, message, record: this.failedShell(message) };
    }
    return this.executeRecord({ ...record, updatedAt: now() }, timeoutMs);
  }

  plan(input: string, decision: DecisionResult, payload?: AndroidActionPayload): AgentRoutePlan | null {
    const text = normalize(input);
    const direct = this.directPayloadPlan(text, decision, payload);
    if (direct) return direct;

    if (/\b(open|launch|start)\s+(settings|android settings|phone settings)\b/.test(text)) {
      return this.makePlan('open_settings', {}, decision, 'User requested Android settings.');
    }

    const appMatch = text.match(/\b(open|launch|start)\s+([a-z][a-z0-9 ]{1,30})\b/);
    const appName = appMatch?.[2]?.trim();
    if (appName && APP_ALIASES[appName]) {
      return this.makePlan('open_app', APP_ALIASES[appName], decision, `Mapped "${appName}" to a registered Android package.`);
    }

    const url = extractUrl(input);
    if (url && /\b(open|launch|visit|go to)\b/.test(text)) {
      return this.makePlan('launch_url', { url }, decision, 'Detected a URL open request.');
    }

    if (/\b(call|dial|phone)\b/.test(text)) {
      const phoneNumber = extractPhone(input);
      if (!phoneNumber) return null;
      return this.makePlan('call_contact', { phoneNumber }, decision, 'Detected a phone call request.');
    }

    if (/\b(sms|text|message)\b/.test(text) && /\b(send|compose|write)\b/.test(text)) {
      const phoneNumber = extractPhone(input);
      if (!phoneNumber) return null;
      const message = extractQuoted(input) ?? input.match(/\b(?:saying|message|text)\s+(.+)$/i)?.[1]?.trim();
      return this.makePlan('send_sms', { phoneNumber, message }, decision, 'Detected an SMS composer request.');
    }

    if (/\bshare\b/.test(text)) {
      const textToShare = extractQuoted(input) ?? input.replace(/\bshare\b/i, '').trim();
      if (!textToShare) return null;
      return this.makePlan('share_text', { text: textToShare }, decision, 'Detected a text share request.');
    }

    return null;
  }

  async getHistory(): Promise<AgentExecutionRecord[]> {
    try {
      const raw = await getItem(HISTORY_KEY);
      return raw ? JSON.parse(raw) as AgentExecutionRecord[] : [];
    } catch {
      return [];
    }
  }

  async clearHistory(): Promise<void> {
    await setItem(HISTORY_KEY, JSON.stringify([]));
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.getHistory(), null, 2);
  }

  private directPayloadPlan(text: string, decision: DecisionResult, payload?: AndroidActionPayload): AgentRoutePlan | null {
    if (!payload) return null;
    if (payload.packageName) return this.makePlan('open_app', payload, decision, 'Payload supplied a package name.');
    if (payload.url) return this.makePlan('launch_url', payload, decision, 'Payload supplied a URL.');
    if (payload.phoneNumber && /\b(call|dial|phone)\b/.test(text)) return this.makePlan('call_contact', payload, decision, 'Payload supplied a phone number for calling.');
    if (payload.phoneNumber && (payload.message || /\b(sms|text|message)\b/.test(text))) return this.makePlan('send_sms', payload, decision, 'Payload supplied SMS details.');
    if (payload.text) return this.makePlan('share_text', payload, decision, 'Payload supplied text to share.');
    return null;
  }

  private makePlan(
    actionType: AndroidActionType,
    payload: AndroidActionPayload,
    decision: DecisionResult,
    explanation: string
  ): AgentRoutePlan {
    const definition = ActionRegistry.get(actionType);
    const sensitive = definition?.risk === 'confirmation_required';
    return {
      actionType,
      payload,
      confidence: decision.confidence,
      explanation,
      sensitive,
      confirmationPrompt: sensitive ? confirmationPrompt(actionType, payload) : undefined,
    };
  }

  private async executeRecord(record: AgentExecutionRecord, timeoutMs: number): Promise<AgentRouteResult> {
    if (!record.actionRequest) {
      record.state = 'failed';
      record.error = 'Agent action request is missing.';
      record.updatedAt = now();
      await this.saveRecord(record);
      return { record, handled: false, message: record.error };
    }

    record.state = 'executing';
    record.attempts += 1;
    record.updatedAt = now();
    await this.saveRecord(record);

    try {
      const result = await withTimeout(ActionExecutor.execute(record.actionRequest), timeoutMs);
      record.result = result;
      record.state = result.status === 'success' ? 'success' : result.status === 'pending_confirmation' ? 'asking_confirmation' : 'failed';
      record.error = result.status === 'success' ? undefined : result.reason;
      record.updatedAt = now();
      await this.saveRecord(record);
      return { record, handled: true, message: result.message };
    } catch (error) {
      record.state = 'failed';
      record.error = error instanceof Error ? error.message : 'Unknown agent execution error.';
      record.updatedAt = now();
      await this.saveRecord(record);
      return { record, handled: true, message: record.error };
    }
  }

  private async saveRecord(record: AgentExecutionRecord): Promise<void> {
    const existing = await this.getHistory();
    const next = [record, ...existing.filter((item) => item.id !== record.id)].slice(0, MAX_HISTORY);
    await setItem(HISTORY_KEY, JSON.stringify(next));
  }

  private failedShell(message: string): AgentExecutionRecord {
    const timestamp = now();
    return {
      id: id(),
      input: '',
      state: 'failed',
      decision: {
        action: 'clarification_required',
        confidence: 0,
        explanation: message,
        sourceSystems: ['intent'],
        candidates: [],
      },
      attempts: 0,
      error: message,
      createdAt: timestamp,
      updatedAt: timestamp,
    };
  }
}

export const AgentRouter = new AgentRouterImpl();
