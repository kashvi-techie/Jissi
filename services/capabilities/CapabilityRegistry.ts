import { Linking, Platform, Share } from 'react-native';
import { ActionExecutor } from '@/services/android-actions';
import type { AndroidActionPayload, AndroidActionType } from '@/services/android-actions';
import { CapabilityAnalytics } from './CapabilityAnalytics';
import { CapabilityPermissionManager } from './CapabilityPermissionManager';
import type {
  CapabilityAvailability,
  CapabilityDefinition,
  CapabilityExecutionInput,
  CapabilityId,
  CapabilityPlatform,
  CapabilityResult,
  CapabilityStatus,
  CapabilityValidation,
} from './CapabilityTypes';

let IntentLauncher: any = null;
try {
  IntentLauncher = require('expo-intent-launcher');
} catch {
  IntentLauncher = null;
}

type CustomExecutor = (input: CapabilityExecutionInput | undefined, startedAt: number, definition: CapabilityDefinition) => Promise<CapabilityResult>;

let sequence = 0;

function resultId(): string {
  sequence += 1;
  return `capability_result_${Date.now()}_${sequence}`;
}

function currentPlatform(): CapabilityPlatform {
  return Platform.OS === 'android' || Platform.OS === 'ios' || Platform.OS === 'web' ? Platform.OS : 'web';
}

function availabilityFor(definition: CapabilityDefinition): CapabilityAvailability {
  const platform = currentPlatform();
  if (!definition.supportedPlatforms.includes(platform)) {
    return { status: 'unsupported', reason: `${definition.displayName} is not supported on ${platform}.`, platform };
  }
  if (definition.nativeModuleRequired) {
    return {
      status: 'unsupported',
      reason: `${definition.displayName} needs ${definition.nativeModuleRequired}.`,
      platform,
      nativeModuleRequired: definition.nativeModuleRequired,
    };
  }
  return { status: 'supported', reason: definition.platformNotes ?? 'Capability metadata is available.', platform };
}

function capabilityResult(
  capabilityId: CapabilityId,
  status: CapabilityStatus,
  message: string,
  reason: string,
  startedAt: number,
  data?: Record<string, unknown>
): CapabilityResult {
  return {
    id: resultId(),
    capabilityId,
    status,
    message,
    reason,
    timestamp: new Date().toISOString(),
    durationMs: Date.now() - startedAt,
    data,
  };
}

async function recordResult(result: CapabilityResult): Promise<CapabilityResult> {
  await CapabilityAnalytics.record({
    capabilityId: result.capabilityId,
    status: result.status,
    timestamp: result.timestamp,
    durationMs: result.durationMs,
    reason: result.reason,
  });
  return result;
}

function unsupported(id: CapabilityId, message: string, reason: string, startedAt: number, data?: Record<string, unknown>): CapabilityResult {
  return capabilityResult(id, 'unsupported', message, reason, startedAt, data);
}

function urlFrom(input: CapabilityExecutionInput | undefined, fallback: string): string {
  const value = input?.payload?.url;
  return typeof value === 'string' && value.trim() ? value : fallback;
}

