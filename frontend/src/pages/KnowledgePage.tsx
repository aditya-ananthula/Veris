import { useCallback, useEffect, useMemo, useState } from 'react';
import { RotateCcw, Flame, Network, Share2, Cloud } from 'lucide-react';
import { api } from '../services/api';
import { useSession } from '../hooks/useSession';
import { Card, EmptyState, ErrorBanner, SectionHeader, Badge, StatCard } from '../components/ui';
import { DonutChart, DependencyMap, RankedDocumentGraph, ChunkCloud } from '../components/charts';
import type { IntelContradictStatsResponse, IntelDocument, IntelEntity, IntelFact, IntelRelationship, DependencyGraph, DependencyNode, DependencyEdge } from '../types';

export function KnowledgePage() {
  const { sessionId } = useSession();
  const [docs, setDocs] = useState<IntelDocument[]>([]);
  const [entities, setEntities] = useState<IntelEntity[]>([]);
  const [facts, setFacts] = useState<IntelFact[]>([]);
  const [relationships, setRelationships] = useState<IntelRelationship[]>([]);
  const [error, setError] = useState('');
  const [scanStats, setScanStats] = useState<IntelContradictStatsResponse | null>(null);
  const [collapsed, setCollapsed] = useState(false);
  const [tab, setTab] = useState<'entities' | 'graph' | 'chunks'>('entities');

  const load = useCallback(async (sid: string) => {
    try {
      setError('');
      const [ds, es, fs, rs, stats] = await Promise.all([
        api.intelDocuments(sid),
        api.intelEntities(sid),
        api.intelFacts(sid),
        api.intelRelationships(sid),
        api.intelContradictionsStats(sid),
      ]);
      setDocs(ds);
      setEntities(es);
      setFacts(fs);
      setRelationships(rs);
      setScanStats(stats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load knowledge.');
    }
  }, []);

  const graph: DependencyGraph = useMemo(() => {
    const nodeMap = new Map<string, DependencyNode>();
    entities.forEach((e) => nodeMap.set(e.entity_id, { id: e.entity_id, label: e.canonical_name, type: e.entity_type, factCount: e.fact_count, status: e.status }));
    const edges: DependencyEdge[] = relationships.map((r) => ({
      id: r.src_entity_id + '-' + r.rel_type + '-' + r.dst_entity_id,
      source: r.src_entity_id,
      target: r.dst_entity_id,
      relType: r.rel_type,
      evidence: r.evidence ?? '',
    }));
    return { nodes: Array.from(nodeMap.values()), edges };
  }, [entities, relationships]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    entities.forEach((e) => { counts[e.entity_type] = (counts[e.entity_type] ?? 0) + 1; });
    return Object.entries(counts).map(([type, value]) => ({
      label: type,
      value,
      color: type === 'person' ? '#22d3ee' : type === 'organization' ? '#a855f7' : type === 'location' ? '#f472b6' : type === 'date' ? '#34d399' : '#94a3b8',
    }));
  }, [entities]);

  useEffect(() => {
    if (sessionId) void load(sessionId);
  }, [sessionId]);

  return (
    <div className='flex flex-col gap-6 h-full'>
      <div>
        <h2 className='text-xl font-semibold tracking-tight text-slate-100'>Knowledge graph</h2>
        <p className='mt-1 text-sm text-slate-400'>
          Extracted entities, facts, and relationships across your document collection.
        </p>
      </div>
      {error && <ErrorBanner message={error} onRetry={() => sessionId && void load(sessionId)} />}

      <div className='grid grid-cols-1 sm:grid-cols-3 gap-4'>
        <StatCard title='Entities' value={entities.length.toString()} subtitle='Extracted entities' />
        <StatCard title='Facts' value={facts.length.toString()} subtitle='Verified statements' />
        <StatCard title='Relationships' value={relationships.length.toString()} subtitle='Entity connections' />
      </div>

      <div className='flex items-center gap-1 border-b border-slate-700/40 pb-px'>
        {([
          { id: 'entities', label: 'Entities & relationships', icon: Share2 },
          { id: 'graph', label: 'Ranked document graph', icon: Network },
          { id: 'chunks', label: 'Chunk cloud', icon: Cloud },
        ] as const).map((t) => {
          const Icon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`inline-flex items-center gap-1.5 rounded-t-lg border-b-2 px-3.5 py-2 text-xs font-medium transition-colors ${
                active
                  ? 'border-accent-500 text-accent-300'
                  : 'border-transparent text-slate-400 hover:border-slate-600 hover:text-slate-200'
              }`}
            >
              <Icon size={14} />
              <span className='hidden sm:inline'>{t.label}</span>
            </button>
          );
        })}
      </div>

      {tab === 'entities' && (
        <>
      <div className='grid grid-cols-1 lg:grid-cols-3 gap-6'>
        <div className='lg:col-span-1 flex flex-col gap-6'>
          {scanStats && (
            <Card className='p-4'>
              <div className='flex items-center gap-2 mb-3'>
                <Flame size={16} className='text-amber-400' />
                <h3 className='text-sm font-semibold text-slate-100'>Contradiction scan</h3>
              </div>
              <div className='grid grid-cols-2 gap-2 text-xs'>
                <div>
                  <p className='text-slate-500'>Compared</p>
                  <p className='text-white'>{scanStats.total_compared}</p>
                </div>
                <div>
                  <p className='text-slate-500'>Conflicts</p>
                  <p className='text-red-400'>{scanStats.conflicts}</p>
                </div>
                <div>
                  <p className='text-slate-500'>Matches</p>
                  <p className='text-emerald-400'>{scanStats.matches}</p>
                </div>
                <div>
                  <p className='text-slate-500'>Uncertain</p>
                  <p className='text-amber-400'>{scanStats.uncertain}</p>
                </div>
              </div>
            </Card>
          )}
          {typeCounts.length > 0 && (
            <Card className='p-4'>
              <h4 className='text-xs font-medium uppercase tracking-wider text-slate-400 mb-3'>Entity types</h4>
              <DonutChart series={typeCounts} totalLabel='Entities' totalValue={entities.length} height={160} />
            </Card>
          )}
        </div>
        <div className='lg:col-span-2'>
          <Card className='p-0'>
            <div className='p-4 border-b border-slate-700/40 flex items-center justify-between'>
              <h3 className='text-sm font-semibold text-slate-100'>Entity dependency map</h3>
              <button
                onClick={() => setCollapsed(!collapsed)}
                className='inline-flex items-center gap-1.5 rounded-lg border border-slate-600 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800'
              >
                <RotateCcw size={14} className={collapsed ? '' : 'animate-spin'} /> Reset
              </button>
            </div>
            <div className='p-4 h-[500px]'>
              <DependencyMap graph={graph} height={500} />
            </div>
          </Card>
        </div>
      </div>

      <Card className='p-0'>
        <SectionHeader title='Fact extraction' hint={facts.length + ' facts across ' + docs.length + ' documents'} />
        <div className='p-4'>
          <div className='overflow-x-auto'>
            <table className='w-full text-sm border-collapse'>
              <thead>
                <tr className='text-left text-xs font-medium uppercase tracking-wider text-slate-400 border-b border-slate-700/50 bg-slate-900/40'>
                  <th className='pb-2 font-medium text-slate-100'>Subject</th>
                  <th className='pb-2 font-medium text-slate-100'>Predicate</th>
                  <th className='pb-2 font-medium text-slate-100'>Object</th>
                  <th className='pb-2 font-medium text-slate-100 text-right'>Status</th>
                  <th className='pb-2 font-medium text-slate-100 text-right'>Source</th>
                </tr>
              </thead>
              <tbody className='divide-y divide-slate-700/40'>
                {facts.length === 0 ? (
                  <tr>
                    <td colSpan={5} className='p-4 text-center text-sm text-slate-400'>
                      <EmptyState title='No facts yet' hint='Upload documents and run extraction to see facts here.' />
                    </td>
                  </tr>
                ) : (
                  facts.map((f) => (
                    <tr key={f.fact_id} className='hover:bg-slate-800/40 transition-colors group'>
                      <td className='py-2 text-slate-200 truncate max-w-[120px]'>{f.subject}</td>
                      <td className='py-2 text-slate-300 truncate max-w-[100px]'>{f.attribute}</td>
                      <td className='py-2 text-slate-200 truncate max-w-[120px]'>{f.value}</td>
                      <td className='py-2 text-right'>
                        <Badge variant={f.status === 'validated' ? 'success' : f.status === 'disputed' || f.status === 'failed' ? 'error' : f.status === 'uncertain' ? 'warn' : 'muted'}>
                          {f.status}
                        </Badge>
                      </td>
                      <td className='py-2 text-right text-xs text-slate-400'>{f.evidence}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </Card>
        </>
      )}

      {tab === 'graph' && (
        <Card className='p-0'>
          <SectionHeader title='Ranked document graph' hint={docs.length + ' documents sized by chunk count'} />
          <div className='p-4'>
            <RankedDocumentGraph documents={docs} relationships={relationships} entities={entities} height={520} />
          </div>
        </Card>
      )}

      {tab === 'chunks' && (
        <Card className='p-0'>
          <SectionHeader title='Chunk cloud' hint='Semantic layout of every indexed chunk' />
          <div className='p-4'>
            {sessionId ? (
              <ChunkCloud sessionId={sessionId} documents={docs} height={480} />
            ) : (
              <EmptyState title='No session' hint='Start a session to load chunk embeddings.' />
            )}
          </div>
        </Card>
      )}
    </div>
  );
}
