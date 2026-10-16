import type {
  AskResult,
  Capabilities,
  DocumentMeta,
  Health,
  IntelContradictDetailResponse,
  IntelContradictMeta,
  IntelContradictResponse,
  IntelContradictStatsResponse,
  IntelCompareResponse,
  IntelDocument,
  IntelEntity,
  IntelFact,
  IntelRelationship,
} from '../types';

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() ?? '';
// Empty base = same-origin relative URLs (works with `vite --proxy` in dev).
export const API_BASE = RAW_BASE.replace(/\/$/, '');

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === 'string') return data.detail;
    return JSON.stringify(data);
  } catch {
    return `${res.status} ${res.statusText}`;
  }
}

async function request<T>(path: string, init?: RequestInit, timeoutMs = 120000): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, { ...init, signal: ctrl.signal });
  } catch (e) {
    throw new Error(
      e instanceof DOMException && e.name === 'AbortError'
        ? 'Request timed out. The backend may be busy embedding documents.'
        : 'Backend unavailable. Start FastAPI with `uvicorn api:app --reload` on port 8000.',
    );
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) throw new ApiError(res.status, await parseError(res));
  return (await res.json()) as T;
}

export const api = {
  health: () => request<Health>('/health', undefined, 10000),
  capabilities: () => request<Capabilities>('/capabilities', undefined, 10000),
  documents: (sessionId: string) =>
    request<{ documents: string[] }>(`/documents?session_id=${encodeURIComponent(sessionId)}`),
  documentsMeta: (sessionId: string) =>
    request<DocumentMeta[]>(`/documents/meta?session_id=${encodeURIComponent(sessionId)}`),
  ask: (question: string, sessionId: string) =>
    request<AskResult>('/ask', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, session_id: sessionId }),
    }),
  absorb: (file: File, sessionId: string) => {
    const form = new FormData();
    form.append('file', file, file.name);
    form.append('session_id', sessionId);
    return request<{ filename: string; chunks_added: number }>('/absorb', {
      method: 'POST',
      body: form,
    });
  },
  deleteDocument: (filename: string, sessionId: string) =>
    request<{ filename: string; chunks_removed: number }>(
      `/documents/${encodeURIComponent(filename)}?session_id=${encodeURIComponent(sessionId)}`,
      { method: 'DELETE' },
    ),
  intelDocuments: (sessionId: string) =>
    request<IntelDocument[]>(`/intel/documents?session_id=${encodeURIComponent(sessionId)}`),
  intelFacts: (sessionId: string, query = '', entityId = '', docId = '') =>
    request<IntelFact[]>(
      `/intel/facts?session_id=${encodeURIComponent(sessionId)}&query=${encodeURIComponent(query)}&entity_id=${encodeURIComponent(entityId)}&doc_id=${encodeURIComponent(docId)}`,
    ),
  intelEntities: (sessionId: string) =>
    request<IntelEntity[]>(`/intel/entities?session_id=${encodeURIComponent(sessionId)}`),
  intelRelationships: (sessionId: string) =>
    request<IntelRelationship[]>(`/intel/relationships?session_id=${encodeURIComponent(sessionId)}`),
  intelRetry: (docId: string, sessionId: string) =>
    request<{ status: string; facts: number }>(`/intel/retry/${encodeURIComponent(docId)}?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    }),
  intelCompare: (claimA: unknown, claimB: unknown, sourceDocIdA = '', sourceDocIdB = '', useLlm = false) =>
    request<IntelCompareResponse>('/intel/compare', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ claim_a: claimA, claim_b: claimB, source_doc_id_a: sourceDocIdA, source_doc_id_b: sourceDocIdB, use_llm: useLlm }),
    }),
  intelContradictions: (sessionId: string, entityId = '', category = '', status = '', docId = '') =>
    request<IntelContradictResponse>(`/intel/contradictions?session_id=${encodeURIComponent(sessionId)}&entity_id=${encodeURIComponent(entityId)}&category=${encodeURIComponent(category)}&status=${encodeURIComponent(status)}&doc_id=${encodeURIComponent(docId)}`),
  intelContradictionsStats: (sessionId: string) =>
    request<IntelContradictStatsResponse>(`/intel/contradictions/stats?session_id=${encodeURIComponent(sessionId)}`),
  intelContradictionsScan: (sessionId: string) =>
    request<IntelContradictStatsResponse>(`/intel/contradictions/scan?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    }),
  intelContradictionsRefresh: (sessionId: string) =>
    request<IntelContradictStatsResponse>(`/intel/contradictions/refresh?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'POST',
    }),
  intelContradictionsUpdate: (conflictId: string, sessionId: string, payload: Record<string, unknown>) =>
    request<IntelContradictMeta>(`/intel/contradictions/${encodeURIComponent(conflictId)}?session_id=${encodeURIComponent(sessionId)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }),
  intelContradictionsDetail: (conflictId: string, sessionId: string) =>
    request<IntelContradictDetailResponse>(`/intel/contradictions/${encodeURIComponent(conflictId)}?session_id=${encodeURIComponent(sessionId)}`),

  /* ---- Chunk Cloud: raw chunks with embeddings ---- */
  intelChunks: (sessionId: string) =>
    request<{ chunks: Array<{
      id: string;
      text: string;
      docId: string;
      docFilename: string;
      chunkIndex: number;
      embedding: number[] | null;
    }>; total: number }>(`/intel/chunks?session_id=${encodeURIComponent(sessionId)}`),
};
