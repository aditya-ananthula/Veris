import type { AskResult, Capabilities, DocumentMeta, Health } from '../types';

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
};
