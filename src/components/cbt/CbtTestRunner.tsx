import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Clock,
  AlertTriangle,
  Send,
  ArrowLeft,
  ArrowRight,
  Check,
  User,
  CloudUpload,
  Cloud,
} from 'lucide-react';
import { User as UserType, CbtExam, CbtSubmission } from '../../types';
import { Modal } from '../ui/Modal';
import { cbtApi } from '../../utils/cbt-api';

interface CbtTestRunnerProps {
  exam: CbtExam;
  currentUser: UserType;
  attemptId: string;
  initialAnswers?: { [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' };
  initialDoubtful?: { [questionId: string]: boolean };
  onFinish: (submission: CbtSubmission) => void | Promise<void>;
  expiresAt?: string;
}

export function CbtTestRunner({ exam, currentUser, attemptId, initialAnswers = {}, initialDoubtful = {}, onFinish, expiresAt }: CbtTestRunnerProps) {
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' }>(initialAnswers);
  const [doubtful, setDoubtful] = useState<{ [questionId: string]: boolean }>(initialDoubtful);
  const [timeLeft, setTimeLeft] = useState<number>(() => expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : exam.durationMinutes * 60);
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify({ answers: initialAnswers, doubtful: initialDoubtful }));

  const persistAnswers = useCallback(async (currentAnswers: typeof answers, currentDoubtful: typeof doubtful) => {
    const payload = JSON.stringify({ answers: currentAnswers, doubtful: currentDoubtful });
    if (payload === lastSavedRef.current) return;
    setSaveState('saving');
    try {
      await cbtApi.saveAttempt(attemptId, currentAnswers, currentDoubtful);
      lastSavedRef.current = payload;
      setSaveState('saved');
    } catch {
      setSaveState('error');
    }
  }, [attemptId]);

  const scheduleSave = useCallback((currentAnswers: typeof answers, currentDoubtful: typeof doubtful) => {
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => { void persistAnswers(currentAnswers, currentDoubtful); }, 1500);
  }, [persistAnswers]);

  useEffect(() => {
    if (submitting) return;
    scheduleSave(answers, doubtful);
    return () => { if (saveTimerRef.current) clearTimeout(saveTimerRef.current); };
  }, [answers, doubtful, scheduleSave, submitting]);

