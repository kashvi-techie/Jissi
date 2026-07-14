import { AppState, AppStateStatus, Dimensions, Platform } from 'react-native';
import type {
  DeviceAppLifecycle,
  DeviceConnectionType,
  DeviceOrientation,
  DeviceReading,
  DeviceSnapshot,
  DeviceSnapshotListener,
  DeviceTimeBucket,
} from './DeviceEvents';

type BrowserBattery = {
  level?: number;
  charging?: boolean;
  addEventListener?: (type: string, listener: () => void) => void;
  removeEventListener?: (type: string, listener: () => void) => void;
};

type NavigatorWithBattery = Navigator & {
  getBattery?: () => Promise<BrowserBattery>;
  connection?: { type?: string; effectiveType?: string; addEventListener?: (type: string, listener: () => void) => void; removeEventListener?: (type: string, listener: () => void) => void };
};

const unsupportedReason = 'No supported Expo/native module is installed for this signal.';

function now(): string {
  return new Date().toISOString();
}

function reading<T>(value: T | null, support: DeviceReading<T>['support'], confidence: number, reason: string): DeviceReading<T> {
  return { value, support, confidence, reason, lastUpdated: now() };
}

function timeBucket(date = new Date()): DeviceTimeBucket {
  const hour = date.getHours();
  if (hour < 6) return 'early_morning';
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  if (hour < 22) return 'evening';
  return 'night';
}

function appLifecycle(value: AppStateStatus): DeviceAppLifecycle {
  if (value === 'active' || value === 'background' || value === 'inactive') return value;
  return 'unknown';
}

function orientation(): DeviceOrientation {
  const size = Dimensions.get('window');
  if (!size.width || !size.height) return 'unknown';
  return size.width >= size.height ? 'landscape' : 'portrait';
}

function connectionTypeFromBrowser(): DeviceConnectionType {
  if (typeof navigator === 'undefined') return 'unknown';
  const nav = navigator as NavigatorWithBattery;
  const type = nav.connection?.type || nav.connection?.effectiveType;
  if (!type) return 'unknown';
  if (/wifi/i.test(type)) return 'wifi';
  if (/cell|2g|3g|4g|5g/i.test(type)) return 'cellular';
  if (/ethernet/i.test(type)) return 'ethernet';
  return 'unknown';
}

function confidence(snapshot: DeviceSnapshot): number {
  const readings = [
    snapshot.batteryLevel,
    snapshot.charging,
    snapshot.powerSaver,
    snapshot.networkOnline,
    snapshot.connectionType,
    snapshot.wifi,
    snapshot.mobileData,
    snapshot.offline,
    snapshot.bluetooth,
    snapshot.headphones,
    snapshot.screenOn,
    snapshot.locked,
    snapshot.appLifecycle,
    snapshot.orientation,
    snapshot.volumeLevel,
    snapshot.brightness,
    snapshot.timeBucket,
  ];
  const total = readings.reduce((sum, item) => sum + item.confidence, 0);
  return Number((total / readings.length).toFixed(2));
}

export class DeviceObservers {
  private battery: BrowserBattery | null = null;
  private unsubscribeFns: Array<() => void> = [];

  async start(listener: DeviceSnapshotListener): Promise<() => void> {
    const notify = async () => listener(await this.getSnapshot());

    const appStateSub = AppState.addEventListener('change', notify);
    this.unsubscribeFns.push(() => appStateSub.remove());

    const dimensionSub = Dimensions.addEventListener('change', notify);
    this.unsubscribeFns.push(() => dimensionSub.remove());

    const timer = setInterval(notify, 60 * 1000);
    this.unsubscribeFns.push(() => clearInterval(timer));

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      window.addEventListener('online', notify);
      window.addEventListener('offline', notify);
      this.unsubscribeFns.push(() => {
        window.removeEventListener('online', notify);
        window.removeEventListener('offline', notify);
      });
    }

    await this.attachBrowserBattery(notify);
    await notify();

