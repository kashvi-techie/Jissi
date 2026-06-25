export type AssistantState = 'idle' | 'listening' | 'processing' | 'speaking';

export interface OverlayPosition {
  x: number;
  y: number;
}

export interface BackgroundTask {
  id: string;
  type: 'speech_recognition' | 'intent_detection' | 'command_execution' | 'wake_word';
  status: 'pending' | 'running' | 'completed' | 'failed';
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: number;
  completedAt?: number;
}

class BackgroundServiceManager {
  private tasks: Map<string, BackgroundTask> = new Map();
  private listeners: Set<(tasks: BackgroundTask[]) => void> = new Set();

  submitTask(task: Omit<BackgroundTask, 'id' | 'status' | 'createdAt'>): string {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    const fullTask: BackgroundTask = {
      ...task,
      id,
      status: 'pending',
      createdAt: Date.now(),
    };
    this.tasks.set(id, fullTask);
    this.notifyListeners();
    this.processTask(id);
    return id;
  }

  private async processTask(id: string) {
    const task = this.tasks.get(id);
    if (!task) return;

    this.tasks.set(id, { ...task, status: 'running' });
    this.notifyListeners();

    try {
      await this.executeTask(task);
      this.tasks.set(id, {
        ...task,
        status: 'completed',
        completedAt: Date.now(),
      });
    } catch (error) {
      this.tasks.set(id, {
        ...task,
        status: 'failed',
        error: error instanceof Error ? error.message : 'Unknown error',
        completedAt: Date.now(),
      });
    }

    this.notifyListeners();
  }

  private async executeTask(task: BackgroundTask): Promise<void> {
    switch (task.type) {
      case 'speech_recognition':
        await new Promise((resolve) => setTimeout(resolve, 500));
        break;
      case 'intent_detection':
        await new Promise((resolve) => setTimeout(resolve, 300));
        break;
      case 'command_execution':
        await new Promise((resolve) => setTimeout(resolve, 800));
        break;
      case 'wake_word':
        await new Promise((resolve) => setTimeout(resolve, 100));
        break;
      default:
        break;
    }
  }

  getTasks(): BackgroundTask[] {
    return Array.from(this.tasks.values()).sort((a, b) => b.createdAt - a.createdAt);
  }

  getTask(id: string): BackgroundTask | undefined {
    return this.tasks.get(id);
  }

  subscribe(callback: (tasks: BackgroundTask[]) => void): () => void {
    this.listeners.add(callback);
    callback(this.getTasks());
    return () => {
      this.listeners.delete(callback);
    };
  }

  private notifyListeners() {
    const tasks = this.getTasks();
    this.listeners.forEach((cb) => cb(tasks));
  }
}

export const backgroundService = new BackgroundServiceManager();

export interface AssistantServiceState {
  state: AssistantState;
  isOverlayVisible: boolean;
  isMinimized: boolean;
  overlayPosition: OverlayPosition;
  transcript: string;
  interimTranscript: string;
  error: string | null;
  hasOverlayPermission: boolean;
  isWakeWordEnabled: boolean;
  isWakeWordActive: boolean;
}

export const initialAssistantState: AssistantServiceState = {
  state: 'idle',
  isOverlayVisible: false,
  isMinimized: false,
  overlayPosition: { x: 20, y: 100 },
  transcript: '',
  interimTranscript: '',
  error: null,
  hasOverlayPermission: false,
  isWakeWordEnabled: false,
  isWakeWordActive: false,
};

export type AssistantAction =
  | { type: 'SET_STATE'; payload: AssistantState }
  | { type: 'SHOW_OVERLAY' }
  | { type: 'HIDE_OVERLAY' }
  | { type: 'TOGGLE_MINIMIZED' }
  | { type: 'SET_POSITION'; payload: OverlayPosition }
  | { type: 'SET_TRANSCRIPT'; payload: string }
  | { type: 'SET_INTERIM'; payload: string }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'SET_OVERLAY_PERMISSION'; payload: boolean }
  | { type: 'SET_WAKE_WORD_ENABLED'; payload: boolean }
  | { type: 'SET_WAKE_WORD_ACTIVE'; payload: boolean }
  | { type: 'CLEAR_TRANSCRIPT' }
  | { type: 'START_LISTENING' }
  | { type: 'STOP_LISTENING' }
  | { type: 'PROCESSING' }
  | { type: 'SPEAKING' };

export function assistantReducer(
  state: AssistantServiceState,
  action: AssistantAction
): AssistantServiceState {
  switch (action.type) {
    case 'SET_STATE':
      return { ...state, state: action.payload };
    case 'SHOW_OVERLAY':
      return { ...state, isOverlayVisible: true };
    case 'HIDE_OVERLAY':
      return { ...state, isOverlayVisible: false, isMinimized: false };
    case 'TOGGLE_MINIMIZED':
      return { ...state, isMinimized: !state.isMinimized };
    case 'SET_POSITION':
      return { ...state, overlayPosition: action.payload };
    case 'SET_TRANSCRIPT':
      return { ...state, transcript: action.payload };
    case 'SET_INTERIM':
      return { ...state, interimTranscript: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'SET_OVERLAY_PERMISSION':
      return { ...state, hasOverlayPermission: action.payload };
    case 'SET_WAKE_WORD_ENABLED':
      return { ...state, isWakeWordEnabled: action.payload };
    case 'SET_WAKE_WORD_ACTIVE':
      return { ...state, isWakeWordActive: action.payload };
    case 'CLEAR_TRANSCRIPT':
      return { ...state, transcript: '', interimTranscript: '', error: null };
    case 'START_LISTENING':
      return { ...state, state: 'listening', error: null };
    case 'STOP_LISTENING':
      return { ...state, state: 'idle', interimTranscript: '' };
    case 'PROCESSING':
      return { ...state, state: 'processing' };
    case 'SPEAKING':
      return { ...state, state: 'speaking' };
    default:
      return state;
  }
}
