import { AIMessage } from '@/services/ai/types';

export interface Conversation {
  id: string;
  userId?: string;
  title?: string;
  messages: AIMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface ConversationStore {
  conversations: Conversation[];
  currentConversation: Conversation | null;
  isLoading: boolean;
  error: string | null;
}

export interface CreateConversationData {
  title?: string;
  userId?: string;
}

export interface AddMessageData {
  conversationId: string;
  role: 'user' | 'assistant';
  content: string;
}
