import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { CbtBankItem } from '../../types';
import { Modal } from '../ui/Modal';
import { cbtApi } from '../../utils/cbt-api';

interface CbtBankPickerProps {
  defaultSubject?: string;
  onPick: (items: CbtBankItem[]) => void;
  onClose: () => void;
}

// Pemilih multi-centang soal dari bank untuk disalin (snapshot) ke paket ujian.
export function CbtBankPicker({ defaultSubject, onPick, onClose }: CbtBankPickerProps) {
  const [items, setItems] = useState<CbtBankItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState(defaultSubject || '');
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    cbtApi.bankList()
      .then(data => { if (!cancelled) setItems(data); })
      .catch(err => { if (!cancelled) setError(err instanceof Error ? err.message : 'Bank soal gagal dimuat.'); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const subjects = useMemo(() => [...new Set(items.map(item => item.subject))].sort(), [items]);
  // Soal esai warisan TIDAK ditampilkan sebagai pilihan: esai tidak lagi
  // dapat ditambahkan ke paket (pembuatan esai dinonaktifkan).
  const legacyEssayCount = items.filter(item => item.type === 'essai').length;
  const filtered = items.filter(item => item.type !== 'essai'
    && (!subject || item.subject === subject)
    && (!search || item.question.toLowerCase().includes(search.toLowerCase()) || (item.topic || '').toLowerCase().includes(search.toLowerCase())));

  const toggle = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  return (
    <Modal onClose={onClose} maxWidth="max-w-2xl" scrollable className="space-y-4 sm:p-8">
      <div className="flex items-center justify-between pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2 text-emerald-700 font-bold text-base">
          <BookOpen className="w-5 h-5" />
          <span>Ambil dari Bank Soal</span>
        </div>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer">✕</button>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row text-xs">
        <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari teks soal / topik…" className="flex-1 p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-medium" />
        <select value={subject} onChange={e => setSubject(e.target.value)} className="p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-slate-700">
          <option value="">Semua Mapel</option>
          {subjects.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      {legacyEssayCount > 0 && (
        <p className="text-[11px] text-sky-700 italic">{legacyEssayCount} soal esai warisan di bank tidak ditampilkan — soal esai tidak lagi dapat ditambahkan ke paket.</p>
      )}

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

      {loading ? (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat bank soal…</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center">Tidak ada soal bank yang cocok. Tambahkan dulu lewat menu Bank Soal.</p>
      ) : (
        <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
          {filtered.map(item => (
            <label key={item.id} className={`flex items-start gap-3 border rounded-xl p-3 cursor-pointer transition-all ${selected.has(item.id) ? 'border-emerald-400 bg-emerald-50/60' : 'border-slate-200 hover:bg-slate-50'}`}>
              <input type="checkbox" checked={selected.has(item.id)} onChange={() => toggle(item.id)} className="mt-0.5 w-4 h-4 accent-emerald-600" />
              <span className="min-w-0 text-xs">
                <span className="flex flex-wrap items-center gap-1.5 mb-1">
                  <span className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-lg">{item.subject}</span>
                  {item.topic && <span className="bg-slate-100 text-slate-600 text-[10px] font-bold px-2 py-0.5 rounded-lg">{item.topic}</span>}
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${item.type === 'essai' ? 'bg-sky-100 text-sky-700' : 'bg-violet-100 text-violet-700'}`}>{item.type === 'essai' ? 'Esai' : 'PG'}</span>
                </span>
                <span className="block font-semibold text-slate-800">{item.question}</span>
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 pt-3 border-t border-slate-100">
        <span className="text-xs font-semibold text-slate-500">{selected.size} soal dipilih — salinan snapshot masuk ke paket; perubahan bank di kemudian hari tidak mengubah paket ini.</span>
        <div className="flex gap-2">
          <button onClick={onClose} className="bg-slate-100 hover:bg-slate-200 text-slate-600 font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer">Batal</button>
          <button
            onClick={() => { onPick(items.filter(item => selected.has(item.id))); onClose(); }}
            disabled={selected.size === 0}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-50"
          >
            Tambahkan {selected.size > 0 ? selected.size : ''} Soal
          </button>
        </div>
      </div>
    </Modal>
  );
}
