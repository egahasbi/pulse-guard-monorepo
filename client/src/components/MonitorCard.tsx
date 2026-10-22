import React from 'react';
import LatencyChart from './LatencyChart';

export interface PingResult {
  timestamp: string | number;
  latencyMs: number;
  statusCode?: number;
  success: boolean;
}

export type MonitorStatus = 'up' | 'down' | 'degraded' | 'paused';

export interface Monitor {
  id: string;
  name: string;
  url: string;
  intervalSec: number;
  status: MonitorStatus;
  uptimePercentage: number;
  lastChecked?: string | number;
  history: PingResult[];
}

interface MonitorCardProps {
  monitor: Monitor;
  onSelect?: (id: string) => void;
  onTogglePause?: (id: string, currentStatus: MonitorStatus) => void;
}

const statusConfig: Record<
  MonitorStatus,
  { label: string; dotClass: string; badgeClass: string }
> = {
  up: {
    label: 'Operational',
    dotClass: 'bg-emerald-500',
    badgeClass: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
  },
  down: {
    label: 'Down',
    dotClass: 'bg-rose-500 animate-pulse',
    badgeClass: 'bg-rose-500/10 text-rose-400 border-rose-500/20'
  },
  degraded: {
    label: 'Degraded',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-500/10 text-amber-400 border-amber-500/20'
  },
  paused: {
    label: 'Paused',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
  }
};

export const MonitorCard: React.FC<MonitorCardProps> = ({
  monitor,
  onSelect,
  onTogglePause
}) => {
  const currentStatus = statusConfig[monitor.status] || statusConfig.paused;
  const recentPings = monitor.history || [];
  const latestPing = recentPings[recentPings.length - 1];

  const handleCardClick = () => {
    if (onSelect) {
      onSelect(monitor.id);
    }
  };

  const handlePauseClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onTogglePause) {
      onTogglePause(monitor.id, monitor.status);
    }
  };

  return (
    <div
      onClick={handleCardClick}
      className="group relative flex flex-col justify-between rounded-xl border border-slate-800 bg-slate-900/60 p-5 backdrop-blur-sm transition-all duration-200 hover:border-slate-700 hover:bg-slate-900 hover:shadow-lg hover:shadow-black/40 cursor-pointer"
    >
      <div>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="truncate text-base font-semibold text-slate-100 group-hover:text-blue-400 transition-colors">
              {monitor.name}
            </h3>
            <p className="truncate text-xs text-slate-400 mt-0.5">
              {monitor.url}
            </p>
          </div>

          <div
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${currentStatus.badgeClass}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${currentStatus.dotClass}`}
            />
            {currentStatus.label}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4 border-y border-slate-800/80 py-3">
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500">
              Uptime
            </span>
            <span className="mt-0.5 block text-lg font-semibold text-slate-200">
              {monitor.uptimePercentage.toFixed(2)}%
            </span>
          </div>
          <div>
            <span className="block text-xs uppercase tracking-wider text-slate-500">
              Latency
            </span>
            <span className="mt-0.5 block text-lg font-semibold text-slate-200">
              {latestPing ? `${Math.round(latestPing.latencyMs)} ms` : '--'}
            </span>
          </div>
        </div>

        <div className="mt-4">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>Latency Trend</span>
            <span>Interval: {monitor.intervalSec}s</span>
          </div>
          <div className="h-20 w-full overflow-hidden rounded-lg bg-slate-950/40 p-1">
            <LatencyChart data={recentPings} />
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between pt-2 text-xs text-slate-500 border-t border-slate-800/50">
        <span>
          {latestPing
            ? `Checked ${new Date(latestPing.timestamp).toLocaleTimeString()}`
            : 'No checks recorded'}
        </span>
        {onTogglePause && (
          <button
            type="button"
            onClick={handlePauseClick}
            className="rounded px-2 py-1 text-slate-400 hover:bg-slate-800 hover:text-slate-200 transition-colors"
          >
            {monitor.status === 'paused' ? 'Resume' : 'Pause'}
          </button>
        )}
      </div>
    </div>
  );
};

export default MonitorCard;