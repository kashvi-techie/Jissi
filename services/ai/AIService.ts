import { GoogleGenerativeAI, GenerativeModel, ChatSession, Content, Part } from '@google/generative-ai';
import {
  AIMessage,
  AIServiceConfig,
  AIGenerationOptions,
  AIGenerationResult,
  DEFAULT_SYSTEM_PROMPT,
  GEMINI_MODEL,
} from './types';

class AIServiceImpl {
  private genAI: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;
  private chat: ChatSession | null = null;
  private config: AIServiceConfig | null = null;
  private conversationHistory: AIMessage[] = [];

  initialize(config: AIServiceConfig): void {
    this.config = config;
    this.genAI = new GoogleGenerativeAI(config.apiKey);

    this.model = this.genAI.getGenerativeModel({
      model: config.model || GEMINI_MODEL,
      systemInstruction: config.systemPrompt || DEFAULT_SYSTEM_PROMPT,
      generationConfig: {
        maxOutputTokens: config.maxTokens || 1024,
        temperature: config.temperature ?? 0.7,
      },
    });

    this.startNewChat();
  }

  startNewChat(): void {
    if (!this.model) {
      throw new Error('AIService not initialized');
    }

    this.conversationHistory = [];

    const history: Content[] = [];

    this.chat = this.model.startChat({
      history,
    });
  }

  addMessage(role: 'user' | 'assistant', content: string): AIMessage {
    const message: AIMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role,
      content,
      timestamp: Date.now(),
    };
    this.conversationHistory.push(message);
    return message;
  }

  getConversationHistory(): AIMessage[] {
    return [...this.conversationHistory];
  }

  async generate(prompt: string, options?: AIGenerationOptions): Promise<AIGenerationResult> {
    if (!this.chat) {
      throw new Error('Chat not initialized. Call initialize() and startNewChat() first.');
    }

    this.addMessage('user', prompt);

    try {
      console.log('[AIDBG] AIService.generate -> sending to Gemini...');
      const result = await this.chat.sendMessage(prompt);
      const response = result.response;
      const text = response.text();
      console.log('[AIDBG] Gemini responded. text len =', text ? text.length : 0);

      this.addMessage('assistant', text);

      return {
        text,
        finishReason: 'stop',
        usage: {
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.log('[AIDBG] Gemini call FAILED:', errorMessage);
      this.addMessage('assistant', `I apologize, but I encountered an error: ${errorMessage}`);

      return {
        text: `I apologize, but I encountered an error processing your request. Please try again.`,
        finishReason: 'error',
      };
    }
  }

  async generateStream(prompt: string, options?: AIGenerationOptions): Promise<ReadableStream<string>> {
    if (!this.chat) {
      throw new Error('Chat not initialized');
    }

    this.addMessage('user', prompt);

    const result = await this.chat.sendMessageStream(prompt);

    const self = this;
    let fullResponse = '';

    return new ReadableStream<string>({
      async start(controller) {
        try {
          for await (const chunk of result.stream) {
            const text = chunk.text();
            fullResponse += text;
            controller.enqueue(text);
          }
          self.addMessage('assistant', fullResponse);
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });
  }

  isInitialized(): boolean {
    return this.model !== null && this.chat !== null;
  }

  getTokenCount(): number {
    return this.conversationHistory.length;
  }

  getConfig(): AIServiceConfig | null {
    return this.config;
  }
}

export const AIService = new AIServiceImpl();
