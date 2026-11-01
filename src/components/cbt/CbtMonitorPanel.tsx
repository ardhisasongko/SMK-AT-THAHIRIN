import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlarmClockPlus,
  AppWindow,
  EyeOff,
  Flag,
  Megaphone,
  Minimize2,
  RefreshCw,
  Search,
  SendHorizontal,
  Timer,
  Users,
} from 'lucide-react';
import type { CbtMonitorData, CbtMonitorStudent } from '../../types';
import { cbtApi } from '../../utils/cbt-api';
import { showToast } from '../ui/toast';
import { Modal } from '../ui/Modal';

// Ruang Kontrol Ujian: panel pemantauan langsung untuk pengawas (guru pemilik
// ujian / admin). Data disegarkan otomatis tiap 15 detik (jeda saat tab tidak
// terlihat) + tombol segarkan manual. Aksi kendali (pengumuman, tambah waktu,
// paksa kumpul) tercatat di audit server.
const POLL_INTERVAL_MS = 15_000;

const STATUS_META: Record<CbtMonitorStudent['status'], { label: string; className: string }> = {
  not_started: { label: 'Belum mulai', className: 'bg-slate-100 text-slate-600' },
  in_progress: { label: 'Sedang mengerjakan', className: 'bg-sky-100 text-sky-800' },
  submitted: { label: 'Sudah kumpul', className: 'bg-emerald-100 text-emerald-800' },
  expired: { label: 'Kedaluwarsa', className: 'bg-rose-100 text-rose-700' },
};

