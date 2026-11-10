import { describe, expect, it } from 'vitest';
import { cloudPoints, hasProjection, sourceNeighbors } from './components/charts/cloudLayout';
import { entityConnections, neighborhood } from './components/charts/entityConnections';
import type { StoredChunk } from './components/charts/knowledgeLayout';
const chunks: StoredChunk[] = [
  { id: 'a3', docId: 'a', docFilename: 'a.txt', chunkIndex: 3, text: 'Third', embedding: null },
  { id: 'b0', docId: 'b', docFilename: 'b.txt', chunkIndex: 0, text: 'Other source', embedding: null, projection: [.1, .4] },
  { id: 'a0', docId: 'a', docFilename: 'a.txt', chunkIndex: 0, text: 'First', embedding: null, projection: [NaN, 0] },
  { id: 'a1', docId: 'a', docFilename: 'a.txt', chunkIndex: 1, text: 'Second', embedding: null, projection: [.2, -.3] },
];
describe('Source cloud integrity', () => {
  it('plots all real records without requiring embeddings, deterministically', () => {
    const positions = cloudPoints(chunks, 'source');
    expect(positions.size).toBe(chunks.length);
    expect(positions).toEqual(cloudPoints([...chunks].reverse(), 'source'));
    positions.forEach(p => { expect(p.x).toBeGreaterThan(0); expect(p.x).toBeLessThan(1000); expect(p.y).toBeGreaterThan(0); expect(p.y).toBeLessThan(570); });
  });
  it('never fabricates projected positions for missing or invalid data', () => {
    const positions = cloudPoints(chunks, 'projection');
    expect([...positions.keys()].sort()).toEqual(['a1', 'b0']);
    expect(hasProjection(chunks[2])).toBe(false);
    expect(positions.get('a1')).toEqual({ x: 578, y: 228.5 });
  });
  it('steps in stored source order without crossing documents', () => {
    expect(sourceNeighbors(chunks, chunks[3])).toEqual({ previous: chunks[2], next: chunks[0] });
    expect(sourceNeighbors(chunks, chunks[1])).toEqual({ previous: undefined, next: undefined });
  });
});
describe('Relationship exploration integrity', () => {
  const record = { rel_id: '1', src_entity_id: 'a', dst_entity_id: 'b', rel_type: 'uses', doc_id: 'doc1', evidence: 'First source evidence', status: 'validated' };
  it('keeps every supporting record while preserving direction', () => {
    const edges = entityConnections([record, { ...record, rel_id: '2', doc_id: 'doc2', evidence: 'Second source evidence' }, { ...record, rel_id: '3', src_entity_id: 'b', dst_entity_id: 'a' }, { ...record, rel_id: '4', status: 'rejected' }]);
    expect(edges).toHaveLength(2);
    expect(edges[0].records.map(r => r.doc_id)).toEqual(['doc1', 'doc2']);
    expect(edges[0].evidence).toContain('Second source evidence');
    expect(edges[0].directed).toBe(true);
  });
  it('groups undirected records and keeps neighborhoods to direct connections', () => {
    const edges = entityConnections([{ ...record, rel_type: 'mentioned_with' }, { ...record, rel_id: '2', src_entity_id: 'b', dst_entity_id: 'a', rel_type: 'mentioned_with' }]);
    expect(edges).toHaveLength(1);
    expect(edges[0].records).toHaveLength(2);
    expect(neighborhood('a', [...edges, { source: 'b', target: 'c' }])).toEqual(new Set(['a', 'b']));
  });
});
