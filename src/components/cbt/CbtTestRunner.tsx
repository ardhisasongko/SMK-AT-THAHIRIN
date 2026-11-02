import React, { useState, useEffect, useCallback, useRef } from 'react';
import { showToast } from '../ui/toast';
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
  HardDrive,
  Megaphone,
  X,
} from 'lucide-react';
import { User as UserType, CbtExam, CbtMonitorAnnouncement, CbtSubmission } from '../../types';
import { SCHOOL_INFO } from '../../data/initialData';
import { Modal } from '../ui/Modal';
import { cbtApi } from '../../utils/cbt-api';
import { isQuestionAnswered } from '../../utils/cbt-scoring';

interface CbtTestRunnerProps {
  exam: CbtExam;
  currentUser: UserType;
  attemptId: string;
  initialAnswers?: { [questionId: string]: string };
  initialDoubtful?: { [questionId: string]: boolean };
  onFinish: (submission: CbtSubmission) => void | Promise<void>;
  expiresAt?: string;
}

const CHECKPOINT_INTERVAL_MS = 10 * 60 * 1000;
// Kanal kendali pengawas (pengumuman, tambah waktu, paksa kumpul) diperiksa
// berkala selama attempt berjalan. 90 detik: tetap terasa cepat di ruangan
// (pengawas juga hadir langsung), dan hasil uji beban 1.000 siswa — jalur
// notices dikecualikan dari ember baca di server, tetapi irama yang lebih
// jarang tetap menghemat baca D1 untuk banyak siswa bersamaan
// (pengecekan per ujian 60 menit turun 120 → 40).
const NOTICES_INTERVAL_MS = 90 * 1000;

function readLocalCache(attemptId: string): { answers: { [questionId: string]: string }; doubtful: { [questionId: string]: boolean } } {
  try {
    const raw = window.localStorage.getItem(`cbt_answers_${attemptId}`);
    if (!raw) return { answers: {}, doubtful: {} };
    const parsed = JSON.parse(raw);
    return {
      answers: parsed && typeof parsed.answers === 'object' ? parsed.answers : {},
      doubtful: parsed && typeof parsed.doubtful === 'object' ? parsed.doubtful : {},
    };
  } catch {
    return { answers: {}, doubtful: {} };
  }
}

function writeLocalCache(attemptId: string, answers: { [questionId: string]: string }, doubtful: { [questionId: string]: boolean }) {
  try {
    window.localStorage.setItem(`cbt_answers_${attemptId}`, JSON.stringify({ answers, doubtful, updatedAt: Date.now() }));
  } catch {
    // kuota penuh / mode pribadi: abaikan, jawaban tetap aman via checkpoint server
  }
}

function clearLocalCache(attemptId: string) {
  try {
    window.localStorage.removeItem(`cbt_answers_${attemptId}`);
  } catch {
    // abaikan
  }
}

