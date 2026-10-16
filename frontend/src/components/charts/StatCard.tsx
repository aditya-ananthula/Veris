import type { ComponentType } from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import type { StatCard } from '../../types';

type IconComponent = ComponentType<any>;

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  delta?: string;
  deltaPositive?: boolean;
  icon?: IconComponent;
  iconColor?: string;
}

const DEFAULT_ICON_COLOR = 'text-accent-400';

export function StatCard({
  label,
  value,
  subtext,
  delta,
  deltaPositive = true,
  icon: Icon = Activity,
  iconColor = DEFAULT_ICON_COLOR,
}: StatCardProps) {
  const showDelta = delta != null && delta !== '';
  const trendIcon = showDelta
    ? (deltaPositive ? <TrendingUp size={12} className="text-emerald-400" /> : <TrendingDown size={12} className="text-red-400" />)
    : null;

  return (
    <div className="group relative rounded-xl bg-gradient-to-b from-ink-900/80 to-ink-950 border border-ink-700/60 p-4 hover:border-accent-500/40 hover:bg-ink-800/90 transition-all duration-300 hover:-translate-y-1 hover:shadow-neon-violet/30">
      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <Icon size={16} className={iconColor} />
      </div>
      <p className="text-[10px] uppercase tracking-widest text-slate-500 font-medium">{label}</p>
      <div className="mt-1 flex items-baseline gap-1">
        <span className="text-2xl font-bold text-white tracking-tight">{value}</span>
        {subtext && <span className="text-xs text-slate-400 opacity-80">{subtext}</span>}
      </div>
      {showDelta && (
        <div className="mt-2.5 flex items-center gap-1.5 text-xs">
          {trendIcon}
          <span className={`font-medium ${deltaPositive ? 'text-emerald-400' : 'text-red-400'}`}>{delta}</span>
        </div>
      )}
    </div>
  );
}

export default StatCard;
