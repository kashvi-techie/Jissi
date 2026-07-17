export interface ConversationStreamSnapshot {
  currentMessageId: string | null;
  ttftMs: number | null;
  tokensPerSecond: number;
  streamingDurationMs: number | null;
  tokenCount: number;
  interrupted: boolean;
  completed: boolean;
  startedAt: string | null;
  updatedAt: string;
}

const EMPTY: ConversationStreamSnapshot = {
  currentMessageId: null,
  ttftMs: null,
  tokensPerSecond: 0,
  streamingDurationMs: null,
  tokenCount: 0,
  interrupted: false,
  completed: false,
  startedAt: null,
  updatedAt: new Date().toISOString(),
};

class ConversationStreamDiagnosticsImpl {
  private snapshot: ConversationStreamSnapshot = { ...EMPTY };
  private listeners = new Set<(snapshot: ConversationStreamSnapshot) => void>();
  private startedAtMs: number | null = null;

  subscribe(listener: (snapshot: ConversationStreamSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ConversationStreamSnapshot {
    return { ...this.snapshot };
  }

  start(messageId: string): void {
    const now = Date.now();
    this.startedAtMs = now;
    this.snapshot = {
      ...EMPTY,
      currentMessageId: messageId,
      startedAt: new Date(now).toISOString(),
      updatedAt: new Date(now).toISOString(),
    };
    this.emit();
  }

  chunk(tokenCount: number): void {
    if (!this.startedAtMs) return;
    const now = Date.now();
    const elapsed = Math.max(1, now - this.startedAtMs);
    this.snapshot = {
      ...this.snapshot,
      ttftMs: this.snapshot.ttftMs ?? elapsed,
      tokenCount,
      tokensPerSecond: tokenCount / (elapsed / 1000),
      streamingDurationMs: elapsed,
      updatedAt: new Date(now).toISOString(),
    };
    this.emit();
  }

  interrupt(): void {
    if (!this.snapshot.currentMessageId || this.snapshot.completed) return;
    const now = Date.now();
    this.snapshot = {
      ...this.snapshot,
      interrupted: true,
      completed: false,
      streamingDurationMs: this.startedAtMs ? now - this.startedAtMs : this.snapshot.streamingDurationMs,
      updatedAt: new Date(now).toISOString(),
    };
    this.emit();
  }

  complete(): void {
    if (!this.snapshot.currentMessageId) return;
    const now = Date.now();
    this.snapshot = {
      ...this.snapshot,
      completed: true,
      interrupted: false,
      streamingDurationMs: this.startedAtMs ? now - this.startedAtMs : this.snapshot.streamingDurationMs,
      updatedAt: new Date(now).toISOString(),
    };
    this.emit();
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const ConversationStreamDiagnostics = new ConversationStreamDiagnosticsImpl();
