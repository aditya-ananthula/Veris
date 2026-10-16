import { useState } from 'react';
import { Activity } from 'lucide-react';

interface ActivityChartProps {
  values: number[];
  title?: string;
  height?: number;
  className?: string;
}

export function ActivityChart({ values, title, height = 100, className = '' }: ActivityChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const padTop = title ? 22 : 12;
  const padBottom = 20;
  const padLeft = 4;
  const padRight = 4;
  const width = Math.max(200, values.length * 24 + 40);
  const chartHeight = height;

  const max = Math.max(0, ...values, 1);
  const min = Math.min(0, ...values);
  const range = max - min || 1;

  const points = values.map((v, i) => {
    const x = padLeft + i * ((width - padLeft - padRight) / Math.max(values.length - 1, 1));
    const y = chartHeight - padBottom - ((v - min) / range) * (chartHeight - padTop - padBottom);
    return { x, y, v };
  });

  const path = points
    .map((p, i) => (i === 0 ? `M ${p.x} ${p.y}` : `L ${p.x} ${p.y}`))
    .join(' ');

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      {title && (
        <div className="flex items-center gap-2">
          <Activity size={14} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</span>
        </div>
      )}
      <div className="relative w-full min-h-[90px]" style={{ height: chartHeight }}>
        <svg width={width} height={chartHeight} className="w-full h-full" role="img" aria-label={title || 'Activity chart'}>
          <defs>
            <linearGradient id="area-grad" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="#a855f7" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#a855f7" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          {/* area fill */}
          <path
            d={`M ${padLeft} ${chartHeight - padBottom} ${path} L ${points[points.length - 1]?.x ?? padLeft} ${chartHeight - padBottom} Z`}
            fill="url(#area-grad)"
          />
          {/* line */}
          <path d={path} fill="none" stroke="#a855f7" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="filter drop-shadow-[0_0_8px_rgba(168,85,247,0.4)]" />
          {/* dots */}
          {points.map((p, i) => (
            <circle
              key={i}
              cx={p.x}
              cy={p.y}
              r={hoverIndex === i ? 4.5 : 2.5}
              fill="#a855f7"
              className="transition-all duration-200"
              onMouseEnter={() => setHoverIndex(i)}
              onMouseLeave={() => setHoverIndex(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHoverIndex(i === hoverIndex ? null : i); } }}
            />
          ))}
        </svg>
      </div>
      {hoverIndex != null && (
        <div className="flex items-center gap-2 text-xs bg-ink-900 border border-ink-700/60 rounded-lg px-2.5 py-1.5 backdrop-blur">
          <span className="text-slate-300">Point {hoverIndex + 1}</span>
          <span className="ml-auto font-mono text-accent-400">{values[hoverIndex]}</span>
        </div>
      )}
    </div>
  );
}

export default ActivityChart;
