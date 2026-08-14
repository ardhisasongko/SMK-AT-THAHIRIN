import React, { useState, useEffect, useRef } from 'react';
import { PresensiRecord, PresensiStatus, PresensiLokasi, Kelas, Siswa, User } from '../types';
import { SCHOOL_INFO } from '../data/initialData';
import { useFilter } from '../hooks/useFilter';
import { validateNISN } from '../utils/validation';
import { getCurrentLocation, mapsUrl } from '../utils/geo';
import { uploadPhoto } from '../utils/photo';
import { StudentAbsensiCard } from './StudentAbsensiCard';
import { dateWIB } from '../utils/date';
import { 
  UserCheck, 
  QrCode, 
  Calendar, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  Clock, 
  Search, 
  Filter, 
  Printer, 
  Download, 
  Sparkles,
  Users,
  Check,
  Edit3,
  FileText,
  Camera,
  MapPin,
  Navigation,
  Loader2,
  ImagePlus,
  Trash2,
  ExternalLink,
  X,
  History
} from 'lucide-react';

interface AbsensiSectionProps {
  presensiList: PresensiRecord[];
  setPresensiList: React.Dispatch<React.SetStateAction<PresensiRecord[]>>;
  savePresensi?: (action: React.SetStateAction<PresensiRecord[]>) => Promise<PresensiRecord[]>;
  refreshPresensi?: () => Promise<PresensiRecord[]>;
  presensiReady?: boolean;
  kelasList: Kelas[];
  siswaList: Siswa[];
  currentUser: User | null;
}

