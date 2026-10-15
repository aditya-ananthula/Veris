import { useCallback, useEffect, useState } from 'react';

const KEY = 'veris.session_id';

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

/**
 * Lightweight per-browser collection id. It scopes documents server-side but
 * is NOT authentication — anyone with the id can read that collection.
 */
export function useSession() {
  const [sessionId, setSessionId] = useState('');
  useEffect(() => {
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = newId();
      localStorage.setItem(KEY, id);
    }
    setSessionId(id);
  }, []);
  const reset = useCallback(() => {
    const id = newId();
    localStorage.setItem(KEY, id);
    setSessionId(id);
  }, []);
  return { sessionId, reset };
}
