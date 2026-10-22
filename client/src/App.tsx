import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { MonitorCard } from './components/MonitorCard';
import { AddMonitorModal } from './components/AddMonitorModal';
import { LatencyChart } from './components/LatencyChart';

export interface PingRecord {
  timestamp: number;
  latencyMs: number;
  statusCode: number;
  success: boolean;
}

export interface Monitor {
  id: string;
  name: string;
  url: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';
  intervalSeconds: number;
  status: 'UP' | 'DOWN' | 'PENDING';
  uptimePercentage: number;
  lastCheckedAt?: number;
  history: PingRecord[];
  webhookUrl?: string;
  headers?: Record<string, string>;
}

export default function App() {
  const [monitors, setMonitors] = useState<Monitor[]>([]);
  const [selectedMonitorId, setSelectedMonitorId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMonitors = useCallback(async () => {
    try {
      const response = await axios.get<Monitor[]>('/api/monitors');
      setMonitors(response.data);
      setError(null);
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        setError(err.response?.data?.message || err.message);
      } else {
        setError('Failed to fetch monitor data');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMonitors();
    const interval = setInterval(fetchMonitors, 5000);
    return () => clearInterval(interval);
  }, [fetchMonitors]);

  const handleAddMonitor = async (newMonitor: {
    name: string;
    url: string;
    method: Monitor['method'];
    intervalSeconds: number;
    webhookUrl?: string;
  }) => {
    try {
      await axios.post('/api/monitors', newMonitor);
      setIsModalOpen(false);
      await fetchMonitors();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || 'Failed to create monitor');
      } else {
        alert('Failed to create monitor');
      }
    }
  };

  const handleDeleteMonitor = async (id: string) => {
    try {
      await axios.delete(`/api/monitors/${id}`);
      if (selectedMonitorId === id) {
        setSelectedMonitorId(null);
      }
      await fetchMonitors();
    } catch (err: unknown) {
      if (axios.isAxiosError(err)) {
        alert(err.response?.data?.error || 'Failed to delete monitor');
      } else {
        alert('Failed to delete monitor');
      }
    }
  };

  const selectedMonitor = monitors.find((m) => m.id === selectedMonitorId) || monitors[0] || null;

  const totalMonitors = monitors.length;
  const upMonitors = monitors.filter((m) => m.status === 'UP').length;
  const downMonitors = monitors.filter((m) => m.status === 'DOWN').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans antialiased">
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center font-bold text-lg text-white shadow-lg shadow-indigo-600/30">
              P
            </span>
            <span className="text-xl font-bold tracking-tight text-white">
              Pulse<span className="text-indigo-500">Guard</span>
            </span>
          </div>
          <button
            onClick={() => setIsModalOpen(true)}
            className="inline-flex items-center px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-600/20 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-900"
          >
            Add New Monitor
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 w-full space-y-8">
        <section className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-sm font-medium text-slate-400">Total Services</span>
            <div className="mt-2 text-3xl font-extrabold text-white">{totalMonitors}</div>
          </div>
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-sm font-medium text-emerald-400">Operational</span>
            <div className="mt-2 text-3xl font-extrabold text-emerald-500">{upMonitors}</div>
          </div>
          <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40">
            <span className="text-sm font-medium text-rose-400">Incidents</span>
            <div className="mt-2 text-3xl font-extrabold text-rose-500">{downMonitors}</div>
          </div>
        </section>

        {error && (
          <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400 text-sm">
            {error}
          </div>
        )}

        <section className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
          <div className="lg:col-span-2 space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Active Monitors</h2>
            {loading && monitors.length === 0 ? (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                Loading endpoints...
              </div>
            ) : monitors.length === 0 ? (
              <div className="p-12 text-center text-slate-500 border border-dashed border-slate-800 rounded-xl">
                No active monitors configured. Add one to start health checking.
              </div>
            ) : (
              <div className="space-y-3">
                {monitors.map((monitor) => (
                  <div
                    key={monitor.id}
                    onClick={() => setSelectedMonitorId(monitor.id)}
                    className="cursor-pointer"
                  >
                    <MonitorCard
                      monitor={monitor}
                      isSelected={selectedMonitor?.id === monitor.id}
                      onDelete={() => handleDeleteMonitor(monitor.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-slate-200">Latency & Trends</h2>
            <div className="p-5 rounded-xl border border-slate-800 bg-slate-900/40 sticky top-24">
              {selectedMonitor ? (
                <div>
                  <div className="mb-4">
                    <h3 className="font-medium text-white truncate">{selectedMonitor.name}</h3>
                    <p className="text-xs text-slate-400 truncate">{selectedMonitor.url}</p>
                  </div>
                  <LatencyChart history={selectedMonitor.history || []} />
                </div>
              ) : (
                <div className="py-16 text-center text-sm text-slate-500">
                  Select monitor to inspect response latency metrics.
                </div>
              )}
            </div>
          </div>
        </section>
      </main>

      <AddMonitorModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleAddMonitor}
      />
    </div>
  );
}