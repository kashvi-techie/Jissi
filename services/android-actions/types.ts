export type AndroidActionType =
  | 'open_app'
  | 'launch_url'
  | 'call_contact'
  | 'send_sms'
  | 'flashlight'
  | 'brightness'
  | 'volume'
  | 'clipboard'
  | 'share_text'
  | 'open_settings'
  | 'wifi_settings'
  | 'bluetooth_settings'
  | 'battery_settings';

export type AndroidActionRisk = 'safe' | 'confirmation_required' | 'restricted';
export type AndroidActionStatus = 'success' | 'failed' | 'pending_confirmation' | 'unsupported';

export interface AndroidActionDefinition {
  type: AndroidActionType;
  label: string;
  description: string;
  risk: AndroidActionRisk;
  requiredPayload: string[];
  androidOnly?: boolean;
}

export interface AndroidActionPayload {
  packageName?: string;
  appName?: string;
  url?: string;
  phoneNumber?: string;
  contactName?: string;
  message?: string;
  text?: string;
  value?: number;
}

export interface AndroidActionRequest {
  type: AndroidActionType;
  payload?: AndroidActionPayload;
  confirmed?: boolean;
}

export interface AndroidActionPermissionCheck {
  allowed: boolean;
  reason: string;
  missing?: string[];
}

export interface AndroidActionResult {
  id: string;
  type: AndroidActionType;
  status: AndroidActionStatus;
  message: string;
  reason: string;
  requiresConfirmation?: boolean;
  confirmationPrompt?: string;
  data?: Record<string, unknown>;
  timestamp: string;
}
