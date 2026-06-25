import { IntentType } from '@/engine/intentEngine';

export type ActionResultStatus = 'success' | 'failed' | 'cancelled' | 'pending';

export interface ActionResult {
  actionId: string;
  type: ActionType;
  status: ActionResultStatus;
  message: string;
  error?: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

export type ActionType =
  | 'open_app'
  | 'open_website'
  | 'search_web'
  | 'call_contact'
  | 'send_message'
  | 'set_reminder'
  | 'set_alarm'
  | 'open_file'
  | 'unknown';

export interface ActionContext {
  query?: string;
  contactName?: string;
  phoneNumber?: string;
  message?: string;
  remindAt?: Date;
  reminderText?: string;
  alarmTime?: Date;
  filePath?: string;
}

export interface ActionDefinition {
  type: ActionType;
  label: string;
  description: string;
  execute: (context: ActionContext) => Promise<ActionResult>;
  validate?: (context: ActionContext) => boolean;
}

export interface AppIntent {
  action: string;
  packageName?: string;
  uri?: string;
  type?: string;
  extras?: Record<string, string | number | boolean>;
}

export const APP_PACKAGES: Record<string, string> = {
  youtube: 'com.google.android.youtube',
  chrome: 'com.android.chrome',
  whatsapp: 'com.whatsapp',
  gmail: 'com.google.android.gm',
  maps: 'com.google.android.apps.maps',
  phone: 'com.android.dialer',
  messages: 'com.google.android.apps.messaging',
  settings: 'com.android.settings',
  camera: 'com.android.camera',
  photos: 'com.google.android.apps.photos',
  calendar: 'com.google.android.calendar',
  clock: 'com.google.android.deskclock',
  play_store: 'com.android.vending',
};

export const INTENT_TO_ACTION: Record<IntentType, ActionType> = {
  open_youtube: 'open_app',
  open_chrome: 'open_app',
  open_whatsapp: 'open_app',
  search_google: 'search_web',
  ask_ai: 'unknown',
  unknown: 'unknown',
};
