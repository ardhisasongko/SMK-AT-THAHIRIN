import React from 'react';
import { Award, Lock } from 'lucide-react';
import { CbtExam, CbtSubmission } from '../../types';
import { Modal } from '../ui/Modal';
import { isAnswerCorrect } from '../../utils/cbt-scoring';

interface CbtResultReviewModalProps {
  submission: CbtSubmission;
  exam?: CbtExam;
  // Pembahasan terkunci sampai seluruh peserta menyelesaikan ujian.
  reviewLocked?: boolean;
  onClose: () => void;
}

export function CbtResultReviewModal({ submission, exam, reviewLocked, onClose }: CbtResultReviewModalProps) {
  const pendingGrading = submission.gradingStatus === 'pending_grading';
  const pointPerQuestion = exam && exam.questions.length ? 100 / exam.questions.length : 0;
  const formatPoint = (value: number) => (Math.round(value * 10) / 10).toString().replace('.', ',');
  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" scrollable className="space-y-6 sm:p-8">
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
              <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider">{pendingGrading ? 'Skor PG Sementara' : 'Nilai Akhir Siswa'}</p>
              <h3 className="text-2xl font-extrabold">{submission.siswaName}</h3>
              <p className="text-xs text-emerald-100 mt-1">{exam?.title}</p>
              {pendingGrading && (
                <p className="text-[11px] font-bold text-amber-200 bg-amber-500/20 border border-amber-300/30 rounded-lg px-2 py-1 mt-2 inline-block">
                  Esai menunggu koreksi guru — nilai akhir menyusul setelah esai dinilai.
                </p>
              )}
            </div>

            <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl text-center min-w-[120px]">
              <div className="text-3xl font-black text-white">{pendingGrading ? (submission.pgScore ?? submission.score) : submission.score}</div>
              <div className="text-[10px] text-emerald-200 font-semibold uppercase">{pendingGrading ? 'Poin PG Terkumpul' : 'Skor Maksimal 100'}</div>
            </div>
          </div>

          {/* Stat breakdown */}
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-emerald-700">{submission.correctCount}</div>
              <div className="text-[11px] text-emerald-800 font-medium">PG Benar</div>
            </div>
            <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-rose-700">{submission.wrongCount}</div>
              <div className="text-[11px] text-rose-800 font-medium">PG Salah</div>
            </div>
            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
              <div className="text-lg font-extrabold text-slate-700">{Math.round(submission.timeSpentSeconds / 60)} m</div>
              <div className="text-[11px] text-slate-600 font-medium">Waktu Pengerjaan</div>
            </div>
          </div>

          {/* Review Questions Breakdown */}
          {reviewLocked ? (
            <div className="rounded-2xl border border-sky-200 bg-sky-50 p-5 text-center space-y-2">
              <Lock className="w-8 h-8 text-sky-600 mx-auto" />
              <p className="font-bold text-sm text-sky-900">Pembahasan Belum Dibuka</p>
              <p className="text-xs text-sky-800 leading-relaxed">
                Pembahasan dibuka setelah semua peserta menyelesaikan ujian, agar kunci jawaban
                tidak tersebar ke peserta yang belum mengerjakan. Hasil ringkasmu di atas sudah
                tersimpan — silakan buka lagi nanti dari menu Nilai Saya.
              </p>
            </div>
          ) : exam && (
            <div className="space-y-4 pt-2">
              <h4 className="font-bold text-sm text-slate-900 border-b pb-2">
                Pembahasan & Kunci Jawaban Soal:
              </h4>

              <div className="space-y-4">
                {exam.questions.map((q, i) => {
                  const userAns = submission.answers[q.id];
                  const isEssay = q.type === 'essai';
                  const isCorrect = !isEssay && isAnswerCorrect(q, userAns);
                  const essayScore = isEssay ? submission.essayScores?.[q.id] : undefined;
                  const essayNote = isEssay ? submission.essayNotes?.[q.id] : undefined;

                  return (
                    <div key={q.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2 text-xs">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold text-slate-800">
                          {i + 1}. {q.question}
                        </span>
                        {isEssay ? (
                          essayScore != null ? (
                            <span className="bg-sky-100 text-sky-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                              Nilai guru: {formatPoint(essayScore)} / {formatPoint(pointPerQuestion)}
                            </span>
                          ) : (
                            <span className="bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                              Menunggu koreksi guru
                            </span>
                          )
                        ) : isCorrect ? (
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                            ✓ Benar
                          </span>
                        ) : (
                          <span className="bg-rose-100 text-rose-800 font-bold px-2 py-0.5 rounded text-[10px] shrink-0">
                            ✗ {userAns ? 'Salah' : 'Tidak dijawab'}
                          </span>
                        )}
                      </div>

                      {!isEssay && q.options && q.options.length > 0 && (
                        <div className="space-y-1 pt-1">
                          {q.options.map(opt => {
                            const isKey = q.correctAnswer === opt.key;
                            const isMine = userAns === opt.key;
                            return (
                              <p key={opt.key} className={`px-2 py-1 rounded-lg border ${isKey ? 'bg-emerald-50 border-emerald-200 text-emerald-900' : isMine ? 'bg-rose-50 border-rose-200 text-rose-900' : 'bg-white border-slate-200 text-slate-600'}`}>
                                <strong>{opt.key}.</strong> {opt.text}
                                {isKey && <span className="ml-2 font-bold text-emerald-700">(Kunci)</span>}
                                {isMine && !isKey && <span className="ml-2 font-bold text-rose-600">(Jawaban kamu)</span>}
                                {isMine && isKey && <span className="ml-2 font-bold text-emerald-700">(Jawaban kamu)</span>}
                              </p>
                            );
                          })}
                        </div>
                      )}

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-slate-700">
                        <p className={isEssay ? 'break-words whitespace-pre-wrap' : ''}>Jawaban Siswa: <strong className={isEssay ? 'text-slate-800' : isCorrect ? 'text-emerald-700' : 'text-rose-600'}>{userAns || '-'}</strong></p>
                        <p className={isEssay ? 'break-words whitespace-pre-wrap' : ''}>Kunci Benar: <strong className="text-emerald-700">{isEssay ? (q.correctAnswer || '-').split('|').join(' ATAU ') : q.correctAnswer}</strong></p>
                      </div>

                      {isEssay && essayNote && (
                        <p className="text-slate-600 bg-sky-50 p-2 rounded-lg border border-sky-200 mt-1">
                          <strong>Catatan guru:</strong> {essayNote}
                        </p>
                      )}

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
    </Modal>
  );
}
