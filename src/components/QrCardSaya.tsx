import React, { useEffect, useState } from 'react';
import QRCode from 'react-qr-code';
import { Loader2, QrCode, ShieldAlert } from 'lucide-react';
import { authHeaders } from '../utils/auth';

/**
 * Kartu "Kartu QR Saya" di Profil untuk siswa & ketua kelas.
 *
 * Payload QR diambil dari server (GET /api/presensi/qr-card) — payload
 * bertanda tangan HMAC yang hanya dibuat server untuk NISN pemilik akun.
 * Bila QR_CARD_SECRET belum dipasang, server menjawab configured: false
 * dan kartu menampilkan pemberitahuan sopan, bukan QR rusak (mencontoh
 * pola TwoFactorCard). Semua panggilan jaringan fail-soft agar kartu
 * tidak pernah merusak render halaman profil.
 */

interface QrCardData {
  configured: boolean;
  payload?: string;
  nisn: string;
  name: string;
  className: string;
}

export const QrCardSaya: React.FC = () => {
  const [card, setCard] = useState<QrCardData | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/presensi/qr-card', { headers: authHeaders() });
        const json = await res.json().catch(() => null) as any;
        if (!res.ok || !json?.success || !json?.data) throw new Error('Gagal memuat kartu QR.');
        if (!cancelled) setCard(json.data as QrCardData);
      } catch {
        if (!cancelled) setLoadFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Gagal memuat (mis. sesi berakhir): jangan tampilkan apa pun agar
  // halaman profil tetap bersih; kartu bukan fungsi kritis profil.
  if (loadFailed) return null;

  return (
    <div className="mt-6 min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:p-6">
      <h3 className="flex items-center gap-2 border-b border-slate-100 pb-3 text-sm font-bold text-slate-900">
        <QrCode className="h-4 w-4 text-emerald-600" />
        <span>Kartu QR Presensi Saya</span>
      </h3>

      {!card && (
        <p className="flex items-center gap-2 pt-4 text-xs font-semibold text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Memuat kartu QR…
        </p>
      )}

      {card && !card.configured && (
        <div className="mt-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-amber-900">
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p className="text-[11px]">
            Fitur kartu QR belum dikonfigurasi oleh administrator sistem, sehingga kartu Anda belum
            dapat ditampilkan. Presensi tetap berjalan seperti biasa melalui guru kelas Anda.
          </p>
        </div>
      )}

      {card?.configured && card.payload && (
        <div className="space-y-3 pt-4 text-center">
          <div className="mx-auto w-fit rounded-2xl border-2 border-slate-700 bg-white p-4">
            <QRCode value={card.payload} size={176} />
          </div>
          <div>
            <p className="text-sm font-extrabold text-slate-900">{card.name}</p>
            <p className="font-mono text-xs font-bold tracking-wider text-slate-500">
              {card.nisn} · {card.className}
            </p>
          </div>
          <p className="mx-auto max-w-sm text-[11px] leading-relaxed text-slate-500">
            Tunjukkan kartu ini kepada guru atau petugas piket saat presensi — kartu akan dipindai
            dan kehadiran Anda tercatat. Jaga kartu ini seperti kartu pelajar Anda; jangan
            membagikan fotonya kepada siapa pun.
          </p>
        </div>
      )}
    </div>
  );
};
