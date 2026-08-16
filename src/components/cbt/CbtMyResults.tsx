import React from 'react';
import { Award, Eye } from 'lucide-react';
import { CbtExam, CbtSubmission } from '../../types';

interface CbtMyResultsProps {
  submissions: CbtSubmission[];
  exams: CbtExam[];
  onReview: (sub: CbtSubmission) => void;
}

const formatWaktu = (submittedAt: string) => {
  try {
    return new Date(submittedAt).toLocaleString('id-ID', {
      timeZone: 'Asia/Jakarta',
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return submittedAt;
  }
};

export function CbtMyResults({ submissions, exams, onReview }: CbtMyResultsProps) {
  const sorted = [...submissions].sort((a, b) => (b.submittedAt || '').localeCompare(a.submittedAt || ''));
  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
      <div className="flex flex-col items-start gap-2 pb-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Award className="w-5 h-5 text-emerald-600" />
          <span>Nilai Saya (Riwayat Ujian)</span>
        </h3>
        <span className="text-xs text-slate-500 font-medium">
          Total Ujian Dikerjakan: {submissions.length}
        </span>
      </div>

      {sorted.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">
          Belum ada ujian yang kamu kerjakan. Skor dan rincian jawaban akan tampil di sini setelah ujian selesai dikerjakan.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[720px] w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-4">Mata Pelajaran</th>
                <th className="py-3 px-4">Ujian CBT</th>
                <th className="py-3 px-4">Waktu Selesai</th>
                <th className="py-3 px-4">Benar / Salah</th>
                <th className="py-3 px-4">Skor / Nilai</th>
                <th className="py-3 px-4 text-center">Detail</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {sorted.map(sub => {
                const exam = exams.find(e => e.id === sub.examId);
                return (
                  <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-3 px-4">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        {exam?.subject || 'Ujian CBT'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-bold text-slate-900">{exam?.title || 'Ujian CBT'}</td>
                    <td className="py-3 px-4 text-slate-500">{formatWaktu(sub.submittedAt)}</td>
                    <td className="py-3 px-4 text-slate-600">
                      <span className="text-emerald-600 font-bold">{sub.correctCount}</span> Benar • <span className="text-rose-500 font-bold">{sub.wrongCount}</span> Salah
                    </td>
                    <td className="py-3 px-4">
                      <span className={`px-2.5 py-1 rounded-lg font-bold ${sub.score >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
                        {sub.score} / 100
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        onClick={() => onReview(sub)}
                        className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1 mx-auto"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Lihat Jawaban</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}