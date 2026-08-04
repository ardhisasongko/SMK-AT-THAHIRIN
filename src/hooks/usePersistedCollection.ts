import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { getAuthToken, authHeaders } from '../utils/auth';

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
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [data, setData] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const dataRef = useRef(data);
  const token = getAuthToken();

  // Load dari API; refetch saat token berubah (login/logout)
  useEffect(() => {
    let cancelled = false;
    setReady(false);
    readyRef.current = false;
    setData(fallback);

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
          } else if (json?.success && json.data === null && token) {
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
  }, [key, token]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync ref agar setter selalu punya nilai terbaru
  useEffect(() => { dataRef.current = data; }, [data]);

  // Setter: update state + tulis ke D1 (fire-and-forget)
  const setPersisted = useCallback(
    (action: SetStateAction<T>) => {
      setData(prev => {
        const next = typeof action === 'function'
          ? (action as (p: T) => T)(prev)
          : action;
        dataRef.current = next;
        fetch(`/api/data/${key}`, {
          method: 'PUT',
          headers: authHeaders({ 'Content-Type': 'application/json' }),
          body: JSON.stringify(next),
        }).catch(err => console.warn(`[persist:${key}] gagal simpan:`, err));
        return next;
      });
    },
    [key]
  );

  return [data, setPersisted, ready];
}