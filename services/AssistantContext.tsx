import React, { createContext, useContext, useReducer, useCallback } from 'react';
import {
  assistantReducer,
  initialAssistantState,
  AssistantServiceState,
  AssistantAction,
  OverlayPosition,
  AssistantState,
  backgroundService,
} from './assistantService';

interface AssistantContextValue {
  state: AssistantServiceState;
  dispatch: React.Dispatch<AssistantAction>;
  showOverlay: () => void;
  hideOverlay: () => void;
  toggleMinimized: () => void;
  setPosition: (position: OverlayPosition) => void;
  startListening: () => void;
  stopListening: () => void;
  setProcessing: () => void;
  setSpeaking: () => void;
  setIdle: () => void;
  setTranscript: (text: string) => void;
  setInterim: (text: string) => void;
  setError: (error: string | null) => void;
  clearTranscript: () => void;
  setOverlayPermission: (granted: boolean) => void;
  setWakeWordEnabled: (enabled: boolean) => void;
  setWakeWordActive: (active: boolean) => void;
  submitBackgroundTask: typeof backgroundService.submitTask;
  getBackgroundTasks: typeof backgroundService.getTasks;
  subscribeToTasks: typeof backgroundService.subscribe;
}

const AssistantContext = createContext<AssistantContextValue | null>(null);

export function AssistantProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(assistantReducer, initialAssistantState);

  const showOverlay = useCallback(() => dispatch({ type: 'SHOW_OVERLAY' }), []);
  const hideOverlay = useCallback(() => dispatch({ type: 'HIDE_OVERLAY' }), []);
  const toggleMinimized = useCallback(() => dispatch({ type: 'TOGGLE_MINIMIZED' }), []);
  const setPosition = useCallback(
    (position: OverlayPosition) => dispatch({ type: 'SET_POSITION', payload: position }),
    []
  );
  const startListening = useCallback(() => dispatch({ type: 'START_LISTENING' }), []);
  const stopListening = useCallback(() => dispatch({ type: 'STOP_LISTENING' }), []);
  const setProcessing = useCallback(() => dispatch({ type: 'PROCESSING' }), []);
  const setSpeaking = useCallback(() => dispatch({ type: 'SPEAKING' }), []);
  const setIdle = useCallback(() => dispatch({ type: 'SET_STATE', payload: 'idle' as AssistantState }), []);
  const setTranscript = useCallback(
    (text: string) => dispatch({ type: 'SET_TRANSCRIPT', payload: text }),
    []
  );
  const setInterim = useCallback(
    (text: string) => dispatch({ type: 'SET_INTERIM', payload: text }),
    []
  );
  const setError = useCallback(
    (error: string | null) => dispatch({ type: 'SET_ERROR', payload: error }),
    []
  );
  const clearTranscript = useCallback(() => dispatch({ type: 'CLEAR_TRANSCRIPT' }), []);
  const setOverlayPermission = useCallback(
    (granted: boolean) => dispatch({ type: 'SET_OVERLAY_PERMISSION', payload: granted }),
    []
  );
  const setWakeWordEnabled = useCallback(
    (enabled: boolean) => dispatch({ type: 'SET_WAKE_WORD_ENABLED', payload: enabled }),
    []
  );
  const setWakeWordActive = useCallback(
    (active: boolean) => dispatch({ type: 'SET_WAKE_WORD_ACTIVE', payload: active }),
    []
  );

  const value: AssistantContextValue = {
    state,
    dispatch,
    showOverlay,
    hideOverlay,
    toggleMinimized,
    setPosition,
    startListening,
    stopListening,
    setProcessing,
    setSpeaking,
    setIdle,
    setTranscript,
    setInterim,
    setError,
    clearTranscript,
    setOverlayPermission,
    setWakeWordEnabled,
    setWakeWordActive,
    submitBackgroundTask: backgroundService.submitTask.bind(backgroundService),
    getBackgroundTasks: backgroundService.getTasks.bind(backgroundService),
    subscribeToTasks: backgroundService.subscribe.bind(backgroundService),
  };

  return <AssistantContext.Provider value={value}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const context = useContext(AssistantContext);
  if (!context) {
    throw new Error('useAssistant must be used within an AssistantProvider');
  }
  return context;
}
