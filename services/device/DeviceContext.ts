import type { DeviceSnapshot } from './DeviceEvents';

export interface DeviceContextSummary {
  offline: boolean;
  lowBattery: boolean;
  charging: boolean;
  headphonesConnected: boolean;
  foreground: boolean;
  orientation: string;
  timeBucket: string;
  confidence: number;
  facts: string[];
}

export function buildDeviceContext(snapshot: DeviceSnapshot): DeviceContextSummary {
  const facts: string[] = [];
  const offline = snapshot.offline.value === true && snapshot.offline.support === 'supported';
  const charging = snapshot.charging.value === true && snapshot.charging.support === 'supported';
  const batteryLevel = snapshot.batteryLevel.value;
  const lowBattery = typeof batteryLevel === 'number' && batteryLevel <= 0.18 && !charging;
  const headphonesConnected = snapshot.headphones.value === true && snapshot.headphones.support === 'supported';
  const foreground = snapshot.appLifecycle.value === 'active';

  if (offline) facts.push("I'm offline.");
  if (lowBattery) facts.push('Battery is low.');
  if (charging) facts.push('User plugged charger.');
  if (headphonesConnected) facts.push('Headphones connected.');
  if (foreground) facts.push('JISSI is in the foreground.');
  if (snapshot.orientation.value) facts.push(`Orientation is ${snapshot.orientation.value}.`);
  if (snapshot.timeBucket.value) facts.push(`Current time bucket is ${snapshot.timeBucket.value}.`);

  return {
    offline,
    lowBattery,
    charging,
    headphonesConnected,
    foreground,
    orientation: snapshot.orientation.value ?? 'unknown',
    timeBucket: snapshot.timeBucket.value ?? 'unknown',
    confidence: snapshot.confidence,
    facts,
  };
}
