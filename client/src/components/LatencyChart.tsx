import React, { useState, useId } from 'react';

export interface LatencyPoint {
  timestamp: number | string;
  responseTimeMs: number;
  status?: number;
}

export interface LatencyChartProps {
  data: LatencyPoint[];
  height?: number;
  color?: string;
  fillOpacity?: number;
  showAxes?: boolean;
  unit?: string;
  className?: string;
}

export const LatencyChart: React.FC<LatencyChartProps> = ({
  data,
  height = 80,
  color = '#38bdf8',
  fillOpacity = 0.15,
  showAxes = false,
  unit = 'ms',
  className = '',
}) => {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const gradientId = useId();

  if (!data || data.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-xs text-slate-500 border border-dashed border-slate-800 rounded bg-slate-900/40 ${className}`}
        style={{ height }}
      >
        No latency records
      </div>
    );
  }

  const padding = {
    top: 8,
    bottom: showAxes ? 22 : 8,
    left: showAxes ? 38 : 6,
    right: 8,
  };

  const viewBoxWidth = 500;
  const innerWidth = viewBoxWidth - padding.left - padding.right;
  const innerHeight = Math.max(height - padding.top - padding.bottom, 10);

  const values = data.map((d) => Math.max(0, d.responseTimeMs));
  const minVal = 0;
  const computedMax = Math.max(...values, 10);
  const maxVal = Math.ceil(computedMax * 1.15);

  const getX = (idx: number): number => {
    if (data.length <= 1) return padding.left + innerWidth / 2;
    return padding.left + (idx / (data.length - 1)) * innerWidth;
  };

  const getY = (val: number): number => {
    const clamped = Math.max(minVal, Math.min(val, maxVal));
    const ratio = (clamped - minVal) / (maxVal - minVal);
    return padding.top + innerHeight - ratio * innerHeight;
  };

  const coordinates = data.map((pt, idx) => ({
    x: getX(idx),
    y: getY(pt.responseTimeMs),
    raw: pt,
  }));

  const linePath = coordinates.reduce((acc, curr, idx) => {
    if (idx === 0) return `M ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
    return `${acc} L ${curr.x.toFixed(2)} ${curr.y.toFixed(2)}`;
  }, '');

  const firstPoint = coordinates[0];
  const lastPoint = coordinates[coordinates.length - 1];
  const baselineY = padding.top + innerHeight;
  const areaPath = `${linePath} L ${lastPoint.x.toFixed(2)} ${baselineY.toFixed(2)} L ${firstPoint.x.toFixed(2)} ${baselineY.toFixed(2)} Z`;

  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const svgRatio = clientX / rect.width;
    const scaledX = svgRatio * viewBoxWidth;

    let closestIdx = 0;
    let minDistance = Infinity;

    coordinates.forEach((pt, idx) => {
      const dist = Math.abs(pt.x - scaledX);
      if (dist < minDistance) {
        minDistance = dist;
        closestIdx = idx;
      }
    });

    setHoverIndex(closestIdx);
  };

  const activePoint = hoverIndex !== null ? coordinates[hoverIndex] : null;

  const formatTimestamp = (val: number | string): string => {
    const d = new Date(val);
    return isNaN(d.getTime()) ? String(val) : d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  return (
    <div className={`relative w-full select-none ${className}`}>
      <svg
        viewBox={`0 0 ${viewBoxWidth} ${height}`}
        className="w-full overflow-visible block"
        style={{ height }}
        preserveAspectRatio="none"
        onPointerMove={handlePointerMove}
        onPointerLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={fillOpacity} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>

        {showAxes && (
          <g className="text-[10px] fill-slate-500 font-mono">
            <line
              x1={padding.left}
              y1={padding.top}
              x2={viewBoxWidth - padding.right}
              y2={padding.top}
              stroke="#334155"
              strokeDasharray="2 2"
              strokeWidth="0.5"
            />
            <line
              x1={padding.left}
              y1={baselineY}
              x2={viewBoxWidth - padding.right}
              y2={baselineY}
              stroke="#334155"
              strokeWidth="0.5"
            />
            <text x={padding.left - 4} y={padding.top + 8} textAnchor="end">
              {maxVal}
            </text>
            <text x={padding.left - 4} y={baselineY} textAnchor="end">
              0
            </text>
            <text x={padding.left} y={height - 4} textAnchor="start">
              {formatTimestamp(data[0].timestamp)}
            </text>
            <text x={viewBoxWidth - padding.right} y={height - 4} textAnchor="end">
              {formatTimestamp(data[data.length - 1].timestamp)}
            </text>
          </g>
        )}

        <path d={areaPath} fill={`url(#${gradientId})`} />

        <path
          d={linePath}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {activePoint && (
          <g>
            <line
              x1={activePoint.x}
              y1={padding.top}
              x2={activePoint.x}
              y2={baselineY}
              stroke="#64748b"
              strokeWidth="1"
              strokeDasharray="2 2"
            />
            <circle
              cx={activePoint.x}
              cy={activePoint.y}
              r="3.5"
              fill={color}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          </g>
        )}
      </svg>

      {activePoint && (
        <div
          className="absolute pointer-events-none z-10 -top-8 transform -translate-x-1/2 bg-slate-900/90 backdrop-blur-sm border border-slate-700 text-slate-200 text-xs px-2 py-0.5 rounded shadow-lg whitespace-nowrap flex items-center gap-1.5 font-mono"
          style={{
            left: `${(activePoint.x / viewBoxWidth) * 100}%`,
          }}
        >
          <span className="font-semibold text-emerald-400">
            {activePoint.raw.responseTimeMs}
            {unit}
          </span>
          {activePoint.raw.status !== undefined && (
            <span
              className={`text-[10px] px-1 rounded ${
                activePoint.raw.status >= 200 && activePoint.raw.status < 300
                  ? 'bg-emerald-950 text-emerald-400'
                  : 'bg-rose-950 text-rose-400'
              }`}
            >
              {activePoint.raw.status}
            </span>
          )}
          <span className="text-[10px] text-slate-400">
            {formatTimestamp(activePoint.raw.timestamp)}
          </span>
        </div>
      )}
    </div>
  );
};

export default LatencyChart;