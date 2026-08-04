import React, { useState, useEffect } from 'react';
import { 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  HelpCircle, 
  Play, 
  Plus, 
  Sparkles, 
  Key, 
  User, 
  Award, 
  BarChart3, 
  Search, 
  ArrowLeft, 
  ArrowRight, 
  Send, 
  RotateCcw,
  BookOpen,
  Trash2,
  Eye,
  ShieldCheck,
  Check,
  Users
} from 'lucide-react';
import { User as UserType, CbtExam, CbtQuestion, CbtSubmission, CbtOption } from '../types';
import { GoogleGenAI } from '@google/genai';

interface CbtSectionProps {
  currentUser: UserType | null;
  cbtExams: CbtExam[];
  setCbtExams: React.Dispatch<React.SetStateAction<CbtExam[]>>;
  cbtSubmissions: CbtSubmission[];
  setCbtSubmissions: React.Dispatch<React.SetStateAction<CbtSubmission[]>>;
  onOpenLogin: () => void;
}

export function CbtSection({
  currentUser,
  cbtExams,
  setCbtExams,
  cbtSubmissions,
  setCbtSubmissions,
  onOpenLogin
}: CbtSectionProps) {
  // Navigation State inside CBT
  const [activeExam, setActiveExam] = useState<CbtExam | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [inputToken, setInputToken] = useState<string>('');
  const [tokenError, setTokenError] = useState<string>('');
  const [selectedExamForToken, setSelectedExamForToken] = useState<CbtExam | null>(null);

  // Active Test Runner States
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState<number>(0);
  const [answers, setAnswers] = useState<{ [questionId: string]: 'A' | 'B' | 'C' | 'D' | 'E' }>({});
  const [doubtful, setDoubtful] = useState<{ [questionId: string]: boolean }>({});
  const [timeLeft, setTimeLeft] = useState<number>(0); // in seconds
  const [showFinishModal, setShowFinishModal] = useState<boolean>(false);
  const [completedResult, setCompletedResult] = useState<CbtSubmission | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<CbtSubmission | null>(null);

  // Guru / Admin States
  const [showCreateExamModal, setShowCreateExamModal] = useState<boolean>(false);
  const [showResultsTable, setShowResultsTable] = useState<boolean>(false);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Form New Exam state
  const [newTitle, setNewTitle] = useState('');
  const [newSubject, setNewSubject] = useState('Otomatisasi Kearsipan Digital');
  const [newClassTarget, setNewClassTarget] = useState('Semua Kelas AP');
  const [newDuration, setNewDuration] = useState<number>(30);
  const [newToken, setNewToken] = useState('AP' + Math.floor(1000 + Math.random() * 9000));
  const [newQuestions, setNewQuestions] = useState<CbtQuestion[]>([]);

  // Timer countdown hook for CBT
  useEffect(() => {
    if (!isTestMode || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmitTest();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isTestMode, timeLeft]);

  // Format seconds to MM:SS
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Start Exam Handler
  const handleStartExam = (exam: CbtExam) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    setSelectedExamForToken(exam);
    setInputToken('');
    setTokenError('');
  };

  const handleVerifyTokenAndStart = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExamForToken) return;

    if (inputToken.trim().toUpperCase() !== selectedExamForToken.token.toUpperCase()) {
      setTokenError('Token ujian tidak valid. Silakan tanyakan token kepada pengawas/guru.');
      return;
    }

    // Reset test state & start test
    setActiveExam(selectedExamForToken);
    setAnswers({});
    setDoubtful({});
    setCurrentQuestionIndex(0);
    setTimeLeft(selectedExamForToken.durationMinutes * 60);
    setIsTestMode(true);
    setSelectedExamForToken(null);
  };

  // Option Select
  const handleSelectOption = (questionId: string, optionKey: 'A' | 'B' | 'C' | 'D' | 'E') => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: optionKey
    }));
  };

  // Toggle Doubtful
  const handleToggleDoubtful = (questionId: string) => {
    setDoubtful(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  // Submit Test Handler
  const handleConfirmSubmitTest = () => {
    if (!activeExam || !currentUser) return;

    let correct = 0;
    let wrong = 0;

    activeExam.questions.forEach(q => {
      const userAnswer = answers[q.id];
      if (userAnswer === q.correctAnswer) {
        correct++;
      } else {
        wrong++;
      }
    });

    const score = Math.round((correct / activeExam.questions.length) * 100);
    const timeSpent = activeExam.durationMinutes * 60 - timeLeft;

    const submission: CbtSubmission = {
      id: `sub-${Date.now()}`,
      examId: activeExam.id,
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

    setCbtSubmissions(prev => [submission, ...prev]);
    setCompletedResult(submission);
    setIsTestMode(false);
    setShowFinishModal(false);
  };

  const handleAutoSubmitTest = () => {
    alert('Waktu ujian telah habis! Sistem secara otomatis mengirimkan jawaban Anda.');
    handleConfirmSubmitTest();
  };

  // AI Generator Question for New Exam
  const handleGenerateAiQuestions = async () => {
    setIsAiGenerating(true);
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error('API Key Gemini belum terkonfigurasi');
      }

      const ai = new GoogleGenAI({ apiKey });
      const prompt = `Buatkan 5 soal pilihan ganda (A, B, C, D, E) untuk mata pelajaran Administrasi Perkantoran "${newSubject}" untuk tingkat SMK Administrasi Perkantoran.
Format JSON murni tanpa markdown/backticks:
[
  {
    "id": "q1",
    "question": "Pertanyaan soal...",
    "options": [
      { "key": "A", "text": "Pilihan A" },
      { "key": "B", "text": "Pilihan B" },
      { "key": "C", "text": "Pilihan C" },
      { "key": "D", "text": "Pilihan D" },
      { "key": "E", "text": "Pilihan E" }
    ],
    "correctAnswer": "A",
    "explanation": "Penjelasan singkat jawaban benar"
  }
]`;

      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt
      });

      const text = response.text || '';
      const cleanJson = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanJson);

      if (Array.isArray(parsed) && parsed.length > 0) {
        setNewQuestions(parsed);
      }
    } catch (err) {
      console.error(err);
      // Fallback default AP questions
      setNewQuestions([
        {
          id: 'ai-1',
          question: 'Salah satu prinsip dasar penataan ruang kantor (office layout) menurut Geoffrey Lockey adalah ...',
          options: [
            { key: 'A', text: 'Prinsip jarak terpendek dalam alur kerja' },
            { key: 'B', text: 'Prinsip isolasi antar karyawan' },
            { key: 'C', text: 'Prinsip sekat tinggi tanpa pencahayaan' },
            { key: 'D', text: 'Prinsip penumpukan berkas manual' },
            { key: 'E', text: 'Prinsip penggunaan perabot berat' }
          ],
          correctAnswer: 'A',
          explanation: 'Prinsip jarak terpendek memungkinkan alur dokumen berjalan efisien tanpa banyak pergerakan yang tak perlu.'
        },
        {
          id: 'ai-2',
          question: 'Alat perkantoran yang digunakan untuk menghancurkan dokumen rahasia menjadi potongan kecil adalah ...',
          options: [
            { key: 'A', text: 'Laminating Machine' },
            { key: 'B', text: 'Paper Shredder (Penghancur Kertas)' },
            { key: 'C', text: 'Binding Machine' },
            { key: 'D', text: 'Risograph' },
            { key: 'E', text: 'Guillotine Cutter' }
          ],
          correctAnswer: 'B',
          explanation: 'Paper Shredder menjaga kerahasiaan dokumen kantor dengan menghancurkannya menjadi potongan strip atau cross-cut.'
        }
      ]);
    } finally {
      setIsAiGenerating(false);
    }
  };

  // Add Manual Question
  const handleAddBlankQuestion = () => {
    const qId = `q-manual-${Date.now()}`;
    setNewQuestions(prev => [
      ...prev,
      {
        id: qId,
        question: 'Tuliskan pertanyaan di sini...',
        options: [
          { key: 'A', text: 'Opsi A' },
          { key: 'B', text: 'Opsi B' },
          { key: 'C', text: 'Opsi C' },
          { key: 'D', text: 'Opsi D' },
          { key: 'E', text: 'Opsi E' }
        ],
        correctAnswer: 'A',
        explanation: 'Penjelasan jawaban benar'
      }
    ]);
  };

  // Save New Exam
  const handleSaveExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Judul ujian tidak boleh kosong.');
      return;
    }
    if (newQuestions.length === 0) {
      alert('Harap tambahkan minimal 1 soal ujian.');
      return;
    }

    const createdExam: CbtExam = {
      id: `cbt-${Date.now()}`,
      title: newTitle,
      subject: newSubject,
      classTarget: newClassTarget,
      durationMinutes: newDuration,
      token: newToken.toUpperCase(),
      teacherName: currentUser?.name || 'Bpk. Ahmad Fauzi, S.Pd.',
      startDate: new Date().toISOString().split('T')[0],
      endDate: '2026-08-31',
      status: 'active',
      questions: newQuestions
    };

    setCbtExams(prev => [createdExam, ...prev]);
    setShowCreateExamModal(false);
    setNewTitle('');
    setNewQuestions([]);
  };

  const filteredExams = cbtExams.filter(exam => 
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // -------------------------------------------------------------
  // RENDER: Active CBT Test Mode (Mode Pengerjaan Ujian)
  // -------------------------------------------------------------
  if (isTestMode && activeExam) {
    const currentQ = activeExam.questions[currentQuestionIndex];
    const answeredCount = Object.keys(answers).length;
    const doubtfulCount = Object.values(doubtful).filter(Boolean).length;

    return (
      <div className="fixed inset-0 z-50 bg-slate-900 text-slate-100 flex flex-col font-sans select-none overflow-hidden">
        {/* CBT Header Toolbar */}
        <header className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between shadow-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-lg shadow-sm">
              CBT
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-bold text-white line-clamp-1">{activeExam.title}</h1>
              <p className="text-xs text-emerald-400 font-medium line-clamp-1">
                {activeExam.subject} • Target: {activeExam.classTarget}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Student Info Pill */}
            <div className="hidden md:flex items-center gap-2 bg-slate-700/80 px-3 py-1.5 rounded-xl border border-slate-600 text-xs text-slate-200">
              <User className="w-4 h-4 text-emerald-400" />
              <span className="font-semibold">{currentUser?.name}</span>
              <span className="text-slate-400">({currentUser?.nipNisn || 'Siswa'})</span>
            </div>

            {/* Countdown Timer */}
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-base sm:text-lg font-bold border transition-all ${
              timeLeft < 300 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 animate-pulse' 
                : 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
            }`}>
              <Clock className="w-5 h-5" />
              <span>{formatTime(timeLeft)}</span>
            </div>

            <button
              id="cbt-finish-btn"
              onClick={() => setShowFinishModal(true)}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs sm:text-sm px-4 py-2 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-1.5"
            >
              <Send className="w-4 h-4" />
              <span>Selesaikan</span>
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
                    dari {activeExam.questions.length} soal
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
                Terjawab: <strong className="text-emerald-400">{answeredCount}</strong> / {activeExam.questions.length}
              </div>

              {currentQuestionIndex < activeExam.questions.length - 1 ? (
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
                {activeExam.questions.map((q, idx) => {
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
                  <span>Belum Dijawab ({activeExam.questions.length - answeredCount})</span>
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
          <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-800 border border-slate-700 text-white rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
              <div className="flex items-center gap-3 text-amber-400">
                <AlertTriangle className="w-8 h-8" />
                <h3 className="text-lg font-bold text-white">Selesaikan Ujian CBT?</h3>
              </div>

              <div className="bg-slate-900 p-4 rounded-xl space-y-2 text-xs text-slate-300 border border-slate-700">
                <div className="flex justify-between">
                  <span>Total Soal:</span>
                  <strong className="text-white">{activeExam.questions.length}</strong>
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
                  <strong className="text-rose-400">{activeExam.questions.length - answeredCount}</strong>
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
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-2.5 rounded-xl text-xs transition-all cursor-pointer shadow-md"
                >
                  Ya, Selesaikan Ujian
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // -------------------------------------------------------------
  // RENDER: Normal CBT Dashboard View
  // -------------------------------------------------------------
  return (
    <div id="cbt-section" className="py-8 bg-slate-50 min-h-[85vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">

        {/* SECTION HEADER */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white rounded-3xl p-6 sm:p-8 shadow-xl border border-slate-800 relative overflow-hidden">
          <div className="absolute right-0 top-0 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>

          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-500/20 text-emerald-300 rounded-full text-xs font-semibold border border-emerald-500/30">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>CBT Portal • SMKS PLUS AT THAHIRIN</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                Computer Based Test (CBT) Kuis & Ujian Digital
              </h1>
              <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
                Sistem pengerjaan ujian berbasis komputer terintegrasi untuk mata pelajaran Administrasi Perkantoran dengan pengawasan token, timer otomatis, dan evaluasi nilai instan.
              </p>
            </div>

            {/* Action Buttons for Guru/Admin */}
            <div className="flex flex-wrap items-center gap-3">
              {(currentUser?.role === 'admin' || currentUser?.role === 'guru') && (
                <>
                  <button
                    id="btn-open-results"
                    onClick={() => setShowResultsTable(!showResultsTable)}
                    className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl border border-slate-700 shadow-md transition-all cursor-pointer"
                  >
                    <BarChart3 className="w-4 h-4 text-emerald-400" />
                    <span>{showResultsTable ? 'Tutup Nilai' : 'Daftar Nilai Siswa'}</span>
                  </button>

                  <button
                    id="btn-create-cbt"
                    onClick={() => setShowCreateExamModal(true)}
                    className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-lg shadow-emerald-600/30 transition-all cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Buat Ujian / Kuis Baru</span>
                  </button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* RESULTS SUMMARY TABLE (IF TOGGLED OR GURU) */}
        {showResultsTable && (
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
                <Award className="w-5 h-5 text-emerald-600" />
                <span>Hasil & Rekapitulasi Nilai Siswa</span>
              </h3>
              <span className="text-xs text-slate-500 font-medium">
                Total Pengerjaan: {cbtSubmissions.length} siswa
              </span>
            </div>

            {cbtSubmissions.length === 0 ? (
              <p className="text-xs text-slate-500 py-6 text-center">Belum ada hasil pengerjaan ujian siswa.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                    <tr>
                      <th className="py-3 px-4">Siswa</th>
                      <th className="py-3 px-4">NISN</th>
                      <th className="py-3 px-4">Ujian CBT</th>
                      <th className="py-3 px-4">Skor / Nilai</th>
                      <th className="py-3 px-4">Benar / Salah</th>
                      <th className="py-3 px-4">Waktu Selesai</th>
                      <th className="py-3 px-4 text-center">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {cbtSubmissions.map(sub => {
                      const exam = cbtExams.find(e => e.id === sub.examId);
                      return (
                        <tr key={sub.id} className="hover:bg-slate-50 transition-colors">
                          <td className="py-3 px-4 font-bold text-slate-900">{sub.siswaName}</td>
                          <td className="py-3 px-4 font-mono text-slate-500">{sub.nisn}</td>
                          <td className="py-3 px-4 text-emerald-700 font-semibold">{exam?.title || 'Ujian CBT'}</td>
                          <td className="py-3 px-4">
                            <span className={`px-2.5 py-1 rounded-lg font-bold ${
                              sub.score >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                            }`}>
                              {sub.score} / 100
                            </span>
                          </td>
                          <td className="py-3 px-4 text-slate-600">
                            <span className="text-emerald-600 font-bold">{sub.correctCount}</span> Benar • <span className="text-rose-500 font-bold">{sub.wrongCount}</span> Salah
                          </td>
                          <td className="py-3 px-4 text-slate-500">{sub.submittedAt}</td>
                          <td className="py-3 px-4 text-center">
                            <button
                              onClick={() => setShowReviewModal(sub)}
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
        )}

        {/* SEARCH & EXAM LIST GRID */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-emerald-600" />
              <span>Daftar Ujian & Kuis CBT Tersedia</span>
            </h2>

            {/* Search Input */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
              <input 
                type="text" 
                placeholder="Cari mata pelajaran / ujian..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {filteredExams.map(exam => {
              // Check if currentUser completed this exam
              const mySubmission = cbtSubmissions.find(s => s.examId === exam.id && s.siswaId === currentUser?.id);

              return (
                <div 
                  key={exam.id} 
                  className="bg-white rounded-2xl p-6 border border-slate-200/90 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[11px] font-bold px-2.5 py-1 rounded-lg">
                        {exam.subject}
                      </span>
                      <span className="bg-slate-100 text-slate-600 text-[11px] font-bold px-2.5 py-1 rounded-lg flex items-center gap-1">
                        <Users className="w-3 h-3 text-slate-500" />
                        {exam.classTarget}
                      </span>
                    </div>

                    <h3 className="font-extrabold text-base sm:text-lg text-slate-900 leading-snug">
                      {exam.title}
                    </h3>

                    <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Durasi: <strong>{exam.durationMinutes} Menit</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Jumlah: <strong>{exam.questions.length} Soal</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 col-span-2">
                        <User className="w-4 h-4 text-slate-400 shrink-0" />
                        <span>Pengampu: {exam.teacherName}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    {mySubmission ? (
                      <div className="flex items-center justify-between w-full">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                          <span className="text-xs font-bold text-slate-700">Sudah Selesai Dikerjakan</span>
                        </div>
                        <button
                          onClick={() => setShowReviewModal(mySubmission)}
                          className="bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-xs font-bold px-3.5 py-2 rounded-xl transition-all cursor-pointer flex items-center gap-1.5"
                        >
                          <Award className="w-4 h-4" />
                          <span>Nilai: {mySubmission.score}</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between w-full">
                        <div className="text-xs text-slate-500 flex items-center gap-1 font-mono">
                          <Key className="w-3.5 h-3.5 text-amber-500" />
                          <span>Token: <strong className="text-slate-800">{exam.token}</strong></span>
                        </div>

                        <button
                          id={`start-exam-${exam.id}`}
                          onClick={() => handleStartExam(exam)}
                          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center gap-2 hover:scale-[1.02]"
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>Kerjakan Ujian</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* TOKEN PROMPT MODAL */}
      {selectedExamForToken && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 border border-slate-100">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Key className="w-5 h-5" />
                <span>Konfirmasi Token Ujian CBT</span>
              </div>
              <button 
                onClick={() => setSelectedExamForToken(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="font-extrabold text-base text-slate-900">{selectedExamForToken.title}</h3>
              <p className="text-xs text-slate-500 mt-1">
                Masukkan Token Ujian yang diberikan oleh pengawas atau guru mata pelajaran untuk memulai timer.
              </p>
            </div>

            <form onSubmit={handleVerifyTokenAndStart} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">TOKEN UJIAN (Contoh: {selectedExamForToken.token})</label>
                <input 
                  type="text" 
                  value={inputToken}
                  onChange={(e) => setInputToken(e.target.value)}
                  placeholder="Masukkan 6 Digit Token"
                  className="w-full p-3 uppercase font-mono font-extrabold text-lg tracking-widest text-center bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500"
                  required
                />
                {tokenError && <p className="text-xs text-rose-600 font-semibold mt-1">{tokenError}</p>}
              </div>

              <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100 text-xs text-emerald-900 space-y-1">
                <p className="font-bold">Ketentuan Ujian:</p>
                <ul className="list-disc list-inside space-y-0.5 text-emerald-800">
                  <li>Durasi: <strong>{selectedExamForToken.durationMinutes} Menit</strong></li>
                  <li>Total: <strong>{selectedExamForToken.questions.length} Soal Pilihan Ganda</strong></li>
                  <li>Timer berjalan saat Anda menekan tombol Mulai.</li>
                </ul>
              </div>

              <button
                type="submit"
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-xl text-sm shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Mulai Ujian Sekarang</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* RESULT / REVIEW DETAIL MODAL */}
      {(completedResult || showReviewModal) && (
        <div className="fixed inset-0 z-50 bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-sm">
                <Award className="w-6 h-6 text-emerald-600" />
                <span>Hasil Evaluasi Ujian CBT</span>
              </div>
              <button 
                onClick={() => {
                  setCompletedResult(null);
                  setShowReviewModal(null);
                }}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Score Card Banner */}
            {(() => {
              const res = completedResult || showReviewModal;
              if (!res) return null;
              const exam = cbtExams.find(e => e.id === res.examId);

              return (
                <div className="space-y-6">
                  <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-6 rounded-2xl shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <p className="text-xs text-emerald-200 font-bold uppercase tracking-wider">Nilai Akhir Siswa</p>
                      <h3 className="text-2xl font-extrabold">{res.siswaName}</h3>
                      <p className="text-xs text-emerald-100 mt-1">{exam?.title}</p>
                    </div>

                    <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-xl text-center min-w-[120px]">
                      <div className="text-3xl font-black text-white">{res.score}</div>
                      <div className="text-[10px] text-emerald-200 font-semibold uppercase">Skor Maksimal 100</div>
                    </div>
                  </div>

                  {/* Stat breakdown */}
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="bg-emerald-50 border border-emerald-100 p-3 rounded-xl">
                      <div className="text-lg font-extrabold text-emerald-700">{res.correctCount}</div>
                      <div className="text-[11px] text-emerald-800 font-medium">Jawaban Benar</div>
                    </div>
                    <div className="bg-rose-50 border border-rose-100 p-3 rounded-xl">
                      <div className="text-lg font-extrabold text-rose-700">{res.wrongCount}</div>
                      <div className="text-[11px] text-rose-800 font-medium">Jawaban Salah</div>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl">
                      <div className="text-lg font-extrabold text-slate-700">{Math.round(res.timeSpentSeconds / 60)} m</div>
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
                          const userAns = res.answers[q.id];
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
                    onClick={() => {
                      setCompletedResult(null);
                      setShowReviewModal(null);
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl text-xs transition-all cursor-pointer"
                  >
                    Tutup Evaluasi
                  </button>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* CREATE NEW EXAM MODAL (GURU/ADMIN) */}
      {showCreateExamModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 sm:p-8 shadow-2xl space-y-6 border border-slate-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-slate-100">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
                <Plus className="w-5 h-5" />
                <span>Buat Paket Ujian CBT Baru</span>
              </div>
              <button 
                onClick={() => setShowCreateExamModal(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveExamSubmit} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Judul Ujian / Kuis CBT</label>
                <input 
                  type="text"
                  required
                  placeholder="contoh: Penilaian Harian - Otomatisasi Kearsipan Digital"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                  <input 
                    type="text"
                    required
                    value={newSubject}
                    onChange={(e) => setNewSubject(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Target Kelas</label>
                  <select 
                    value={newClassTarget}
                    onChange={(e) => setNewClassTarget(e.target.value)}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  >
                    <option value="Semua Kelas AP">Semua Kelas AP</option>
                    <option value="X AP 1">X AP 1</option>
                    <option value="X AP 2">X AP 2</option>
                    <option value="XI AP 1">XI AP 1</option>
                    <option value="XII AP 1">XII AP 1</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Durasi Pengerjaan (Menit)</label>
                  <input 
                    type="number"
                    min={5}
                    max={180}
                    required
                    value={newDuration}
                    onChange={(e) => setNewDuration(Number(e.target.value))}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Token Akses Ujian</label>
                  <input 
                    type="text"
                    required
                    value={newToken}
                    onChange={(e) => setNewToken(e.target.value.toUpperCase())}
                    className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 uppercase"
                  />
                </div>
              </div>

              {/* Soal Generator Box */}
              <div className="pt-4 border-t border-slate-100 space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900">
                    Daftar Soal Ujian ({newQuestions.length} Soal)
                  </h4>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleGenerateAiQuestions}
                      disabled={isAiGenerating}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                    >
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>{isAiGenerating ? 'Memproses AI...' : 'Generate AI Soal'}</span>
                    </button>

                    <button
                      type="button"
                      onClick={handleAddBlankQuestion}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Manual</span>
                    </button>
                  </div>
                </div>

                {newQuestions.length === 0 ? (
                  <p className="text-slate-400 italic py-4 text-center border border-dashed rounded-xl">
                    Belum ada soal ditambahkan. Gunakan &quot;Generate AI Soal&quot; atau &quot;Manual&quot;.
                  </p>
                ) : (
                  <div className="space-y-3 max-h-60 overflow-y-auto p-1">
                    {newQuestions.map((q, idx) => (
                      <div key={q.id} className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-emerald-800">Soal #{idx + 1}</span>
                          <button
                            type="button"
                            onClick={() => setNewQuestions(prev => prev.filter((_, i) => i !== idx))}
                            className="text-rose-500 hover:text-rose-700 font-bold text-[11px]"
                          >
                            Hapus
                          </button>
                        </div>
                        <p className="font-medium text-slate-800">{q.question}</p>
                        <p className="text-[11px] text-emerald-700 font-semibold">Kunci: {q.correctAnswer}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateExamModal(false)}
                  className="bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md cursor-pointer"
                >
                  Simpan Ujian CBT
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
