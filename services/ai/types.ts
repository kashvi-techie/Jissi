export type AIMessageRole = 'user' | 'assistant' | 'system';

export interface AIMessage {
  id: string;
  role: AIMessageRole;
  content: string;
  timestamp: number;
}

export interface AIConversation {
  id: string;
  messages: AIMessage[];
  createdAt: number;
  updatedAt: number;
  title?: string;
}

export interface AIServiceConfig {
  apiKey: string;
  model?: string;
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface AIGenerationOptions {
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
}

export interface AIGenerationResult {
  text: string;
  finishReason: 'stop' | 'length' | 'safety' | 'error';
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export const DEFAULT_SYSTEM_PROMPT = `You are JISSI, a friendly and helpful AI assistant. You are conversational, concise, and informative.

Guidelines:
- Keep responses brief and natural (2-4 sentences for most queries)
- Be conversational and friendly, not robotic
- If the user asks about doing something on their device (opening apps, searching, calling, etc.), they may be speaking to a voice assistant, so keep responses action-oriented
- For informational questions, provide clear, accurate answers
- For coding questions, provide code snippets with brief explanations
- If you don't know something, say so honestly
- Don't prefix responses with "JISSI:" or similar - just respond naturally`;

export const GEMINI_MODEL = 'gemini-1.5-flash';
