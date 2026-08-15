import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { loadAuthSession, authHeaders } from '../utils/auth';

export interface PersistedCollectionActions<T> {
  save: (action: SetStateAction<T>) => Promise<T>;
  refresh: () => Promise<T>;
}

interface ApiResult<T> {
  success?: boolean;
  data?: T | null;
  error?: string;
}

async function readResult<T>(res: Response): Promise<ApiResult<T>> {
  try {
    return await res.json() as ApiResult<T>;
  } catch {
    return {};
  }
}

// Hook untuk memuat & menyimpan koleksi data ke Cloudflare D1 via API.
// GET  /api/data/:key   -> memuat data (null jika belum ada)
// PUT  /api/data/:key   -> menyimpan seluruh koleksi
//
// Membawa header Authorization (token sesi). Data dimuat ulang saat token
// berubah (mis. setelah login). Fallback: bila API tak tersedia / belum login,
// data memakai nilai awal dan penyimpanan diabaikan dengan aman.

export function usePersistedCollection<T>(
  key: string,
  fallback: T
): [T, Dispatch<SetStateAction<T>>, boolean, PersistedCollectionActions<T>] {
  const [data, setData] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const dataRef = useRef(data);
  const authUserId = loadAuthSession()?.user.id || null;

  const refresh = useCallback(async (): Promise<T> => {
    if (!authUserId) return dataRef.current;
    const res = await fetch(`/api/data/${key}`, {
      cache: 'no-store',
      headers: authHeaders(),
    });
    const json = await readResult<T>(res);
    if (!res.ok || !json.success || json.data === null || json.data === undefined) {
      throw new Error(json.error || `Gagal memuat data (HTTP ${res.status}).`);
    }
    dataRef.current = json.data;
    setData(json.data);
    return json.data;
  }, [key, authUserId]);

  const save = useCallback(async (action: SetStateAction<T>): Promise<T> => {
    if (!authUserId) throw new Error('Sesi login tidak tersedia. Silakan login kembali.');
    const next = typeof action === 'function'
      ? (action as (previous: T) => T)(dataRef.current)
      : action;
    const res = await fetch(`/api/data/${key}`, {
      method: 'PUT',
      headers: authHeaders({ 'Content-Type': 'application/json' }),
      body: JSON.stringify(next),
    });
    const json = await readResult<T>(res);
    if (!res.ok || !json.success || json.data === null || json.data === undefined) {
      throw new Error(json.error || `Penyimpanan gagal (HTTP ${res.status}).`);
    }
    dataRef.current = json.data;
    setData(json.data);
    return json.data;
  }, [key, authUserId]);

  // Load dari API; refetch saat token berubah (login/logout)
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    readyRef.current = false;
    setData(fallback);

    if (!authUserId) {
      dataRef.current = fallback;
      setReady(true);
      readyRef.current = true;
      return () => { cancelled = true; };
    }

    (async () => {
      try {
        const res = await fetch(`/api/data/${key}`, {
          cache: 'no-store',
          headers: authHeaders(),
        });
        if (res.ok) {
          const json = await res.json() as { success?: boolean; data?: T | null };
          if (json?.success && json.data !== null && json.data !== undefined) {
            dataRef.current = json.data as T;
            if (!cancelled) setData(json.data as T);
          } else if (json?.success && json.data === null && authUserId) {
            // D1 masih kosong (deploy pertama) & sudah login -> seed data fallback ke D1
            dataRef.current = fallback;
            fetch(`/api/data/${key}`, {
              method: 'PUT',
              headers: authHeaders({ 'Content-Type': 'application/json' }),
              body: JSON.stringify(fallback),
            }).catch(err => console.warn(`[persist:${key}] gagal seed:`, err));
          }
        }
      } catch (err) {
        // API belum tersedia / belum login.
        console.warn(`[persist:${key}] gagal load, pakai data default:`, err);
      } finally {
        if (!cancelled) {
          setReady(true);
          readyRef.current = true;
        }
      }
    })();
    return () => { cancelled = true; };
  }, [key, authUserId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ref agar setter selalu punya nilai terbaru
  useEffect(() => { dataRef.current = data; }, [data]);

  // Setter kompatibel untuk komponen lama. Alur yang perlu konfirmasi server
  // harus memakai actions.save agar UI tidak menampilkan sukses prematur.
  const setPersisted = useCallback(
    (action: SetStateAction<T>) => {
      const previous = dataRef.current;
      const next = typeof action === 'function'
        ? (action as (value: T) => T)(previous)
        : action;
      dataRef.current = next;
      setData(next);
      if (!authUserId) return;
      void save(next).catch(async error => {
        console.error(`[persist:${key}] Gagal simpan:`, error);
        try {
          await refresh();
        } catch {
          if (dataRef.current === next) {
            dataRef.current = previous;
            setData(previous);
          }
        }
        window.dispatchEvent(new CustomEvent('persist:error', {
          detail: { key, message: error instanceof Error ? error.message : 'Penyimpanan gagal.' },
        }));
      });
    },
    [authUserId, key, refresh, save]
  );

  return [data, setPersisted, ready, { save, refresh }];
}
