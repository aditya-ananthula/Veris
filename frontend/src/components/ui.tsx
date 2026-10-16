import type { ReactNode } from 'react';
import { ChevronRight, MoreHorizontal, Sparkles } from 'lucide-react';

export function Card({ children, className = '', style }: { children: ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <div className={`rounded-xl haze-panel backdrop-blur-md shadow-soft ${className}`} style={style}>{children}</div>
  );
}

export function EmptyState({ title, hint, action }: { title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-slate-700/40 bg-slate-900/40 px-6 py-10 text-center">
      <p className="text-sm font-medium text-slate-200">{title}</p>
      <p className="max-w-md text-[13px] text-slate-400">{hint}</p>
      {action}
    </div>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-[13px] text-red-200" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button onClick={onRetry} className="shrink-0 underline underline-offset-2 hover:text-white">
          Retry
        </button>
      )}
    </div>
  );
}

export function SectionHeader({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">{title}</h3>
        {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
      </div>
      {action}
    </div>
  );
}

export function CollapseTrigger({ label, onToggle, expanded }: { label: string; onToggle: () => void; expanded: boolean }) {
  return (
    <button
      onClick={onToggle}
      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600/40 bg-slate-800/60 px-3 py-1.5 text-xs font-medium text-slate-300 hover:border-accent-500/50 hover:text-white transition-all duration-200 group"
    >
      <ChevronRight size={14} className={`transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
      {label}
      <MoreHorizontal size={14} className="ml-auto opacity-0 group-hover:opacity-100" />
    </button>
  );
}

export function SparkleBadge({ count }: { count: number }) {
  return count > 0 ? (
    <span className="inline-flex items-center gap-1 rounded-full border border-accent-500/30 bg-accent-500/10 px-2 py-0.5 text-[10px] font-medium text-accent-300">
      <Sparkles size={10} className="text-accent-400" /> {count}
    </span>
  ) : null;
}

export function StatCard({ title, value, subtitle, icon, trend }: { title: string; value: string; subtitle?: string; icon?: ReactNode; trend?: ReactNode }) {
  return (
    <Card className="p-5 hover:bg-slate-800/50 transition-colors">
      <div className="flex flex-col gap-1">
        <div className="flex items-center justify-between">
          <p className="text-xs font-medium text-slate-400">{title}</p>
          {trend}
        </div>
        <p className="text-2xl font-bold text-slate-100">{value}</p>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
        {icon && <div className="mt-4 flex items-center gap-2">{icon}</div>}
      </div>
    </Card>
  );
}

export function Badge({ children, variant = 'default', className = '' }: { children: ReactNode; variant?: 'default' | 'success' | 'warn' | 'muted' | 'error'; className?: string }) {
  const variants: Record<string, string> = {
    default: 'border-slate-600/40 bg-slate-800/50 text-slate-300',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    warn: 'border-amber-500/30 bg-amber-500/10 text-amber-300',
    muted: 'border-slate-700 bg-slate-900/60 text-slate-500',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
}

export function Button({ children, variant = 'default', className = '', disabled }: { children: ReactNode; variant?: 'default' | 'accent' | 'danger' | 'ghost'; className?: string; disabled?: boolean }) {
  const variants: Record<string, string> = {
    default: 'bg-slate-800 border border-slate-600/40 text-slate-200 hover:bg-slate-700 hover:border-slate-500',
    accent: 'bg-accent-500 text-slate-950 hover:bg-accent-400 border-accent-500/30',
    danger: 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/20 hover:text-red-300',
    ghost: 'bg-transparent text-slate-400 hover:bg-slate-800 hover:text-slate-200',
  };
  return (
    <button
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all duration-200 ${variants[variant]} ${className} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      {children}
    </button>
  );
}

export function Input({ className = '', ...props }: { className?: string; [key: string]: any }) {
  return (
    <input
      className={`flex-1 rounded-lg border border-slate-600 bg-slate-950 px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 hover:border-slate-500 focus:border-accent-500 focus:ring-1 focus:ring-accent-500 outline-none transition-all ${className}`}
      {...props}
    />
  );
}

export function Skeleton({ className = '' }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-md bg-slate-700/40 ${className}`} />
  );
}

export function Toast({ message, type = 'info', onDismiss }: { message: string; type?: 'info' | 'success' | 'error'; onDismiss?: () => void }) {
  const colors: Record<string, string> = {
    info: 'border-accent-500/30 bg-accent-500/10 text-slate-200',
    success: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
    error: 'border-red-500/30 bg-red-500/10 text-red-300',
  };
  return (
    <div className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${colors[type]}`}>
      <span>{message}</span>
      {onDismiss && (
        <button onClick={onDismiss} className="ml-auto mt-0.5 p-1 text-slate-500 hover:text-white">
          <span className="sr-only">Dismiss</span>
          <span aria-hidden="true">×</span>
        </button>
      )}
    </div>
  );
}

