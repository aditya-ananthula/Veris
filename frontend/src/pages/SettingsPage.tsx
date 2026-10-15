import { useEffect, useState } from 'react';
import { Server, KeyRound, Database, Cpu } from 'lucide-react';
import { api } from '../services/api';
import { Card, ErrorBanner } from '../components/ui';
import type { Capabilities, Health } from '../types';

export function SettingsPage() {
  const [health, setHealth] = useState<Health | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([api.health(), api.capabilities()])
      .then(([h, c]) => {
        setHealth(h);
        setCaps(c);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to reach backend.'));
  }, []);

  return (
    <div className="flex max-w-3xl flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">Settings &amp; system status</h2>
        <p className="mt-1 text-sm text-slate-400">
          Live backend configuration. Secrets are never exposed to the browser.
        </p>
      </div>
      {error && <ErrorBanner message={error} />}
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Server size={16} className="text-accent-400" /> Backend
        </h3>
        <dl className="mt-3 grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-lg bg-ink-950 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="text-slate-200">{health?.status ?? '—'}</dd>
          </div>
          <div className="rounded-lg bg-ink-950 px-3 py-2">
            <dt className="text-[11px] uppercase tracking-wide text-slate-500">App</dt>
            <dd className="text-slate-200">{health?.app ?? '—'}</dd>
          </div>
        </dl>
      </Card>
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <KeyRound size={16} className="text-accent-400" /> LLM provider
        </h3>
        <p className="mt-2 text-sm text-slate-300">
          Model: <span className="font-mono text-[13px]">{caps?.llm_model ?? health?.model ?? '—'}</span>
        </p>
        <p className="mt-1 text-sm text-slate-400">
          {caps?.groq_configured ?? health?.groq_configured
            ? 'Provider key is configured on the backend.'
            : 'Provider key is NOT configured — questions will fail until GROQ_API_KEY is set server-side.'}
        </p>
      </Card>
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Database size={16} className="text-accent-400" /> Storage
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Persistence: <span className="text-slate-200">{caps?.persistence ?? 'ephemeral-in-memory'}</span>.
          Session TTL: {caps ? Math.round(caps.session_ttl_seconds / 60) : 60} minutes idle.
          Supported: {caps?.supported_extensions.join(', ') ?? '—'} up to {caps?.max_upload_mb ?? 10} MB.
        </p>
      </Card>
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <Cpu size={16} className="text-accent-400" /> Roadmap (not yet implemented)
        </h3>
        <p className="mt-2 text-sm text-slate-400">
          Structured fact extraction, entity resolution, contradiction detection, and change
          intelligence are Phase 3+ work. No placeholder controls are shown for them.
        </p>
      </Card>
    </div>
  );
}
