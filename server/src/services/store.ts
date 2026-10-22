import fs from 'node:fs/promises';
import path from 'node:path';
import { Monitor, CheckResult, MonitorStats } from '../types/monitor.js';

interface StoreSchema {
  monitors: Monitor[];
  checkHistory: Record<string, CheckResult[]>;
}

export class DataStore {
  private static instance: DataStore | null = null;
  private filePath: string;
  private monitors: Map<string, Monitor> = new Map();
  private checkHistory: Map<string, CheckResult[]> = new Map();
  private maxHistoryPerMonitor: number;
  private isSaving: boolean = false;
  private savePending: boolean = false;
  private lockPromise: Promise<void> = Promise.resolve();

  private constructor(storageDir: string = './data', maxHistory: number = 200) {
    this.filePath = path.resolve(storageDir, 'store.json');
    this.maxHistoryPerMonitor = maxHistory;
  }

  public static getInstance(storageDir?: string, maxHistory?: number): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore(storageDir, maxHistory);
    }
    return DataStore.instance;
  }

  private async acquireLock<T>(task: () => Promise<T>): Promise<T> {
    let releaseLock: () => void;
    const nextLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    const previousLock = this.lockPromise;
    this.lockPromise = nextLock;

    try {
      await previousLock;
      return await task();
    } finally {
      releaseLock!();
    }
  }

  public async init(): Promise<void> {
    return this.acquireLock(async () => {
      try {
        const dir = path.dirname(this.filePath);
        await fs.mkdir(dir, { recursive: true });

        const fileExists = await fs
          .access(this.filePath)
          .then(() => true)
          .catch(() => false);

        if (!fileExists) {
          await this.persistDisk();
          return;
        }

        const rawData = await fs.readFile(this.filePath, 'utf-8');
        if (!rawData.trim()) {
          await this.persistDisk();
          return;
        }

        const parsed: StoreSchema = JSON.parse(rawData);

        this.monitors.clear();
        this.checkHistory.clear();

        if (Array.isArray(parsed.monitors)) {
          for (const monitor of parsed.monitors) {
            this.monitors.set(monitor.id, monitor);
          }
        }

        if (parsed.checkHistory && typeof parsed.checkHistory === 'object') {
          for (const [key, results] of Object.entries(parsed.checkHistory)) {
            if (Array.isArray(results)) {
              this.checkHistory.set(key, results.slice(-this.maxHistoryPerMonitor));
            }
          }
        }
      } catch (error) {
        console.error('Failed read storage file. Start empty memory store.', error);
      }
    });
  }

  private async persistDisk(): Promise<void> {
    if (this.isSaving) {
      this.savePending = true;
      return;
    }

    this.isSaving = true;

    try {
      const serializableMonitors = Array.from(this.monitors.values());
      const serializableHistory: Record<string, CheckResult[]> = {};

      for (const [id, history] of this.checkHistory.entries()) {
        serializableHistory[id] = history;
      }

      const payload: StoreSchema = {
        monitors: serializableMonitors,
        checkHistory: serializableHistory
      };

      const tempPath = `${this.filePath}.tmp.${Date.now()}`;
      await fs.writeFile(tempPath, JSON.stringify(payload, null, 2), 'utf-8');
      await fs.rename(tempPath, this.filePath);
    } catch (error) {
      console.error('Store disk write error:', error);
    } finally {
      this.isSaving = false;
      if (this.savePending) {
        this.savePending = false;
        await this.persistDisk();
      }
    }
  }

  public async getAllMonitors(): Promise<Monitor[]> {
    return this.acquireLock(async () => {
      return Array.from(this.monitors.values()).map((m) => ({ ...m }));
    });
  }

  public async getMonitorById(id: string): Promise<Monitor | null> {
    return this.acquireLock(async () => {
      const monitor = this.monitors.get(id);
      return monitor ? { ...monitor } : null;
    });
  }

  public async upsertMonitor(monitor: Monitor): Promise<Monitor> {
    return this.acquireLock(async () => {
      const copy: Monitor = { ...monitor, updatedAt: new Date().toISOString() };
      this.monitors.set(copy.id, copy);
      if (!this.checkHistory.has(copy.id)) {
        this.checkHistory.set(copy.id, []);
      }
      await this.persistDisk();
      return { ...copy };
    });
  }

  public async deleteMonitor(id: string): Promise<boolean> {
    return this.acquireLock(async () => {
      const monitorExisted = this.monitors.delete(id);
      this.checkHistory.delete(id);
      if (monitorExisted) {
        await this.persistDisk();
      }
      return monitorExisted;
    });
  }

  public async addCheckResult(monitorId: string, result: CheckResult): Promise<void> {
    return this.acquireLock(async () => {
      const monitor = this.monitors.get(monitorId);
      if (monitor) {
        monitor.status = result.status;
        monitor.lastCheckAt = result.timestamp;
        monitor.updatedAt = new Date().toISOString();
      }

      let history = this.checkHistory.get(monitorId);
      if (!history) {
        history = [];
        this.checkHistory.set(monitorId, history);
      }

      history.push(result);
      if (history.length > this.maxHistoryPerMonitor) {
        history.splice(0, history.length - this.maxHistoryPerMonitor);
      }

      await this.persistDisk();
    });
  }

  public async getCheckHistory(monitorId: string, limit?: number): Promise<CheckResult[]> {
    return this.acquireLock(async () => {
      const history = this.checkHistory.get(monitorId) || [];
      const sliceCount = limit && limit > 0 ? limit : history.length;
      return history.slice(-sliceCount).map((item) => ({ ...item }));
    });
  }

  public async getMonitorStats(monitorId: string): Promise<MonitorStats | null> {
    return this.acquireLock(async () => {
      const monitor = this.monitors.get(monitorId);
      if (!monitor) {
        return null;
      }

      const history = this.checkHistory.get(monitorId) || [];
      if (history.length === 0) {
        return {
          monitorId,
          totalChecks: 0,
          upChecks: 0,
          downChecks: 0,
          uptimePercentage: 100,
          avgLatencyMs: 0,
          p95LatencyMs: 0,
          p99LatencyMs: 0
        };
      }

      const totalChecks = history.length;
      let upChecks = 0;
      let downChecks = 0;
      let sumLatency = 0;
      const latencies: number[] = [];

      for (const item of history) {
        if (item.status === 'UP' || item.status === 'DEGRADED') {
          upChecks++;
        } else {
          downChecks++;
        }
        sumLatency += item.latencyMs;
        latencies.push(item.latencyMs);
      }

      latencies.sort((a, b) => a - b);
      const p95Index = Math.min(Math.floor(latencies.length * 0.95), latencies.length - 1);
      const p99Index = Math.min(Math.floor(latencies.length * 0.99), latencies.length - 1);

      return {
        monitorId,
        totalChecks,
        upChecks,
        downChecks,
        uptimePercentage: Number(((upChecks / totalChecks) * 100).toFixed(2)),
        avgLatencyMs: Math.round(sumLatency / totalChecks),
        p95LatencyMs: latencies[p95Index] || 0,
        p99LatencyMs: latencies[p99Index] || 0
      };
    });
  }

  public async clearAll(): Promise<void> {
    return this.acquireLock(async () => {
      this.monitors.clear();
      this.checkHistory.clear();
      await this.persistDisk();
    });
  }
}

export const store = DataStore.getInstance();