import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, FileText, FlaskConical, Network } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { Card, EmptyState, ErrorBanner, SectionHeader, Button, StatCard, Badge } from '../components/ui';
import { DonutChart, BarChart } from '../components/charts';
import type { Capabilities, DocumentMeta } from '../types';

const EXT_LABEL: Record<string, string> = { pdf: 'PDF', docx: 'DOCX', txt: 'TXT', md: 'Markdown' };

export function OverviewPage() {
  const { sessionId } = useSession();
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [docs, setDocs] = useState<DocumentMeta[]>([]);
  const [error, setError] = useState('');

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

  const totalChunks = docs.reduce((n, d) => n + d.chunks, 0);
  const groqOk = caps?.groq_configured ?? false;

  const extCounts = docs.reduce<Record<string, number>>((acc, d) => {
    acc[d.extension] = (acc[d.extension] ?? 0) + 1;
    return acc;
  }, {});
  const extSeries = Object.entries(extCounts).map(([ext, value]) => ({
    label: EXT_LABEL[ext] ?? ext.toUpperCase(),
    value,
    color: ext === 'pdf' ? '#22d3ee' : ext === 'docx' ? '#a855f7' : ext === 'txt' ? '#f472b6' : '#34d399',
  }));
  const docsTotal = docs.length;
  const topDocs = [...docs].sort((a, b) => b.chunks - a.chunks).slice(0, 6);
  const barSeries = topDocs.map((d) => ({
    label: d.filename.length > 14 ? d.filename.slice(0, 14) + '…' : d.filename,
    value: d.chunks,
    color: '#22d3ee',
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold tracking-tight text-slate-100">From documents to intelligence</h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-400">
          Upload documents, then ask grounded questions with cited passages and verification.
          Everything below reflects live backend state — no sample data.
        </p>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => sessionId && void load(sessionId)} />}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Documents" value={docsTotal.toString()} subtitle="Uploaded files" />
        <StatCard title="Chunks" value={totalChunks.toString()} subtitle="Indexed segments" />
        <StatCard title="Session" value={sessionId?.slice(-8) ?? '—'} subtitle="Active session" />
        <StatCard
          title="Backend"
          value={groqOk ? 'Connected' : 'Offline'}
          subtitle={groqOk ? 'LLM provider ready' : 'Configure GROQ_API_KEY'}
          trend={<Badge variant={groqOk ? 'success' : 'error'}>{groqOk ? 'Online' : 'Offline'}</Badge>}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 flex flex-col gap-6">
          <Card className="p-5">
            <SectionHeader title="Add documents" hint="Upload from the Documents workspace" />
            <div className="mt-3">
              <p className="mt-2 text-[13px] leading-relaxed text-slate-400">All uploads live in one place. Drop PDF, DOCX, TXT, or Markdown files to embed and index them.</p>
              <Link
                to="/documents"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-400 hover:scale-[1.02] transition-transform"
              >
                Go to Documents <ArrowRight size={15} />
              </Link>
            </div>
          </Card>
          <Card className="p-5">
            <SectionHeader title="Quick actions" hint="Move to another workspace area" />
            <div className="mt-3 flex flex-col gap-2">
              <Button variant="default" disabled={docs.length === 0} className="w-full">
                <FlaskConical size={15} className="mr-2" /> Start analyzing
              </Button>
              <Link to="/documents" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 hover:border-slate-500 transition-all">
                <FileText size={15} /> Manage library
              </Link>
              <Link to="/knowledge" className="inline-flex items-center gap-2 rounded-lg border border-slate-600 px-4 py-2.5 text-sm font-medium text-slate-300 hover:bg-slate-800 hover:text-slate-100 hover:border-slate-500 transition-all">
                <Network size={15} /> Explore knowledge graph
              </Link>
            </div>
          </Card>
        </div>
        <div className="lg:col-span-2 flex flex-col gap-6">
          <Card className="p-5">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-medium text-slate-100">
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
                <ul className="divide-y divide-slate-700/40">
                  {docs.slice(-5).reverse().map((d) => (
                    <li key={d.filename} className="flex items-center justify-between py-2 text-sm hover-expand group">
                      <span className="truncate text-slate-200">{d.filename}</span>
                      <span className="ml-3 shrink-0 text-xs text-slate-400">{d.chunks} chunks</span>
                    </li>
                  ))}
                </ul>
              )}
              {docs.length > 0 && (
                <Link to="/intelligence" className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-accent-500 px-3.5 py-2 text-sm font-medium text-white hover:bg-accent-400 hover:scale-[1.02] transition-transform">
                  <FlaskConical size={15} /> Start analyzing
                </Link>
              )}
            </div>
          </Card>
          <div className="grid grid-cols-2 gap-4">
            <Card className="p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">Document types</h3>
              <DonutChart series={extSeries} totalLabel='Documents' totalValue={docs.length} height={180} />
            </Card>
            <Card className="p-5">
              <h3 className="text-xs font-medium uppercase tracking-wider text-slate-400 mb-3">Top documents by chunks</h3>
              <BarChart series={barSeries} height={220} />
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
