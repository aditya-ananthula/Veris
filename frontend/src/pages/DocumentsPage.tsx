import { useEffect, useState } from 'react';
import { Trash2, RefreshCw, FileText } from 'lucide-react';
import { api, ApiError } from '../services/api';
import { useSession } from '../hooks/useSession';
import { Card, EmptyState, ErrorBanner } from '../components/ui';
import { UploadDropzone } from '../components/UploadDropzone';
import type { Capabilities, DocumentMeta } from '../types';

export function DocumentsPage() {
  const { sessionId } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = async (sid: string) => {
    setLoading(true);
    try {
      setError('');
      const [c, m] = await Promise.all([api.capabilities(), api.documentsMeta(sid)]);
      setCaps(c);
      setDocs(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load documents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (sessionId) void load(sessionId);
  }, [sessionId]);

  const extOk = (name: string) => {
    if (!caps) return true;
    return caps.supported_extensions.includes('.' + name.split('.').pop()?.toLowerCase());
  };

  const upload = async (files: File[]) => {
    if (!sessionId) return;
    setBusy(true);
    setNotice('');
    try {
      for (const f of files) {
        if (!caps) throw new Error(f.name + ': capabilities not loaded.');
        if (!extOk(f.name)) throw new Error(f.name + ': unsupported type. Use ' + caps.supported_extensions.join(', '));
        if (f.size > (caps.max_upload_bytes ?? 10 * 1024 * 1024))
          throw new Error(f.name + ': exceeds ' + (caps.max_upload_mb ?? 10) + ' MB.');
        const r = await api.absorb(f, sessionId);
        setNotice('Added ' + r.filename + ' (' + r.chunks_added + ' chunks).');
      }
      await load(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (filename: string) => {
    if (!sessionId || !confirm('Remove "' + filename + '" from this session?')) return;
    try {
      setError('');
      const r = await api.deleteDocument(filename, sessionId);
      setNotice('Removed ' + r.filename + ' (' + r.chunks_removed + ' chunks).');
      await load(sessionId);
    } catch (e) {
      setError(
        e instanceof ApiError && e.status === 404
          ? '"' + filename + '" was not found in this session.'
          : e instanceof Error
            ? e.message
            : 'Delete failed.',
      );
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-slate-100">Document library</h2>
          <p className="mt-1 text-sm text-slate-400">
            Session-scoped collection. Re-uploading a filename replaces its chunks.
          </p>
        </div>
        <button
          onClick={() => sessionId && void load(sessionId)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => sessionId && void load(sessionId)} />}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-200" role="status">
          {notice}
        </div>
      )}
      <UploadDropzone
        accept={caps ? caps.supported_extensions.join(',') : '.pdf,.docx,.txt,.md'}
        maxMb={caps?.max_upload_mb ?? 10}
        onFiles={(f) => void upload(f)}
        disabled={busy || loading || !sessionId}
      />
      {busy && <p className="text-xs text-slate-400">Reading and embedding documents…</p>}
      <Card className="p-2">
        {loading ? (
          <p className="px-4 py-8 text-center text-sm text-slate-400">Loading documents…</p>
        ) : docs.length === 0 ? (
          <div className="p-3">
            <EmptyState title="Library is empty" hint="Upload documents above. They stay in this browser session until the backend restarts or 1 hour of inactivity." />
          </div>
        ) : (
          <ul className="divide-y divide-slate-700/40">
            {docs.map((d) => (
              <li key={d.filename} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-800/50 rounded-lg group">
                <FileText size={18} className="shrink-0 text-accent-400 group-hover:text-accent-300 transition-colors" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-100">{d.filename}</p>
                  <p className="text-xs text-slate-400">
                    {d.extension || 'unknown type'} · {d.chunks} chunks · {(d.size_chars / 1000).toFixed(1)}k chars indexed
                  </p>
                </div>
                <button
                  onClick={() => void remove(d.filename)}
                  className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-600 px-2.5 py-1.5 text-xs text-slate-300 hover:border-red-500/40 hover:text-red-300 hover:bg-red-500/10 transition-colors"
                  aria-label={'Delete ' + d.filename}
                >
                  <Trash2 size={13} /> Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
