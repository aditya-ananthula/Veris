import type { DocumentGraphEdge } from '../../types';

export function connectionNames(edge: DocumentGraphEdge): string[] {
  if (edge.shared_entities?.length) return edge.shared_entities.map(entity => entity.name);
  // Older servers expose the same names as evidence text. Keep that text intact.
  const evidence = edge.evidence.replace(/^Shared entities:\s*/i, '').trim();
  return evidence ? [evidence] : [];
}

export function documentConnection(edge: DocumentGraphEdge) {
  const names = connectionNames(edge);
  const label = names.length > 1 ? `${names[0]} +${names.length - 1}` : names[0] || `${edge.weight} shared ${edge.weight === 1 ? 'entity' : 'entities'}`;
  return { ...edge, id: `${edge.source}:${edge.target}:${edge.rel_type}`, label, directed: false };
}
