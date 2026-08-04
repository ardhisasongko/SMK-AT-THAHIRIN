import React from 'react';
import { Award } from 'lucide-react';
import { CbtExam, CbtSubmission } from '../../types';

interface CbtResultReviewModalProps {
  submission: CbtSubmission;
  exam?: CbtExam;
  onClose: () => void;
}

export function CbtResultReviewModal({ submission, exam, onClose }: CbtResultReviewModalProps) {
  return (
    <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
            <Award className="w-6 h-6 text-emerald-600" />
            <span>Hasil Evaluasi Ujian CBT</span>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
          >
            ✕
          </button>
        </div>

        <div className="space-y-6">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Nilai Akhir Siswa</p>
              <h3 className="text-2xl font-extrabold">{submission.siswaName}</h3>
              <p className="text-xs text-emerald-100 mt-1">{exam?.title}</p>
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl text-center min-w-[120px]">
              <div className="text-3xl font-black text-white">{submission.score}</div>
              <div className="text-[10px] text-emerald-200 font-semibold uppercase">Skor Maksimal 100</div>
            </div>
          </div>

          {/* Stat breakdown */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-emerald-700">{submission.correctCount}</div>
              <div className="text-[11px] text-emerald-800 font-medium">Jawaban Benar</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-rose-700">{submission.wrongCount}</div>
              <div className="text-[11px] text-rose-800 font-medium">Jawaban Salah</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-slate-700">{Math.round(submission.timeSpentSeconds / 60)} m</div>
              <div className="text-[11px] text-slate-600 font-medium">Waktu Pengerjaan</div>
            </div>
          </div>

          {/* Review Questions Breakdown */}
          {exam && (
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-sm text-slate-900 border-b pb-2">
                Pembahasan & Kunci Jawaban Soal:
              </h4>

              <div className="space-y-4">
                {exam.questions.map((q, i) => {
                  const userAns = submission.answers[q.id];
                  const isCorrect = userAns === q.correctAnswer;

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          {i + 1}. {q.question}
                        </span>
                        {isCorrect ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                            ✓ Benar
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                            ✗ Salah
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1 text-slate-700">
                        <p>Jawaban Siswa: <strong className={isCorrect ? 'text-emerald-700' : 'text-rose-600'}>{userAns || '-'}</strong></p>
                        <p>Kunci Benar: <strong className="text-emerald-700">{q.correctAnswer}</strong></p>
                      </div>

                      {q.explanation && (
                        <p className="text-slate-500 italic bg-white p-2 rounded-lg border border-slate-200 mt-1">
                          <strong>Pembahasan:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button
            onClick={onClose}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
          >
            Tutup Evaluasi
          </button>
        </div>
      </div>
    </div>
  );
}
