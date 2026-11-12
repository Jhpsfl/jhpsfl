"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * On-device memory for the admin app.
 *
 * Every list the app shows (emails, accounts, customers, invoices…) is kept in two places on the phone:
 *   1. a module-level Map → instant when moving between pages inside one app session
 *   2. IndexedDB          → survives the app being closed / killed / the phone rebooting
 *
 * `useCached(key, loader)` renders the saved copy immediately and refreshes it in the background
 * (stale-while-revalidate). A refresh that fails or times out never blanks the screen: the saved
 * copy stays and `error` is set so the page can show "couldn't refresh — showing saved copy".
 */

const DB = "jhps-admin-mail";
const STORE = "kv";
const FETCH_TIMEOUT = 20_000;

const mem = new Map<string, { v: unknown; t: number }>();

let dbp: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  if (!dbp) {
    dbp = new Promise((resolve) => {
      try {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
        req.onblocked = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  }
  return dbp;
}

export async function cacheGet<T>(key: string): Promise<{ v: T; t: number } | null> {
  const m = mem.get(key);
  if (m) return m as { v: T; t: number };
  const d = await db();
  if (!d) return null;
  return new Promise((resolve) => {
    try {
      const req = d.transaction(STORE, "readonly").objectStore(STORE).get(key);
      req.onsuccess = () => {
        const hit = req.result as { v: T; t: number } | undefined;
        if (hit) mem.set(key, hit);
        resolve(hit || null);
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

export async function cacheSet<T>(key: string, v: T): Promise<void> {
  const entry = { v, t: Date.now() };
  mem.set(key, entry);
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, "readwrite").objectStore(STORE).put(entry, key);
  } catch {
    /* quota / private mode — memory copy still works */
  }
}

/** Update a saved value in place (e.g. after a local action) so the next render is already right. */
export async function cachePatch<T>(key: string, fn: (v: T | undefined) => T): Promise<void> {
  const cur = await cacheGet<T>(key);
  await cacheSet(key, fn(cur?.v));
}

export async function cacheClear(): Promise<void> {
  mem.clear();
  const d = await db();
  if (!d) return;
  try {
    d.transaction(STORE, "readwrite").objectStore(STORE).clear();
  } catch {
    /* ignore */
  }
}

/** fetch() with a hard timeout — a hung request must never leave a page spinning forever. */
export async function fetchJson<T>(url: string, init?: RequestInit, timeout = FETCH_TIMEOUT): Promise<T> {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), timeout);
  const outer = init?.signal;
  if (outer) outer.addEventListener("abort", () => ctl.abort(), { once: true });
  try {
    const r = await fetch(url, { ...init, signal: ctl.signal });
    const text = await r.text();
    let j: unknown = null;
    try { j = text ? JSON.parse(text) : null; } catch { /* non-JSON error page */ }
    if (!r.ok) {
      const msg = (j as { error?: string } | null)?.error || `${r.status} ${r.statusText || "error"}`;
      throw new Error(msg);
    }
    return j as T;
  } finally {
    clearTimeout(timer);
  }
}

export type Cached<T> = {
  data: T | undefined;
  /** true only while there is nothing to show yet */
  loading: boolean;
  /** a background refresh is running (data may already be on screen) */
  refreshing: boolean;
  /** last refresh failed; data (if any) is the saved copy */
  error: string | null;
  /** when the data on screen was fetched */
  savedAt: number | null;
  refresh: () => Promise<void>;
  /** change the data locally (and in the cache) without a round trip */
  mutate: (fn: (cur: T | undefined) => T) => void;
};

/**
 * Render from the device's saved copy, refresh in the background.
 * `key` null = disabled. `loader` is re-run whenever `key` changes.
 */
export function useCached<T>(key: string | null, loader: (signal: AbortSignal) => Promise<T>): Cached<T> {
  const [data, setData] = useState<T | undefined>(() => (key ? (mem.get(key)?.v as T | undefined) : undefined));
  const [savedAt, setSavedAt] = useState<number | null>(() => (key ? mem.get(key)?.t ?? null : null));
  const [loading, setLoading] = useState<boolean>(() => !(key && mem.has(key)));
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const seq = useRef(0);
  const ctlRef = useRef<AbortController | null>(null);
  const keyRef = useRef(key);
  keyRef.current = key;

  const refresh = useCallback(async () => {
    const k = keyRef.current;
    if (!k) return;
    ctlRef.current?.abort();
    const ctl = new AbortController();
    ctlRef.current = ctl;
    const my = ++seq.current;
    setRefreshing(true);
    try {
      const v = await loaderRef.current(ctl.signal);
      if (my !== seq.current || keyRef.current !== k) return;
      setData(v);
      setSavedAt(Date.now());
      setError(null);
      setLoading(false);
      cacheSet(k, v);
    } catch (e) {
      if (my !== seq.current || keyRef.current !== k) return;
      if ((e as Error)?.name === "AbortError") return;
      setError((e as Error)?.message || "Couldn't refresh");
      setLoading(false);
    } finally {
      if (my === seq.current) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    let alive = true;
    if (!key) { setData(undefined); setLoading(false); return; }
    const m = mem.get(key);
    if (m) { setData(m.v as T); setSavedAt(m.t); setLoading(false); }
    else {
      setLoading(true);
      cacheGet<T>(key).then((hit) => {
        if (!alive || keyRef.current !== key) return;
        if (hit) { setData(hit.v); setSavedAt(hit.t); setLoading(false); }
      });
    }
    setError(null);
    refresh();
    return () => { alive = false; };
  }, [key, refresh]);

  // refresh when the app comes back to the foreground
  useEffect(() => {
    const onVis = () => { if (document.visibilityState === "visible") refresh(); };
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => { document.removeEventListener("visibilitychange", onVis); window.removeEventListener("focus", onVis); };
  }, [refresh]);

  const mutate = useCallback((fn: (cur: T | undefined) => T) => {
    const k = keyRef.current;
    setData((cur) => {
      const next = fn(cur);
      if (k) cacheSet(k, next);
      return next;
    });
  }, []);

  return { data, loading, refreshing, error, savedAt, refresh, mutate };
}

/** Shorthand for the common case: a GET that returns JSON. */
export function useCachedJson<T>(key: string | null, url: string | null): Cached<T> {
  const loader = useCallback((signal: AbortSignal) => fetchJson<T>(url || "", { cache: "no-store", signal }), [url]);
  return useCached<T>(key && url ? key : null, loader);
}

/**
 * For pages with their own load() function: apply the saved copy first (if any), then the fresh answer.
 * Returns whether the refresh worked so the page can show "showing saved copy" instead of an empty error.
 */
export async function loadSaved<T>(
  key: string,
  fetcher: () => Promise<T>,
  apply: (v: T, fromCache: boolean) => void,
): Promise<{ ok: boolean; error?: string; hadCache: boolean }> {
  const hit = await cacheGet<T>(key);
  if (hit) apply(hit.v, true);
  try {
    const v = await fetcher();
    apply(v, false);
    cacheSet(key, v);
    return { ok: true, hadCache: !!hit };
  } catch (e) {
    return { ok: false, error: (e as Error)?.message || "Could not refresh", hadCache: !!hit };
  }
}
