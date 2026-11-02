import { SCHOOL_INFO } from '../data/schoolConfig';
import type { RaporReport } from '../types';

/**
 * Lembar rapor SATU HALAMAN untuk dicetak / disimpan sebagai PDF.
 *
 * Komponen ini dirender lewat portal ke <body> oleh RaporModal dan
 * disembunyikan di layar (`.rapor-print-sheet { display: none }` di
 * index.css). Saat pengguna menekan tombol "Cetak Rapor", body mendapat
 * kelas `printing-rapor` lalu `window.print()` dipanggil; aturan
 * `@media print` menyembunyikan seluruh aplikasi (#root) dan hanya
 * menampilkan lembar ini.
 *
 * Isinya persis data JSON rapor yang sedang ditampilkan di modal —
 * tidak ada pengambilan data tambahan dan tidak ada data yang dikarang:
 * blok tanda tangan hanya memuat tempat (lokalitas dari konfigurasi
 * sekolah) + tanggal hari ini dan garis nama kosong, karena data rapor
 * memang tidak memiliki nama wali kelas.
 */

function formatTanggalHariIni(): string {
  return new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function labelJenisUjian(examType: string): string {
  if (examType === 'ujian') return 'Ujian';
  if (examType === 'latihan') return 'Latihan';
  return examType;
}

const thClass = 'border border-slate-300 bg-slate-100 px-2 py-1.5 text-[11px] font-bold text-slate-700';
const tdClass = 'border border-slate-300 px-2 py-1.5 text-[11px] text-slate-800';

export function RaporPrintSheet({ report }: { report: RaporReport }) {
  const kota = SCHOOL_INFO.address?.locality;
  const barisTanggal = `${kota ? `${kota}, ` : ''}${formatTanggalHariIni()}`;
  const adaNilaiFinal = report.cbt.perMapel.length > 0;

  return (
    <div className="rapor-print-sheet" data-testid="rapor-print-sheet">
      {/* Kop rapor */}
      <div className="rapor-print-band bg-emerald-700 px-6 py-4 text-center text-white">
        <h1 className="text-2xl font-extrabold tracking-wide">RAPOR</h1>
        <p className="text-sm font-bold tracking-wide">{SCHOOL_INFO.name}</p>
      </div>

      {/* Identitas siswa */}
      <div className="mt-4 space-y-1 text-xs text-slate-800">
        <div className="flex gap-2">
          <span className="w-16 shrink-0 font-bold text-slate-500">NISN</span>
          <span>: {report.siswa.nisn}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-16 shrink-0 font-bold text-slate-500">Nama</span>
          <span>: {report.siswa.name}</span>
        </div>
        <div className="flex gap-2">
          <span className="w-16 shrink-0 font-bold text-slate-500">Kelas</span>
          <span>: {report.siswa.className}</span>
        </div>
      </div>

      {/* Presensi */}
      <h2 className="mt-5 text-xs font-extrabold tracking-wide text-slate-900">PRESENSI</h2>
      <table className="mt-2 w-full border-collapse">
        <thead>
          <tr>
            {report.presensi.rincian.map(item => (
              <th key={item.status} className={`${thClass} text-center`}>{item.status}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr>
            {report.presensi.rincian.map(item => (
              <td key={item.status} className={`${tdClass} text-center font-bold`}>{item.jumlah}</td>
            ))}
          </tr>
          <tr>
            <td className={tdClass} colSpan={Math.max(1, report.presensi.rincian.length - 1)}>
              <span className="font-bold">Kehadiran (%)</span>
            </td>
            <td className={`${tdClass} text-center font-bold`}>{report.presensi.hadirPersen}%</td>
          </tr>
        </tbody>
      </table>

      {/* Nilai CBT per mata pelajaran */}
      <h2 className="mt-5 text-xs font-extrabold tracking-wide text-slate-900">NILAI CBT PER MATA PELAJARAN</h2>
      {adaNilaiFinal ? (
        <table className="mt-2 w-full border-collapse">
          <thead>
            <tr>
              <th className={`${thClass} text-left`}>Mata Pelajaran</th>
              <th className={`${thClass} text-center`}>Jumlah Ujian</th>
              <th className={`${thClass} text-center`}>Rata-rata</th>
              <th className={`${thClass} text-center`}>Nilai Terbaik</th>
            </tr>
          </thead>
          <tbody>
            {report.cbt.perMapel.map(item => (
              <tr key={item.subject}>
                <td className={tdClass}>{item.subject}</td>
                <td className={`${tdClass} text-center`}>{item.examCount}</td>
                <td className={`${tdClass} text-center font-bold`}>{item.avgScore}</td>
                <td className={`${tdClass} text-center`}>{item.bestScore}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="mt-2 text-[11px] italic text-slate-500">Belum ada nilai CBT yang final.</p>
      )}

      {/* Riwayat ujian: hanya dirender bila ada isinya */}
      {report.ujian.length > 0 && (
        <>
          <h2 className="mt-5 text-xs font-extrabold tracking-wide text-slate-900">RIWAYAT UJIAN</h2>
          <table className="mt-2 w-full border-collapse">
            <thead>
              <tr>
                <th className={`${thClass} text-left`}>Tanggal</th>
                <th className={`${thClass} text-left`}>Mapel</th>
                <th className={`${thClass} text-left`}>Ujian</th>
                <th className={`${thClass} text-center`}>Jenis</th>
                <th className={`${thClass} text-center`}>Skor</th>
              </tr>
            </thead>
            <tbody>
              {report.ujian.map((exam, index) => (
                <tr key={`${exam.title}-${index}`}>
                  <td className={tdClass}>{exam.submittedAt ? exam.submittedAt.slice(0, 10) : '-'}</td>
                  <td className={tdClass}>{exam.subject}</td>
                  <td className={tdClass}>{exam.title}</td>
                  <td className={`${tdClass} text-center`}>{labelJenisUjian(exam.examType)}</td>
                  <td className={`${tdClass} text-center font-bold`}>{exam.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      {/* Rata-rata + tanda tangan */}
      <div className="mt-6 flex items-start justify-between gap-6 break-inside-avoid">
        <div className="rounded-xl border-2 border-emerald-700 px-5 py-3 text-center">
          <p className="text-[10px] font-extrabold tracking-widest text-slate-500">RATA-RATA NILAI</p>
          <p className="text-3xl font-extrabold text-emerald-700">{adaNilaiFinal ? report.cbt.rataRata : '—'}</p>
        </div>
        <div className="w-56 text-center text-xs text-slate-800">
          <p>{barisTanggal}</p>
          <p className="mt-1">Wali Kelas,</p>
          <div className="h-16" />
          <p className="font-bold">( ____________________ )</p>
        </div>
      </div>
    </div>
  );
}
