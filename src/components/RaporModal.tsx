import React, { useEffect, useState } from 'react';
import { Award, CalendarCheck2, Download, GraduationCap, Loader2, X } from 'lucide-react';
import type { RaporReport } from '../types';
import { authHeaders } from '../utils/auth';
import { downloadCsv } from '../utils/download';

interface RaporModalProps {
  nisn: string;
  name: string;
  onClose: () => void;
}

export function RaporModal({ nisn, name, onClose }: RaporModalProps) {
  const [report, setReport] = useState<RaporReport | null>(null);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/rapor/${nisn}`, { headers: authHeaders() })
      .then(async response => {
        const json = await response.json() as { success?: boolean; error?: string; data?: RaporReport };
        if (!response.ok || !json.success) throw new Error(json.error || 'Rapor gagal dimuat.');
        return json.data as RaporReport;
      })
      .then(data => { if (!cancelled) setReport(data); })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : 'Rapor gagal dimuat.'); });
    return () => { cancelled = true; };
  }, [nisn]);

  const handleDownload = async () => {
    setDownloading(true);
    try {
      await downloadCsv(`/api/rapor/${nisn}?format=csv`, `rapor-${nisn}.csv`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unduh rapor gagal.');
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-6 space-y-4 shadow-2xl border border-slate-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-slate-900">Rapor Siswa</h3>
            <p className="text-xs text-slate-500">
              {report ? `${report.siswa.name} • ${report.siswa.className}` : name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 cursor-pointer" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>

        {error && <p className="text-xs font-bold text-rose-600 bg-rose-50 border border-rose-200 rounded-xl p-3">{error}</p>}
        {!report && !error && (
          <div className="flex items-center justify-center gap-2 py-12 text-slate-400">
            <Loader2 className="w-5 h-5 animate-spin" />
            <span className="text-xs font-bold">Memuat rapor...</span>
          </div>
        )}

        {report && (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <CalendarCheck2 className="w-4 h-4" /> Kehadiran
                </div>
                <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-slate-700">
                  {report.presensi.rincian.map(item => (
                    <div key={item.status} className="flex justify-between">
                      <span className="text-slate-500">{item.status}</span>
                      <strong>{item.jumlah}</strong>
                    </div>
                  ))}
                  <div className="flex justify-between col-span-2 border-t border-slate-100 pt-1">
                    <span className="text-slate-500">Kehadiran</span>
                    <strong>{report.presensi.hadirPersen}%</strong>
                  </div>
                </div>
              </div>
              <div className="rounded-xl border border-slate-200 p-4 space-y-2">
                <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                  <Award className="w-4 h-4" /> Nilai CBT
                </div>
                {report.cbt.perMapel.length === 0 ? (
                  <p className="text-xs text-slate-400">Belum ada ujian dikerjakan.</p>
                ) : (
                  <div className="space-y-1 text-xs text-slate-700">
                    {report.cbt.perMapel.map(item => (
                      <div key={item.subject} className="flex justify-between">
                        <span className="text-slate-500 truncate">{item.subject} ({item.examCount}x)</span>
                        <strong>{item.avgScore}</strong>
                      </div>
                    ))}
                    <div className="flex justify-between border-t border-slate-100 pt-1">
                      <span className="text-slate-500">Rata-rata</span>
                      <strong>{report.cbt.rataRata}</strong>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3 bg-slate-50 border-b border-slate-200 font-bold text-xs text-slate-700">
                <GraduationCap className="w-4 h-4 text-emerald-600" /> Riwayat Ujian ({report.ujian.length})
              </div>
              {report.ujian.length === 0 ? (
                <p className="px-4 py-3 text-xs text-slate-400">Belum ada ujian dikerjakan.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs text-left">
                    <tbody className="divide-y divide-slate-100">
                      {report.ujian.map((exam, index) => (
                        <tr key={`${exam.title}-${index}`}>
                          <td className="py-2.5 px-4 font-medium text-slate-800 min-w-0">
                            <div className="truncate">{exam.title}</div>
                            <div className="text-[10px] text-slate-400">{exam.subject} • {exam.submittedAt.slice(0, 10)}</div>
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-900">{exam.score}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => void handleDownload()}
              disabled={downloading}
              className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-sm px-4 py-2.5 rounded-xl cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Mengunduh...' : 'Unduh Rapor (CSV)'}</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}