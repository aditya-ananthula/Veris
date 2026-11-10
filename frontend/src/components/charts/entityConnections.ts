import type { IntelRelationship } from '../../types';

export const isDirectional = (label: string) => /^(uses|provides|enables|supports|implements|works_for|employs|owns|develops|founded|founded_by|part_of|located_in|produces|contains|retrieves_for|supplies_context|powers|enhances|stored_in|proposes|reports_to)$/.test(label.toLowerCase().replace(/ /g, '_'));

export function entityConnections(relationships: IntelRelationship[]) {
  const groups = new Map<string, IntelRelationship[]>();
  for (const relationship of relationships) {
    if (relationship.status !== 'validated') continue;
    const ends = [relationship.src_entity_id, relationship.dst_entity_id];
    const key = JSON.stringify([...(isDirectional(relationship.rel_type) ? ends : ends.sort()), relationship.rel_type]);
    groups.set(key, [...(groups.get(key) ?? []), relationship]);
  }
  return [...groups.entries()].map(([id, records]) => ({
    id, source: records[0].src_entity_id, target: records[0].dst_entity_id,
    label: records[0].rel_type, evidence: records.map(r => r.evidence).join('\n'),
    directed: isDirectional(records[0].rel_type), records,
  }));
}

export function neighborhood(id: string, edges: Array<{ source: string; target: string }>) {
  const ids = new Set([id]);
  edges.forEach(edge => { if (edge.source === id) ids.add(edge.target); if (edge.target === id) ids.add(edge.source); });
  return ids;
}