function formatRemaining(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  const mm = String(minutes).padStart(2, '0');
  const ss = String(rest).padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

function formatClock(iso: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return iso;
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

interface CbtMonitorPanelProps {
  examId: string;
  onClose: () => void;
}

export function CbtMonitorPanel({ examId, onClose }: CbtMonitorPanelProps) {
  const [data, setData] = useState<CbtMonitorData | null>(null);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [announcement, setAnnouncement] = useState('');
  const [sendingAnnouncement, setSendingAnnouncement] = useState(false);
  const [extendAllMinutes, setExtendAllMinutes] = useState<5 | 10 | 15>(10);
  const [busyAction, setBusyAction] = useState<string>('');
  const [forceTarget, setForceTarget] = useState<CbtMonitorStudent | null>(null);
  const [forceConfirmed, setForceConfirmed] = useState(false);
  const fetchedAtRef = useRef<number>(Date.now());
  const loadingRef = useRef(false);

  const refresh = useCallback(async (silent = true) => {
    if (loadingRef.current) return;
    loadingRef.current = true;
    if (!silent) setLoading(true);
    try {
      const next = await cbtApi.monitor(examId);
      setData(next);
      setError('');
      fetchedAtRef.current = Date.now();
      setLastUpdatedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal memuat data pantauan.');
    } finally {
      loadingRef.current = false;
      setLoading(false);
    }
  }, [examId]);

  useEffect(() => {
    void refresh(false);
    const interval = window.setInterval(() => {
      if (!document.hidden) void refresh();
    }, POLL_INTERVAL_MS);
    const onVisible = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refresh]);

  // Detik berjalan untuk tampilan sisa waktu (dihitung dari snapshot server).
  useEffect(() => {
    const tick = window.setInterval(() => setNowTick(Date.now()), 1000);
    return () => window.clearInterval(tick);
  }, []);

  const students = useMemo(() => {
    const all = data?.students ?? [];
    const keyword = search.trim().toLowerCase();
    if (!keyword) return all;
    return all.filter(student => student.name.toLowerCase().includes(keyword) || student.className.toLowerCase().includes(keyword));
  }, [data, search]);

  const remainingFor = (student: CbtMonitorStudent): number | null => {
    if (student.remainingSeconds == null) return null;
    const elapsed = Math.max(0, (nowTick - fetchedAtRef.current) / 1000);
    return Math.max(0, student.remainingSeconds - elapsed);
  };

  const handleSendAnnouncement = async () => {
    const message = announcement.trim();
    if (!message) return;
    setSendingAnnouncement(true);
    try {
      await cbtApi.monitorAnnouncement(examId, message);
      setAnnouncement('');
      showToast('Pengumuman terkirim ke semua siswa yang sedang mengerjakan.', 'success');
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Pengumuman gagal terkirim.', 'error');
    } finally {
      setSendingAnnouncement(false);
    }
  };

  const handleExtend = async (minutes: 5 | 10 | 15, student?: CbtMonitorStudent) => {
    const key = student ? `extend-${student.attemptId}` : 'extend-all';
    setBusyAction(key);
    try {
      const result = await cbtApi.monitorExtendTime(examId, minutes, student?.attemptId ?? undefined);
      showToast(
        student
          ? `Waktu ${student.name} ditambah ${minutes} menit.`
          : `Waktu ${result.extended.length} siswa yang sedang mengerjakan ditambah ${minutes} menit.`,
        'success',
      );
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Gagal menambah waktu.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const handleForceSubmit = async () => {
    if (!forceTarget?.attemptId) return;
    setBusyAction(`force-${forceTarget.attemptId}`);
    try {
      const result = await cbtApi.monitorForceSubmit(examId, forceTarget.attemptId);
      showToast(`Jawaban ${result.studentName} dikumpulkan oleh pengawas. Nilai: ${result.gradingStatus === 'pending_grading' ? `PG ${result.pgScore} (esai menunggu koreksi)` : result.score}.`, 'success');
      setForceTarget(null);
      setForceConfirmed(false);
      await refresh();
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Paksa kumpul gagal.', 'error');
    } finally {
      setBusyAction('');
    }
  };

  const summary = data?.summary;
  const examStatus = data?.exam.status;
  const phaseNote = examStatus === 'upcoming'
    ? 'Ujian belum dimulai — siswa belum dapat mengerjakan. Panel akan terisi begitu ujian aktif.'
    : examStatus === 'completed' || examStatus === 'inactive'
      ? 'Ujian sudah selesai — tampilan di bawah adalah rekap akhir pengerjaan siswa.'
      : null;

  return (
    <div className="bg-white rounded-2xl p-4 sm:p-6 shadow-sm border border-slate-200/80 space-y-4">
      <div className="flex flex-col gap-2 pb-3 border-b border-slate-100 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-bold text-base text-slate-900 flex items-center gap-2">
          <Timer className="w-5 h-5 text-emerald-600" />
          <span>Ruang Kontrol Ujian{data ? ` — ${data.exam.title}` : ''}</span>
        </h3>
        <div className="flex items-center gap-2">
          <span className="text-[11px] text-slate-500 font-medium">
            {lastUpdatedAt ? `Terakhir diperbarui pukul ${formatClock(new Date(lastUpdatedAt).toISOString())}` : 'Memuat…'}
          </span>
          <button
            onClick={() => void refresh(false)}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center gap-1"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={onClose}
            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold rounded-xl px-4 py-3">
          {error} Data terakhir yang berhasil dimuat tetap ditampilkan.
        </div>
      )}

      {phaseNote && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold rounded-xl px-4 py-3">
          {phaseNote}
        </div>
      )}

      {summary && (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          {[
            { label: 'Total peserta', value: String(summary.totalStudents), className: 'bg-slate-50 text-slate-800' },
            { label: 'Sudah kumpul', value: String(summary.submitted), className: 'bg-emerald-50 text-emerald-800' },
            { label: 'Sedang mengerjakan', value: String(summary.inProgress), className: 'bg-sky-50 text-sky-800' },
            { label: 'Belum mulai', value: String(summary.notStarted), className: 'bg-slate-50 text-slate-600' },
            { label: 'Perlu perhatian', value: String(summary.flagged), className: 'bg-rose-50 text-rose-700' },
            {
              label: summary.averageFinalScore != null ? 'Rata-rata nilai final' : 'Rata-rata nilai sementara',
              value: summary.averageFinalScore != null
                ? String(summary.averageFinalScore)
                : summary.averageProvisionalScore != null ? String(summary.averageProvisionalScore) : '—',
              className: 'bg-amber-50 text-amber-800',
            },
          ].map(card => (
            <div key={card.label} className={`rounded-xl border border-slate-200/70 px-3 py-2.5 ${card.className}`}>
              <p className="text-[10px] font-bold uppercase tracking-wide opacity-70">{card.label}</p>
              <p className="text-xl font-extrabold leading-tight">{card.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Pengumuman siaran */}
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 space-y-2">
        <label htmlFor="monitor-announcement" className="flex items-center gap-2 text-xs font-bold text-slate-800">
          <Megaphone className="w-4 h-4 text-emerald-600" />
          Pengumuman untuk semua siswa yang sedang mengerjakan
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <input
            id="monitor-announcement"
            type="text"
            value={announcement}
            maxLength={300}
            onChange={event => setAnnouncement(event.target.value)}
            placeholder="Contoh: Sisa waktu 10 menit, periksa kembali jawaban kalian."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
          <button
            onClick={() => void handleSendAnnouncement()}
            disabled={sendingAnnouncement || !announcement.trim()}
            className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer flex items-center justify-center gap-1.5"
          >
            <SendHorizontal className="w-3.5 h-3.5" />
            <span>Kirim Pengumuman</span>
          </button>
        </div>
        <p className="text-[10px] text-slate-500 font-medium">{announcement.length}/300 karakter · tampil sebagai banner di layar siswa sampai ditutup siswa.</p>
        {data && data.announcements.length > 0 && (
          <ul className="space-y-1 pt-1">
            {data.announcements.slice(0, 3).map(item => (
              <li key={item.id} className="text-[11px] text-slate-600 font-medium">
                <span className="font-bold text-slate-700">{formatClock(item.createdAt)}</span> — {item.message} <span className="text-slate-400">({item.authorName})</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Tambah waktu massal + pencarian */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          <AlarmClockPlus className="w-4 h-4 shrink-0 text-slate-500" />
          <span className="text-xs font-bold text-slate-700">Tambah waktu semua yang sedang mengerjakan:</span>
          <select
            value={extendAllMinutes}
            onChange={event => setExtendAllMinutes(Number(event.target.value) as 5 | 10 | 15)}
            className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-xs font-bold text-slate-700"
            aria-label="Pilihan tambahan waktu massal"
          >
            <option value={5}>+5 menit</option>
            <option value={10}>+10 menit</option>
            <option value={15}>+15 menit</option>
          </select>
          <button
            onClick={() => void handleExtend(extendAllMinutes)}
            disabled={busyAction === 'extend-all' || !summary || summary.inProgress === 0}
            className="bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white px-3 py-1.5 rounded-lg font-bold text-xs transition-all cursor-pointer"
          >
            Terapkan
          </button>
        </div>
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Cari nama siswa…"
            className="w-full sm:w-56 rounded-lg border border-slate-300 bg-white pl-8 pr-3 py-1.5 text-xs font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          />
        </div>
      </div>

      {/* Tabel siswa */}
      {loading && !data ? (
        <p className="text-xs text-slate-500 py-6 text-center">Memuat data pantauan…</p>
      ) : students.length === 0 ? (
        <p className="text-xs text-slate-500 py-6 text-center flex items-center justify-center gap-2">
          <Users className="w-4 h-4" />
          {data && data.students.length === 0 ? 'Belum ada siswa aktif pada kelas target ujian ini.' : 'Tidak ada siswa yang cocok dengan pencarian.'}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-[860px] w-full text-xs text-left">
            <thead className="bg-slate-50 text-slate-600 font-bold uppercase border-b border-slate-200">
              <tr>
                <th className="py-3 px-3">Siswa</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">Progres Terjawab</th>
                <th className="py-3 px-3">Sisa Waktu</th>
                <th className="py-3 px-3">Nilai</th>
                <th className="py-3 px-3">Proctoring</th>
                <th className="py-3 px-3">Aktivitas Terakhir</th>
                <th className="py-3 px-3 text-center">Kendali</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
              {students.map(student => {
                const remaining = remainingFor(student);
                return (
                  <tr key={student.studentId} className={student.flagged ? 'bg-rose-50 hover:bg-rose-100/60' : 'hover:bg-slate-50'}>
                    <td className="py-3 px-3">
                      <p className="font-bold text-slate-900">{student.name}</p>
                      <p className="text-[10px] text-slate-500">{student.className} · NISN {student.nisn || '—'}</p>
                      {student.flagged && (
                        <span className="mt-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[10px] font-bold bg-rose-100 text-rose-700">
                          <Flag className="w-3 h-3" /> Perlu perhatian
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded-lg font-bold whitespace-nowrap ${STATUS_META[student.status].className}`}>
                        {STATUS_META[student.status].label}
                      </span>
                      {student.submittedBy === 'proctor' && (
                        <span className="ml-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-sky-100 text-sky-800">Oleh pengawas</span>
                      )}
                      {student.hasEssayPending && student.status === 'submitted' && (
                        <span className="ml-1.5 px-2 py-1 rounded-lg text-[10px] font-bold bg-amber-100 text-amber-800">Esai menunggu koreksi</span>
                      )}
                    </td>
                    <td className="py-3 px-3 min-w-[140px]">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden" role="progressbar" aria-valuenow={student.progressPercent} aria-valuemin={0} aria-valuemax={100}>
                          <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${student.progressPercent}%` }} />
                        </div>
                        <span className="font-bold text-slate-700 whitespace-nowrap">{student.answeredCount}/{student.totalQuestions}</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 font-mono font-bold text-slate-700">
                      {student.status === 'in_progress' && remaining != null ? formatRemaining(remaining) : '—'}
                    </td>
                    <td className="py-3 px-3">
                      {student.status === 'submitted' && student.finalScore != null ? (
                        <span className={`px-2.5 py-1 rounded-lg font-bold ${student.finalScore >= 75 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>{student.finalScore} / 100</span>
                      ) : student.provisionalScore != null ? (
                        <span className="font-bold text-slate-800">
                          {student.provisionalScore}
                          <span className="block text-[10px] font-semibold text-slate-500">
                            {student.status === 'submitted' ? 'PG sementara — esai belum dinilai' : 'sementara (PG)'}
                          </span>
                        </span>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-2.5 text-slate-600" title="Perpindahan tab/aplikasi · keluar fokus jendela · keluar layar penuh">
                        <span className="inline-flex items-center gap-1"><AppWindow className="w-3.5 h-3.5" />{student.proctor.tabSwitch}×</span>
                        <span className="inline-flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" />{student.proctor.windowBlur}×</span>
                        <span className="inline-flex items-center gap-1"><Minimize2 className="w-3.5 h-3.5" />{student.proctor.fullscreenExit}×</span>
                      </div>
                    </td>
                    <td className="py-3 px-3 text-slate-500">{formatClock(student.lastActivityAt)}</td>
                    <td className="py-3 px-3">
                      {student.status === 'in_progress' && student.attemptId ? (
                        <div className="flex flex-wrap items-center justify-center gap-1">
                          {([5, 10, 15] as const).map(minutes => (
                            <button
                              key={minutes}
                              onClick={() => void handleExtend(minutes, student)}
                              disabled={busyAction !== ''}
                              className="bg-sky-100 hover:bg-sky-200 disabled:opacity-50 text-sky-800 px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                              title={`Tambah ${minutes} menit untuk ${student.name}`}
                            >
                              +{minutes}
                            </button>
                          ))}
                          <button
                            onClick={() => { setForceTarget(student); setForceConfirmed(false); }}
                            disabled={busyAction !== ''}
                            className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-2 py-1 rounded-lg font-bold text-[11px] transition-all cursor-pointer"
                          >
                            Paksa Kumpul
                          </button>
                        </div>
                      ) : (
                        <span className="block text-center text-slate-300">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {forceTarget && (
        <Modal onClose={() => setForceTarget(null)} className="space-y-4">
          <div className="space-y-2">
            <h3 className="font-extrabold text-base text-slate-900">Paksa Kumpul Jawaban?</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Jawaban milik siswa bernama <strong className="text-slate-900">{forceTarget.name}</strong> ({forceTarget.className}) akan
              dikumpulkan <strong>sekarang juga</strong> memakai jawaban tersimpan terakhirnya
              ({forceTarget.answeredCount} dari {forceTarget.totalQuestions} soal terjawab) dan langsung dinilai.
              Siswa tidak dapat melanjutkan pengerjaan setelah ini. Tindakan ini tercatat di audit pengawas.
            </p>
          </div>
          <label className="flex items-start gap-2 text-xs font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={forceConfirmed}
              onChange={event => setForceConfirmed(event.target.checked)}
              className="mt-0.5"
            />
            <span>Saya yakin mengumpulkan paksa jawaban {forceTarget.name} sekarang.</span>
          </label>
          <div className="flex gap-2 justify-end">
            <button
              onClick={() => setForceTarget(null)}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer"
            >
              Batal
            </button>
            <button
              onClick={() => void handleForceSubmit()}
              disabled={!forceConfirmed || busyAction !== ''}
              className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg font-bold text-xs transition-all cursor-pointer"
            >
              Ya, Kumpulkan Paksa
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
