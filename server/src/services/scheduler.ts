import { Monitor } from '../types/monitor.js';
import { store } from './store.js';
import { executeCheck } from './checker.js';

class MonitorScheduler {
  private timers: Map<string, NodeJS.Timeout> = new Map();
  private inFlight: Set<string> = new Set();
  private isRunning: boolean = false;

  public start(): void {
    if (this.isRunning) {
      return;
    }
    this.isRunning = true;
    this.syncAll();
  }

  public stop(): void {
    this.isRunning = false;
    for (const [id, timer] of this.timers.entries()) {
      clearInterval(timer);
      this.timers.delete(id);
    }
    this.inFlight.clear();
  }

  public syncAll(): void {
    if (!this.isRunning) {
      return;
    }

    const monitors = store.getMonitors();
    const activeIds = new Set(monitors.map((m) => m.id));

    for (const id of this.timers.keys()) {
      if (!activeIds.has(id)) {
        this.unregisterMonitor(id);
      }
    }

    for (const monitor of monitors) {
      this.registerMonitor(monitor);
    }
  }

  public registerMonitor(monitor: Monitor): void {
    this.unregisterMonitor(monitor.id);

    if (!this.isRunning || !monitor.isActive) {
      return;
    }

    const intervalMs = Math.max((monitor.intervalSeconds || 60) * 1000, 5000);

    // Initial run with slight jitter
    const initialDelay = Math.floor(Math.random() * 2000);
    const initialTimer = setTimeout(() => {
      this.runMonitorCheck(monitor.id);
    }, initialDelay);

    const intervalTimer = setInterval(() => {
      this.runMonitorCheck(monitor.id);
    }, intervalMs);

    this.timers.set(monitor.id, intervalTimer);
  }

  public unregisterMonitor(monitorId: string): void {
    const existing = this.timers.get(monitorId);
    if (existing) {
      clearInterval(existing);
      this.timers.delete(monitorId);
    }
    this.inFlight.delete(monitorId);
  }

  public async triggerImmediate(monitorId: string): Promise<void> {
    await this.runMonitorCheck(monitorId);
  }

  private async runMonitorCheck(monitorId: string): Promise<void> {
    if (this.inFlight.has(monitorId)) {
      return;
    }

    const monitor = store.getMonitorById(monitorId);
    if (!monitor || !monitor.isActive) {
      this.unregisterMonitor(monitorId);
      return;
    }

    this.inFlight.add(monitorId);
    try {
      await executeCheck(monitor);
    } catch (err) {
      console.error(`Scheduler check failed for monitor ${monitorId}:`, err);
    } finally {
      this.inFlight.delete(monitorId);
    }
  }
}

export const scheduler = new MonitorScheduler();
export default scheduler;