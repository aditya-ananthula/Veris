import { hash, type StoredChunk } from './knowledgeLayout';

export const CLOUD_PAGE_SIZE = 120;
export type CloudMode = 'source' | 'projection';
export const hasProjection = (chunk: StoredChunk) => !!chunk.projection && chunk.projection.length >= 2 && chunk.projection.slice(0, 2).every(Number.isFinite);

export function cloudPoints(chunks: StoredChunk[], mode: CloudMode) {
  const sources = [...new Set(chunks.map(c => c.docId))].sort();
  const columns = Math.ceil(Math.sqrt(sources.length || 1));
  const rows = Math.ceil(sources.length / columns) || 1;
  const cellWidth = 880 / columns, cellHeight = 420 / rows;
  const points = new Map<string, { x: number; y: number }>();
  for (const [index, source] of sources.entries()) {
    const records = chunks.filter(c => c.docId === source).sort((a, b) => a.chunkIndex - b.chunkIndex || a.id.localeCompare(b.id));
    records.forEach((chunk, i) => {
      if (mode === 'projection') {
        if (hasProjection(chunk)) points.set(chunk.id, { x: 500 + chunk.projection![0] * 390, y: 290 + chunk.projection![1] * 205 });
        return;
      }
      const angle = i * 2.399963 + hash(source) % 360;
      const radius = Math.sqrt((i + .5) / records.length);
      points.set(chunk.id, {
        x: 60 + (index % columns + .5) * cellWidth + Math.cos(angle) * radius * cellWidth * .36,
        y: 65 + (Math.floor(index / columns) + .5) * cellHeight + Math.sin(angle) * radius * cellHeight * .32,
      });
    });
  }
  return points;
}

export function sourceNeighbors(chunks: StoredChunk[], selected?: StoredChunk) {
  const sequence = selected ? chunks.filter(c => c.docId === selected.docId).sort((a, b) => a.chunkIndex - b.chunkIndex || a.id.localeCompare(b.id)) : [];
  const index = sequence.findIndex(c => c.id === selected?.id);
  return { previous: index > 0 ? sequence[index - 1] : undefined, next: index >= 0 ? sequence[index + 1] : undefined };
}
