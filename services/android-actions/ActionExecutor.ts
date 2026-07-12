import { Linking, Platform, Share } from 'react-native';
import { ActionRegistry } from './ActionRegistry';
import type {
  AndroidActionPermissionCheck,
  AndroidActionPayload,
  AndroidActionRequest,
  AndroidActionResult,
  AndroidActionType,
} from './types';

let IntentLauncher: any = null;
try {
  IntentLauncher = require('expo-intent-launcher');
} catch {
  IntentLauncher = null;
}

const SETTINGS_ACTIONS: Partial<Record<AndroidActionType, string>> = {
  open_settings: 'android.settings.SETTINGS',
  wifi_settings: 'android.settings.WIFI_SETTINGS',
  bluetooth_settings: 'android.settings.BLUETOOTH_SETTINGS',
  battery_settings: 'android.settings.BATTERY_SETTINGS',
};

function id(): string {
  return `android_action_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function result(
  type: AndroidActionType,
  status: AndroidActionResult['status'],
  message: string,
  reason: string,
  data?: Record<string, unknown>
): AndroidActionResult {
  return { id: id(), type, status, message, reason, data, timestamp: new Date().toISOString() };
}

function missingPayload(type: AndroidActionType, payload: AndroidActionPayload | undefined): string[] {
  const definition = ActionRegistry.get(type);
  if (!definition) return [];
  return definition.requiredPayload.filter((key) => {
    const value = payload?.[key as keyof AndroidActionPayload];
    return value === undefined || value === null || value === '';
  });
}

function confirmationPrompt(type: AndroidActionType, payload?: AndroidActionPayload): string {
  if (type === 'call_contact') return `Call ${payload?.contactName || payload?.phoneNumber || 'this contact'}?`;
  if (type === 'send_sms') return `Send SMS to ${payload?.contactName || payload?.phoneNumber || 'this contact'}?`;
  if (type === 'clipboard') return 'Copy this text to your clipboard?';
  return 'Do you want JISSI to continue?';
}

async function canOpen(url: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(url);
  } catch {
    return false;
  }
}

class ActionExecutorImpl {
  checkPermissions(request: AndroidActionRequest): AndroidActionPermissionCheck {
    const definition = ActionRegistry.get(request.type);
    if (!definition) {
      return { allowed: false, reason: 'Action is not registered.' };
    }

    const missing = missingPayload(request.type, request.payload);
    if (missing.length) {
      return { allowed: false, reason: `Missing required payload: ${missing.join(', ')}.`, missing };
    }

    if (definition.androidOnly && Platform.OS !== 'android') {
      return { allowed: false, reason: 'This action is only available on Android.' };
    }

    if (definition.androidOnly && !IntentLauncher && request.type.endsWith('settings')) {
      return { allowed: false, reason: 'Android intent launcher is unavailable in this runtime.' };
    }

    return { allowed: true, reason: 'Action can be attempted.' };
  }

  async execute(request: AndroidActionRequest): Promise<AndroidActionResult> {
    const definition = ActionRegistry.get(request.type);
    if (!definition) {
      return result(request.type, 'failed', 'Action is not registered.', 'Unknown action type.');
    }

    const permission = this.checkPermissions(request);
    if (!permission.allowed) {
      return result(request.type, definition.androidOnly && Platform.OS !== 'android' ? 'unsupported' : 'failed', permission.reason, permission.reason, {
        missing: permission.missing,
      });
    }

    if (definition.risk === 'confirmation_required' && !request.confirmed) {
      return {
        ...result(request.type, 'pending_confirmation', confirmationPrompt(request.type, request.payload), 'User confirmation required before execution.'),
        requiresConfirmation: true,
        confirmationPrompt: confirmationPrompt(request.type, request.payload),
      };
    }

    switch (request.type) {
      case 'open_app':
        return this.openApp(request.payload);
      case 'launch_url':
        return this.launchUrl(request.payload);
      case 'call_contact':
        return this.callContact(request.payload);
      case 'send_sms':
        return this.sendSms(request.payload);
      case 'share_text':
        return this.shareText(request.payload);
      case 'clipboard':
        return this.clipboard(request.payload);
      case 'open_settings':
      case 'wifi_settings':
      case 'bluetooth_settings':
      case 'battery_settings':
        return this.openAndroidSettings(request.type);
      case 'flashlight':
        return result('flashlight', 'unsupported', 'Flashlight control needs a native torch module.', 'No safe Expo runtime API is available for background torch control.');
      case 'brightness':
        return result('brightness', 'unsupported', 'Brightness control needs a native brightness module.', 'No brightness module is installed, so JISSI will not pretend it can change system brightness.');
      case 'volume':
        return result('volume', 'unsupported', 'Volume control needs a native volume module.', 'Android media volume cannot be changed from the current Expo runtime safely.');
      default:
        return result(request.type, 'failed', 'Action not implemented.', 'Registered action has no executor branch.');
    }
  }

  private async openApp(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    if (!IntentLauncher) return result('open_app', 'unsupported', 'Android intent launcher is unavailable.', 'expo-intent-launcher is not available.');
    try {
      await IntentLauncher.startActivityAsync('android.intent.action.MAIN', { packageName: payload?.packageName });
      return result('open_app', 'success', `Opened ${payload?.appName || payload?.packageName}.`, 'Android MAIN intent launched.', payload as Record<string, unknown>);
    } catch (error) {
      return result('open_app', 'failed', `Could not open ${payload?.appName || payload?.packageName}.`, error instanceof Error ? error.message : 'Unknown launch error.', payload as Record<string, unknown>);
    }
  }

  private async launchUrl(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    const raw = payload?.url ?? '';
    const url = /^https?:|^tel:|^sms:|^mailto:|^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : `https://${raw}`;
    if (!(await canOpen(url))) return result('launch_url', 'failed', 'This link cannot be opened on this device.', 'Linking.canOpenURL returned false.', { url });
    try {
      await Linking.openURL(url);
      return result('launch_url', 'success', `Opened ${url}.`, 'URL launched through Linking.', { url });
    } catch (error) {
      return result('launch_url', 'failed', 'Failed to open link.', error instanceof Error ? error.message : 'Unknown URL error.', { url });
    }
  }

  private async callContact(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    const telUrl = `tel:${payload?.phoneNumber}`;
    if (!(await canOpen(telUrl))) return result('call_contact', 'unsupported', 'Calls are not supported on this device.', 'tel: URL cannot be opened.');
    try {
      await Linking.openURL(telUrl);
      return result('call_contact', 'success', `Opening dialer for ${payload?.contactName || payload?.phoneNumber}.`, 'Dialer opened after confirmation.', payload as Record<string, unknown>);
    } catch (error) {
      return result('call_contact', 'failed', 'Could not open the dialer.', error instanceof Error ? error.message : 'Unknown call error.', payload as Record<string, unknown>);
    }
  }

  private async sendSms(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    const encoded = payload?.message ? `?body=${encodeURIComponent(payload.message)}` : '';
    const smsUrl = `sms:${payload?.phoneNumber}${encoded}`;
    if (!(await canOpen(smsUrl))) return result('send_sms', 'unsupported', 'SMS is not supported on this device.', 'sms: URL cannot be opened.');
    try {
      await Linking.openURL(smsUrl);
      return result('send_sms', 'success', `Opening SMS composer for ${payload?.contactName || payload?.phoneNumber}.`, 'SMS composer opened after confirmation.', payload as Record<string, unknown>);
    } catch (error) {
      return result('send_sms', 'failed', 'Could not open SMS composer.', error instanceof Error ? error.message : 'Unknown SMS error.', payload as Record<string, unknown>);
    }
  }

  private async shareText(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    try {
      await Share.share({ message: payload?.text ?? '' });
      return result('share_text', 'success', 'Opened the Android share sheet.', 'Share.share completed.', { textLength: payload?.text?.length ?? 0 });
    } catch (error) {
      return result('share_text', 'failed', 'Could not open share sheet.', error instanceof Error ? error.message : 'Unknown share error.');
    }
  }

  private async clipboard(payload?: AndroidActionPayload): Promise<AndroidActionResult> {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(payload?.text ?? '');
      return result('clipboard', 'success', 'Copied text to clipboard.', 'Browser clipboard API completed.', { textLength: payload?.text?.length ?? 0 });
    }
    return result('clipboard', 'unsupported', 'Clipboard write needs a native clipboard module.', 'No native clipboard dependency is installed yet.');
  }

  private async openAndroidSettings(type: AndroidActionType): Promise<AndroidActionResult> {
    if (!IntentLauncher) return result(type, 'unsupported', 'Android intent launcher is unavailable.', 'expo-intent-launcher is not available.');
    const action = SETTINGS_ACTIONS[type];
    if (!action) return result(type, 'failed', 'Settings action is not mapped.', 'Missing Android settings action.');
    try {
      await IntentLauncher.startActivityAsync(action);
      return result(type, 'success', 'Opened Android settings.', `${action} launched.`);
    } catch (error) {
      return result(type, 'failed', 'Could not open Android settings.', error instanceof Error ? error.message : 'Unknown settings error.');
    }
  }
}

export const ActionExecutor = new ActionExecutorImpl();
