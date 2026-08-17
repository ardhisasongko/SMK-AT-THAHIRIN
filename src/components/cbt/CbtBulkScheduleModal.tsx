import React, { useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, Copy, Key, Plus, Trash2, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import type { CbtBulkExamResult, CbtBulkPayload, CbtBulkSubject, CbtBulkResult, Kelas } from '../../types';
import { cbtApi } from '../../utils/cbt-api';

interface CbtBulkScheduleModalProps {
  kelasList: Kelas[];
  onClose: () => void;
  onCreated: () => void;
}

const WEEKDAY_NAMES = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat'];

function weekdaysFrom(startDate: string): string[] {
  const dates: string[] = [];
  const cursor = new Date(`${startDate}T00:00:00Z`);
  while (dates.length < 5) {
    const day = cursor.getUTCDay();
    if (day >= 1 && day <= 5) dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function formatDate(date: string): string {
  try {
    return new Date(`${date}T00:00:00Z`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' });
  } catch {
    return date;
  }
}

function toMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function toTime(minutes: number): string {
  return `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;
}

export function CbtBulkScheduleModal({ kelasList, onClose, onCreated }: CbtBulkScheduleModalProps) {
  const [title, setTitle] = useState('');
  const [startDate, setStartDate] = useState('');
  const [subjects, setSubjects] = useState<CbtBulkSubject[]>([
    { name: '', teacher: '' },
    { name: '', teacher: '' },
    { name: '', teacher: '' },
    { name: '', teacher: '' },
  ]);
  const [classTarget, setClassTarget] = useState('Semua Kelas MPLB');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [openTime, setOpenTime] = useState('07:30');
  const [sessionGapMinutes, setSessionGapMinutes] = useState(15);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<CbtBulkResult | null>(null);
  const [copied, setCopied] = useState(false);

  const preview = useMemo(() => {
    if (!startDate) return [];
    return weekdaysFrom(startDate).map((date, dayIndex) => {
      const sessions = subjects
        .filter(subject => subject.name.trim())
        .map((subject, sessionIndex) => ({
          subject: subject.name.trim(),
          open: toTime(toMinutes(openTime) + sessionIndex * (durationMinutes + sessionGapMinutes)),
          close: toTime(toMinutes(openTime) + sessionIndex * (durationMinutes + sessionGapMinutes) + durationMinutes),
        }));
      return { date, day: WEEKDAY_NAMES[dayIndex], sessions };
    });
  }, [startDate, subjects, openTime, durationMinutes, sessionGapMinutes]);

  const updateSubject = (index: number, field: 'name' | 'teacher', value: string) => {
    setSubjects(prev => prev.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
  };

  const handleSubmit = async () => {
    setError('');
    const validSubjects = subjects.filter(subject => subject.name.trim());
    if (!title.trim()) { setError('Nama periode wajib diisi.'); return; }
    if (!startDate) { setError('Tanggal mulai wajib diisi.'); return; }
    if (validSubjects.length < 1) { setError('Minimal 1 mapel diisi.'); return; }
    const payload: CbtBulkPayload = {
      title: title.trim(),
      startDate,
      subjects: validSubjects,
      classTarget,
      durationMinutes,
      openTime,
      sessionGapMinutes,
    };
    setSubmitting(true);
    try {
      const created = await cbtApi.createBulkExams(payload);
      setResult(created);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat jadwal ujian.');
    } finally {
      setSubmitting(false);
    }
  };

  const copyTokens = async () => {
    if (!result) return;
    const text = result.exams
      .map(exam => `${exam.day} ${exam.date} | ${exam.subject} | ${exam.openTime}-${exam.closeTime} | Token: ${exam.token}`)
      .join('\n');
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError('Gagal menyalin token. Salin manual dari tabel.');
    }
  };

  const inputClass = 'w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 shadow-xs';

  return (
    <Modal onClose={onClose} maxWidth="max-w-3xl" scrollable>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">Template Jadwal PTS/UAS (5 Hari × 4 Mapel)</h2>
          <p className="text-xs text-slate-500 mt-0.5">Buat 20 ujian resmi sekaligus — token otomatis per mapel per hari.</p>
        </div>
        <button type="button" onClick={onClose} className="rounded-lg border border-slate-200 bg-slate-50 p-2 text-slate-600 hover:bg-slate-100 cursor-pointer" aria-label="Tutup">
          <X className="h-4 w-4" />
        </button>
      </div>

      {result ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3">
            <div className="flex items-center gap-2 text-sm font-bold text-emerald-800">
              <CheckCircle2 className="w-5 h-5" />
              {result.exams.length} ujian berhasil dibuat: {result.title}
            </div>
            <button
              type="button"
              onClick={() => void copyTokens()}
              className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3 py-2 cursor-pointer"
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Tersalin!' : 'Salin Semua Token'}
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-xs text-left">
              <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Hari</th>
                  <th className="py-2.5 px-3">Mapel</th>
                  <th className="py-2.5 px-3">Jam Sesi</th>
                  <th className="py-2.5 px-3">Token</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                {result.exams.map(exam => (
                  <tr key={exam.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2 px-3 whitespace-nowrap">{exam.day} <span className="text-slate-400 text-[10px]">({formatDate(exam.date)})</span></td>
                    <td className="py-2 px-3">{exam.subject}</td>
                    <td className="py-2 px-3 font-mono text-slate-600">{exam.openTime}–{exam.closeTime} WIB</td>
                    <td className="py-2 px-3">
                      <span className="flex items-center gap-1.5 font-mono font-bold text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2 py-1">
                        <Key className="w-3 h-3" /> {exam.token}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button type="button" onClick={onClose} className="w-full rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-sm font-bold px-4 py-3 cursor-pointer">
            Selesai
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          {error && <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-700">{error}</div>}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5 sm:col-span-1">
              <label htmlFor="bulk-title" className="text-[11px] font-bold text-slate-600 uppercase">Nama Periode</label>
              <input id="bulk-title" type="text" value={title} onChange={e => setTitle(e.target.value)} placeholder="Contoh: PTS Ganjil 2026/2027" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-start-date" className="text-[11px] font-bold text-slate-600 uppercase">Mulai (Senin)</label>
              <input id="bulk-start-date" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-class-target" className="text-[11px] font-bold text-slate-600 uppercase">Kelas Target</label>
              <select id="bulk-class-target" value={classTarget} onChange={e => setClassTarget(e.target.value)} className={inputClass}>
                <option value="Semua Kelas MPLB">Semua Kelas MPLB</option>
                {kelasList.map(kelas => <option key={kelas.id} value={kelas.id}>{kelas.name}</option>)}
              </select>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-[11px] font-bold text-slate-600 uppercase">Mapel per Hari (maks. 8)</label>
              <button
                type="button"
                onClick={() => setSubjects(prev => [...prev, { name: '', teacher: '' }])}
                disabled={subjects.length >= 8}
                className="flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700 hover:bg-emerald-100 disabled:opacity-40 cursor-pointer"
              >
                <Plus className="w-3 h-3" /> Tambah Mapel
              </button>
            </div>
            <div className="space-y-2">
              {subjects.map((subject, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-6 text-center text-[11px] font-bold text-slate-400">{index + 1}</span>
                  <input type="text" value={subject.name} onChange={e => updateSubject(index, 'name', e.target.value)} placeholder="Mata pelajaran" className={inputClass} />
                  <input type="text" value={subject.teacher} onChange={e => updateSubject(index, 'teacher', e.target.value)} placeholder="Guru pengampu" className={inputClass} />
                  <button
                    type="button"
                    onClick={() => setSubjects(prev => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))}
                    className="rounded-lg border border-rose-200 bg-rose-50 p-2 text-rose-600 hover:bg-rose-100 cursor-pointer"
                    aria-label={`Hapus mapel ${index + 1}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label htmlFor="bulk-duration" className="text-[11px] font-bold text-slate-600 uppercase">Durasi Sesi (menit)</label>
              <input id="bulk-duration" type="number" min={1} max={300} value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value) || 90)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-open-time" className="text-[11px] font-bold text-slate-600 uppercase">Jam Mulai Sesi 1</label>
              <input id="bulk-open-time" type="time" value={openTime} onChange={e => setOpenTime(e.target.value)} className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label htmlFor="bulk-gap" className="text-[11px] font-bold text-slate-600 uppercase">Jeda Antar Sesi (menit)</label>
              <input id="bulk-gap" type="number" min={0} max={180} value={sessionGapMinutes} onChange={e => setSessionGapMinutes(Number(e.target.value) || 0)} className={inputClass} />
            </div>
          </div>

          {preview.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-bold text-slate-700">
                <CalendarDays className="w-4 h-4 text-emerald-600" />
                Pratinjau Jadwal ({preview.reduce((total, day) => total + day.sessions.length, 0)} ujian)
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[560px] w-full text-xs text-left">
                  <thead className="bg-white text-slate-600 font-bold uppercase border border-slate-200">
                    <tr>
                      <th className="py-2 px-3">Hari</th>
                      {subjects.filter(s => s.name.trim()).map((subject, index) => (
                        <th key={index} className="py-2 px-3">{subject.name.trim()}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {preview.map(day => (
                      <tr key={day.date}>
                        <td className="py-2 px-3 font-bold text-slate-800 whitespace-nowrap">{day.day} <span className="text-slate-400 font-medium">{formatDate(day.date)}</span></td>
                        {day.sessions.map((session, index) => (
                          <td key={index} className="py-2 px-3">
                            <span className="flex items-center gap-1 text-slate-600 font-mono">
                              <Clock3 className="w-3 h-3 text-slate-400" /> {session.open}–{session.close}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={submitting}
              className="flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold px-4 py-3 shadow-lg shadow-emerald-600/30 disabled:opacity-50 cursor-pointer"
            >
              {submitting ? 'Membuat ujian…' : `Buat ${preview.reduce((total, day) => total + day.sessions.length, 0)} Ujian Sekaligus`}
            </button>
            <button type="button" onClick={onClose} disabled={submitting} className="rounded-xl border border-slate-200 bg-slate-50 text-slate-700 text-sm font-bold px-6 py-3 hover:bg-slate-100 disabled:opacity-50 cursor-pointer">
              Batal
            </button>
          </div>
        </div>
      )}
    </Modal>
  );
}