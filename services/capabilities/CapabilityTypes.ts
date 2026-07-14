import type { AndroidActionPayload, AndroidActionType } from '@/services/android-actions';

export type CapabilityId =
  | 'whatsapp'
  | 'chrome'
  | 'maps'
  | 'spotify'
  | 'share_text'
  | 'calendar'
  | 'contacts'
  | 'phone'
  | 'sms'
  | 'camera'
  | 'gallery'
  | 'files'
  | 'alarm'
  | 'reminders'
  | 'clipboard'
  | 'notifications'
  | 'battery'
  | 'network_status';

export type CapabilityStatus = 'supported' | 'unsupported' | 'permission_required' | 'temporarily_unavailable';
export type CapabilityPlatform = 'android' | 'ios' | 'web';
export type CapabilityPermissionState = 'granted' | 'required' | 'unsupported' | 'unknown';

export interface CapabilityExecutionInput {
  payload?: AndroidActionPayload & Record<string, unknown>;
  confirmed?: boolean;
}

export interface CapabilityValidation {
  status: CapabilityStatus;
  reason: string;
  missingPayload?: string[];
  permissionState: CapabilityPermissionState;
  nativeModuleRequired?: string;
}

export interface CapabilityResult {
  id: string;
  capabilityId: CapabilityId;
  status: CapabilityStatus;
  message: string;
  reason: string;
  timestamp: string;
  durationMs: number;
  data?: Record<string, unknown>;
}

export interface CapabilityAvailability {
  status: CapabilityStatus;
  reason: string;
  platform: CapabilityPlatform;
  nativeModuleRequired?: string;
}

export interface CapabilityDefinition {
  id: CapabilityId;
  displayName: string;
  description: string;
  requiredPermissions: string[];
  supportedPlatforms: CapabilityPlatform[];
  requiredPayload?: string[];
  nativeModuleRequired?: string;
  action?: {
    type: AndroidActionType;
    payload?: AndroidActionPayload;
  };
  platformNotes?: string;
  availability(): CapabilityAvailability;
  validate(input?: CapabilityExecutionInput): CapabilityValidation;
  execute(input?: CapabilityExecutionInput): Promise<CapabilityResult>;
}

export interface CapabilityAnalyticsEntry {
  id: string;
  capabilityId: CapabilityId;
  status: CapabilityStatus;
  timestamp: string;
  durationMs: number;
  reason: string;
}

export interface CapabilitySnapshotItem {
  id: CapabilityId;
  displayName: string;
  description: string;
  requiredPermissions: string[];
  permissionState: CapabilityPermissionState;
  supportedPlatforms: CapabilityPlatform[];
  availability: CapabilityAvailability;
  validation: CapabilityValidation;
  lastExecution?: CapabilityAnalyticsEntry;
  lastSuccess?: CapabilityAnalyticsEntry;
  lastFailure?: CapabilityAnalyticsEntry;
  platformNotes?: string;
}

export interface CapabilitySnapshot {
  registered: CapabilitySnapshotItem[];
  history: CapabilityAnalyticsEntry[];
}
