import { Platform, Linking, Alert } from 'react-native';
import {
  ActionType,
  ActionResult,
  ActionResultStatus,
  ActionContext,
  AppIntent,
  APP_PACKAGES,
  INTENT_TO_ACTION,
} from './types';
import { IntentType } from '@/engine/intentEngine';

let IntentLauncher: any = null;
try {
  IntentLauncher = require('expo-intent-launcher');
} catch {
  console.warn('expo-intent-launcher not available');
}

function generateActionId(): string {
  return `action_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function createResult(
  type: ActionType,
  status: ActionResultStatus,
  message: string,
  error?: string,
  data?: Record<string, unknown>
): ActionResult {
  return {
    actionId: generateActionId(),
    type,
    status,
    message,
    error,
    timestamp: Date.now(),
    data,
  };
}

async function launchAppIntent(intent: AppIntent): Promise<boolean> {
  if (Platform.OS === 'web') {
    console.warn('App launching is not supported on web');
    return false;
  }

  if (!IntentLauncher) {
    console.warn('IntentLauncher not available');
    return false;
  }

  try {
    if (intent.packageName) {
      await IntentLauncher.startActivityAsync(
        'android.intent.action.MAIN',
        {
          packageName: intent.packageName,
          className: `${intent.packageName}.Main`,
        }
      );
      return true;
    } else if (intent.uri) {
      const canOpen = await Linking.canOpenURL(intent.uri);
      if (canOpen) {
        await Linking.openURL(intent.uri);
        return true;
      }
      return false;
    }
    return false;
  } catch (error) {
    console.error('Failed to launch intent:', error);
    return false;
  }
}

async function openApp(packageName: string, appName: string): Promise<ActionResult> {
  if (Platform.OS === 'web') {
    return createResult(
      'open_app',
      'failed',
      'App launching is only available on mobile devices',
      'web_not_supported'
    );
  }

  try {
    if (!IntentLauncher) {
      return createResult(
        'open_app',
        'failed',
        'Intent launcher not available',
        'intent_launcher_unavailable'
      );
    }
    await IntentLauncher.startActivityAsync(
      'android.intent.action.MAIN',
      {
        packageName,
      }
    );
    return createResult(
      'open_app',
      'success',
      `Opened ${appName}`,
      undefined,
      { packageName }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('not found') || errorMessage.includes('No Activity')) {
      return createResult(
        'open_app',
        'failed',
        `${appName} is not installed on your device`,
        'app_not_installed',
        { packageName, suggestion: `Install ${appName} from Play Store` }
      );
    }
    return createResult(
      'open_app',
      'failed',
      `Failed to open ${appName}`,
      errorMessage,
      { packageName }
    );
  }
}

async function openWebsite(url: string): Promise<ActionResult> {
  try {
    const finalUrl = url.startsWith('http') ? url : `https://${url}`;
    const canOpen = await Linking.canOpenURL(finalUrl);

    if (!canOpen) {
      return createResult(
        'open_website',
        'failed',
        'Cannot open this URL',
        'url_not_supported',
        { url }
      );
    }

    await Linking.openURL(finalUrl);
    return createResult(
      'open_website',
      'success',
      `Opened ${finalUrl}`,
      undefined,
      { url: finalUrl }
    );
  } catch (error) {
    return createResult(
      'open_website',
      'failed',
      'Failed to open website',
      error instanceof Error ? error.message : 'Unknown error',
      { url }
    );
  }
}

async function searchWeb(query: string): Promise<ActionResult> {
  if (!query || query.trim().length === 0) {
    return createResult(
      'search_web',
      'failed',
      'No search query provided',
      'empty_query'
    );
  }

  const encodedQuery = encodeURIComponent(query.trim());

  if (Platform.OS === 'web') {
    const googleUrl = `https://www.google.com/search?q=${encodedQuery}`;
    window.open(googleUrl, '_blank');
    return createResult(
      'search_web',
      'success',
      `Searching for "${query}"`,
      undefined,
      { query, url: googleUrl }
    );
  }

  try {
    const googleSearchUrl = `https://www.google.com/search?q=${encodedQuery}`;
    const canOpen = await Linking.canOpenURL(googleSearchUrl);

    if (canOpen) {
      await Linking.openURL(googleSearchUrl);
      return createResult(
        'search_web',
        'success',
        `Searching Google for "${query}"`,
        undefined,
        { query, url: googleSearchUrl }
      );
    }

    if (IntentLauncher) {
      await IntentLauncher.startActivityAsync(
        'android.intent.action.WEB_SEARCH',
        {
          extra: {
            'android.intent.action.SEARCH': query,
          },
        }
      );
    }

    return createResult(
      'search_web',
      'success',
      `Searching for "${query}"`,
      undefined,
      { query }
    );
  } catch (error) {
    const googleUrl = `https://www.google.com/search?q=${encodedQuery}`;
    try {
      await Linking.openURL(googleUrl);
      return createResult(
        'search_web',
        'success',
        `Searching Google for "${query}"`,
        undefined,
        { query, url: googleUrl }
      );
    } catch {
      return createResult(
        'search_web',
        'failed',
        'Failed to perform search',
        error instanceof Error ? error.message : 'Unknown error',
        { query }
      );
    }
  }
}

