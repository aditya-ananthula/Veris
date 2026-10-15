import type { ReactNode } from 'react';

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-xl border border-ink-700/70 bg-ink-900/70 ${className}`}>{children}</div>
  );
}

export function EmptyState({
  title,
  hint,
  action,
}: {
  title: string;
  hint: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-ink-700 bg-ink-900/40 px-6 py-10 text-center">
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
