import { Platform } from 'react-native';
import { Conversation, CreateConversationData, AddMessageData } from './types';
import { AIMessage } from '@/services/ai/types';

const CONVERSATIONS_KEY = '@jissi_conversations';
const CURRENT_CONVERSATION_KEY = '@jissi_current_conversation';

function generateId(): string {
  return `conv_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

let AsyncStorageModule: any = null;

try {
  if (Platform.OS !== 'web') {
    AsyncStorageModule = require('@react-native-async-storage/async-storage').default;
  }
} catch {
  console.warn('AsyncStorage not available - using memory storage');
}

class ConversationRepositoryImpl {
  private memoryCache: Conversation[] = [];
  private currentConversation: Conversation | null = null;

  async initialize(): Promise<void> {
    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(CONVERSATIONS_KEY);
      const current = localStorage.getItem(CURRENT_CONVERSATION_KEY);

      if (stored) {
        try {
          this.memoryCache = JSON.parse(stored);
        } catch {
          this.memoryCache = [];
        }
      }

      if (current) {
        try {
          this.currentConversation = JSON.parse(current);
        } catch {
          this.currentConversation = null;
        }
      }
    } else if (Platform.OS !== 'web' && AsyncStorageModule) {
      try {
        const stored = await AsyncStorageModule.getItem(CONVERSATIONS_KEY);
        const current = await AsyncStorageModule.getItem(CURRENT_CONVERSATION_KEY);

        if (stored) {
          this.memoryCache = JSON.parse(stored);
        }

        if (current) {
          this.currentConversation = JSON.parse(current);
        }
      } catch (error) {
        console.error('Failed to load conversations:', error);
      }
    }
  }

  private async persist(): Promise<void> {
    const data = JSON.stringify(this.memoryCache);
    const current = this.currentConversation ? JSON.stringify(this.currentConversation) : null;

    if (Platform.OS === 'web' && typeof localStorage !== 'undefined') {
      localStorage.setItem(CONVERSATIONS_KEY, data);
      if (current) {
        localStorage.setItem(CURRENT_CONVERSATION_KEY, current);
      }
    } else if (Platform.OS !== 'web' && AsyncStorageModule) {
      await AsyncStorageModule.setItem(CONVERSATIONS_KEY, data);
      if (current) {
        await AsyncStorageModule.setItem(CURRENT_CONVERSATION_KEY, current);
      }
    }
  }

  async createConversation(data: CreateConversationData = {}): Promise<Conversation> {
    const conversation: Conversation = {
      id: generateId(),
      userId: data.userId,
      title: data.title,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.memoryCache.unshift(conversation);
    this.currentConversation = conversation;
    await this.persist();

    return conversation;
  }

  async getCurrentConversation(): Promise<Conversation | null> {
    return this.currentConversation;
  }

  async setCurrentConversation(conversationId: string): Promise<void> {
    const conversation = this.memoryCache.find(c => c.id === conversationId);
    if (conversation) {
      this.currentConversation = conversation;
      await this.persist();
    }
  }

  async addMessage(data: AddMessageData): Promise<AIMessage> {
    const message: AIMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      role: data.role,
      content: data.content,
      timestamp: Date.now(),
    };

    if (this.currentConversation && this.currentConversation.id === data.conversationId) {
      this.currentConversation.messages.push(message);
      this.currentConversation.updatedAt = new Date().toISOString();

      if (!this.currentConversation.title && data.role === 'user' && data.content.length > 0) {
        this.currentConversation.title = data.content.slice(0, 50) + (data.content.length > 50 ? '...' : '');
      }

      const index = this.memoryCache.findIndex(c => c.id === data.conversationId);
      if (index !== -1) {
        this.memoryCache[index] = { ...this.currentConversation };
      }

      await this.persist();
    }

    return message;
  }

  async getAllConversations(): Promise<Conversation[]> {
    return [...this.memoryCache];
  }

  async deleteConversation(conversationId: string): Promise<void> {
    this.memoryCache = this.memoryCache.filter(c => c.id !== conversationId);

    if (this.currentConversation?.id === conversationId) {
      this.currentConversation = null;
    }

    await this.persist();
  }

  async clearAllConversations(): Promise<void> {
    this.memoryCache = [];
    this.currentConversation = null;
    await this.persist();
  }

  async getConversationById(id: string): Promise<Conversation | null> {
    return this.memoryCache.find(c => c.id === id) || null;
  }
}

export const ConversationRepository = new ConversationRepositoryImpl();
