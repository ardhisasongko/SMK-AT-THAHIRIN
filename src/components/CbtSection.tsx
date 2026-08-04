import React, { useState } from 'react';
import {
  FileText,
  Clock,
  CheckCircle2,
  Key,
  Play,
  Plus,
  Search,
  User,
  Award,
  BarChart3,
  BookOpen,
  Users,
  ShieldCheck,
} from 'lucide-react';
import { User as UserType, CbtExam, CbtSubmission } from '../types';
import { CbtTestRunner } from './cbt/CbtTestRunner';
import { CbtResultsTable } from './cbt/CbtResultsTable';
import { CbtResultReviewModal } from './cbt/CbtResultReviewModal';
import { CbtTokenModal } from './cbt/CbtTokenModal';
import { CbtCreateExamModal } from './cbt/CbtCreateExamModal';

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
  const [activeExam, setActiveExam] = useState<CbtExam | null>(null);
  const [isTestMode, setIsTestMode] = useState<boolean>(false);
  const [selectedExamForToken, setSelectedExamForToken] = useState<CbtExam | null>(null);

  const [showCreateExamModal, setShowCreateExamModal] = useState<boolean>(false);
  const [showResultsTable, setShowResultsTable] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState<string>('');

  const [completedResult, setCompletedResult] = useState<CbtSubmission | null>(null);
  const [showReviewModal, setShowReviewModal] = useState<CbtSubmission | null>(null);

  const handleStartExam = (exam: CbtExam) => {
    if (!currentUser) {
      onOpenLogin();
      return;
    }
    setSelectedExamForToken(exam);
  };

  const handleTokenVerified = () => {
    if (!selectedExamForToken) return;
    setActiveExam(selectedExamForToken);
    setIsTestMode(true);
    setSelectedExamForToken(null);
  };

  const handleFinishSubmission = (submission: CbtSubmission) => {
    setCbtSubmissions(prev => [submission, ...prev]);
    setCompletedResult(submission);
    setIsTestMode(false);
  };

  const closeReview = () => {
    setCompletedResult(null);
    setShowReviewModal(null);
  };

  const handleSaveExam = (exam: CbtExam) => {
    setCbtExams(prev => [exam, ...prev]);
    setShowCreateExamModal(false);
  };

  const filteredExams = cbtExams.filter(exam =>
    exam.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    exam.subject.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Full-screen test runner
  if (isTestMode && activeExam && currentUser) {
    return (
      <CbtTestRunner
        exam={activeExam}
        currentUser={currentUser}
        onFinish={handleFinishSubmission}
      />
    );
  }

  const reviewTarget = completedResult || showReviewModal;
  const reviewExam = reviewTarget
    ? cbtExams.find(e => e.id === reviewTarget.examId)
    : undefined;

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
          <CbtResultsTable
            submissions={cbtSubmissions}
            exams={cbtExams}
            onReview={(sub) => setShowReviewModal(sub)}
          />
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
        <CbtTokenModal
          exam={selectedExamForToken}
          onClose={() => setSelectedExamForToken(null)}
          onStart={handleTokenVerified}
        />
      )}

      {/* RESULT / REVIEW DETAIL MODAL */}
      {reviewTarget && (
        <CbtResultReviewModal
          submission={reviewTarget}
          exam={reviewExam}
          onClose={closeReview}
        />
      )}

      {/* CREATE NEW EXAM MODAL (GURU/ADMIN) */}
      {showCreateExamModal && (
        <CbtCreateExamModal
          currentUser={currentUser}
          onSave={handleSaveExam}
          onClose={() => setShowCreateExamModal(false)}
        />
      )}

    </div>
  );
}
