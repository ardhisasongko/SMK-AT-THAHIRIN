import React, { useEffect, useState } from 'react';

export type ToastType = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

// Komunikasi via daftar listener modular — tidak perlu Provider/context,
// bisa dipanggil dari mana saja (handler, efek, komponen).
let listeners: Array<(toast: ToastItem) => void> = [];
let counter = 0;

/** Tampilkan notifikasi non-blocking menggantikan alert(). */
export function showToast(message: string, type: ToastType = 'info'): void {
  const toast = { id: ++counter, message, type };
  for (const listener of [...listeners]) listener(toast);
}

const TYPE_STYLES: Record<ToastType, string> = {
  success: 'bg-emerald-600 text-white border-emerald-500',
  error: 'bg-red-600 text-white border-red-500',
  info: 'bg-slate-800 text-white border-slate-600',
};

const TOAST_TTL_MS = 5000;

export function ToastHost(): React.JSX.Element | null {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    const handler = (toast: ToastItem) => {
      setItems(previous => [...previous.slice(-3), toast]);
      window.setTimeout(() => {
        setItems(previous => previous.filter(item => item.id !== toast.id));
      }, TOAST_TTL_MS);
    };
    listeners.push(handler);
    return () => {
      listeners = listeners.filter(entry => entry !== handler);
    };
  }, []);

  if (!items.length) return null;
  return (
    <div
      aria-live="polite"
      className="fixed bottom-24 sm:bottom-8 left-1/2 -translate-x-1/2 z-[70] w-[min(92vw,26rem)] space-y-2"
    >
      {items.map(item => (
        <div
          key={item.id}
          role={item.type === 'error' ? 'alert' : 'status'}
          className={[
            'px-4 py-3 rounded-xl border shadow-xl text-sm font-semibold animate-in fade-in slide-in-from-bottom-2 duration-200',
            TYPE_STYLES[item.type],
          ].join(' ')}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}