    return () => this.stop();
  }

  stop(): void {
    this.unsubscribeFns.forEach((unsubscribe) => unsubscribe());
    this.unsubscribeFns = [];
  }

  async getSnapshot(): Promise<DeviceSnapshot> {
    const timestamp = now();
    const browserBattery = await this.getBrowserBattery();
    const onlineSupported = Platform.OS === 'web' && typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean';
    const online = onlineSupported ? navigator.onLine : null;
    const connectionType = Platform.OS === 'web' ? connectionTypeFromBrowser() : 'unknown';
    const lifecycle = appLifecycle(AppState.currentState);

    const snapshot: DeviceSnapshot = {
      batteryLevel: browserBattery?.level !== undefined
        ? reading(browserBattery.level, 'supported', 0.88, 'Read from the browser Battery Status API.')
        : reading<number>(null, 'unsupported', 0, 'Battery level needs expo-battery or the browser Battery Status API.'),
      charging: browserBattery?.charging !== undefined
        ? reading(browserBattery.charging, 'supported', 0.88, 'Read from the browser Battery Status API.')
        : reading<boolean>(null, 'unsupported', 0, 'Charging state needs expo-battery or the browser Battery Status API.'),
      powerSaver: reading<boolean>(null, 'unsupported', 0, 'Power saver state is not exposed by the current Expo runtime.'),
      networkOnline: onlineSupported
        ? reading(online, 'supported', 0.8, 'Read navigator.onLine from the web runtime.')
        : reading<boolean>(null, 'unsupported', 0, 'Network state needs @react-native-community/netinfo on native.'),
      connectionType: connectionType !== 'unknown'
        ? reading(connectionType, 'supported', 0.7, 'Read from the browser Network Information API.')
        : reading(connectionType, Platform.OS === 'web' ? 'unknown' : 'unsupported', 0.2, Platform.OS === 'web' ? 'Browser did not expose connection type.' : 'Connection type needs NetInfo on native.'),
      wifi: connectionType === 'wifi'
        ? reading(true, 'supported', 0.7, 'Derived from browser connection type.')
        : reading<boolean>(null, Platform.OS === 'web' ? 'unknown' : 'unsupported', 0.15, Platform.OS === 'web' ? 'Wifi could not be confirmed by the browser.' : 'Wifi state needs NetInfo on native.'),
      mobileData: connectionType === 'cellular'
        ? reading(true, 'supported', 0.7, 'Derived from browser connection type.')
        : reading<boolean>(null, Platform.OS === 'web' ? 'unknown' : 'unsupported', 0.15, Platform.OS === 'web' ? 'Mobile data could not be confirmed by the browser.' : 'Mobile data state needs NetInfo on native.'),
      offline: onlineSupported
        ? reading(online === false, 'supported', 0.8, 'Derived from navigator.onLine.')
        : reading<boolean>(null, 'unsupported', 0, 'Offline detection needs NetInfo on native.'),
      bluetooth: reading<boolean>(null, 'unsupported', 0, 'Bluetooth state needs a native Bluetooth module.'),
      headphones: reading<boolean>(null, 'unsupported', 0, 'Headphone route detection needs a native audio route module.'),
      screenOn: lifecycle === 'active'
        ? reading(true, 'supported', 0.62, 'The app is active in the foreground, so the screen is on for JISSI.')
        : reading<boolean>(null, 'unknown', 0.24, 'Screen-on state cannot be confirmed while the app is not active.'),
      locked: reading<boolean>(null, 'unsupported', 0, 'Lock state is not exposed by the current Expo runtime.'),
      appLifecycle: reading(lifecycle, 'supported', 0.92, 'Read from React Native AppState.'),
      orientation: reading(orientation(), 'supported', 0.82, 'Derived from React Native window dimensions.'),
      volumeLevel: reading<number>(null, 'unsupported', 0, unsupportedReason),
      brightness: reading<number>(null, 'unsupported', 0, unsupportedReason),
      timeBucket: reading(timeBucket(), 'supported', 0.96, 'Derived locally from device time.'),
      lastUpdated: timestamp,
      confidence: 0,
    };

    return { ...snapshot, confidence: confidence(snapshot) };
  }

  private async attachBrowserBattery(listener: () => void): Promise<void> {
    const battery = await this.getBrowserBattery();
    if (!battery?.addEventListener || this.battery === battery) return;
    this.battery = battery;
    battery.addEventListener('chargingchange', listener);
    battery.addEventListener('levelchange', listener);
    this.unsubscribeFns.push(() => {
      battery.removeEventListener?.('chargingchange', listener);
      battery.removeEventListener?.('levelchange', listener);
    });
  }

  private async getBrowserBattery(): Promise<BrowserBattery | null> {
    if (this.battery) return this.battery;
    if (Platform.OS !== 'web' || typeof navigator === 'undefined') return null;
    const nav = navigator as NavigatorWithBattery;
    if (!nav.getBattery) return null;
    try {
      this.battery = await nav.getBattery();
      return this.battery;
    } catch {
      return null;
    }
  }
}
