'use client';
import { useCallback, useEffect, useRef, useState } from 'react';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields?: Record<string, string>) { super(message); }
}

export async function api<T = any>(url: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const res = await fetch(url, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && typeof window !== 'undefined' && !url.startsWith('/api/auth/login')) {
    window.location.href = `/login?next=${encodeURIComponent(window.location.pathname + window.location.search)}`;
  }
  if (!res.ok || !json?.ok) throw new ApiError(res.status, json?.error?.code || 'ERROR', json?.error?.message || 'Request failed', json?.error?.fields);
  return json.data as T;
}

/** Tiny SWR-style hook: cached by URL, revalidates on focus, supports manual `mutate`. */
const cache = new Map<string, unknown>();
const listeners = new Map<string, Set<() => void>>();
export function invalidate(prefix: string) {
  for (const [k, set] of listeners) if (k.startsWith(prefix)) set.forEach((f) => f());
}

export function useApi<T = any>(url: string | null, opts: { refreshMs?: number } = {}) {
  const [data, setData] = useState<T | undefined>(url ? (cache.get(url) as T | undefined) : undefined);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(!!url && !cache.has(url));
  const alive = useRef(true);
  const seq = useRef(0);

  const load = useCallback(async () => {
    if (!url) return;
    const my = ++seq.current;
    try {
      const d = await api<T>(url);
      if (!alive.current || my !== seq.current) return;
      cache.set(url, d); setData(d); setError(null);
    } catch (e) { if (alive.current && my === seq.current) setError(e as ApiError); }
    finally { if (alive.current && my === seq.current) setLoading(false); }
  }, [url]);

  useEffect(() => {
    alive.current = true;
    if (url) { setData(cache.get(url) as T | undefined); setLoading(!cache.has(url)); load(); }
    else { setData(undefined); setLoading(false); }
    const set = url ? (listeners.get(url) ?? new Set()) : null;
    if (url && set) { set.add(load); listeners.set(url, set); }
    const onFocus = () => load();
    window.addEventListener('focus', onFocus);
    const iv = opts.refreshMs ? setInterval(load, opts.refreshMs) : null;
    return () => { alive.current = false; window.removeEventListener('focus', onFocus); if (iv) clearInterval(iv); set?.delete(load); };
  }, [url, load, opts.refreshMs]);

  const mutate = useCallback((next?: T | ((d: T | undefined) => T)) => {
    if (next !== undefined && url) { const v = typeof next === 'function' ? (next as any)(cache.get(url)) : next; cache.set(url, v); setData(v); }
    else load();
  }, [url, load]);
  return { data, error, loading, mutate, reload: load };
}

// ── toast bus ──
export type Toast = { id: number; kind: 'success' | 'error' | 'info'; message: string; action?: { label: string; run: () => void } };
const toastListeners = new Set<(t: Toast) => void>();
let tid = 0;
export const toast = {
  show(kind: Toast['kind'], message: string, action?: Toast['action']) { const t = { id: ++tid, kind, message, action }; toastListeners.forEach((f) => f(t)); },
  success: (m: string, action?: Toast['action']) => toast.show('success', m, action),
  error: (m: string) => toast.show('error', m),
  info: (m: string) => toast.show('info', m),
};
export function onToast(f: (t: Toast) => void) { toastListeners.add(f); return () => { toastListeners.delete(f); }; }

export const errMsg = (e: unknown) => (e instanceof ApiError ? e.message : 'Something went wrong');