async function callContact(phoneNumber: string, contactName?: string): Promise<ActionResult> {
  if (!phoneNumber) {
    return createResult(
      'call_contact',
      'failed',
      'No phone number provided',
      'missing_phone_number'
    );
  }

  const telUrl = `tel:${phoneNumber}`;

  try {
    const canOpen = await Linking.canOpenURL(telUrl);
    if (!canOpen) {
      return createResult(
        'call_contact',
        'failed',
        'Cannot make phone calls on this device',
        'tel_not_supported'
      );
    }

    await Linking.openURL(telUrl);
    const displayName = contactName || phoneNumber;
    return createResult(
      'call_contact',
      'success',
      `Calling ${displayName}`,
      undefined,
      { phoneNumber, contactName }
    );
  } catch (error) {
    return createResult(
      'call_contact',
      'failed',
      'Failed to initiate call',
      error instanceof Error ? error.message : 'Unknown error',
      { phoneNumber, contactName }
    );
  }
}

async function sendMessage(phoneNumber: string, message: string, contactName?: string): Promise<ActionResult> {
  if (!phoneNumber) {
    return createResult(
      'send_message',
      'failed',
      'No phone number provided',
      'missing_phone_number'
    );
  }

  const smsUrl = message
    ? `sms:${phoneNumber}?body=${encodeURIComponent(message)}`
    : `sms:${phoneNumber}`;

  try {
    const canOpen = await Linking.canOpenURL(smsUrl);
    if (!canOpen) {
      return createResult(
        'send_message',
        'failed',
        'Cannot send messages on this device',
        'sms_not_supported'
      );
    }

    await Linking.openURL(smsUrl);
    const displayName = contactName || phoneNumber;
    return createResult(
      'send_message',
      'success',
      `Opening messages to ${displayName}`,
      undefined,
      { phoneNumber, contactName, message }
    );
  } catch (error) {
    return createResult(
      'send_message',
      'failed',
      'Failed to open messaging',
      error instanceof Error ? error.message : 'Unknown error',
      { phoneNumber, contactName }
    );
  }
}

async function setReminder(text: string, dateTime?: Date): Promise<ActionResult> {
  if (Platform.OS === 'web') {
    return createResult(
      'set_reminder',
      'failed',
      'Reminders require the mobile app',
      'web_not_supported',
      { text }
    );
  }

  if (!IntentLauncher) {
    return createResult(
      'set_reminder',
      'failed',
      'Intent launcher not available',
      'intent_launcher_unavailable',
      { text }
    );
  }

  try {
    const timestamp = dateTime ? dateTime.getTime() : Date.now() + 3600000;

    await IntentLauncher.startActivityAsync(
      'android.intent.action.SET_ALARM',
      {
        extra: {
          'android.intent.extra.ALARM_MESSAGE': text,
          'android.intent.extra.ALARM_LENGTH': Math.floor((timestamp - Date.now()) / 1000),
        },
      }
    );

    return createResult(
      'set_reminder',
      'success',
      `Reminder set: "${text}"`,
      undefined,
      { text, scheduledFor: new Date(timestamp).toISOString() }
    );
  } catch (error) {
    return createResult(
      'set_reminder',
      'failed',
      'Failed to set reminder. Please set it manually in your Clock app.',
      error instanceof Error ? error.message : 'Unknown error',
      { text }
    );
  }
}

async function setAlarm(label: string, dateTime: Date): Promise<ActionResult> {
  if (Platform.OS === 'web') {
    return createResult(
      'set_alarm',
      'failed',
      'Alarms require the mobile app',
      'web_not_supported',
      { label }
    );
  }

  if (!IntentLauncher) {
    return createResult(
      'set_alarm',
      'failed',
      'Intent launcher not available',
      'intent_launcher_unavailable',
      { label }
    );
  }

  try {
    const hours = dateTime.getHours();
    const minutes = dateTime.getMinutes();

    await IntentLauncher.startActivityAsync(
      'android.intent.action.SET_ALARM',
      {
        extra: {
          'android.intent.extra.ALARM_HOUR': hours,
          'android.intent.extra.ALARM_MINUTES': minutes,
          'android.intent.extra.ALARM_MESSAGE': label,
          'android.intent.extra.ALARM_SKIP_UI': false,
        },
      }
    );

    const timeStr = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
    return createResult(
      'set_alarm',
      'success',
      `Alarm set for ${timeStr}: "${label}"`,
      undefined,
      { label, time: timeStr }
    );
  } catch (error) {
    return createResult(
      'set_alarm',
      'failed',
      'Failed to set alarm. Please set it manually in your Clock app.',
      error instanceof Error ? error.message : 'Unknown error',
      { label }
    );
  }
}

