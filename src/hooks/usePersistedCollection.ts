import { useCallback, useEffect, useRef, useState, type Dispatch, type SetStateAction } from 'react';

// Hook untuk memuat & menyimpan koleksi data ke Cloudflare D1 via API.
// GET  /api/data/:key   -> memuat data (null jika belum ada)
// PUT  /api/data/:key   -> menyimpan seluruh koleksi
//
// Fallback: jika API tidak tersedia (mis. running lewat vite tanpa server API),
// data tetap pakai nilai awal dan penyimpanan diabaikan dengan aman.

export function usePersistedCollection<T>(
  key: string,
  fallback: T
): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [data, setData] = useState<T>(fallback);
  const [ready, setReady] = useState(false);
  const readyRef = useRef(false);
  const dataRef = useRef(data);

  // Load dari API sekali
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/data/${key}`, { cache: 'no-store' });
        if (res.ok) {
          const json = await res.json() as { success?: boolean; data?: T | null };
          if (json?.success && json.data !== null && json.data !== undefined) {
            dataRef.current = json.data as T;
            if (!cancelled) setData(json.data as T);
          } else if (json?.success && json.data === null) {
            // D1 masih kosong (deploy pertama) -> seed data fallback ke D1
            dataRef.current = fallback;
            fetch(`/api/data/${key}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(fallback),
            }).catch(err => console.warn(`[persist:${key}] gagal seed:`, err));
          }
        }
      } catch (err) {
        // API tidak tersedia (mode dev vite). Pakai fallback.
        console.warn(`[persist:${key}] gagal load, pakai data default:`, err);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => { cancelled = true; };
  }, [key]);

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
        // Tulis ke D1
        fetch(`/api/data/${key}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(next),
        }).catch(err => console.warn(`[persist:${key}] gagal simpan:`, err));
        return next;
      });
    },
    [key]
  );

  return [data, setPersisted, ready];
}
