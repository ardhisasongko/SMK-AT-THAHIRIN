import QRCode from 'react-qr-code';
import { SCHOOL_INFO } from '../data/schoolConfig';

/**
 * Lembar cetak MASSAL kartu QR presensi satu kelas (grid hemat kertas).
 *
 * Pola sama dengan RaporPrintSheet: komponen dirender lewat portal ke
 * <body>, tersembunyi di layar (`.qr-card-print-sheet { display: none }`),
 * dan hanya tampil saat body ber kelas `printing-qr-cards` + window.print().
 * Isinya persis payload bertanda tangan dari server (GET
 * /api/presensi/qr-cards) untuk siswa dalam cakupan kewenangan staf —
 * tidak ada payload yang dibuat di klien.
 */

export interface QrCardPrintItem {
  nisn: string;
  name: string;
  payload: string;
}

export function QrCardPrintSheet({ className, cards }: { className: string; cards: QrCardPrintItem[] }) {
  return (
    <div className="qr-card-print-sheet" data-testid="qr-card-print-sheet">
      <div className="mb-4 text-center">
        <h1 className="text-base font-extrabold tracking-wide text-slate-900">KARTU QR PRESENSI</h1>
        <p className="text-xs font-bold text-slate-600">{SCHOOL_INFO.name} — Kelas {className}</p>
        <p className="mt-1 text-[10px] text-slate-500">
          Potong mengikuti garis kartu. Kartu dipakai untuk presensi dengan pemindaian oleh guru/piket.
        </p>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {cards.map(card => (
          <div
            key={card.nisn}
            className="break-inside-avoid rounded-xl border-2 border-slate-700 px-3 py-3 text-center"
          >
            <p className="text-[9px] font-extrabold tracking-widest text-slate-500">{SCHOOL_INFO.name}</p>
            <div className="mt-2 flex justify-center bg-white p-1.5">
              <QRCode value={card.payload} size={104} />
            </div>
            <p className="mt-2 text-xs font-extrabold text-slate-900">{card.name}</p>
            <p className="font-mono text-[10px] font-bold tracking-wider text-slate-600">{card.nisn}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
