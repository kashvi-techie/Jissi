export type ConversationRuntimeState =
  | 'Idle'
  | 'Listening'
  | 'Understanding'
  | 'Searching'
  | 'Thinking'
  | 'Executing'
  | 'Speaking'
  | 'Waiting'
  | 'Completed'
  | 'Interrupted'
  | 'Failed'
  | 'Timeout';

export interface ConversationTransition {
  id: string;
  from: ConversationRuntimeState;
  to: ConversationRuntimeState;
  timestamp: string;
  reason: string;
  elapsedMs: number;
}

export interface ConversationLatency {
  timeToFirstTokenMs: number | null;
  timeToFinalResponseMs: number | null;
  thinkingDurationMs: number | null;
  ttsDurationMs: number | null;
  executionDurationMs: number | null;
}

export interface ConversationDiagnosticsSnapshot {
  currentState: ConversationRuntimeState;
  previousState: ConversationRuntimeState;
  transitionHistory: ConversationTransition[];
  latency: ConversationLatency;
  retryCount: number;
  currentTask: string;
  currentEngine: string;
  pendingActions: string[];
  companionMessage: string;
  startedAt: string | null;
  updatedAt: string;
}

const WAITING_MESSAGES = [
  "I'm thinking...",
  'Checking that...',
  'Searching...',
  'Almost there...',
  "I'm putting everything together...",
];

const EMPTY_LATENCY: ConversationLatency = {
  timeToFirstTokenMs: null,
  timeToFinalResponseMs: null,
  thinkingDurationMs: null,
  ttsDurationMs: null,
  executionDurationMs: null,
};

let sequence = 0;

function id(): string {
  sequence += 1;
  return `conversation_transition_${Date.now()}_${sequence}`;
}

function nowIso(): string {
  return new Date().toISOString();
}

function companionFor(state: ConversationRuntimeState, retryCount: number): string {
  if (state === 'Listening') return "I'm here.";
  if (state === 'Understanding') return 'Let me understand that.';
  if (state === 'Searching') return 'Searching carefully...';
  if (state === 'Thinking') return WAITING_MESSAGES[retryCount % WAITING_MESSAGES.length];
  if (state === 'Executing') return 'Taking care of that.';
  if (state === 'Speaking') return 'Speaking...';
  if (state === 'Waiting') return 'Ready when you are.';
  if (state === 'Completed') return 'Done.';
  if (state === 'Interrupted') return "Okay, let's do that instead.";
  if (state === 'Timeout') return "I'm still working on that.";
  if (state === 'Failed') return "I couldn't complete that yet.";
  return 'Ready.';
}

class ConversationStateMachineImpl {
  private snapshot: ConversationDiagnosticsSnapshot = {
    currentState: 'Idle',
    previousState: 'Idle',
    transitionHistory: [],
    latency: { ...EMPTY_LATENCY },
    retryCount: 0,
    currentTask: 'None',
    currentEngine: 'None',
    pendingActions: [],
    companionMessage: 'Ready.',
    startedAt: null,
    updatedAt: nowIso(),
  };

  private listeners = new Set<(snapshot: ConversationDiagnosticsSnapshot) => void>();
  private lastTransitionAt = Date.now();
  private requestStartedAt: number | null = null;
  private thinkingStartedAt: number | null = null;
  private ttsStartedAt: number | null = null;
  private executionStartedAt: number | null = null;

  subscribe(listener: (snapshot: ConversationDiagnosticsSnapshot) => void): () => void {
    this.listeners.add(listener);
    listener(this.getSnapshot());
    return () => this.listeners.delete(listener);
  }

  getSnapshot(): ConversationDiagnosticsSnapshot {
    return {
      ...this.snapshot,
      latency: { ...this.snapshot.latency },
      transitionHistory: [...this.snapshot.transitionHistory],
      pendingActions: [...this.snapshot.pendingActions],
    };
  }

