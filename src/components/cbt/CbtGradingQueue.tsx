import React, { useCallback, useEffect, useState } from 'react';
import { ClipboardCheck, RefreshCw } from 'lucide-react';
import { CbtGradingQueueItem } from '../../types';
import { cbtApi } from '../../utils/cbt-api';
import { CbtGradingModal } from './CbtGradingModal';

interface CbtGradingQueueProps {
  onGraded?: () => void;
}

const formatWaktu = (submittedAt: string) => {
  try {
    return new Date(submittedAt).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch {
    return submittedAt;
  }
};

export function CbtGradingQueue({ onGraded }: CbtGradingQueueProps) {
  const [items, setItems] = useState<CbtGradingQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeAttemptId, setActiveAttemptId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await cbtApi.gradingQueue());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Antrean koreksi gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
      <div className="flex flex-col items-start gap-2 pb-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-emerald-600" />
          <span>Koreksi Esai — Menunggu Penilaian Guru</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500 font-medium">{items.length} pengerjaan menunggu</span>
          <button onClick={() => void load()} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 leading-relaxed">
        Pilihan ganda sudah dinilai otomatis oleh sistem. Esai di bawah ini menunggu nilai dari guru;
        skor siswa masih sementara (poin PG) sampai semua esai pada pengerjaan tersebut selesai dinilai.
      </p>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat antrean koreksi…</p>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">Tidak ada esai yang menunggu koreksi. Semua pengerjaan sudah final.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Siswa</th>
                <th className="py-3 px-4">Ujian</th>
                <th className="py-3 px-4">Waktu Kirim</th>
                <th className="py-3 px-4">Skor PG Sementara</th>
                <th className="py-3 px-4">Esai</th>
                <th className="py-3 px-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {items.map(item => (
                <tr key={item.attemptId} className="hover:bg-slate-50 transition-colors">
                  <td className="py-3 px-4">
                    <span className="font-bold text-slate-900">{item.siswaName}</span>
                    <span className="block font-mono text-[10px] text-slate-400">{item.nisn}</span>
                  </td>
                  <td className="py-3 px-4">
                    <span className="text-emerald-700 font-semibold">{item.examTitle}</span>
                    <span className="block text-[10px] text-slate-400">{item.subject}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-500">{formatWaktu(item.submittedAt)}</td>
                  <td className="py-3 px-4">
                    <span className="px-2.5 py-1 rounded-lg font-bold bg-amber-100 text-amber-800">{item.pgScore}</span>
                  </td>
                  <td className="py-3 px-4 text-slate-600">{item.essayCount} soal</td>
                  <td className="py-3 px-4 text-center">
                    <button
                      onClick={() => setActiveAttemptId(item.attemptId)}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
                    >
                      Koreksi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeAttemptId && (
        <CbtGradingModal
          attemptId={activeAttemptId}
          onClose={() => setActiveAttemptId(null)}
          onSaved={() => { void load(); onGraded?.(); }}
        />
      )}
    </div>
  );
}
