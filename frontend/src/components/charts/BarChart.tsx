import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import type { BarSeries } from '../../types';

interface BarChartProps {
  series: BarSeries[];
  title?: string;
  height?: number;
  className?: string;
  showValues?: boolean;
}

export function BarChartComponent({ series, title, height = 180, className = '', showValues = true }: BarChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const max = Math.max(0, ...series.map((s) => s.value), 1);
  const barWidth = 34;
  const gap = 16;
  const padTop = title ? 40 : 24;
  const padBottom = 34;
  const padLeft = 44;
  const padRight = 24;
  const chartWidth = Math.max(260, series.length * (barWidth + gap) + padLeft + padRight);
  const chartHeight = height;

  const gridlines = [0.25, 0.5, 0.75, 1].map((ratio) => {
    const y = chartHeight - padBottom - ratio * (chartHeight - padTop - padBottom);
    return (
      <line key={ratio} x1={padLeft} x2={chartWidth - padRight} y1={y} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
    );
  });

  return (
    <div className={`flex flex-col gap-3 ${className}`}>
      {title && (
        <div className="flex items-center gap-2">
          <BarChart3 size={14} className="text-accent-400" />
          <span className="text-xs font-semibold uppercase tracking-widest text-slate-400">{title}</span>
        </div>
      )}
      <div className="relative w-full min-h-[160px]" style={{ height: chartHeight }}>
        <svg width={chartWidth} height={chartHeight} className="w-full h-full" role="img" aria-label={title || 'Bar chart'}>
          <defs>
            {series.map((s, i) => (
              <linearGradient key={i} id={`bar-grad-${i}`} x1="0" x2="0" y1="0" y2="1">
                <stop offset="0%" stopColor={s.color ?? 'currentColor'} stopOpacity={0.9} />
                <stop offset="100%" stopColor={s.color ?? 'currentColor'} stopOpacity={0.35} />
              </linearGradient>
            ))}
          </defs>
          {gridlines}
          {series.map((s, i) => {
            const pct = max > 0 ? s.value / max : 0;
            const barH = pct * (chartHeight - padTop - padBottom);
            const x = padLeft + i * (barWidth + gap);
            const y = chartHeight - padBottom - barH;
            const isHovered = i === hoverIndex;
            return (
              <g
                key={s.label}
                onMouseEnter={() => setHoverIndex(i)}
                onMouseLeave={() => setHoverIndex(null)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setHoverIndex(i === hoverIndex ? null : i); } }}
                className="cursor-pointer"
              >
                <rect x={x} y={y} width={barWidth} height={barH} rx={4} fill={`url(#bar-grad-${i})`} style={{ filter: isHovered ? 'brightness(1.1)' : 'brightness(1)' }} />
                {showValues && barH > 12 && (
                  <text x={x + barWidth / 2} y={y - 6} textAnchor="middle" fill="#94a3b8" fontSize="11" fontWeight="600">{s.value}</text>
                )}
                <text x={x + barWidth / 2} y={chartHeight - padBottom + 14} textAnchor="middle" fill={isHovered ? '#fff' : '#94a3b8'} fontSize="11" className={`transition-colors ${isHovered ? 'font-semibold text-white' : 'text-slate-400'}`}>{s.label}</text>
              </g>
            );
          })}
        </svg>
      </div>
      {hoverIndex != null && series[hoverIndex] && (
        <div className="flex items-center gap-2 text-xs bg-ink-900 border border-ink-700/60 rounded-lg px-2.5 py-1.5 backdrop-blur">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: series[hoverIndex].color ?? 'currentColor' }} aria-hidden="true" />
          <span className="text-slate-300">{series[hoverIndex].label}</span>
          <span className="ml-auto font-mono text-accent-400">{series[hoverIndex].value}</span>
        </div>
      )}
    </div>
  );
}

export default BarChartComponent;