export function CbtTestRunner({ exam, currentUser, attemptId, initialAnswers = {}, initialDoubtful = {}, onFinish, expiresAt }: CbtTestRunnerProps) {
  const localCache = readLocalCache(attemptId);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: string }>({ ...initialAnswers, ...localCache.answers });
  const [doubtful, setDoubtful] = useState<{ [questionId: string]: boolean }>({ ...initialDoubtful, ...localCache.doubtful });
  const [timeLeft, setTimeLeft] = useState<number>(() => expiresAt ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)) : exam.durationMinutes * 60);
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const lastSavedRef = useRef<string>(JSON.stringify({ answers: { ...initialAnswers, ...localCache.answers }, doubtful: { ...initialDoubtful, ...localCache.doubtful } }));
  const finishedRef = useRef(false);

  // --- Kanal kendali pengawas (Ruang Kontrol) ---
  const [serverAnnouncements, setServerAnnouncements] = useState<CbtMonitorAnnouncement[]>([]);
  const [dismissedAnnouncementIds, setDismissedAnnouncementIds] = useState<ReadonlySet<string>>(new Set());
  const [proctorSubmitted, setProctorSubmitted] = useState<{ score: number | null } | null>(null);
  const knownExpiresAtRef = useRef<string | undefined>(expiresAt);
  const proctorFinishStartedRef = useRef(false);
  // Ref nilai terbaru agar callback polling stabil (tidak memicu polling ulang
  // setiap jawaban berubah).
  const latestRef = useRef({ answers, doubtful, onFinish });
  useEffect(() => { latestRef.current = { answers, doubtful, onFinish }; });

  // --- Proctoring web (pencatatan + peringatan ramah; TANPA sanksi otomatis) ---
  const rootRef = useRef<HTMLDivElement>(null);
  const wasFullscreenRef = useRef(false);
  const pendingProctorRef = useRef<{ type: string; at: string }[]>([]);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [proctorCounts, setProctorCounts] = useState({ tabSwitch: 0, windowBlur: 0, fullscreenExit: 0 });

  const recordProctorEvent = useCallback((type: 'tab_switch' | 'window_blur' | 'fullscreen_exit') => {
    if (finishedRef.current) return;
    pendingProctorRef.current.push({ type, at: new Date().toISOString() });
    setProctorCounts(prev => ({
      tabSwitch: prev.tabSwitch + (type === 'tab_switch' ? 1 : 0),
      windowBlur: prev.windowBlur + (type === 'window_blur' ? 1 : 0),
      fullscreenExit: prev.fullscreenExit + (type === 'fullscreen_exit' ? 1 : 0),
    }));
  }, []);

  const flushProctorEvents = useCallback(async () => {
    if (!pendingProctorRef.current.length) return;
    const events = pendingProctorRef.current.splice(0, pendingProctorRef.current.length);
    try {
      await cbtApi.proctorEvents(attemptId, events);
    } catch {
      pendingProctorRef.current.unshift(...events);
    }
  }, [attemptId]);

  const enterFullscreen = useCallback(() => {
    const el = rootRef.current;
    if (el && typeof el.requestFullscreen === 'function') {
      el.requestFullscreen().catch(() => undefined);
    }
  }, []);

  // Minta layar penuh saat runner tampil (best effort; tombol manual tersedia
  // bila browser menolak permintaan tanpa gestur langsung).
  useEffect(() => { enterFullscreen(); }, [enterFullscreen]);

  useEffect(() => {
    const onFullscreenChange = () => {
      const active = Boolean(document.fullscreenElement);
      setIsFullscreen(active);
      if (active) { wasFullscreenRef.current = true; return; }
      if (wasFullscreenRef.current) recordProctorEvent('fullscreen_exit');
    };
    const onVisibility = () => { if (document.hidden) recordProctorEvent('tab_switch'); };
    const onBlur = () => recordProctorEvent('window_blur');
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('blur', onBlur);
    return () => {
      document.removeEventListener('fullscreenchange', onFullscreenChange);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('blur', onBlur);
    };
  }, [recordProctorEvent]);

  // Kirim peristiwa proctoring berkala & saat halaman disembunyikan.
  useEffect(() => {
    const interval = setInterval(() => { void flushProctorEvents(); }, 30 * 1000);
    const onHide = () => { void flushProctorEvents(); };
    window.addEventListener('pagehide', onHide);
    return () => {
      clearInterval(interval);
      window.removeEventListener('pagehide', onHide);
    };
  }, [flushProctorEvents]);

  // Attempt sudah diselesaikan pengawas di server: hentikan semua aktivitas
  // runner lalu serahkan ke alur selesai yang biasa (onFinish bersifat
  // idempoten di server — attempt yang sudah submitted dikembalikan apa
  // adanya), sehingga siswa mendarat di layar hasil yang pantas, bukan error.
  const finishByProctor = useCallback(async (score: number | null) => {
    if (proctorFinishStartedRef.current) return;
    proctorFinishStartedRef.current = true;
    finishedRef.current = true;
    clearLocalCache(attemptId);
    const latest = latestRef.current;
    const vehicle: CbtSubmission = {
      id: attemptId,
      examId: exam.id,
      siswaId: currentUser.id,
      siswaName: currentUser.name,
      nisn: currentUser.nipNisn || '',
      answers: latest.answers,
      doubtful: latest.doubtful,
      score: score ?? 0,
      correctCount: 0,
      wrongCount: 0,
      submittedAt: new Date().toISOString(),
      timeSpentSeconds: 0,
      submittedBy: 'proctor',
    };
    try {
      await latest.onFinish(vehicle);
    } catch {
      // Server sudah menyimpan hasil final; layar selesai lokal tetap tampil
      // dan tombol di dalamnya mencoba menyerahkan ulang ke layar hasil.
      proctorFinishStartedRef.current = false;
    }
  }, [attemptId, exam.id, currentUser]);

  // Polling kanal kendali pengawas selama attempt berjalan.
  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      if (cancelled || finishedRef.current || document.hidden) return;
      const notices = await cbtApi.attemptNotices(attemptId).catch(() => null);
      if (!notices || cancelled || finishedRef.current) return;
      if (notices.status === 'submitted') {
        if (notices.submittedBy === 'proctor') {
          setProctorSubmitted({ score: typeof notices.score === 'number' ? notices.score : null });
          showToast('Ujianmu telah dikumpulkan oleh pengawas. Terima kasih sudah mengerjakan dengan jujur.', 'info');
          void finishByProctor(typeof notices.score === 'number' ? notices.score : null);
        }
        return;
      }
      if (notices.status !== 'in_progress') return;
      if (Array.isArray(notices.announcements)) setServerAnnouncements(notices.announcements);
      if (typeof notices.expiresAt === 'string' && notices.expiresAt && notices.expiresAt !== knownExpiresAtRef.current) {
        const previousMs = knownExpiresAtRef.current ? new Date(knownExpiresAtRef.current).getTime() : NaN;
        const nextMs = new Date(notices.expiresAt).getTime();
        if (!Number.isNaN(nextMs)) {
          knownExpiresAtRef.current = notices.expiresAt;
          setTimeLeft(Math.max(0, Math.floor((nextMs - Date.now()) / 1000)));
          if (!Number.isNaN(previousMs) && nextMs > previousMs) {
            const addedMinutes = Math.max(1, Math.round((nextMs - previousMs) / 60000));
            showToast(`Waktu ditambah pengawas (+${addedMinutes} menit). Sisa waktumu sudah diperbarui — tetap semangat!`, 'success');
          }
        }
      }
    };
    // Polling pertama setelah satu interval (bukan saat mount) agar membuka
    // runner tidak menambah request jaringan di luar jadwal berkala.
    const interval = setInterval(() => { void poll(); }, NOTICES_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [attemptId, finishByProctor]);

  const persistAnswers = useCallback(async (currentAnswers: typeof answers, currentDoubtful: typeof doubtful) => {
    const payload = JSON.stringify({ answers: currentAnswers, doubtful: currentDoubtful });
    if (payload === lastSavedRef.current) return;
    setSaveState('saving');
    try {
      await cbtApi.saveAttempt(attemptId, currentAnswers, currentDoubtful);
      lastSavedRef.current = payload;
      setSaveState('saved');
      setLastSyncedAt(new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }));
    } catch {
      setSaveState('error');
    }
  }, [attemptId]);

  // Simpan instan ke localStorage setiap jawaban berubah (tanpa jaringan)
  useEffect(() => {
    if (submitting || finishedRef.current) return;
    writeLocalCache(attemptId, answers, doubtful);
  }, [answers, doubtful, attemptId, submitting]);

  // Checkpoint ke server tiap 10 menit sebagai cadangan
  useEffect(() => {
    if (submitting || finishedRef.current) return;
    const interval = setInterval(() => { void persistAnswers(answers, doubtful); }, CHECKPOINT_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [persistAnswers, answers, doubtful, submitting]);

  useEffect(() => {
    const flush = () => {
      if (finishedRef.current) return;
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

  const missingCount = exam.questions.filter(q => !isQuestionAnswered(q, answers[q.id])).length;
  const missingNumbers = exam.questions
    .map((q, idx) => ({ q, idx }))
    .filter(({ q }) => !isQuestionAnswered(q, answers[q.id]))
    .map(({ idx }) => idx + 1);

  // Ujian resmi: siswa tidak boleh mengirim sebelum waktu minimal pengerjaan (anti jawaban asal-asalan).
  const minSubmitSeconds = exam.examType === 'ujian' && exam.minSubmitMinutes ? Math.min(exam.minSubmitMinutes, exam.durationMinutes) * 60 : 0;
  const elapsedSeconds = Math.max(0, exam.durationMinutes * 60 - timeLeft);
  const canSubmitYet = minSubmitSeconds === 0 || elapsedSeconds >= minSubmitSeconds;
  const minSubmitWaitSeconds = Math.max(0, minSubmitSeconds - elapsedSeconds);

  // Saat waktu habis, submit dipaksa meski belum lengkap agar jawaban yang ada tidak hilang.
  const handleConfirmSubmitTest = useCallback(async (force = false) => {
    if (submitting || finishedRef.current) return;
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
      if (userAnswer && (q.type === 'essai' ? true : userAnswer === q.correctAnswer)) {
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
      await flushProctorEvents();
      await onFinish(submission);
      finishedRef.current = true;
      clearLocalCache(attemptId);
    } finally {
      setSubmitting(false);
    }
  }, [exam, currentUser, answers, doubtful, timeLeft, onFinish, submitting, persistAnswers, attemptId, flushProctorEvents]);

  const handleFinishClick = () => {
    if (submitting) return;
    if (!canSubmitYet) {
      showToast(`Ujian resmi belum boleh dikirim. Minimal pengerjaan ${exam.minSubmitMinutes} menit — masih tersisa ${formatTime(minSubmitWaitSeconds)}. Jawaban Anda tetap aman tersimpan.`, 'info');
      return;
    }
    if (missingCount > 0) {
      showToast(`Masih ada ${missingCount} soal belum diisi: nomor ${missingNumbers.slice(0, 12).join(', ')}${missingNumbers.length > 12 ? ', ...' : ''}. Semua soal wajib dijawab sebelum ujian dikirim.`, 'error');
      const firstMissing = missingNumbers[0] - 1;
      if (firstMissing >= 0) setCurrentQuestionIndex(firstMissing);
      return;
    }
    setShowFinishModal(true);
  };

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || finishedRef.current) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          showToast('Waktu ujian telah habis! Sistem secara otomatis mengirimkan jawaban Anda.', 'info');
          void handleConfirmSubmitTest(true);
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

  const handleSelectOption = (questionId: string, option: { key: string; originalKey?: string }) => {
    // Jawaban selalu disimpan sebagai kunci ASAL opsi (originalKey) agar
    // penilaian server konsisten meski urutan tampilan diacak per attempt.
    setAnswers(prev => ({
      ...prev,
      [questionId]: option.originalKey ?? option.key
    }));
  };

  const handleEssayChange = (questionId: string, value: string) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));
  };

  const handleToggleDoubtful = (questionId: string) => {
    setDoubtful(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const currentQ = exam.questions[currentQuestionIndex];
  const answeredCount = exam.questions.filter(q => isQuestionAnswered(q, answers[q.id])).length;
  const doubtfulCount = Object.values(doubtful).filter(Boolean).length;
  const isEssay = currentQ.type === 'essai';

  const proctorSwitchTotal = proctorCounts.tabSwitch + proctorCounts.windowBlur;

  // Layar selesai khusus: attempt dikumpulkan oleh pengawas dari ruang kontrol.
  if (proctorSubmitted) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex items-center justify-center font-sans p-4">
        <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 text-center space-y-4 shadow-2xl">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-sky-600/20 border border-sky-500/40 flex items-center justify-center">
            <Megaphone className="w-7 h-7 text-sky-300" />
          </div>
          <h1 className="text-lg sm:text-xl font-extrabold text-white">Ujian Telah Dikumpulkan oleh Pengawas</h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            Pengawas telah menyelesaikan sesi ujianmu dari ruang kontrol. Jawaban terakhir yang tersimpan
            sudah dinilai oleh sistem{proctorSubmitted.score != null ? <> — nilai PG kamu: <strong className="text-emerald-300">{proctorSubmitted.score}</strong></> : ''}.
            Terima kasih sudah mengerjakan dengan jujur.
          </p>
          <button
            onClick={() => { proctorFinishStartedRef.current = false; void finishByProctor(proctorSubmitted.score); }}
            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-sm transition-all cursor-pointer"
          >
            Lihat Hasil Ujian
          </button>
        </div>
      </div>
    );
  }

  const visibleAnnouncements = serverAnnouncements.filter(item => !dismissedAnnouncementIds.has(item.id));

  return (
    <div
      ref={rootRef}
      onCopy={event => event.preventDefault()}
      onCut={event => event.preventDefault()}
      onContextMenu={event => event.preventDefault()}
      className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden"
    >
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
              saveState === 'error'
                ? 'bg-rose-500/10 text-rose-300 border-rose-500/40'
                : saveState === 'saved'
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                  : 'bg-slate-700/60 text-slate-300 border-slate-600'
            }`}
            title="Jawaban tersimpan di HP dan disinkronkan ke server tiap 10 menit"
          >
            {saveState === 'error'
              ? <CloudUpload className="w-3.5 h-3.5" />
              : saveState === 'saved'
                ? <Cloud className="w-3.5 h-3.5" />
                : <HardDrive className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">
              {saveState === 'error' ? 'Sinkron gagal' : saveState === 'saving' ? 'Sinkron...' : saveState === 'saved' ? `Tersinkron ${lastSyncedAt}` : 'Tersimpan di HP'}
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

          {proctorSwitchTotal > 0 && (
            <span
              className="hidden sm:flex bg-amber-500/15 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
              title="Perpindahan tab/aplikasi tercatat oleh sistem dan diteruskan ke guru sebagai catatan — tetap fokus ya."
            >
              Tercatat berpindah {proctorSwitchTotal}× — tetap fokus ya
            </span>
          )}

          {minSubmitSeconds > 0 && !canSubmitYet && (
            <span className="hidden sm:block bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold px-2.5 py-1.5 rounded-lg">
              Kirim dibuka dalam {formatTime(minSubmitWaitSeconds)}
            </span>
          )}

          <button
            id="cbt-finish-btn"
            onClick={handleFinishClick}
            disabled={!canSubmitYet}
            title={canSubmitYet ? undefined : `Ujian dapat dikirim setelah ${exam.minSubmitMinutes} menit`}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-2 sm:px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-emerald-600"
          >
            <Send className="w-4 h-4" />
            <span className="hidden sm:inline">{canSubmitYet ? 'Selesaikan' : formatTime(minSubmitWaitSeconds)}</span>
          </button>
        </div>
      </header>

      {/* Pengumuman pengawas (Ruang Kontrol) — banner mencolok sampai ditutup siswa */}
      {visibleAnnouncements.map(item => (
        <div key={item.id} className="bg-amber-400 text-slate-950 px-3 py-2.5 flex items-start gap-2.5 shadow-md sm:px-4" role="alert">
          <Megaphone className="w-4.5 h-4.5 shrink-0 mt-0.5" />
          <p className="flex-1 text-xs sm:text-sm font-semibold leading-snug">
            <span className="font-extrabold">Pengumuman pengawas{item.authorName ? ` (${item.authorName})` : ''}:</span> {item.message}
          </p>
          <button
            type="button"
            aria-label="Tutup pengumuman"
            onClick={() => setDismissedAnnouncementIds(prev => new Set(prev).add(item.id))}
            className="shrink-0 rounded-lg p-1 hover:bg-amber-500/60 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ))}

      {/* Peringatan ramah saat di luar layar penuh */}
      {!isFullscreen && (
        <div className="bg-sky-950/80 border-b border-sky-800 px-3 py-2 flex items-center justify-between gap-3 text-[11px] sm:text-xs text-sky-200">
          <span>Kamu sedang tidak dalam mode layar penuh. Tetap di halaman ini selama ujian berlangsung ya — perpindahan tab/aplikasi tercatat oleh sistem.</span>
          <button
            type="button"
            onClick={enterFullscreen}
            className="shrink-0 bg-sky-600 hover:bg-sky-500 text-white font-bold px-3 py-1.5 rounded-lg cursor-pointer"
          >
            Masuk Layar Penuh
          </button>
        </div>
      )}

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
              {isEssay && (
                <span className="inline-block mb-2 bg-sky-600/20 text-sky-300 border border-sky-600/40 text-[10px] font-bold px-2.5 py-1 rounded-lg">
                  Soal Essai
                </span>
              )}
              <p className="text-base sm:text-lg text-slate-100 font-medium leading-relaxed">
                {currentQ.question}
              </p>
            </div>

            {/* Options List (PG) atau Textarea (Essai) */}
            {isEssay ? (
              <div className="max-w-3xl">
                <textarea
                  value={answers[currentQ.id] || ''}
                  onChange={e => handleEssayChange(currentQ.id, e.target.value)}
                  placeholder="Tulis jawaban essai Anda di sini..."
                  rows={7}
                  maxLength={4000}
                  className="w-full p-4 rounded-xl border border-slate-700 bg-slate-800/80 text-slate-100 text-sm sm:text-base leading-relaxed focus:ring-2 focus:ring-sky-500 focus:border-sky-500 outline-none resize-y"
                />
                <div className="mt-1 text-right text-[11px] text-slate-400">
                  {(answers[currentQ.id] || '').length} / 4000 karakter
                </div>
              </div>
            ) : (
              <div className="space-y-3 max-w-3xl">
                {currentQ.options.map((opt) => {
                  const answerKey = opt.originalKey ?? opt.key;
                  const isSelected = answers[currentQ.id] === answerKey;
                  return (
                    <button
                      key={opt.key}
                      onClick={() => handleSelectOption(currentQ.id, opt)}
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
            )}
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
                onClick={handleFinishClick}
                disabled={!canSubmitYet}
                title={canSubmitYet ? undefined : `Ujian dapat dikirim setelah ${exam.minSubmitMinutes} menit`}
                className="flex items-center gap-2 bg-amber-600 hover:bg-amber-500 text-white text-xs sm:text-sm font-bold px-5 py-2.5 rounded-xl transition-all cursor-pointer shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-amber-600"
              >
                <span>{canSubmitYet ? 'Selesaikan Ujian' : `Kirim dibuka dalam ${formatTime(minSubmitWaitSeconds)}`}</span>
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
                const isAnswered = isQuestionAnswered(q, answers[q.id]);
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
              Aplikasi CBT {SCHOOL_INFO.name}
            </p>
          </div>
        </aside>
      </div>

      {/* Finish Confirmation Modal */}
      {showFinishModal && (
        <Modal onClose={() => setShowFinishModal(false)} tone="dark" className="space-y-4" ariaLabel="Konfirmasi selesaikan ujian" closeOnBackdrop={false}>
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
              <strong className="text-rose-400">{missingCount}</strong>
            </div>
          </div>

          {missingCount > 0 && (
            <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-xl p-3">
              Waktu habis: {missingCount} soal kosong akan ikut terkirim dan dinilai salah.
            </p>
          )}

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
