import React, { useEffect, useState } from 'react';
import { ClipboardCheck, Save } from 'lucide-react';
import { CbtGradingDetail } from '../../types';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/toast';
import { cbtApi } from '../../utils/cbt-api';

interface CbtGradingModalProps {
  attemptId: string;
  onClose: () => void;
  onSaved?: () => void;
}

const formatPoint = (value: number) => (Math.round(value * 10) / 10).toString().replace('.', ',');

export function CbtGradingModal({ attemptId, onClose, onSaved }: CbtGradingModalProps) {
  const [detail, setDetail] = useState<CbtGradingDetail | null>(null);
  const [scores, setScores] = useState<{ [questionId: string]: string }>({});
  const [notes, setNotes] = useState<{ [questionId: string]: string }>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    cbtApi.gradingDetail(attemptId)
      .then(data => {
        if (cancelled) return;
        setDetail(data);
        setScores(Object.fromEntries(data.essays.map(essay => [essay.questionId, essay.score != null ? String(essay.score) : ''])));
        setNotes(Object.fromEntries(data.essays.map(essay => [essay.questionId, essay.note || ''])));
      })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Detail koreksi gagal dimuat.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [attemptId]);

  const filledCount = detail ? detail.essays.filter(essay => (scores[essay.questionId] ?? '') !== '').length : 0;

  const handleSave = async () => {
    if (!detail) return;
    const payloadScores: { [questionId: string]: number } = {};
    const payloadNotes: { [questionId: string]: string } = {};
    for (const essay of detail.essays) {
      const raw = (scores[essay.questionId] ?? '').trim().replace(',', '.');
      if (raw !== '') {
        const value = Number(raw);
        if (!Number.isFinite(value) || value < 0 || value > essay.maxScore + 0.001) {
          showToast(`Nilai soal esai harus antara 0 dan ${formatPoint(essay.maxScore)}.`, 'error');
          return;
        }
        payloadScores[essay.questionId] = Math.round(value * 10) / 10;
      }
      payloadNotes[essay.questionId] = notes[essay.questionId] || '';
    }
    if (Object.keys(payloadScores).length === 0) {
      showToast('Isi minimal satu nilai esai sebelum menyimpan.', 'error');
      return;
    }
    setSaving(true);
    try {
      const result = await cbtApi.saveGrades(attemptId, payloadScores, payloadNotes);
      if (result.gradingStatus === 'graded') {
        showToast(`Koreksi selesai. Nilai akhir ${detail.siswaName}: ${result.score}.`, 'success');
        onSaved?.();
        onClose();
      } else {
        showToast('Nilai tersimpan sebagian. Status masih menunggu koreksi sampai semua esai dinilai.', 'info');
        onSaved?.();
        const refreshed = await cbtApi.gradingDetail(attemptId);
        setDetail(refreshed);
        setScores(Object.fromEntries(refreshed.essays.map(essay => [essay.questionId, essay.score != null ? String(essay.score) : ''])));
        setNotes(Object.fromEntries(refreshed.essays.map(essay => [essay.questionId, essay.note || ''])));
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Nilai gagal disimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" scrollable className="space-y-5 sm:p-8">
      <div className="flex items-center justify-between pb-4 border-b border-slate-100">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
          <ClipboardCheck className="w-5 h-5" />
          <span>Koreksi Esai</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
      </div>

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat jawaban esai…</p>
      ) : error || !detail ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error || 'Detail tidak tersedia.'}</div>
      ) : (
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div><p className="text-slate-400 font-bold">Siswa</p><p className="font-bold text-slate-900 text-sm">{detail.siswaName}</p></div>
            <div><p className="text-slate-400 font-bold">Ujian</p><p className="font-semibold text-slate-800">{detail.examTitle}</p></div>
            <div><p className="text-slate-400 font-bold">Skor PG (otomatis)</p><p className="font-bold text-emerald-700 text-sm">{formatPoint(detail.pgScore)}</p></div>
            <div><p className="text-slate-400 font-bold">Poin per soal</p><p className="font-bold text-slate-800 text-sm">{formatPoint(detail.pointPerQuestion)}</p></div>
          </div>

          {detail.essays.map((essay, idx) => (
            <div key={essay.questionId} className="border border-slate-200 rounded-xl p-4 space-y-3 bg-white">
              <p className="font-bold text-slate-900 text-sm">Esai {idx + 1}. {essay.question}</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="bg-slate-50 border border-slate-200 rounded-lg p-3">
                  <p className="font-bold text-slate-500 mb-1">Jawaban siswa</p>
                  <p className="whitespace-pre-wrap break-words text-slate-800 leading-relaxed">{essay.studentAnswer || <em className="text-slate-400">(tidak dijawab)</em>}</p>
                </div>
                <div className="bg-emerald-50/60 border border-emerald-100 rounded-lg p-3">
                  <p className="font-bold text-emerald-700 mb-1">Kunci jawaban guru</p>
                  <p className="whitespace-pre-wrap break-words text-slate-800 leading-relaxed">{(essay.correctAnswer || '-').split('|').join(' ATAU ')}</p>
                  {essay.explanation && <p className="mt-2 text-slate-500 italic">Pembahasan: {essay.explanation}</p>}
                </div>
              </div>

              <p className="text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                <strong>Petunjuk kata kunci (bukan nilai):</strong> {essay.hint.total > 0 ? `terpenuhi ${essay.hint.matched} dari ${essay.hint.total} kata kunci${essay.hint.autoMatch ? ' — pola kunci cocok penuh' : ''}.` : 'tidak ada kata kunci terukur.'} Nilai resmi ditentukan guru.
              </p>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <label className="flex items-center gap-2 font-bold text-slate-700">
                  Nilai (0 – {formatPoint(essay.maxScore)}):
                  <input
                    type="number"
                    min={0}
                    max={essay.maxScore}
                    step={0.1}
                    value={scores[essay.questionId] ?? ''}
                    onChange={e => setScores(prev => ({ ...prev, [essay.questionId]: e.target.value }))}
                    className="w-24 p-2 bg-white border border-slate-300 rounded-lg font-bold text-slate-900"
                  />
                </label>
                <input
                  type="text"
                  maxLength={500}
                  placeholder="Catatan untuk siswa (opsional)"
                  value={notes[essay.questionId] ?? ''}
                  onChange={e => setNotes(prev => ({ ...prev, [essay.questionId]: e.target.value }))}
                  className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                />
              </div>
            </div>
          ))}

          <div className="flex flex-col gap-3 pt-2 border-t border-slate-100 sm:flex-row sm:items-center sm:justify-between">
            <span className="font-semibold text-slate-500">Terisi {filledCount} dari {detail.essays.length} esai — simpan sebagian diperbolehkan, status menjadi final bila semua esai ternilai.</span>
            <div className="flex gap-2">
              <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Tutup</button>
              <button onClick={() => void handleSave()} disabled={saving} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">
                <Save className="w-4 h-4" /> {saving ? 'Menyimpan…' : 'Simpan Nilai Esai'}
              </button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
