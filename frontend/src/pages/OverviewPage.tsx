import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, FlaskConical, UploadCloud } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { Card, EmptyState, ErrorBanner } from '../components/ui';
import { UploadDropzone } from '../components/UploadDropzone';
import type { Capabilities, DocumentMeta } from '../types';

export function OverviewPage() {
  const { sessionId } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async (sid: string) => {
    try {
      setError('');
      const [c, m] = await Promise.all([api.capabilities(), api.documentsMeta(sid)]);
      setCaps(c);
      setDocs(m);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load workspace.');
    }
  };

  useEffect(() => {
    if (sessionId) void load(sessionId);
  }, [sessionId]);

  const upload = async (files: File[]) => {
    if (!sessionId || !files.length) return;
    setUploading(true);
    setNotice('');
    try {
      for (const f of files) {
        const r = await api.absorb(f, sessionId);
        setNotice(`Added ${r.filename} (${r.chunks_added} chunks). Re-uploading a name replaces it.`);
      }
      await load(sessionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed.');
    } finally {
      setUploading(false);
    }
  };

  const totalChunks = docs.reduce((n, d) => n + d.chunks, 0);
  const accept = caps ? caps.supported_extensions.join(',') : '.pdf,.docx,.txt,.md';

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-white">From documents to intelligence</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Upload documents, then ask grounded questions with cited passages and verification.
          Everything below reflects live backend state — no sample data.
        </p>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => sessionId && void load(sessionId)} />}
      {notice && (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-[13px] text-emerald-200" role="status">
          {notice}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Documents</p>
          <p className="mt-1 text-2xl font-semibold text-white">{docs.length}</p>
          <p className="text-xs text-slate-400">in this browser session</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Indexed chunks</p>
          <p className="mt-1 text-2xl font-semibold text-white">{totalChunks}</p>
          <p className="text-xs text-slate-400">retrievable passages</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-wide text-slate-500">Answer model</p>
          <p className="mt-1 truncate text-sm font-medium text-white" title={caps?.llm_model}>
            {caps?.llm_model ?? '—'}
          </p>
          <p className="text-xs text-slate-400">
            {caps ? (caps.groq_configured ? 'Provider configured' : 'Provider NOT configured') : '…'}
          </p>
        </Card>
      </div>
      <Card className="p-5">
        <h3 className="flex items-center gap-2 text-sm font-medium text-white">
          <UploadCloud size={16} className="text-accent-400" /> Ingest documents
        </h3>
        <div className="mt-3">
          <UploadDropzone accept={accept} maxMb={caps?.max_upload_mb ?? 10} onFiles={(f) => void upload(f)} disabled={uploading || !sessionId} />
        </div>
        {uploading && <p className="mt-2 text-xs text-slate-400">Reading and embedding documents…</p>}
      </Card>
      <Card className="p-5">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-medium text-white">
            <FileText size={16} className="text-accent-400" /> Recent documents
          </h3>
          <Link to="/documents" className="inline-flex items-center gap-1 text-xs text-accent-400 hover:text-accent-500">
            Open library <ArrowRight size={13} />
          </Link>
        </div>
        <div className="mt-3">
          {docs.length === 0 ? (
            <EmptyState title="No documents yet" hint="Upload a PDF, DOCX, TXT, or Markdown file to start. Your collection is scoped to this browser session." />
          ) : (
            <ul className="divide-y divide-ink-700/60">
              {docs.slice(-5).reverse().map((d) => (
                <li key={d.filename} className="flex items-center justify-between py-2 text-sm">
                  <span className="truncate text-slate-200">{d.filename}</span>
                  <span className="ml-3 shrink-0 text-xs text-slate-400">{d.chunks} chunks</span>
                </li>
              ))}
            </ul>
          )}
        </div>
        {docs.length > 0 && (
          <Link
            to="/intelligence"
            className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-600"
          >
            <FlaskConical size={15} /> Start analyzing
          </Link>
        )}
      </Card>
    </div>
  );
}
