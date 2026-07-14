import type { DeviceEvent, DeviceSnapshot, DeviceSnapshotListener } from './DeviceEvents';
import { DeviceObservers } from './DeviceObservers';
import { buildDeviceContext, DeviceContextSummary } from './DeviceContext';

class DeviceStateEngineImpl {
  private observers = new DeviceObservers();
  private listeners = new Set<DeviceSnapshotListener>();
  private stopObservers: (() => void) | null = null;
  private snapshotPromise: Promise<DeviceSnapshot>;
  lastUpdated: string | null = null;
  confidence = 0;

  constructor() {
    this.snapshotPromise = this.observers.getSnapshot();
  }

  async getSnapshot(): Promise<DeviceSnapshot> {
    this.snapshotPromise = this.observers.getSnapshot().then((snapshot) => {
      this.lastUpdated = snapshot.lastUpdated;
      this.confidence = snapshot.confidence;
      return snapshot;
    });
    return this.snapshotPromise;
  }

  async getContext(): Promise<DeviceContextSummary> {
    return buildDeviceContext(await this.getSnapshot());
  }

  subscribe(listener: DeviceSnapshotListener): () => void {
    this.listeners.add(listener);
    void this.ensureStarted();
    void this.snapshotPromise.then((snapshot) => listener(snapshot));
    return () => this.unsubscribe(listener);
  }

  unsubscribe(listener: DeviceSnapshotListener): void {
    this.listeners.delete(listener);
    if (this.listeners.size === 0) {
      this.stopObservers?.();
      this.stopObservers = null;
    }
  }

  private async ensureStarted(): Promise<void> {
    if (this.stopObservers) return;
    this.stopObservers = await this.observers.start((snapshot) => {
      this.snapshotPromise = Promise.resolve(snapshot);
      this.lastUpdated = snapshot.lastUpdated;
      this.confidence = snapshot.confidence;
      const event: DeviceEvent = {
        type: 'snapshot_changed',
        timestamp: snapshot.lastUpdated,
        snapshot,
        reason: 'Device observer reported a new snapshot.',
      };
      this.listeners.forEach((listener) => listener(snapshot, event));
    });
  }
}

export const DeviceStateEngine = new DeviceStateEngineImpl();
