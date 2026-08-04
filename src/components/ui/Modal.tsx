import React from 'react';

interface ModalProps {
  onClose: () => void;
  children: React.ReactNode;
  /** Tailwind max-width class, default `max-w-md`. */
  maxWidth?: string;
  /** Panel menjadi scrollable (max-h-90vh). */
  scrollable?: boolean;
  /** Gaya panel: light (default) atau dark. */
  tone?: 'light' | 'dark';
  /** Kelas tambahan pada panel (mis. `space-y-4`, `sm:p-8`). */
  className?: string;
}

export function Modal({
  onClose,
  children,
  maxWidth = 'max-w-md',
  scrollable = false,
  tone = 'light',
  className = '',
}: ModalProps) {
  const isLight = tone === 'light';
  const panelClass = [
    'w-full shadow-2xl p-6 border',
    maxWidth,
    isLight
      ? 'bg-white rounded-3xl border-slate-100'
      : 'bg-slate-800 rounded-2xl border-slate-700 text-white',
    scrollable ? 'max-h-[90vh] overflow-y-auto' : '',
    className,
  ].join(' ');

  return (
    <div
      onClick={onClose}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        isLight ? 'bg-slate-900/60 backdrop-blur-xs' : 'bg-slate-950/80 backdrop-blur-sm',
      ].join(' ')}
    >
      <div onClick={(e) => e.stopPropagation()} className={panelClass}>
        {children}
      </div>
    </div>
  );
}
