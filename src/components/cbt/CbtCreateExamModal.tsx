import React, { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';
import { User as UserType, CbtExam, CbtQuestion, Kelas } from '../../types';
import { Modal } from '../ui/Modal';
import { cbtApi } from '../../utils/cbt-api';

interface CbtCreateExamModalProps {
  currentUser: UserType | null;
  kelasList: Kelas[];
  initialExam?: CbtExam | null;
  onSave: (exam: CbtExam) => void;
  onClose: () => void;
}

export function CbtCreateExamModal({ currentUser, kelasList, initialExam, onSave, onClose }: CbtCreateExamModalProps) {
  const today = new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
  const initialClassTarget = initialExam?.classTarget === 'Semua Kelas MPLB' ? 'all' : kelasList.find(kelas => kelas.id === initialExam?.classTarget || kelas.name === initialExam?.classTarget)?.id || initialExam?.classTarget || 'all';
  const [newTitle, setNewTitle] = useState(initialExam?.title || '');
  const [newSubject, setNewSubject] = useState(initialExam?.subject || 'Otomatisasi Kearsipan Digital');
  const [newClassTarget, setNewClassTarget] = useState(initialClassTarget);
  const [newDuration, setNewDuration] = useState<number>(initialExam?.durationMinutes || 30);
  const [newToken, setNewToken] = useState(initialExam ? '' : 'MPLB' + Math.floor(1000 + Math.random() * 9000));
  const [newStartDate, setNewStartDate] = useState(initialExam?.startDate || today);
  const [newEndDate, setNewEndDate] = useState(initialExam?.endDate || today);
  const [newOpenTime, setNewOpenTime] = useState(initialExam?.openTime || '');
  const [newCloseTime, setNewCloseTime] = useState(initialExam?.closeTime || '');
  const [newQuestions, setNewQuestions] = useState<CbtQuestion[]>(initialExam?.questions || []);
  const [isAiGenerating, setIsAiGenerating] = useState<boolean>(false);

  const handleGenerateAiQuestions = async () => {
    setIsAiGenerating(true);
    try {
      const questions = await cbtApi.generateQuestions(newSubject);
      if (!questions.length) throw new Error('Generator tidak menghasilkan soal.');
      setNewQuestions(questions);
    } catch (err: any) {
      console.error('Error generating questions:', err);
      alert(`Gagal membuat soal AI: ${err.message}`);
    } finally {
      setIsAiGenerating(false);
    }
  };

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

  const handleAddEssayQuestion = () => {
    const qId = `q-essai-${Date.now()}`;
    setNewQuestions(prev => [
      ...prev,
      {
        id: qId,
        question: 'Tuliskan pertanyaan essai di sini...',
        type: 'essai',
        options: [],
        correctAnswer: ''
      }
    ]);
  };

  const handleUpdateQuestion = (qId: string, patch: Partial<CbtQuestion>) => {
    setNewQuestions(prev => prev.map(q => q.id === qId ? { ...q, ...patch } : q));
  };

  const handleSaveExamSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) {
      alert('Judul ujian tidak boleh kosong.');
      return;
    }
    if (!newSubject.trim()) {
      alert('Mata pelajaran tidak boleh kosong.');
      return;
    }
    if (newEndDate < newStartDate) {
      alert('Tanggal akhir tidak boleh sebelum tanggal mulai.');
      return;
    }
    if (newOpenTime && newCloseTime && newCloseTime <= newOpenTime) {
      alert('Jam tutup harus lebih lambat dari jam buka.');
      return;
    }
    if (newQuestions.length === 0) {
      alert('Harap tambahkan minimal 1 soal ujian.');
      return;
    }
    const incompleteEssay = newQuestions.find(q => q.type === 'essai' && !(q.correctAnswer || '').trim());
    if (incompleteEssay) {
      alert('Setiap soal essai wajib memiliki kunci jawaban teks.');
      return;
    }

    const createdExam: CbtExam = {
      id: initialExam?.id || `cbt-${Date.now()}`,
      title: newTitle,
      subject: newSubject,
      classTarget: newClassTarget,
      durationMinutes: newDuration,
      token: newToken.toUpperCase(),
      teacherName: initialExam?.teacherName || currentUser?.name || 'Guru',
      startDate: newStartDate,
      endDate: newEndDate,
      openTime: newOpenTime || undefined,
      closeTime: newCloseTime || undefined,
      status: initialExam?.status || 'active',
      questions: newQuestions
    };

    onSave(createdExam);
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" scrollable className="space-y-6 sm:p-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
          <Plus className="w-5 h-5" />
          <span>{initialExam ? 'Edit Paket Ujian CBT' : 'Buat Paket Ujian CBT Baru'}</span>
        </div>
        <button
          onClick={onClose}
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
                 <option value="all">Semua Kelas</option>
                 {kelasList.map(kelas => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
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
               <label className="block font-bold text-slate-700 mb-1">Token Akses Ujian{initialExam ? ' (opsional)' : ''}</label>
              <input
                type="text"
                 required={!initialExam}
                 placeholder={initialExam ? 'Kosongkan jika tidak diubah' : undefined}
                value={newToken}
                onChange={(e) => setNewToken(e.target.value.toUpperCase())}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-mono font-bold text-slate-900 uppercase"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tanggal Mulai</label>
              <input type="date" required value={newStartDate} onChange={(e) => { setNewStartDate(e.target.value); if (newEndDate < e.target.value) setNewEndDate(e.target.value); }} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900" />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Tanggal Akhir</label>
              <input type="date" required min={newStartDate} value={newEndDate} onChange={(e) => setNewEndDate(e.target.value)} className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900" />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jam Buka (opsional, WIB)</label>
              <input
                type="time"
                value={newOpenTime}
                onChange={(e) => { setNewOpenTime(e.target.value); if (newCloseTime && newCloseTime <= e.target.value) setNewCloseTime(''); }}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Jam Tutup (opsional, WIB)</label>
              <input
                type="time"
                min={newOpenTime || undefined}
                value={newCloseTime}
                onChange={(e) => setNewCloseTime(e.target.value)}
                className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
              />
            </div>
            <p className="text-[11px] text-slate-400 col-span-1 sm:col-span-2 -mt-1">
              Kosongkan keduanya jika ujian tersedia sepanjang hari pada rentang tanggal. Berlaku sama untuk setiap hari pada rentang tanggal.
            </p>
          </div>

          {/* Soal Generator Box */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h4 className="font-bold text-slate-900">
                Daftar Soal Ujian ({newQuestions.length} Soal)
              </h4>

              <div className="flex flex-wrap items-center gap-2">
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
                  <span>Manual (PG)</span>
                </button>

                <button
                  type="button"
                  onClick={handleAddEssayQuestion}
                  className="bg-sky-100 hover:bg-sky-200 text-sky-800 font-bold px-3 py-1.5 rounded-xl transition-all cursor-pointer flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Tambahkan Essai</span>
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
                      <span className="font-bold text-emerald-800">
                        Soal #{idx + 1}
                        {q.type === 'essai' && <span className="ml-2 bg-sky-100 text-sky-700 text-[10px] font-bold px-2 py-0.5 rounded">Essai</span>}
                      </span>
                      <button
                        type="button"
                        onClick={() => setNewQuestions(prev => prev.filter((_, i) => i !== idx))}
                        className="text-rose-500 hover:text-rose-700 font-bold text-[11px]"
                      >
                        Hapus
                      </button>
                    </div>
                    <textarea
                      value={q.question}
                      onChange={e => handleUpdateQuestion(q.id, { question: e.target.value })}
                      rows={2}
                      maxLength={2000}
                      className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-800 resize-y"
                    />
                    {q.type === 'essai' ? (
                      <div>
                        <label className="text-[11px] font-bold text-slate-600">Kunci Jawaban Essai (guru) — pisahkan alternatif dengan tanda |</label>
                        <input
                          type="text"
                          value={q.correctAnswer || ''}
                          onChange={e => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                          maxLength={2000}
                          placeholder="contoh: arsip adalah rekaman kegiatan|rekaman informasi"
                          className="w-full p-2 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 mt-1"
                        />
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <label className="text-[11px] font-bold text-slate-600">Kunci:</label>
                        <select
                          value={q.correctAnswer}
                          onChange={e => handleUpdateQuestion(q.id, { correctAnswer: e.target.value })}
                          className="p-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-800"
                        >
                          {['A', 'B', 'C', 'D', 'E'].map(key => <option key={key} value={key}>{key}</option>)}
                        </select>
                        {q.explanation !== undefined && (
                          <input
                            type="text"
                            value={q.explanation || ''}
                            onChange={e => handleUpdateQuestion(q.id, { explanation: e.target.value })}
                            placeholder="Pembahasan (opsional)"
                            maxLength={2000}
                            className="flex-1 min-w-40 p-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800"
                          />
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="bg-slate-100 text-slate-600 font-bold px-4 py-2.5 rounded-xl hover:bg-slate-200"
            >
              Batal
            </button>
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-6 py-2.5 rounded-xl shadow-md cursor-pointer"
            >
               {initialExam ? 'Simpan Perubahan' : 'Simpan Ujian CBT'}
            </button>
          </div>
        </form>
    </Modal>
  );
}
