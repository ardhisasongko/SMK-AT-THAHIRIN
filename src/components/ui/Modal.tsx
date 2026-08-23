import React, { useEffect, useRef } from 'react';

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
  /** Label aksesibel untuk pembaca layar. */
  ariaLabel?: string;
  /** Klik backdrop menutup modal (default true). Matikan untuk dialog kritis
   *  seperti konfirmasi selesai ujian agar misklik tidak menutupnya. */
  closeOnBackdrop?: boolean;
}

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])',
].join(', ');

export function Modal({
  onClose,
  children,
  maxWidth = 'max-w-md',
  scrollable = false,
  tone = 'light',
  className = '',
  ariaLabel,
  closeOnBackdrop = true,
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);

  // Scroll lock + fokus awal + kembalikan fokus setelah tutup.
  useEffect(() => {
    previouslyFocused.current = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const panel = panelRef.current;
    const initialFocus = panel?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR) ?? panel;
    initialFocus?.focus();
    return () => {
      document.body.style.overflow = previousOverflow;
      previouslyFocused.current?.focus?.();
    };
  }, []);

  // Escape menutup; Tab dikurung di dalam panel (focus trap).
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = panelRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (!items.length) {
        event.preventDefault();
        return;
      }
      const first = items[0] as HTMLElement | undefined;
      const last = items[items.length - 1] as HTMLElement | undefined;
      if (!first || !last) {
        event.preventDefault();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (document.activeElement === last || !panel.contains(document.activeElement))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  const isLight = tone === 'light';
  const panelClass = [
    'w-full shadow-2xl p-6 border outline-none',
    maxWidth,
    isLight
      ? 'bg-white rounded-3xl border-slate-100'
      : 'bg-slate-800 rounded-2xl border-slate-700 text-white',
    scrollable ? 'max-h-[90vh] overflow-y-auto' : '',
    className,
  ].join(' ');

  return (
    <div
      onClick={closeOnBackdrop ? onClose : undefined}
      className={[
        'fixed inset-0 z-50 flex items-center justify-center p-4',
        isLight ? 'bg-slate-900/60 backdrop-blur-xs' : 'bg-slate-950/80 backdrop-blur-sm',
      ].join(' ')}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        className={panelClass}
      >
        {children}
      </div>
    </div>
  );
}
