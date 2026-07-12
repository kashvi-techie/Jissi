import type { AndroidActionDefinition, AndroidActionType } from './types';

const DEFINITIONS: AndroidActionDefinition[] = [
  { type: 'open_app', label: 'Open app', description: 'Launch an installed Android app by package name.', risk: 'safe', requiredPayload: ['packageName'], androidOnly: true },
  { type: 'launch_url', label: 'Launch URL', description: 'Open a website or deep link through Android Linking.', risk: 'safe', requiredPayload: ['url'] },
  { type: 'call_contact', label: 'Call contact', description: 'Open the phone dialer for a contact or number.', risk: 'confirmation_required', requiredPayload: ['phoneNumber'] },
  { type: 'send_sms', label: 'Send SMS', description: 'Open the SMS composer with an optional draft message.', risk: 'confirmation_required', requiredPayload: ['phoneNumber'] },
  { type: 'flashlight', label: 'Flashlight', description: 'Future native flashlight toggle. Currently blocked without a torch module.', risk: 'restricted', requiredPayload: [], androidOnly: true },
  { type: 'brightness', label: 'Brightness', description: 'Future brightness control. Currently opens/uses display settings only when native support exists.', risk: 'restricted', requiredPayload: ['value'], androidOnly: true },
  { type: 'volume', label: 'Volume', description: 'Future media-volume control. Currently unavailable without a native audio-control module.', risk: 'restricted', requiredPayload: ['value'], androidOnly: true },
  { type: 'clipboard', label: 'Clipboard', description: 'Copy text to clipboard where platform APIs are available.', risk: 'confirmation_required', requiredPayload: ['text'] },
  { type: 'share_text', label: 'Share text', description: 'Open the native Android share sheet for text.', risk: 'safe', requiredPayload: ['text'] },
  { type: 'open_settings', label: 'Open settings', description: 'Open Android system settings.', risk: 'safe', requiredPayload: [], androidOnly: true },
  { type: 'wifi_settings', label: 'Wi-Fi settings', description: 'Open Android Wi-Fi settings.', risk: 'safe', requiredPayload: [], androidOnly: true },
  { type: 'bluetooth_settings', label: 'Bluetooth settings', description: 'Open Android Bluetooth settings.', risk: 'safe', requiredPayload: [], androidOnly: true },
  { type: 'battery_settings', label: 'Battery settings', description: 'Open Android battery settings.', risk: 'safe', requiredPayload: [], androidOnly: true },
];

class ActionRegistryImpl {
  list(): AndroidActionDefinition[] {
    return DEFINITIONS;
  }

  get(type: AndroidActionType): AndroidActionDefinition | undefined {
    return DEFINITIONS.find((definition) => definition.type === type);
  }

  has(type: AndroidActionType): boolean {
    return !!this.get(type);
  }
}

export const ActionRegistry = new ActionRegistryImpl();