function phoneFrom(input: CapabilityExecutionInput | undefined): string | undefined {
  const value = input?.payload?.phoneNumber;
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function textFrom(input: CapabilityExecutionInput | undefined): string | undefined {
  const value = input?.payload?.text ?? input?.payload?.message;
  return typeof value === 'string' ? value : undefined;
}

async function executeUrl(id: CapabilityId, url: string, startedAt: number): Promise<CapabilityResult> {
  try {
    const canOpen = await Linking.canOpenURL(url);
    if (!canOpen) return unsupported(id, 'No app can open this link.', `Linking.canOpenURL returned false for ${url}.`, startedAt, { url });
    await Linking.openURL(url);
    return capabilityResult(id, 'supported', `Opened ${url}.`, 'URL opened through React Native Linking.', startedAt, { url });
  } catch (error) {
    return capabilityResult(id, 'temporarily_unavailable', 'Failed to open link.', error instanceof Error ? error.message : 'Unknown URL error.', startedAt, { url });
  }
}

function createCapability(config: {
  id: CapabilityId;
  displayName: string;
  description: string;
  requiredPermissions?: string[];
  supportedPlatforms?: CapabilityPlatform[];
  requiredPayload?: string[];
  nativeModuleRequired?: string;
  platformNotes?: string;
  action?: { type: AndroidActionType; payload?: AndroidActionPayload };
  customExecute?: CustomExecutor;
}): CapabilityDefinition {
  const definition: CapabilityDefinition = {
    id: config.id,
    displayName: config.displayName,
    description: config.description,
    requiredPermissions: config.requiredPermissions ?? [],
    supportedPlatforms: config.supportedPlatforms ?? ['android'],
    requiredPayload: config.requiredPayload ?? [],
    nativeModuleRequired: config.nativeModuleRequired,
    platformNotes: config.platformNotes,
    action: config.action,
    availability() {
      return availabilityFor(definition);
    },
    validate(input?: CapabilityExecutionInput): CapabilityValidation {
      return CapabilityPermissionManager.validate(definition, input);
    },
    async execute(input?: CapabilityExecutionInput): Promise<CapabilityResult> {
      const startedAt = Date.now();
      const validation = definition.validate(input);
      if (validation.status !== 'supported') {
        return recordResult(capabilityResult(definition.id, validation.status, validation.reason, validation.reason, startedAt, {
          nativeModuleRequired: validation.nativeModuleRequired,
          missingPayload: validation.missingPayload,
        }));
      }

      const permission = await CapabilityPermissionManager.requestPermissions(definition);
      if (permission === 'required' || permission === 'unsupported') {
        return recordResult(capabilityResult(definition.id, permission === 'unsupported' ? 'unsupported' : 'permission_required', `${definition.displayName} permission is ${permission}.`, 'Runtime permission request did not grant access.', startedAt));
      }

      if (config.customExecute) {
        return recordResult(await config.customExecute(input, startedAt, definition));
      }

      if (!definition.action) {
        return recordResult(unsupported(definition.id, `${definition.displayName} has no executor yet.`, 'No executable action is registered.', startedAt));
      }

      const payload = { ...definition.action.payload, ...input?.payload };
      const actionResult = await ActionExecutor.execute({ type: definition.action.type, payload, confirmed: input?.confirmed });
      const status: CapabilityStatus = actionResult.status === 'success'
        ? 'supported'
        : actionResult.status === 'pending_confirmation'
          ? 'permission_required'
          : actionResult.status === 'unsupported'
            ? 'unsupported'
            : 'temporarily_unavailable';
      return recordResult(capabilityResult(definition.id, status, actionResult.message, actionResult.reason, startedAt, actionResult.data));
    },
  };
  return definition;
}

const DEFINITIONS: CapabilityDefinition[] = [
  createCapability({
    id: 'whatsapp',
    displayName: 'WhatsApp',
    description: 'Open WhatsApp or a WhatsApp chat deep link.',
    supportedPlatforms: ['android', 'ios', 'web'],
    platformNotes: 'Uses wa.me deep links when phoneNumber is provided, otherwise launches the Android app package.',
    customExecute: async (input, startedAt) => {
      const phoneNumber = phoneFrom(input);
      if (phoneNumber) {
        const message = textFrom(input);
        const url = `https://wa.me/${phoneNumber}${message ? `?text=${encodeURIComponent(message)}` : ''}`;
        return executeUrl('whatsapp', url, startedAt);
      }
      const actionResult = await ActionExecutor.execute({ type: 'open_app', payload: { packageName: 'com.whatsapp', appName: 'WhatsApp' }, confirmed: input?.confirmed });
      const status: CapabilityStatus = actionResult.status === 'success' ? 'supported' : actionResult.status === 'unsupported' ? 'unsupported' : 'temporarily_unavailable';
      return capabilityResult('whatsapp', status, actionResult.message, actionResult.reason, startedAt, actionResult.data);
    },
  }),
  createCapability({
    id: 'chrome',
    displayName: 'Browser',
    description: 'Open a browser URL. Defaults to Google if no URL is supplied.',
    supportedPlatforms: ['android', 'ios', 'web'],
    customExecute: async (input, startedAt) => executeUrl('chrome', urlFrom(input, 'https://www.google.com'), startedAt),
  }),
  createCapability({
    id: 'maps',
    displayName: 'Maps',
    description: 'Open Google Maps or a query/destination.',
    supportedPlatforms: ['android', 'web', 'ios'],
    customExecute: async (input, startedAt) => {
      const query = typeof input?.payload?.query === 'string' ? input.payload.query : undefined;
      const url = query ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}` : urlFrom(input, 'https://www.google.com/maps');
      return executeUrl('maps', url, startedAt);
    },
  }),
  createCapability({
    id: 'spotify',
    displayName: 'Spotify',
    description: 'Open Spotify app or search link.',
    supportedPlatforms: ['android', 'ios', 'web'],
    customExecute: async (input, startedAt) => {
      const query = typeof input?.payload?.query === 'string' ? input.payload.query : undefined;
      if (query) return executeUrl('spotify', `https://open.spotify.com/search/${encodeURIComponent(query)}`, startedAt);
      const actionResult = await ActionExecutor.execute({ type: 'open_app', payload: { packageName: 'com.spotify.music', appName: 'Spotify' }, confirmed: input?.confirmed });
      const status: CapabilityStatus = actionResult.status === 'success' ? 'supported' : actionResult.status === 'unsupported' ? 'unsupported' : 'temporarily_unavailable';
      return capabilityResult('spotify', status, actionResult.message, actionResult.reason, startedAt, actionResult.data);
    },
  }),
  createCapability({
    id: 'share_text',
    displayName: 'Share Text',
    description: 'Open the native share sheet with text.',
    requiredPayload: ['text'],
    supportedPlatforms: ['android', 'ios', 'web'],
    customExecute: async (input, startedAt) => {
      const text = textFrom(input);
      if (!text) return capabilityResult('share_text', 'permission_required', 'Missing required payload: text.', 'Share text requires payload.text.', startedAt);
      try {
        await Share.share({ message: text });
        return capabilityResult('share_text', 'supported', 'Opened share sheet.', 'React Native Share.share completed.', startedAt, { textLength: text.length });
      } catch (error) {
        return capabilityResult('share_text', 'temporarily_unavailable', 'Could not open share sheet.', error instanceof Error ? error.message : 'Unknown share error.', startedAt);
      }
    },
  }),
  createCapability({ id: 'calendar', displayName: 'Calendar', description: 'Calendar access placeholder for future native module.', nativeModuleRequired: 'expo-calendar or native calendar module' }),
  createCapability({ id: 'contacts', displayName: 'Contacts', description: 'Contact lookup placeholder for future native module.', nativeModuleRequired: 'expo-contacts or native contacts module' }),
  createCapability({
    id: 'phone',
    displayName: 'Phone',
    description: 'Open the phone dialer for a supplied number.',
    requiredPermissions: ['dialer'],
    requiredPayload: ['phoneNumber'],
    supportedPlatforms: ['android', 'ios'],
    customExecute: async (input, startedAt) => {
      const phoneNumber = phoneFrom(input);
      if (!phoneNumber) return capabilityResult('phone', 'permission_required', 'Missing required payload: phoneNumber.', 'Dialer requires payload.phoneNumber.', startedAt);
      return executeUrl('phone', `tel:${phoneNumber}`, startedAt);
    },
  }),
  createCapability({
    id: 'sms',
    displayName: 'SMS',
    description: 'Open the SMS composer for a supplied number.',
    requiredPayload: ['phoneNumber'],
    supportedPlatforms: ['android', 'ios'],
    customExecute: async (input, startedAt) => {
      const phoneNumber = phoneFrom(input);
      if (!phoneNumber) return capabilityResult('sms', 'permission_required', 'Missing required payload: phoneNumber.', 'SMS composer requires payload.phoneNumber.', startedAt);
      const message = textFrom(input);
      return executeUrl('sms', `sms:${phoneNumber}${message ? `?body=${encodeURIComponent(message)}` : ''}`, startedAt);
    },
  }),
  createCapability({
    id: 'camera',
    displayName: 'Camera',
    description: 'Request camera permission and launch Android camera capture intent.',
    requiredPermissions: ['camera'],
    supportedPlatforms: ['android'],
    platformNotes: 'Uses expo-camera for permission and Android IMAGE_CAPTURE intent. In-app camera capture needs a dedicated camera screen.',
    customExecute: async (_input, startedAt) => {
      if (!IntentLauncher) return unsupported('camera', 'Android intent launcher is unavailable.', 'expo-intent-launcher is not available in this runtime.', startedAt);
      try {
        await IntentLauncher.startActivityAsync('android.media.action.IMAGE_CAPTURE');
        return capabilityResult('camera', 'supported', 'Opened Android camera.', 'IMAGE_CAPTURE intent launched after permission check.', startedAt);
      } catch (error) {
        return capabilityResult('camera', 'temporarily_unavailable', 'Could not open camera.', error instanceof Error ? error.message : 'Unknown camera intent error.', startedAt);
      }
    },
  }),
  createCapability({ id: 'gallery', displayName: 'Gallery', description: 'Gallery picker requires an image picker module that is not installed.', nativeModuleRequired: 'expo-image-picker or media library module' }),
  createCapability({ id: 'files', displayName: 'Files', description: 'File picker requires a document picker module that is not installed.', nativeModuleRequired: 'expo-document-picker or filesystem module' }),
  createCapability({ id: 'alarm', displayName: 'Alarm', description: 'Alarm creation placeholder for future native module.', nativeModuleRequired: 'native alarm intent/module' }),
  createCapability({ id: 'reminders', displayName: 'Reminders', description: 'Reminder creation placeholder for future scheduler module.', nativeModuleRequired: 'local notification/reminder scheduler' }),
  createCapability({
    id: 'clipboard',
    displayName: 'Clipboard',
    description: 'Read/write clipboard where platform APIs are available.',
    supportedPlatforms: ['web', 'android', 'ios'],
    platformNotes: 'Web clipboard is supported through navigator.clipboard. Android/iOS need expo-clipboard, which is not installed.',
    customExecute: async (input, startedAt) => {
      const mode = typeof input?.payload?.mode === 'string' ? input.payload.mode : 'write';
      const text = textFrom(input);
      if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
        try {
          if (mode === 'read') {
            const value = await navigator.clipboard.readText();
            return capabilityResult('clipboard', 'supported', 'Read clipboard text.', 'Browser clipboard readText completed.', startedAt, { text: value });
          }
          if (!text) return capabilityResult('clipboard', 'permission_required', 'Missing required payload: text.', 'Clipboard write requires payload.text.', startedAt);
          await navigator.clipboard.writeText(text);
          return capabilityResult('clipboard', 'supported', 'Copied text to clipboard.', 'Browser clipboard writeText completed.', startedAt, { textLength: text.length });
        } catch (error) {
          return capabilityResult('clipboard', 'permission_required', 'Clipboard permission was not granted.', error instanceof Error ? error.message : 'Browser blocked clipboard access.', startedAt);
        }
      }
      return unsupported('clipboard', 'Clipboard needs a native clipboard module on mobile.', 'expo-clipboard is not installed, so mobile clipboard read/write cannot be executed honestly.', startedAt);
    },
  }),
  createCapability({ id: 'notifications', displayName: 'Notifications', description: 'Notification scheduling placeholder for future module.', nativeModuleRequired: 'expo-notifications or native notification module' }),
  createCapability({
    id: 'battery',
    displayName: 'Battery',
    description: 'Battery status requires expo-battery. Android battery settings can be opened separately.',
    nativeModuleRequired: 'expo-battery',
  }),
  createCapability({
    id: 'network_status',
    displayName: 'Network Status',
    description: 'Read network status where platform APIs are available.',
    supportedPlatforms: ['web', 'android', 'ios'],
    platformNotes: 'Web uses navigator.onLine. Android/iOS need @react-native-community/netinfo, which is not installed.',
    customExecute: async (_input, startedAt) => {
      if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
        return capabilityResult('network_status', 'supported', navigator.onLine ? 'Network appears online.' : 'Network appears offline.', 'Read navigator.onLine from the browser runtime.', startedAt, { online: navigator.onLine });
      }
      return unsupported('network_status', 'Native network status needs NetInfo.', '@react-native-community/netinfo is not installed, so mobile network status cannot be read honestly.', startedAt);
    },
  }),
];

class CapabilityRegistryImpl {
  list(): CapabilityDefinition[] {
    return DEFINITIONS;
  }

  get(id: CapabilityId): CapabilityDefinition | undefined {
    return DEFINITIONS.find((definition) => definition.id === id);
  }
}

export const CapabilityRegistry = new CapabilityRegistryImpl();
