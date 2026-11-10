import { useEffect, useState } from 'react';
import { api } from '../services/api';

export const knowledgeLoaders = {
  graph: api.intelDocumentGraph,
  entities: api.intelEntities,
  relationships: api.intelRelationships,
  chunks: api.intelChunks,
  stats: api.intelStats,
};
type Key = keyof typeof knowledgeLoaders;
type Data<K extends Key> = Awaited<ReturnType<(typeof knowledgeLoaders)[K]>>;
// Share in-flight requests (including StrictMode), and retain data across tabs.
const cache = new Map<string, { promise: Promise<unknown>; expires: number }>();
export function clearKnowledgeCache(session: string) {
  for (const key of cache.keys()) if (key.startsWith(`${session}:`)) cache.delete(key);
}
export function useKnowledgeData<K extends Key>(session: string, key: K, revision = 0) {
  const [state, setState] = useState<{ data?: Data<K>; error: string; loading: boolean }>({ error: '', loading: true });
  useEffect(() => {
    let active = true;
    setState({ error: '', loading: true });
    if (!session) return;
    const id = `${session}:${key}`;
    let entry = cache.get(id);
    if (!entry || entry.expires < Date.now()) {
      // Bound retained collections; no embedding arrays survive indefinitely.
      for (const [k, value] of cache) if (value.expires < Date.now()) cache.delete(k);
      const promise = knowledgeLoaders[key](session);
      entry = { promise, expires: Date.now() + 60_000 };
      cache.set(id, entry);
      void promise.catch(() => { if (cache.get(id)?.promise === promise) cache.delete(id); });
    }
    void entry.promise.then(data => { if (active) setState({ data: data as Data<K>, error: '', loading: false }); })
      .catch(error => { if (active) setState({ error: error instanceof Error ? error.message : 'Unable to load knowledge.', loading: false }); });
    return () => { active = false; };
  }, [session, key, revision]);
  return state;
}