async function openFile(filePath: string): Promise<ActionResult> {
  if (Platform.OS === 'web') {
    return createResult(
      'open_file',
      'failed',
      'File opening is only available on mobile devices',
      'web_not_supported',
      { filePath }
    );
  }

  if (!IntentLauncher) {
    return createResult(
      'open_file',
      'failed',
      'Intent launcher not available',
      'intent_launcher_unavailable',
      { filePath }
    );
  }

  try {
    await IntentLauncher.startActivityAsync(
      'android.intent.action.VIEW',
      {
        data: filePath,
        type: '*/*',
        flags: 1,
      }
    );

    return createResult(
      'open_file',
      'success',
      `Opening file`,
      undefined,
      { filePath }
    );
  } catch (error) {
    return createResult(
      'open_file',
      'failed',
      'Failed to open file',
      error instanceof Error ? error.message : 'Unknown error',
      { filePath }
    );
  }
}

class ActionServiceImpl {
  private lastResult: ActionResult | null = null;
  private resultCallbacks: Set<(result: ActionResult) => void> = new Set();

  subscribeToResults(callback: (result: ActionResult) => void): () => void {
    this.resultCallbacks.add(callback);
    return () => {
      this.resultCallbacks.delete(callback);
    };
  }

  private notifyResult(result: ActionResult): void {
    this.lastResult = result;
    this.resultCallbacks.forEach(cb => {
      try {
        cb(result);
      } catch (e) {
        console.error('Error in result callback:', e);
      }
    });
  }

  async executeFromIntent(intentType: IntentType, query?: string): Promise<ActionResult> {
    const actionType = INTENT_TO_ACTION[intentType];
    const context: ActionContext = { query };

    switch (intentType) {
      case 'open_youtube':
        return this.executeAction('open_app', { ...context, query: APP_PACKAGES.youtube });

      case 'open_chrome':
        return this.executeAction('open_app', { ...context, query: APP_PACKAGES.chrome });

      case 'open_whatsapp':
        return this.executeAction('open_app', { ...context, query: APP_PACKAGES.whatsapp });

      case 'search_google':
        return this.executeAction('search_web', context);

      case 'ask_ai':
        return createResult('unknown', 'pending', 'AI queries are handled by the conversation layer');

      case 'unknown':
      default:
        return createResult('unknown', 'failed', 'Unknown intent - cannot execute action');
    }
  }

  async executeAction(type: ActionType, context: ActionContext): Promise<ActionResult> {
    let result: ActionResult;

    switch (type) {
      case 'open_app': {
        const packageName = context.query || '';
        if (!packageName) {
          result = createResult(type, 'failed', 'No app specified', 'missing_app');
          break;
        }

        const appName = Object.entries(APP_PACKAGES).find(
          ([, pkg]) => pkg === packageName
        )?.[0] || 'App';

        if (Platform.OS === 'android') {
          result = await openApp(packageName, appName);
        } else if (Platform.OS === 'web') {
          result = createResult(
            type,
            'failed',
            `${appName} can only be opened on Android devices`,
            'web_not_supported'
          );
        } else {
          try {
            await Linking.openURL(`app://${packageName}`);
            result = createResult(type, 'success', `Opened ${appName}`);
          } catch {
            result = createResult(type, 'failed', `Failed to open ${appName}`);
          }
        }
        break;
      }

      case 'open_website':
        result = await openWebsite(context.query || '');
        break;

      case 'search_web':
        result = await searchWeb(context.query || '');
        break;

      case 'call_contact':
        result = await callContact(context.phoneNumber || '', context.contactName);
        break;

      case 'send_message':
        result = await sendMessage(context.phoneNumber || '', context.message || '', context.contactName);
        break;

      case 'set_reminder':
        result = await setReminder(context.reminderText || context.query || '', context.remindAt);
        break;

      case 'set_alarm':
        result = await setAlarm(context.query || 'Alarm', context.alarmTime || new Date());
        break;

      case 'open_file':
        result = await openFile(context.filePath || '');
        break;

      case 'unknown':
      default:
        result = createResult(type, 'failed', `Action type "${type}" is not implemented`);
        break;
    }

    this.notifyResult(result);
    return result;
  }

  getLastResult(): ActionResult | null {
    return this.lastResult;
  }

  getSupportedApps(): string[] {
    return Object.keys(APP_PACKAGES);
  }

  getSupportedActions(): ActionType[] {
    return [
      'open_app',
      'open_website',
      'search_web',
      'call_contact',
      'send_message',
      'set_reminder',
      'set_alarm',
      'open_file',
    ];
  }
}

export const ActionService = new ActionServiceImpl();
