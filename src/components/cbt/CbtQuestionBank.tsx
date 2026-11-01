import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Pencil, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { CbtBankItem, CbtQuestion } from '../../types';
import { Modal } from '../ui/Modal';
import { showToast } from '../ui/toast';
import { cbtApi } from '../../utils/cbt-api';

const EMPTY_OPTIONS = ['A', 'B', 'C', 'D', 'E'].map(key => ({ key: key as 'A' | 'B' | 'C' | 'D' | 'E', text: '' }));

interface BankFormState {
  subject: string;
  topic: string;
  question: string;
  options: { key: 'A' | 'B' | 'C' | 'D' | 'E'; text: string }[];
  correctAnswer: string;
  explanation: string;
}

const blankForm = (subject = ''): BankFormState => ({
  subject, topic: '', question: '',
  options: EMPTY_OPTIONS.map(option => ({ ...option })), correctAnswer: 'A', explanation: '',
});

export function CbtQuestionBank() {
  const [items, setItems] = useState<CbtBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subjectFilter, setSubjectFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BankFormState | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setItems(await cbtApi.bankList());
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Bank soal gagal dimuat.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const subjects = useMemo(() => [...new Set(items.map(item => item.subject))].sort(), [items]);
  const filtered = items.filter(item =>
    (!subjectFilter || item.subject === subjectFilter)
    && (!search || item.question.toLowerCase().includes(search.toLowerCase()) || (item.topic || '').toLowerCase().includes(search.toLowerCase())));

  const openCreate = () => { setEditingId(null); setForm(blankForm(subjectFilter)); };
  const openEdit = (item: CbtBankItem) => {
    setEditingId(item.id);
    setForm({
      subject: item.subject, topic: item.topic || '', question: item.question,
      options: item.options && item.options.length === 5 ? item.options.map(option => ({ key: option.key, text: option.text })) : EMPTY_OPTIONS.map(option => ({ ...option })),
      correctAnswer: item.correctAnswer || 'A', explanation: item.explanation || '',
    });
  };

  const handleSave = async () => {
    if (!form) return;
    if (!form.subject.trim()) { showToast('Mata pelajaran wajib diisi.', 'error'); return; }
    if (!form.question.trim()) { showToast('Pertanyaan wajib diisi.', 'error'); return; }
    if (form.options.some(option => !option.text.trim())) { showToast('Semua opsi A–E wajib diisi.', 'error'); return; }
    // Bank hanya menerima pilihan ganda — pembuatan soal esai dinonaktifkan.
    const question: CbtQuestion = {
      id: editingId || 'bank-form',
      question: form.question,
      type: 'pg',
      options: form.options,
      correctAnswer: form.correctAnswer,
      explanation: form.explanation || undefined,
    };
    setSaving(true);
    try {
      if (editingId) await cbtApi.bankUpdate(editingId, { subject: form.subject, topic: form.topic || undefined, question });
      else await cbtApi.bankCreate({ subject: form.subject, topic: form.topic || undefined, question });
      showToast(editingId ? 'Soal bank diperbarui.' : 'Soal ditambahkan ke bank.', 'success');
      setForm(null);
      setEditingId(null);
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Soal bank gagal disimpan.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (item: CbtBankItem) => {
    if (!window.confirm('Hapus soal ini dari bank? Ujian yang sudah memakai salinannya tidak terpengaruh.')) return;
    try {
      await cbtApi.bankDelete(item.id);
      showToast('Soal bank dihapus.', 'success');
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Soal bank gagal dihapus.', 'error');
    }
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200/80 space-y-4">
      <div className="flex flex-col items-start gap-2 pb-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-emerald-600" />
          <span>Bank Soal CBT</span>
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <button onClick={() => void load()} className="flex items-center gap-1 bg-slate-100 hover:bg-slate-200 text-slate-700 px-2.5 py-1.5 rounded-lg font-bold text-xs cursor-pointer">
            <RefreshCw className="w-3.5 h-3.5" /> Muat Ulang
          </button>
          <button onClick={openCreate} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-xs cursor-pointer">
            <Plus className="w-3.5 h-3.5" /> Tambah Soal
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari teks soal / topik…"
          className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium"
        />
        <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700">
          <option value="">Semua Mapel</option>
          {subjects.map(subject => <option key={subject} value={subject}>{subject}</option>)}
        </select>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat bank soal…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">Belum ada soal di bank untuk filter ini. Tambahkan soal, atau simpan soal dari paket ujian lewat tombol “Simpan ke Bank”.</p>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <div key={item.id} className="flex items-start justify-between gap-3 border border-slate-200 rounded-xl p-3 hover:bg-slate-50">
              <div className="min-w-0 text-xs">
                <div className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">{item.subject}</span>
                  {item.topic && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">{item.topic}</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${item.type === 'essai' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{item.type === 'essai' ? 'Esai (warisan)' : 'PG'}</span>
                  {item.ownerName && <span className="text-[10px] text-slate-400">oleh {item.ownerName}</span>}
                </div>
                <p className="font-semibold text-slate-800 line-clamp-2">{item.question}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Kunci: <strong className="text-emerald-700">{item.type === 'essai' ? (item.correctAnswer || '-').split('|').join(' ATAU ') : item.correctAnswer}</strong></p>
                {item.type === 'essai' && <p className="text-[11px] text-sky-700 italic mt-0.5">Soal warisan — soal esai tidak lagi dapat dibuat/diedit/disalin ke paket; soal ini hanya dapat dihapus.</p>}
              </div>
              <div className="flex shrink-0 gap-1.5">
                {item.type !== 'essai' && <button type="button" onClick={() => openEdit(item)} title="Edit soal" className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-700 hover:bg-slate-100 cursor-pointer"><Pencil className="h-3.5 w-3.5" /></button>}
                <button type="button" onClick={() => void handleDelete(item)} title="Hapus soal" className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-700 hover:bg-rose-100 cursor-pointer"><Trash2 className="h-3.5 w-3.5" /></button>
              </div>
            </div>
          ))}
        </div>
      )}

      {form && (
        <Modal onClose={() => { setForm(null); setEditingId(null); }} maxWidth="max-w-2xl" scrollable className="space-y-4 sm:p-8">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h4 className="font-bold text-slate-900">{editingId ? 'Edit Soal Bank' : 'Tambah Soal ke Bank'}</h4>
            <button onClick={() => { setForm(null); setEditingId(null); }} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
          </div>
          <div className="space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                <input type="text" value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Topik (opsional)</label>
                <input type="text" value={form.topic} onChange={e => setForm({ ...form, topic: e.target.value })} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900" />
              </div>
            </div>
            <p className="text-[11px] text-slate-400 -mt-1">Bank soal hanya untuk pilihan ganda — soal esai tidak lagi dapat dibuat.</p>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pertanyaan</label>
              <textarea value={form.question} onChange={e => setForm({ ...form, question: e.target.value })} rows={3} maxLength={2000} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium text-slate-900 resize-y" />
            </div>
            <div className="space-y-2">
              {form.options.map(option => (
                <div key={option.key} className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center font-bold text-slate-700">{option.key}</span>
                  <input
                    type="text" value={option.text} maxLength={1000}
                    onChange={e => setForm({ ...form, options: form.options.map(o => o.key === option.key ? { ...o, text: e.target.value } : o) })}
                    className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-slate-800"
                    placeholder={`Teks opsi ${option.key}`}
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 font-bold text-slate-700 pt-1">
                Kunci jawaban:
                <select value={form.correctAnswer} onChange={e => setForm({ ...form, correctAnswer: e.target.value })} className="p-1.5 bg-white border border-slate-200 rounded-lg font-bold text-slate-800">
                  {['A', 'B', 'C', 'D', 'E'].map(key => <option key={key} value={key}>{key}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pembahasan (opsional)</label>
              <input type="text" value={form.explanation} onChange={e => setForm({ ...form, explanation: e.target.value })} maxLength={2000} className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-900" />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
              <button onClick={() => { setForm(null); setEditingId(null); }} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl cursor-pointer">Batal</button>
              <button onClick={() => void handleSave()} disabled={saving} className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl cursor-pointer disabled:opacity-50">{saving ? 'Menyimpan…' : 'Simpan Soal'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