export const AbsensiSection: React.FC<AbsensiSectionProps> = ({
  presensiList,
  setPresensiList,
  savePresensi,
  refreshPresensi,
  presensiReady,
  kelasList,
  siswaList,
  currentUser
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(dateWIB());
  const [selectedClassId, setSelectedClassId] = useState<string>(kelasList[0]?.id || 'k1');
  const [activeTabMode, setActiveTabMode] = useState<'harian' | 'qr-scanner' | 'rekap' | 'log'>('harian');

  // ===== RBAC: hak akses berdasarkan role =====
  const canEditClass = (classId: string): boolean => {
    if (!currentUser) return false;
    if (currentUser.role === 'admin' || currentUser.role === 'super_admin') return true;
    if (currentUser.role === 'guru') return true;
    if (currentUser.role === 'ketua_kelas') {
      return currentUser.ketuaStatus === 'approved' && currentUser.classId === classId;
    }
    return false;
  };

  // Daftar kelas yang boleh diedit user (untuk selektor & default)
  const fullClassIds = kelasList.map(k => k.id);
  const editableClassIds: string[] =
    currentUser?.role === 'admin' || currentUser?.role === 'super_admin'
      ? fullClassIds
      : currentUser?.role === 'guru'
        ? fullClassIds
        : (currentUser?.role === 'ketua_kelas' && currentUser.ketuaStatus === 'approved' && currentUser.classId)
          ? [currentUser.classId]
          : [];

  const classOptions = editableClassIds.length ? kelasList.filter(k => editableClassIds.includes(k.id)) : kelasList;
  const canEditCurrent = canEditClass(selectedClassId);
  const isReadOnly = !canEditCurrent;

  // Jaga selectedClassId selalu valid & dalam kewenangan user
  useEffect(() => {
    const allow = editableClassIds.length ? editableClassIds : fullClassIds;
    if (allow.length && !allow.includes(selectedClassId)) {
      setSelectedClassId(allow[0] || 'k1');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?.role, currentUser?.ketuaStatus, editableClassIds.join(','), selectedClassId]);

  // QR Simulator state
  const [qrNisnInput, setQrNisnInput] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  // FIXED: useRef untuk cleanup timer (prevent memory leak)
  const scanMessageTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Date range filter untuk rekap
  const [rekapStartDate, setRekapStartDate] = useState<string>('2026-08-01');
  const [rekapEndDate, setRekapEndDate] = useState<string>(dateWIB());

  useEffect(() => {
    if (!refreshPresensi) return;
    const refresh = () => { void refreshPresensi().catch(() => undefined); };
    if (presensiReady) refresh();
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, [presensiReady, refreshPresensi]);
  const [rekapClassFilter, setRekapClassFilter] = useState<string>('all');

  // Pagination untuk tabel rekap
  const [rekapPage, setRekapPage] = useState<number>(1);
  const [rekapPageSize, setRekapPageSize] = useState<number>(15);

  // Log perubahan (admin only)
  const [logData, setLogData] = useState<any[]>([]);
  const [logLoading, setLogLoading] = useState(false);
  const fetchLog = async () => {
    if (currentUser?.role !== 'admin' && currentUser?.role !== 'super_admin') return;
    setLogLoading(true);
    try {
      const res = await fetch('/api/data/presensi_log', {
        headers: { Authorization: `Bearer ${localStorage.getItem('smk_auth') ? JSON.parse(localStorage.getItem('smk_auth')!).token : ''}` }
      });
      const json = await res.json() as { data?: any[] };
      setLogData(json.data || []);
    } catch {
      setLogData([]);
    }
    setLogLoading(false);
  };

  // Filtered Siswa for selected class
  const classSiswa = siswaList.filter(s => s.classId === selectedClassId);
  const selectedKelasInfo = kelasList.find(k => k.id === selectedClassId);

  // Filtered by search query
  const { query: presensiSearchQuery, setQuery: setPresensiSearchQuery, filtered: filteredSiswa } = useFilter(
    classSiswa,
    ['name', 'nisn']
  );

  // Get presensi records for selected Date and Class
  const classPresensi = presensiList.filter(
    p => p.tanggal === selectedDate && p.classId === selectedClassId
  );

  // Stats calculation
  const totalSiswaSelectedClass = classSiswa.length;
  const countHadir = classPresensi.filter(p => p.status === 'Hadir').length;
  const countTerlambat = classPresensi.filter(p => p.status === 'Terlambat').length;
  const countSakit = classPresensi.filter(p => p.status === 'Sakit').length;
  const countIzin = classPresensi.filter(p => p.status === 'Izin').length;
  const countAlpa = classPresensi.filter(p => p.status === 'Alpa').length;
  const totalInputed = countHadir + countTerlambat + countSakit + countIzin + countAlpa;

  // Handler to update or create presensi record (termasuk foto & lokasi)
  const updatePresensi = (
    siswa: Siswa,
    newStatus: PresensiStatus,
    note?: string,
    fotoUrl?: string,
    lokasi?: PresensiLokasi
  ) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    // Date validation: prevent adding presensi for future dates
    const today = dateWIB(now);
    if (selectedDate > today) {
      setScanMessage({
        type: 'error',
        text: `✗ Tanggal ${selectedDate} belum tiba. Tidak bisa menginput presensi untuk tanggal masa depan.`
      });
      if (scanMessageTimerRef.current) clearTimeout(scanMessageTimerRef.current);
      scanMessageTimerRef.current = setTimeout(() => setScanMessage(null), 5000);
      return;
    }

    setPresensiList(prev => {
      const existingIndex = prev.findIndex(
        p => p.tanggal === selectedDate && p.siswaId === siswa.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        const existing = updated[existingIndex];
        updated[existingIndex] = {
          ...existing,
          status: newStatus,
          keterangan: note !== undefined ? note : existing.keterangan,
          waktuInput: timeStr,
          fotoUrl: fotoUrl !== undefined ? fotoUrl : existing.fotoUrl,
          lokasi: lokasi !== undefined ? lokasi : existing.lokasi
        };
        return updated;
      } else {
        const newRecord: PresensiRecord = {
          id: 'p-' + Date.now() + '-' + Math.random().toString(36).substr(2, 4),
          tanggal: selectedDate,
          classId: siswa.classId,
          siswaId: siswa.id,
          siswaName: siswa.name,
          nisn: siswa.nisn,
          status: newStatus,
          keterangan: note || '',
          waktuInput: timeStr,
          fotoUrl: fotoUrl || undefined,
          lokasi: lokasi || undefined
        };
        return [newRecord, ...prev];
      }
    });
  };

  const handleUpdateStatus = (siswa: Siswa, newStatus: PresensiStatus, note?: string) => {
    updatePresensi(siswa, newStatus, note);
  };

  // ===== State modal detail (foto + tap location) =====
  const [detailSiswa, setDetailSiswa] = useState<Siswa | null>(null);
  const [detailStatus, setDetailStatus] = useState<PresensiStatus>('Hadir');
  const [detailNote, setDetailNote] = useState('');
  const [detailFotoFile, setDetailFotoFile] = useState<File | null>(null);
  const [detailFotoPreview, setDetailFotoPreview] = useState<string>('');
  const [detailLokasi, setDetailLokasi] = useState<PresensiLokasi | null>(null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [locMsg, setLocMsg] = useState('');
  const [detailSaving, setDetailSaving] = useState(false);
  const [detailMsg, setDetailMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const openDetail = (siswa: Siswa) => {
    const existing = presensiList.find(
      p => p.tanggal === selectedDate && p.siswaId === siswa.id
    );
    setDetailSiswa(siswa);
    setDetailStatus(existing?.status || 'Hadir');
    setDetailNote(existing?.keterangan || '');
    setDetailFotoFile(null);
    setDetailFotoPreview(existing?.fotoUrl ? `${existing.fotoUrl}?link=1` : '');
    setDetailLokasi(existing?.lokasi || null);
    setLocStatus('idle');
    setLocMsg('');
    setDetailMsg(null);
  };

  const handleDetailFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setDetailFotoFile(file);
    setDetailFotoPreview(URL.createObjectURL(file));
  };

  const handleDetailLocate = async () => {
    setLocStatus('loading');
    setLocMsg('');
    try {
      const loc = await getCurrentLocation();
      setDetailLokasi(loc);
      setLocStatus('done');
    } catch (err) {
      setLocStatus('error');
      setLocMsg(err instanceof Error ? err.message : 'Gagal mengambil lokasi.');
    }
  };

  const handleDetailSave = async () => {
    if (!detailSiswa) return;
    const now = new Date();
    const today = dateWIB(now);
    if (selectedDate > today) {
      setDetailMsg({ type: 'error', text: `✗ Tanggal ${selectedDate} belum tiba.` });
      return;
    }

    setDetailSaving(true);
    setDetailMsg(null);

    let newFotoUrl: string | undefined;
    if (detailFotoFile) {
      try {
        const url = await uploadPhoto(detailFotoFile);
        if (!url) throw new Error('Upload foto gagal.');
        newFotoUrl = url;
      } catch (err) {
        setDetailSaving(false);
        setDetailMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload foto gagal.' });
        return;
      }
    } else {
      // Tidak ada file baru: pertahankan foto lama (preview terisi), atau hapus foto bila preview kosong
      const existing = presensiList.find(p => p.tanggal === selectedDate && p.siswaId === detailSiswa.id);
      newFotoUrl = detailFotoPreview ? (existing?.fotoUrl || detailFotoPreview) : undefined;
    }

    updatePresensi(
      detailSiswa,
      detailStatus,
      detailNote,
      newFotoUrl,
      detailLokasi || undefined
    );

    setDetailSaving(false);
    setDetailMsg({ type: 'success', text: `✓ Presensi ${detailSiswa.name} disimpan.` });
  };

  const closeDetail = () => {
    setDetailSiswa(null);
    if (detailFotoPreview && detailFotoPreview.startsWith('blob:')) {
      URL.revokeObjectURL(detailFotoPreview);
    }
  };


  // FIXED: QR Scan Handler with validation
  const handleQrScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    
    const input = qrNisnInput.trim();
    if (!input) {
      setScanMessage({
        type: 'error',
        text: 'Silakan masukkan NISN atau scan QR Code terlebih dahulu.'
      });
      return;
    }

    // Validate NISN format (jika input adalah 10 digit angka)
    if (/^\d+$/.test(input)) {
      const validation = validateNISN(input);
      if (!validation.valid) {
        setScanMessage({
          type: 'error',
          text: validation.message
        });
        return;
      }
    }

    const matchedSiswa = siswaList.find(s => s.nisn === input || s.id === input);

    if (matchedSiswa) {
      handleUpdateStatus(matchedSiswa, 'Hadir');
      setScanMessage({
        type: 'success',
        text: `✓ Presensi BERHASIL! ${matchedSiswa.name} (NISN: ${matchedSiswa.nisn}) dicatat HADIR pukul ${new Date().toLocaleTimeString('id-ID')}`
      });
      setQrNisnInput('');
    } else {
      setScanMessage({
        type: 'error',
        text: `✗ NISN "${input}" tidak ditemukan dalam database siswa ${SCHOOL_INFO.name}.`
      });
    }

    // Clear previous timer if exists
    if (scanMessageTimerRef.current) {
      clearTimeout(scanMessageTimerRef.current);
    }

    // Set new timer
    scanMessageTimerRef.current = setTimeout(() => {
      setScanMessage(null);
      scanMessageTimerRef.current = null;
    }, 5000);
  };

  // FIXED: Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (scanMessageTimerRef.current) {
        clearTimeout(scanMessageTimerRef.current);
      }
    };
  }, []);

  // Auto-fetch log saat tab log aktif
  useEffect(() => {
    if (activeTabMode === 'log' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin')) {
      fetchLog();
    }
  }, [activeTabMode, currentUser?.role]);

  // Export to CSV function
  const handleExportCSV = () => {
    const headers = ['No', 'NISN', 'Nama Siswa', 'Kelas', 'Hadir', 'Sakit', 'Izin', 'Alpa', 'Total', 'Persentase'];
    const rows = siswaList
      .filter(siswa => rekapClassFilter === 'all' || siswa.classId === rekapClassFilter)
      .map((siswa, idx) => {
      const sRecords = presensiList.filter(p => p.siswaId === siswa.id && p.tanggal >= rekapStartDate && p.tanggal <= rekapEndDate);
      const h = sRecords.filter(p => p.status === 'Hadir').length;
      const s = sRecords.filter(p => p.status === 'Sakit').length;
      const i = sRecords.filter(p => p.status === 'Izin').length;
      const a = sRecords.filter(p => p.status === 'Alpa').length;
      const tot = sRecords.length || 1;
      const pct = Math.round((h / tot) * 100);
      const kInfo = kelasList.find(k => k.id === siswa.classId);

      return [
        idx + 1,
        siswa.nisn,
        siswa.name,
        kInfo?.name || '-',
        h,
        s,
        i,
        a,
        tot,
        `${pct}%`
      ];
    });

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Rekap_Absensi_SMK_${rekapStartDate}_to_${rekapEndDate}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Status badge untuk tampilan ringkas (tabel & kartu)
  const statusBadgeClass = (s: PresensiStatus): string => {
    if (s === 'Hadir') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'Terlambat') return 'bg-orange-100 text-orange-700 border-orange-200';
    if (s === 'Sakit') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'Izin') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  return (
    <div id="absensi-module" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">

      {/* SISWA: UI sederhana (kartu + riwayat + kelas) */}
      {currentUser?.role === 'siswa' && currentUser && (
        <StudentAbsensiCard
         presensiList={presensiList}
         setPresensiList={setPresensiList}
         savePresensi={savePresensi}
         siswaList={siswaList}
          currentUser={currentUser}
        />
      )}

      {/* ADMIN/GURU/KETUA: UI lengkap */}
      {currentUser?.role !== 'siswa' && (
      <>
      
      {/* Header Title */}
      <div className="flex flex-col gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sistem Pengelolaan Absensi Vokasi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Presensi & Kehadiran Siswa {SCHOOL_INFO.name}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catat presensi harian per kelas, scan QR Kartu Pelajar, serta pantau persentase kehadiran real-time.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="print-hidden flex flex-wrap gap-1 bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => setActiveTabMode('harian')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTabMode === 'harian' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>Presensi Harian</span>
          </button>

          {currentUser?.role !== 'ketua_kelas' && (
            <button
              onClick={() => setActiveTabMode('qr-scanner')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTabMode === 'qr-scanner' 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <QrCode className="w-4 h-4 text-emerald-600" />
              <span>Scan QR / NISN</span>
            </button>
          )}

          {currentUser?.role !== 'ketua_kelas' && (
            <button
              onClick={() => setActiveTabMode('rekap')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTabMode === 'rekap' 
                  ? 'bg-white text-emerald-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
            <FileText className="w-4 h-4" />
            <span>Rekap & Laporan</span>
          </button>
          )}

          {(currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
            <button
              onClick={() => setActiveTabMode('log')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                activeTabMode === 'log'
                  ? 'bg-white text-emerald-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="w-4 h-4" />
              <span>Log</span>
            </button>
          )}
        </div>
      </div>

      {/* Read-only banner */}
      {currentUser && isReadOnly && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs font-semibold p-3 rounded-2xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>
            Anda login sebagai <strong>{currentUser.role === 'siswa' ? 'Siswa' : currentUser.role}</strong> dan hanya dapat
            melihat presensi (mode baca). Riwayat kehadiran pribadi bisa dilihat di menu <strong>Profil</strong>.
          </span>
        </div>
      )}

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500">{presensiSearchQuery ? 'Hasil Pencarian' : 'Siswa di Kelas ini'}</div>
          <div className="text-2xl font-extrabold text-slate-900">{filteredSiswa.length} <span className="text-xs font-normal text-slate-400">siswa</span></div>
          <div className="text-[11px] text-emerald-600 font-medium">Kelas {selectedKelasInfo?.name}</div>
        </div>

        <div className="bg-emerald-50/80 p-5 rounded-2xl border border-emerald-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-emerald-700 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Hadir</span>
          </div>
          <div className="text-2xl font-extrabold text-emerald-800">{countHadir}</div>
          <div className="text-[11px] text-emerald-600 font-medium">
            {totalSiswaSelectedClass ? Math.round((countHadir / totalSiswaSelectedClass) * 100) : 0}% Kehadiran
          </div>
        </div>

        <div className="bg-amber-50/80 p-5 rounded-2xl border border-amber-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-amber-700 flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            <span>Sakit</span>
          </div>
          <div className="text-2xl font-extrabold text-amber-800">{countSakit}</div>
          <div className="text-[11px] text-amber-600 font-medium">Izin Dokter / Orangtua</div>
        </div>

        <div className="bg-blue-50/80 p-5 rounded-2xl border border-blue-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-blue-700 flex items-center gap-1">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>Izin</span>
          </div>
          <div className="text-2xl font-extrabold text-blue-800">{countIzin}</div>
          <div className="text-[11px] text-blue-600 font-medium">Kegiatan / Tugas</div>
        </div>

        <div className="bg-rose-50/80 p-5 rounded-2xl border border-rose-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-rose-700 flex items-center gap-1">
            <XCircle className="w-3.5 h-3.5" />
            <span>Alpa</span>
          </div>
          <div className="text-2xl font-extrabold text-rose-800">{countAlpa}</div>
          <div className="text-[11px] text-rose-600 font-medium">Tanpa Keterangan</div>
        </div>
      </div>

      {/* MODE 1: PRESENSI HARIAN */}
      {activeTabMode === 'harian' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden space-y-6 p-6">
          
          {/* Controls Bar: Select Date & Class */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Tanggal Presensi:</label>
                <div className="relative">
                  <Calendar className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input 
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {currentUser?.role === 'ketua_kelas' ? (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kelas:</label>
                  <div className="px-4 py-2 bg-emerald-50 border border-emerald-200 rounded-xl text-xs font-bold text-emerald-800">
                    {selectedKelasInfo?.name || '-'}
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Kelas:</label>
                  <select
                    value={selectedClassId}
                    onChange={(e) => setSelectedClassId(e.target.value)}
                    className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                  >
                    {classOptions.map(k => (
                      <option key={k.id} value={k.id}>
                        {k.name} — Wali Kelas: {k.waliKelas}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div className="relative w-full md:w-auto">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={presensiSearchQuery}
                onChange={(e) => setPresensiSearchQuery(e.target.value)}
                placeholder="Cari nama / NISN..."
                className="pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 w-full md:w-56"
              />
              {presensiSearchQuery && (
                <button
                  onClick={() => setPresensiSearchQuery('')}
                  className="absolute right-2.5 top-2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  aria-label="Hapus pencarian"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Student Roster: Kartu di mobile, Tabel ringkas di desktop */}
          {filteredSiswa.length === 0 ? (
            <div className="text-center py-10">
              <Users className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">
                {presensiSearchQuery ? `Tidak ada siswa yang cocok dengan "${presensiSearchQuery}".` : 'Tidak ada data siswa untuk kelas yang dipilih.'}
              </p>
            </div>
          ) : (
            <>
              {/* ===== MOBILE: KARTU PER SISWA ===== */}
              <div className="md:hidden space-y-3">
                {filteredSiswa.map((siswa, idx) => {
                  const record = classPresensi.find(p => p.siswaId === siswa.id);
                  return (
                    <button
                      key={siswa.id}
                      type="button"
                      onClick={() => openDetail(siswa)}
                      className="w-full text-left bg-slate-50 hover:bg-emerald-50/70 border border-slate-200 rounded-2xl p-4 transition-colors cursor-pointer"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xs font-semibold text-slate-400 mt-1 w-5 shrink-0">{idx + 1}</span>
                        <img src={siswa.foto} alt={siswa.name} className="w-11 h-11 rounded-full object-cover border border-slate-200 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 text-sm truncate">{siswa.name}</div>
                          <div className="text-[11px] text-slate-400">
                            {siswa.gender === 'L' ? 'Laki-Laki' : 'Perempuan'} • <span className="font-mono">{siswa.nisn}</span>
                          </div>
                        </div>
                        {record ? (
                          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border shrink-0 ${statusBadgeClass(record.status)}`}>
                            {record.status}
                          </span>
                        ) : (
                          <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200 shrink-0">
                            Belum
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 mt-3">
                        <span className="text-[11px] text-slate-400 font-mono">⏱ {record?.waktuInput || '-'}</span>
                        <span className="text-[11px] text-slate-400 truncate">
                          • Diinput oleh: {record?.inputBy ? record.inputBy.name : (record ? 'dimuat dari seed' : '-')}
                        </span>
                        <span className="ml-auto flex items-center gap-2">
                          {record?.fotoUrl && <Camera className="w-4 h-4 text-emerald-500" />}
                          {record?.lokasi && <MapPin className="w-4 h-4 text-sky-500" />}
                          {!isReadOnly && <Edit3 className="w-4 h-4 text-slate-400" />}
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* ===== DESKTOP: TABEL RINGKAS ===== */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                      <th className="py-3 px-4">No</th>
                      <th className="py-3 px-4">Siswa</th>
                      <th className="py-3 px-4 text-center">Status Presensi</th>
                      <th className="py-3 px-4">Keterangan / Catatan</th>
                      <th className="py-3 px-4 text-right">Waktu Input</th>
                      <th className="py-3 px-4 text-left">Diinput oleh</th>
                      <th className="py-3 px-4 text-center">Bukti (Foto & Lokasi)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-sm">
                    {filteredSiswa.map((siswa, idx) => {
                      const record = classPresensi.find(p => p.siswaId === siswa.id);

                      return (
                        <tr key={siswa.id} onClick={() => openDetail(siswa)}
                          className="hover:bg-emerald-50/40 transition-colors cursor-pointer">
                          <td className="py-3 px-4 text-xs font-semibold text-slate-400">{idx + 1}</td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <img src={siswa.foto} alt={siswa.name} className="w-9 h-9 rounded-full object-cover border border-slate-200 shrink-0" />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-sm truncate">{siswa.name}</div>
                                <div className="text-[11px] text-slate-400">
                                  {siswa.gender === 'L' ? 'Laki-Laki' : 'Perempuan'} • <span className="font-mono">{siswa.nisn}</span>
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            {record ? (
                              <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${statusBadgeClass(record.status)}`}>
                                {record.status}
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-100 text-slate-400 border border-slate-200">
                                Belum
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-xs text-slate-600 max-w-[180px]">
                            <span className="line-clamp-2">{record?.keterangan || '-'}</span>
                          </td>
                          <td className="py-3 px-4 text-right text-xs font-mono text-slate-500">
                            {record?.waktuInput || '-'}
                          </td>
                          <td className="py-3 px-4 text-left text-xs text-slate-500">
                            {record?.inputBy
                              ? <span>{record.inputBy.name} <span className="text-slate-400">({record.inputBy.role})</span></span>
                              : (record ? <span className="text-slate-400">dimuat dari seed</span> : '-')}
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center justify-center gap-2">
                              {record?.fotoUrl && (
                                <span className="w-9 h-9 rounded-lg overflow-hidden border border-slate-200 bg-slate-100 shrink-0" title="Lihat foto presensi">
                                  <img src={`${record.fotoUrl}?thumb=1`} alt="Foto presensi" className="w-full h-full object-cover" />
                                </span>
                              )}
                              {record?.lokasi && (
                                <span className="w-8 h-8 rounded-lg bg-sky-100 text-sky-700 flex items-center justify-center shrink-0" title={`Lokasi: ${record.lokasi.lat.toFixed(5)}, ${record.lokasi.lng.toFixed(5)}`}>
                                  <MapPin className="w-4 h-4" />
                                </span>
                              )}
                              {!record?.fotoUrl && !record?.lokasi && (
                                <span className="text-xs text-slate-300">-</span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

        </div>
      )}

      {/* MODE 2: QR CODE SCANNER SIMULATOR */}
      {activeTabMode === 'qr-scanner' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-8 max-w-3xl mx-auto space-y-6 text-center">
          <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-inner">
            <QrCode className="w-10 h-10" />
          </div>

          <div>
            <h3 className="text-2xl font-bold text-slate-900">Scan QR Code Kartu Pelajar Siswa</h3>
            <p className="text-xs text-slate-500 max-w-md mx-auto mt-1">
              Arahkan QR Code Kartu Pelajar ke kamera scanner atau masukkan NISN siswa secara manual di bawah ini.
            </p>
          </div>

          {/* Quick NISN Click Helper Chips */}
          <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-left space-y-2">
            <div className="text-xs font-bold text-slate-700">Klik NISN Siswa Demo untuk Presensi Cepat:</div>
            <div className="flex flex-wrap gap-2">
              {siswaList.slice(0, 8).map(s => (
                <button
                  key={s.id}
                  disabled={!canEditCurrent}
                  onClick={() => {
                    setQrNisnInput(s.nisn);
                    handleQrScanSubmit();
                  }}
                  className="bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg font-mono font-medium transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                  <span>{s.name} ({s.nisn})</span>
                </button>
              ))}
            </div>
          </div>

          <form onSubmit={handleQrScanSubmit} className="flex gap-3 max-w-md mx-auto">
            <input 
              type="text"
              value={qrNisnInput}
              disabled={!canEditCurrent}
              onChange={(e) => setQrNisnInput(e.target.value)}
              placeholder="Masukkan NISN atau Scan QR..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed"
            />
            <button
              type="submit"
              disabled={!canEditCurrent}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md cursor-pointer text-sm disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Scan
            </button>
          </form>

          {scanMessage && (
            <div className={`p-4 rounded-2xl text-xs font-bold border flex items-center justify-center gap-2 animate-in fade-in duration-200 ${
              scanMessage.type === 'success' 
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800' 
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {scanMessage.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <XCircle className="w-5 h-5 text-rose-600" />}
              <span>{scanMessage.text}</span>
            </div>
          )}
        </div>
      )}

      {/* MODE 3: REKAP LAPORAN PRESENSI */}
      {activeTabMode === 'rekap' && (
        <div className="print-full bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Rekap Laporan Kehadiran Siswa</h3>
              <p className="text-xs text-slate-500">{SCHOOL_INFO.name} — Semester Ganjil 2026/2027</p>
            </div>
            
            <div className="print-hidden flex gap-2">
              <button
                onClick={handleExportCSV}
                className="flex items-center gap-2 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-emerald-700 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Export Excel/CSV</span>
              </button>
              
              <button
                onClick={() => window.print()}
                className="flex items-center gap-2 bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer transition-colors"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak PDF</span>
              </button>
            </div>
          </div>

          {/* Date Range & Class Filter Controls */}
          <div className="print-hidden flex flex-col md:flex-row flex-wrap gap-3 p-4 bg-slate-50 rounded-2xl border border-slate-200">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-slate-500" />
              <input
                type="date"
                value={rekapStartDate}
                max={rekapEndDate}
                onChange={(e) => { setRekapStartDate(e.target.value); setRekapPage(1); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <span className="text-slate-400 text-xs">s/d</span>
              <input
                type="date"
                value={rekapEndDate}
                min={rekapStartDate}
                onChange={(e) => { setRekapEndDate(e.target.value); setRekapPage(1); }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
            <select
              value={rekapClassFilter}
              onChange={(e) => { setRekapClassFilter(e.target.value); setRekapPage(1); }}
              className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
            >
              <option value="all">Semua Kelas</option>
              {kelasList.map(k => (
                <option key={k.id} value={k.id}>{k.name}</option>
              ))}
            </select>
            <span className="text-xs text-slate-500 font-medium self-center">
              Periode: {rekapStartDate} s/d {rekapEndDate}
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">Kelas</th>
                  <th className="py-3 px-4">Hadir</th>
                  <th className="py-3 px-4">Sakit</th>
                  <th className="py-3 px-4">Izin</th>
                  <th className="py-3 px-4">Alpa</th>
                  <th className="py-3 px-4 text-right">Persentase</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(() => {
                  const filteredSiswaList = siswaList.filter(siswa => rekapClassFilter === 'all' || siswa.classId === rekapClassFilter);
                  const totalPages = Math.max(1, Math.ceil(filteredSiswaList.length / rekapPageSize));
                  const currentPage = Math.min(rekapPage, totalPages);
                  const startIndex = (currentPage - 1) * rekapPageSize;
                  const pageItems = filteredSiswaList.slice(startIndex, startIndex + rekapPageSize);

                  return pageItems.map(siswa => {
                    const sRecords = presensiList.filter(p => p.siswaId === siswa.id && p.tanggal >= rekapStartDate && p.tanggal <= rekapEndDate);
                    const h = sRecords.filter(p => p.status === 'Hadir').length;
                    const s = sRecords.filter(p => p.status === 'Sakit').length;
                    const i = sRecords.filter(p => p.status === 'Izin').length;
                    const a = sRecords.filter(p => p.status === 'Alpa').length;
                    const tot = sRecords.length || 1;
                    const pct = Math.round((h / tot) * 100);

                    const kInfo = kelasList.find(k => k.id === siswa.classId);

                    return (
                      <tr key={siswa.id} className="hover:bg-slate-50">
                        <td className="py-3 px-4 font-bold text-slate-900">{siswa.name} ({siswa.nisn})</td>
                        <td className="py-3 px-4 font-semibold text-emerald-700">{kInfo?.name || '-'}</td>
                        <td className="py-3 px-4 font-bold text-emerald-600">{h}</td>
                        <td className="py-3 px-4 font-bold text-amber-600">{s}</td>
                        <td className="py-3 px-4 font-bold text-blue-600">{i}</td>
                        <td className="py-3 px-4 font-bold text-rose-600">{a}</td>
                        <td className="py-3 px-4 text-right font-extrabold text-slate-800">{pct}%</td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="print-hidden">
          {(() => {
            const filteredSiswaList = siswaList.filter(siswa => rekapClassFilter === 'all' || siswa.classId === rekapClassFilter);
            const totalPages = Math.max(1, Math.ceil(filteredSiswaList.length / rekapPageSize));
            const currentPage = Math.min(rekapPage, totalPages);
            return (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2 border-t border-slate-100">
                <div className="text-xs text-slate-500 font-medium">
                  Menampilkan <strong>{filteredSiswaList.length === 0 ? 0 : (currentPage - 1) * rekapPageSize + 1}</strong> - <strong>{Math.min(currentPage * rekapPageSize, filteredSiswaList.length)}</strong> dari <strong>{filteredSiswaList.length}</strong> siswa
                </div>
                <div className="flex items-center gap-2">
                  <select
                    value={rekapPageSize}
                    onChange={(e) => { setRekapPageSize(Number(e.target.value)); setRekapPage(1); }}
                    className="px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer"
                  >
                    <option value={10}>10 / halaman</option>
                    <option value={15}>15 / halaman</option>
                    <option value={25}>25 / halaman</option>
                    <option value={50}>50 / halaman</option>
                  </select>
                  <button
                    onClick={() => setRekapPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage <= 1}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    ← Sebelumnya
                  </button>
                  <span className="text-xs font-bold text-slate-700 px-2">
                    Hal {currentPage} / {totalPages}
                  </span>
                  <button
                    onClick={() => setRekapPage(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage >= totalPages}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-xs font-bold disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer hover:bg-slate-200 transition-colors"
                  >
                    Berikutnya →
                  </button>
                </div>
              </div>
            );
          })()}
          </div>
        </div>
      )}

      {/* MODE 4: LOG PERUBAHAN (admin only) */}
      {activeTabMode === 'log' && (currentUser?.role === 'admin' || currentUser?.role === 'super_admin') && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Log Perubahan Presensi</h3>
              <p className="text-xs text-slate-500 mt-1">Riwayat perubahan data presensi oleh semua pengguna.</p>
            </div>
            <button onClick={fetchLog} disabled={logLoading}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer disabled:opacity-50">
              {logLoading ? 'Memuat...' : 'Refresh'}
            </button>
          </div>

          {logData.length === 0 ? (
            <div className="text-center py-12">
              <History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
              <p className="text-sm text-slate-400">Belum ada log perubahan.</p>
              <p className="text-xs text-slate-300 mt-1">Klik Refresh untuk memuat data terbaru.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                    <th className="py-3 px-4">Tanggal</th>
                    <th className="py-3 px-4">Siswa</th>
                    <th className="py-3 px-4">Field</th>
                    <th className="py-3 px-4">Lama</th>
                    <th className="py-3 px-4">Baru</th>
                    <th className="py-3 px-4">Diubah Oleh</th>
                    <th className="py-3 px-4">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {logData.map((log: any) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-4 text-xs font-mono text-slate-600">{log.tanggal}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-slate-800">{log.siswa_name}</td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-mono">{log.field_changed}</span>
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-[150px] truncate">{log.old_value || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-500 max-w-[150px] truncate">{log.new_value || '-'}</td>
                      <td className="py-3 px-4 text-xs text-slate-600">
                        {log.changed_by_name} <span className="text-slate-400">({log.changed_by_role})</span>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">{log.changed_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL DETAIL: Foto + Tap Location per siswa */}
      {detailSiswa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-3">
                <img src={detailSiswa.foto} alt={detailSiswa.name} className="w-10 h-10 rounded-full object-cover border border-slate-200" />
                <div>
                  <div className="font-bold text-slate-900">{detailSiswa.name}</div>
                  <div className="text-[11px] text-slate-400 font-mono">NISN: {detailSiswa.nisn} • {detailSiswa.classId.toUpperCase()}</div>
                </div>
              </div>
              <button onClick={closeDetail} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {detailMsg && (
                <div className={`text-xs px-3 py-2 rounded-lg border ${detailMsg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                  {detailMsg.text}
                </div>
              )}

              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['Hadir', 'Terlambat', 'Sakit', 'Izin', 'Alpa'] as PresensiStatus[]).map(st => {
                    const isSelected = detailStatus === st;
                    const map: Record<PresensiStatus, string> = {
                      Hadir: isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400',
                      Terlambat: isSelected ? 'bg-orange-600 text-white border-orange-600' : 'bg-white text-slate-600 border-slate-200 hover:border-orange-400',
                      Sakit: isSelected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400',
                      Izin: isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400',
                      Alpa: isSelected ? 'bg-rose-600 text-white border-rose-600' : 'bg-white text-slate-600 border-slate-200 hover:border-rose-400'
                    };
                    return (
                      <button key={st} type="button" disabled={isReadOnly}
                        onClick={() => setDetailStatus(st)}
                        className={`px-4 py-2 rounded-lg border text-sm font-semibold transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${map[st]}`}>
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Foto */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Foto Presensi</label>
                <div className="space-y-3">
                  {detailFotoPreview ? (
                    <div className="relative">
                      <img src={detailFotoPreview} alt="Preview" className="w-full max-h-56 object-cover rounded-xl border border-slate-200" />
                      {!isReadOnly && (
                        <button type="button" onClick={() => { setDetailFotoFile(null); setDetailFotoPreview(''); }}
                          className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow cursor-pointer hover:bg-rose-700">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  ) : (
                    !isReadOnly && (
                      <label className="flex flex-col items-center justify-center gap-2 w-full h-32 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 cursor-pointer hover:border-emerald-400 hover:text-emerald-500 transition-colors">
                        <ImagePlus className="w-7 h-7" />
                        <span className="text-xs font-semibold">Pilih / Ambil Foto Presensi</span>
                        <span className="text-[10px]">JPEG maks. 5MB (otomatis dikompres agar hemat R2)</span>
                        <input type="file" accept="image/*" capture="environment" onChange={handleDetailFotoChange} className="hidden" />
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* Lokasi (tap location) */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Lokasi (Tap Location)</label>
                <div className="space-y-3">
                  {detailLokasi ? (
                    <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sky-800">
                        <MapPin className="w-4 h-4" />
                        <span className="text-xs font-mono">
                          {detailLokasi.lat.toFixed(5)}, {detailLokasi.lng.toFixed(5)}
                        </span>
                      </div>
                      <a href={mapsUrl(detailLokasi.lat, detailLokasi.lng)} target="_blank" rel="noreferrer"
                        className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold">
                        Buka Maps <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  ) : null}
                  {!isReadOnly && (
                    <button type="button" onClick={handleDetailLocate} disabled={locStatus === 'loading'}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed">
                      {locStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                      {locStatus === 'loading' ? 'Mendeteksi lokasi...' : (detailLokasi ? 'Perbarui Lokasi' : 'Deteksi Lokasi Saya')}
                    </button>
                  )}
                  {locStatus === 'error' && <p className="text-xs text-rose-600">{locMsg}</p>}
                  {locStatus === 'done' && <p className="text-xs text-emerald-600">Lokasi berhasil dideteksi.</p>}
                </div>
              </div>

              {/* Catatan */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Keterangan / Catatan</label>
                <textarea value={detailNote} disabled={isReadOnly} onChange={e => setDetailNote(e.target.value)}
                  rows={2} placeholder="Catatan tambahan..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white disabled:opacity-60 disabled:cursor-not-allowed resize-none" />
              </div>

              {/* Save */}
              {!isReadOnly && (
                <div className="flex gap-3 pt-1">
                  <button type="button" onClick={closeDetail}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold cursor-pointer hover:bg-slate-200 transition-colors">
                    Batal
                  </button>
                  <button type="button" onClick={handleDetailSave} disabled={detailSaving}
                    className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                    {detailSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Simpan Presensi
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
};