  startTask(task: string, engine: string): void {
    const startedAt = Date.now();
    this.requestStartedAt = startedAt;
    this.thinkingStartedAt = null;
    this.ttsStartedAt = null;
    this.executionStartedAt = null;
    this.snapshot = {
      ...this.snapshot,
      latency: { ...EMPTY_LATENCY },
      retryCount: 0,
      currentTask: task,
      currentEngine: engine,
      pendingActions: [],
      startedAt: new Date(startedAt).toISOString(),
    };
    this.transition('Understanding', `Started: ${task}`);
  }

  transition(to: ConversationRuntimeState, reason: string): void {
    const timestamp = Date.now();
    const from = this.snapshot.currentState;
    if (to === 'Thinking' && !this.thinkingStartedAt) this.thinkingStartedAt = timestamp;
    if (to === 'Speaking') this.ttsStartedAt = timestamp;
    if (to === 'Executing') this.executionStartedAt = timestamp;
    if (to === 'Completed' || to === 'Failed' || to === 'Timeout') {
      this.finishOpenTimers(timestamp);
    }
    const transition: ConversationTransition = {
      id: id(),
      from,
      to,
      timestamp: new Date(timestamp).toISOString(),
      reason,
      elapsedMs: timestamp - this.lastTransitionAt,
    };
    this.lastTransitionAt = timestamp;
    this.snapshot = {
      ...this.snapshot,
      previousState: from,
      currentState: to,
      transitionHistory: [transition, ...this.snapshot.transitionHistory].slice(0, 80),
      companionMessage: companionFor(to, this.snapshot.retryCount),
      updatedAt: nowIso(),
    };
    this.emit();
  }

  markFirstResponse(): void {
    if (!this.requestStartedAt || this.snapshot.latency.timeToFirstTokenMs != null) return;
    const elapsed = Date.now() - this.requestStartedAt;
    this.snapshot = {
      ...this.snapshot,
      latency: { ...this.snapshot.latency, timeToFirstTokenMs: elapsed },
      updatedAt: nowIso(),
    };
    this.emit();
  }

  markFinalResponse(): void {
    if (!this.requestStartedAt) return;
    const elapsed = Date.now() - this.requestStartedAt;
    this.snapshot = {
      ...this.snapshot,
      latency: { ...this.snapshot.latency, timeToFinalResponseMs: elapsed },
      updatedAt: nowIso(),
    };
    this.emit();
  }

  markRetry(reason: string): void {
    const retryCount = this.snapshot.retryCount + 1;
    this.snapshot = {
      ...this.snapshot,
      retryCount,
      companionMessage: companionFor('Timeout', retryCount),
      updatedAt: nowIso(),
    };
    this.transition('Timeout', reason);
  }

  setPendingActions(actions: string[]): void {
    this.snapshot = {
      ...this.snapshot,
      pendingActions: actions,
      updatedAt: nowIso(),
    };
    this.emit();
  }

  setEngine(engine: string): void {
    this.snapshot = {
      ...this.snapshot,
      currentEngine: engine,
      updatedAt: nowIso(),
    };
    this.emit();
  }

  interrupt(task: string): void {
    this.snapshot = {
      ...this.snapshot,
      currentTask: task,
      pendingActions: [],
      updatedAt: nowIso(),
    };
    this.transition('Interrupted', "User changed direction before the previous turn finished.");
  }

  private finishOpenTimers(timestamp: number): void {
    const latency = { ...this.snapshot.latency };
    if (this.thinkingStartedAt && latency.thinkingDurationMs == null) {
      latency.thinkingDurationMs = timestamp - this.thinkingStartedAt;
    }
    if (this.ttsStartedAt && latency.ttsDurationMs == null) {
      latency.ttsDurationMs = timestamp - this.ttsStartedAt;
    }
    if (this.executionStartedAt && latency.executionDurationMs == null) {
      latency.executionDurationMs = timestamp - this.executionStartedAt;
    }
    if (this.requestStartedAt && latency.timeToFinalResponseMs == null) {
      latency.timeToFinalResponseMs = timestamp - this.requestStartedAt;
    }
    this.snapshot = { ...this.snapshot, latency };
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach((listener) => listener(snapshot));
  }
}

export const ConversationStateMachine = new ConversationStateMachineImpl();