  useEffect(() => {
    const flush = () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      void persistAnswers(answers, doubtful);
    };
    const onHide = () => flush();
    window.addEventListener('pagehide', onHide);
    window.addEventListener('beforeunload', onHide);
    return () => {
      window.removeEventListener('pagehide', onHide);
      window.removeEventListener('beforeunload', onHide);
    };
  }, [persistAnswers, answers, doubtful]);

  const handleConfirmSubmitTest = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    let correct = 0;
    let wrong = 0;

    try {
      await persistAnswers(answers, doubtful);
    } catch {
      // tetap lanjut submit; jawaban ikut terkirim
    }

    exam.questions.forEach(q => {
      const userAnswer = answers[q.id];
      if (userAnswer === q.correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = Math.round((correct / exam.questions.length) * 100);
    const timeSpent = exam.durationMinutes * 60 - timeLeft;

    const submission: CbtSubmission = {
      id: `sub-${Date.now()}`,
      examId: exam.id,
      siswaId: currentUser.id,
      siswaName: currentUser.name,
      nisn: currentUser.nipNisn || '0068123491',
      answers,
      doubtful,
      score,
      correctCount: correct,
      wrongCount: wrong,
      submittedAt: new Date().toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' }),
      timeSpentSeconds: timeSpent
    };

    try {
      await onFinish(submission);
    } finally {
      setSubmitting(false);
    }
  }, [exam, currentUser, answers, doubtful, timeLeft, onFinish, submitting, persistAnswers]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          alert('Waktu ujian telah habis! Sistem secara otomatis mengirimkan jawaban Anda.');
          handleConfirmSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeLeft, handleConfirmSubmitTest]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSelectOption = (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  const handleToggleDoubtful = (questionId: string) => {
    setDoubtful(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const currentQ = exam.questions[currentQuestionIndex];
  const answeredCount = Object.keys(answers).length;
  const doubtfulCount = Object.values(doubtful).filter(Boolean).length;

  return (
    <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
      {/* CBT Header Toolbar */}
      <header className="bg-slate-800 border-b border-slate-700 px-2 py-2 flex items-center gap-2 shadow-md sm:px-4 sm:py-3">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <div className="w-9 h-9 shrink-0 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-base shadow-sm sm:w-10 sm:h-10 sm:text-lg">
            CBT
          </div>
          <div className="min-w-0">
            <h1 className="text-sm sm:text-base font-bold text-white line-clamp-1">{exam.title}</h1>
            <p className="text-xs text-emerald-400 font-medium line-clamp-1">
              {exam.subject} • Target: {exam.classTarget}
            </p>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1 sm:gap-4">
          {/* Student Info Pill */}
          <div className="hidden md:flex items-center gap-2 bg-slate-700/80 px-3 py-1.5 rounded-xl border border-slate-600 text-xs text-slate-200">
            <User className="w-4 h-4 text-emerald-400" />
            <span className="font-semibold">{currentUser.name}</span>
            <span className="text-slate-400">({currentUser.nipNisn || 'Siswa'})</span>
          </div>

          {/* Auto-save Status */}
          <div
            className={`flex items-center gap-1.5 px-2 py-1.5 rounded-xl text-[10px] sm:text-xs font-bold border transition-all ${
              saveState === 'saved'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : saveState === 'error'
                  ? 'bg-rose-500/10 text-rose-300 border-rose-500/40'
                  : 'bg-slate-700/60 text-slate-300 border-slate-600'
            }`}
            title="Jawaban disimpan otomatis secara berkala"
          >
            {saveState === 'saved'
              ? <Cloud className="w-3.5 h-3.5" />
              : saveState === 'error'
                ? <CloudUpload className="w-3.5 h-3.5" />
                : <CloudUpload className="w-3.5 h-3.5 animate-pulse" />}
            <span className="hidden sm:inline">
              {saveState === 'saved' ? 'Tersimpan' : saveState === 'error' ? 'Gagal simpan' : saveState === 'saving' ? 'Menyimpan...' : 'Auto-save'}
            </span>
          </div>

          {/* Countdown Timer */}
          <div className={`flex items-center gap-1 px-2 py-2 rounded-xl font-mono text-sm sm:gap-2 sm:px-4 sm:text-lg font-bold border transition-all ${
            timeLeft < 300
              ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse'
              : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
          }`}>
            <Clock className="hidden w-5 h-5 sm:block" />
            <span>{formatTime(timeLeft)}</span>
          </div>

          <button
            id="cbt-finish-btn"
            onClick={() => setShowFinishModal(true)}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-2 sm:px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">Selesaikan</span>
          </button>
        </div>
      </header>

      {/* CBT Main Body Grid */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        {/* Question View Column */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto bg-slate-900/90 flex flex-col justify-between">
          <div>
            {/* Question Navigation Bar */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-800 mb-6">
              <div className="flex items-center gap-2">
                <span className="bg-emerald-600 text-white font-bold text-xs px-3 py-1 rounded-lg">
                  Soal No. {currentQuestionIndex + 1}
                </span>
                <span className="text-xs text-slate-400">
                  dari {exam.questions.length} soal
                </span>
              </div>

              {/* Doubtful Toggle Button */}
              <label className={`flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold cursor-pointer transition-all border ${
                doubtful[currentQ.id]
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}>
                <input
                  type="checkbox"
                  checked={!!doubtful[currentQ.id]}
                  onChange={() => handleToggleDoubtful(currentQ.id)}
                  className="rounded text-amber-500 focus:ring-amber-400 accent-amber-500 w-4 h-4"
                />
                <span>Ragu-ragu (Tandai)</span>
              </label>
            </div>

            {/* Question Text */}
            <div className="mb-6">
              <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
                {currentQ.question}
              </p>
            </div>

            {/* Options List */}
            <div className="space-y-3 max-w-3xl">
              {currentQ.options.map((opt) => {
                const isSelected = answers[currentQ.id] === opt.key;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelectOption(currentQ.id, opt.key)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex items-start gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-600/20 border-emerald-500 text-white shadow-md ring-2 ring-emerald-500/30'
                        : 'bg-slate-800/80 border-slate-700/80 text-slate-200 hover:bg-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 border transition-all ${
                      isSelected
                        ? 'bg-emerald-500 text-slate-950 border-emerald-400 shadow-sm'
                        : 'bg-slate-700 text-slate-300 border-slate-600'
                    }`}>
                      {opt.key}
                    </span>
                    <span className="text-sm sm:text-base pt-1 leading-normal">{opt.text}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom Controls */}
          <div className="pt-6 border-t border-slate-800 flex items-center justify-between mt-8">
            <button
              disabled={currentQuestionIndex === 0}
              onClick={() => setCurrentQuestionIndex(prev => prev - 1)}
              className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold px-4 py-2.5 rounded-xl border border-slate-700 transition-all cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Sebelumnya</span>
            </button>

            <div className="text-xs text-slate-400 hidden sm:block">
              Terjawab: <strong className="text-emerald-400">{answeredCount}</strong> / {exam.questions.length}
            </div>

            {currentQuestionIndex < exam.questions.length - 1 ? (
              <button
                onClick={() => setCurrentQuestionIndex(prev => prev + 1)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
              >
                <span>Selanjutnya</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={() => setShowFinishModal(true)}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md"
              >
                <span>Selesaikan Ujian</span>
                <Check className="w-4 h-4" />
              </button>
            )}
          </div>
        </main>

        {/* Right Question Navigator Panel */}
        <aside className="w-full md:w-80 bg-slate-800 border-t md:border-t-0 md:border-l border-slate-700 p-4 flex flex-col justify-between shrink-0">
          <div>
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center justify-between">
              <span>Navigasi Soal</span>
              <span className="text-emerald-400 text-[10px] lowercase font-normal">{answeredCount} dijawab</span>
            </h3>

            {/* Grid Number Buttons */}
            <div className="grid grid-cols-5 gap-2 max-h-64 md:max-h-96 overflow-y-auto p-1">
              {exam.questions.map((q, idx) => {
                const isAnswered = !!answers[q.id];
                const isDoubt = !!doubtful[q.id];
                const isCurrent = idx === currentQuestionIndex;

                let bgClass = 'bg-slate-700 text-slate-300 border-slate-600 hover:bg-slate-600';
                if (isDoubt) {
                  bgClass = 'bg-amber-500 text-slate-950 font-extrabold border-amber-400 shadow-sm';
                } else if (isAnswered) {
                  bgClass = 'bg-emerald-600 text-white font-extrabold border-emerald-500 shadow-sm';
                }

                return (
                  <button
                    key={q.id}
                    onClick={() => setCurrentQuestionIndex(idx)}
                    className={`h-10 rounded-xl font-bold text-sm flex items-center justify-center border transition-all cursor-pointer ${bgClass} ${
                      isCurrent ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="mt-6 pt-4 border-t border-slate-700 space-y-2 text-xs">
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-emerald-600 border border-emerald-500 inline-block"></span>
                <span>Sudah Dijawab ({answeredCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-amber-500 border border-amber-400 inline-block"></span>
                <span>Ragu-ragu ({doubtfulCount})</span>
              </div>
              <div className="flex items-center gap-2 text-slate-300">
                <span className="w-3.5 h-3.5 rounded bg-slate-700 border border-slate-600 inline-block"></span>
                <span>Belum Dijawab ({exam.questions.length - answeredCount})</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-700 text-center">
            <p className="text-[11px] text-slate-400">
              Aplikasi CBT SMKS PLUS AT THAHIRIN
            </p>
          </div>
        </aside>
      </div>

      {/* Finish Confirmation Modal */}
      {showFinishModal && (
        <Modal onClose={() => setShowFinishModal(false)} tone="dark" className="space-y-4">
          <div className="flex items-center gap-3 text-amber-400">
            <AlertTriangle className="w-8 h-8" />
            <h3 className="text-lg font-bold text-white">Selesaikan Ujian CBT?</h3>
          </div>

          <div className="bg-slate-900 p-4 rounded-xl space-y-2 text-xs text-slate-300 border border-slate-700">
            <div className="flex justify-between">
              <span>Total Soal:</span>
              <strong className="text-white">{exam.questions.length}</strong>
            </div>
            <div className="flex justify-between">
              <span>Sudah Dijawab:</span>
              <strong className="text-emerald-400">{answeredCount}</strong>
            </div>
            <div className="flex justify-between">
              <span>Ragu-ragu:</span>
              <strong className="text-amber-400">{doubtfulCount}</strong>
            </div>
            <div className="flex justify-between">
              <span>Belum Dijawab:</span>
              <strong className="text-rose-400">{exam.questions.length - answeredCount}</strong>
            </div>
          </div>

          <p className="text-xs text-slate-300 leading-relaxed">
            Apakah Anda yakin ingin menyelesaikan ujian ini? Setelah dikirim, Anda tidak dapat mengubah jawaban lagi.
          </p>

          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={() => setShowFinishModal(false)}
              className="flex-1 bg-slate-700 hover:bg-slate-600 text-slate-200 font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer"
            >
              Batal & Periksa Lagi
            </button>
            <button
              onClick={handleConfirmSubmitTest}
              disabled={submitting}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
            >
              Ya, Selesaikan Ujian
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
