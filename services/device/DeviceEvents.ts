export type DeviceSupport = 'supported' | 'unsupported' | 'unknown';

export type DeviceConfidence = number;

export interface DeviceReading<T> {
  value: T | null;
  support: DeviceSupport;
  confidence: DeviceConfidence;
  reason: string;
  lastUpdated: string;
}

export type DeviceConnectionType = 'wifi' | 'cellular' | 'ethernet' | 'none' | 'unknown';
export type DeviceAppLifecycle = 'active' | 'background' | 'inactive' | 'unknown';
export type DeviceOrientation = 'portrait' | 'landscape' | 'unknown';
export type DeviceTimeBucket = 'early_morning' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface DeviceSnapshot {
  batteryLevel: DeviceReading<number>;
  charging: DeviceReading<boolean>;
  powerSaver: DeviceReading<boolean>;
  networkOnline: DeviceReading<boolean>;
  connectionType: DeviceReading<DeviceConnectionType>;
  wifi: DeviceReading<boolean>;
  mobileData: DeviceReading<boolean>;
  offline: DeviceReading<boolean>;
  bluetooth: DeviceReading<boolean>;
  headphones: DeviceReading<boolean>;
  screenOn: DeviceReading<boolean>;
  locked: DeviceReading<boolean>;
  appLifecycle: DeviceReading<DeviceAppLifecycle>;
  orientation: DeviceReading<DeviceOrientation>;
  volumeLevel: DeviceReading<number>;
  brightness: DeviceReading<number>;
  timeBucket: DeviceReading<DeviceTimeBucket>;
  lastUpdated: string;
  confidence: DeviceConfidence;
}

export type DeviceEventType =
  | 'battery_changed'
  | 'charging_changed'
  | 'network_changed'
  | 'audio_route_changed'
  | 'screen_changed'
  | 'lifecycle_changed'
  | 'orientation_changed'
  | 'time_bucket_changed'
  | 'snapshot_changed';

export interface DeviceEvent {
  type: DeviceEventType;
  timestamp: string;
  snapshot: DeviceSnapshot;
  reason: string;
}

export type DeviceSnapshotListener = (snapshot: DeviceSnapshot, event?: DeviceEvent) => void;
