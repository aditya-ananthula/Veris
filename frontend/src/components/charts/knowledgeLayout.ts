export type StoredChunk = { id: string; docId: string; docFilename: string; chunkIndex: number; text: string; embedding: number[] | null; projection?: number[] | null; page?: number | null; kind?: string };

export const typePalette: Record<string, string> = {
  person: '#34d399',
  organization: '#a855f7',
  org: '#a855f7',
  product: '#fbbf24',
  concept: '#38bdf8',
  date: '#f43f5e',
  technology: '#818cf8',
  document: '#c084fc',
  location: '#2dd4bf',
  metric: '#38bdf8',
  money: '#34d399',
};

export const palette = [
  '#38bdf8', // cyan
  '#a855f7', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f43f5e', // rose
  '#818cf8', // indigo
  '#e879f9', // fuchsia
  '#2dd4bf', // teal
];

export function hash(value: string) {
  let h = 2166136261;
  for (let i = 0; i < value.length; i++) h = Math.imul(h ^ value.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function colorFor(value: string) {
  const lower = value.toLowerCase();
  if (typePalette[lower]) return typePalette[lower];
  return palette[hash(value) % palette.length];
}
