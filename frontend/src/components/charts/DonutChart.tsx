import { useState, useCallback } from 'react';
import { Info } from 'lucide-react';
import type { DonutSeries } from '../../types';

interface DonutChartProps {
  series: DonutSeries[];
  totalLabel: string;
  totalValue: number | string;
  width?: number;
  height?: number;
  className?: string;
}

export function DonutChart({ series, totalLabel, totalValue, width = 220, height = 220, className = '' }: DonutChartProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const total = series.reduce((s, d) => s + d.value, 0);
  const cx = width / 2;
  const cy = height / 2;
  const outerRadius = Math.min(width, height) * 0.38;
  const innerRadius = outerRadius * 0.62;

  const arcs = useCallback(() => {
    const out: { path: string; series: DonutSeries; pct: number; start: number; end: number }[] = [];
    let startAngle = -Math.PI / 2;
    for (const s of series) {
      const sweep = total > 0 ? (s.value / total) * 2 * Math.PI : 0;
      const endAngle = startAngle + sweep;
      const x1 = cx + outerRadius * Math.cos(startAngle);
      const y1 = cy + outerRadius * Math.sin(startAngle);
      const x2 = cx + outerRadius * Math.cos(endAngle);
      const y2 = cy + outerRadius * Math.sin(endAngle);
      const largeArc = sweep > Math.PI ? 1 : 0;
      const path = `M ${x1} ${y1} A ${outerRadius} ${outerRadius} 0 ${largeArc} 1 ${x2} ${y2} L ${cx} ${cy} Z`;
      out.push({ path, series: s, pct: total > 0 ? (s.value / total) * 100 : 0, start: startAngle, end: endAngle });
      startAngle = endAngle;
    }
    return out;
  }, [series, total, cx, cy, outerRadius]);

  const arcList = arcs();

  const onHover = (index: number | null) => setHoverIndex(index);

  const highlighted = hoverIndex != null ? arcList[hoverIndex] : null;
  const baseOpacity = highlighted ? 0.35 : 1;

  return (
    <div className={`flex flex-col items-center justify-center gap-3 ${className}`}>
      <div className="relative">
        <svg width={width} height={height} className="transition-transform duration-200 group-hover:scale-105">
          {arcList.map((arc, i) => (
            <path
              key={arc.series.label}
              d={arc.path}
              fill={arc.series.color}
              className="transition-all duration-300"
              style={{
                opacity: baseOpacity,
                transform: highlighted && i === hoverIndex ? 'scale(1.04)' : 'scale(1)',
                transformOrigin: `${cx}px ${cy}px`,
              } as React.CSSProperties}
              onMouseEnter={() => onHover(i)}
              onMouseLeave={() => onHover(null)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onHover(i === hoverIndex ? null : i);
                }
              }}
            />
          ))}
          {/* center donut hole + total */}
          <circle cx={cx} cy={cy} r={innerRadius} fill="transparent" stroke="var(--donut-border, rgba(255,255,255,0.06))" strokeWidth="2" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className="text-[11px] uppercase tracking-widest text-slate-500">{totalLabel}</span>
          <span className="text-2xl font-bold text-white">{totalValue}</span>
          {hoverIndex != null && highlighted && (
            <div className="mt-1 flex items-center gap-1.5 text-xs">
              <Info size={14} className={highlighted.series.color} />
              <span className="text-slate-300">{highlighted.series.label}</span>
              <span className="text-slate-400">{highlighted.pct.toFixed(0)}%</span>
            </div>
          )}
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-1.5 text-[11px]">
        {series.map((s, i) => (
          <button
            key={s.label}
            onClick={() => onHover(i === hoverIndex ? null : i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onHover(i === hoverIndex ? null : i); } }}
            className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 transition-all ${
              i === hoverIndex
                ? `border-${s.color.replace('#', '')} bg-${s.color.replace('#', '')}/10 text-white`
                : 'border-ink-700 text-slate-400 hover:border-slate-500 hover:text-slate-300'
            }`}
          >
            <span
              className="h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: s.color }}
              aria-hidden="true"
            />
            {s.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DonutChart;
