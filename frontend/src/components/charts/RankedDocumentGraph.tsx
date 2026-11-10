import { useMemo } from 'react';
import type { IntelDocument, DocumentGraphEdge } from '../../types';
import { GlassGraph } from './GlassGraph';
export function RankedDocumentGraph({ documents, edges, height, selectedId, onSelect, query }: { documents: IntelDocument[]; edges: DocumentGraphEdge[]; height?: number; className?: string; selectedId?: string; onSelect?: (id: string) => void; query?: string }) {
  const nodes = useMemo(() => documents.map(d => ({ id: d.doc_id, label: d.filename, type: 'document', size: d.chunks, detail: `${d.chunks} chunks` })), [documents]);
  const links = useMemo(() => edges.map((e, i) => ({ ...e, id: `${e.source}:${e.target}:${i}`, weight: e.similarity * 7, label: Math.round(e.similarity * 100) + '% entity overlap' })), [edges]);
  return <GlassGraph nodes={nodes} edges={links} height={height} selectedId={selectedId} onSelect={onSelect} query={query}/>;
}
export default RankedDocumentGraph;
