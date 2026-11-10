import { useMemo } from 'react';
import type { DependencyGraph } from '../../types';
import { GlassGraph } from './GlassGraph';
export function DependencyMap({ graph, height, selectedId, onSelect, query, type }: { graph: DependencyGraph; height?: number; className?: string; selectedId?: string; onSelect?: (id: string) => void; query?: string; type?: string }) {
  const nodes = useMemo(() => graph.nodes.map(n => ({ ...n, detail: `${n.type} | ${n.factCount} facts` })), [graph.nodes]);
  const edges = useMemo(() => graph.edges.map(e => ({ ...e, label: e.relType })), [graph.edges]);
  return <GlassGraph nodes={nodes} edges={edges} height={height} selectedId={selectedId} onSelect={onSelect} query={query} type={type} layout="mindmap"/>;
}
export default DependencyMap;
