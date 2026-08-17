import React, { useState, useEffect } from 'react';
import { Kelas, Siswa, ScheduleItem, User } from '../types';
import { validateNISN, validateName, validateTextField } from '../utils/validation';
import { authHeaders } from '../utils/auth';
import { 
  Users, 
  Plus, 
  Calendar, 
  BookOpen, 
  UserCheck, 
  MapPin, 
  GraduationCap, 
  ChevronRight, 
  Search,
  Clock,
  UserPlus,
  Building2,
  Check,
  Crown,
  ShieldCheck,
  ShieldX,
  Loader2,
  FileText
} from 'lucide-react';
import { RaporModal } from './RaporModal';

interface KelasSectionProps {
  kelasList: Kelas[];
  setKelasList: React.Dispatch<React.SetStateAction<Kelas[]>>;
  siswaList: Siswa[];
  refreshSiswa: () => Promise<Siswa[]>;
  currentUser: User | null;
}

export const KelasSection: React.FC<KelasSectionProps> = ({
  kelasList,
  setKelasList,
  siswaList,
  refreshSiswa,
  currentUser
}) => {
  const [selectedKelas, setSelectedKelas] = useState<Kelas | null>(null);
  const [activeSubTab, setActiveSubTab] = useState<'roster' | 'jadwal'>('roster');
  
  // Modal states
  const [showAddClassModal, setShowAddClassModal] = useState(false);
  const [showAddSiswaModal, setShowAddSiswaModal] = useState(false);

  // Form New Class state
  const [newClassName, setNewClassName] = useState('');
  const [newJurusanCode, setNewJurusanCode] = useState('MPLB');
  const [newTingkat, setNewTingkat] = useState<'X' | 'XI' | 'XII'>('X');
  const [newRuang, setNewRuang] = useState('Gedung A - R.105');
  const [newWaliKelas, setNewWaliKelas] = useState('');

  // Form New Siswa state
  const [newSiswaName, setNewSiswaName] = useState('');
  const [newSiswaNisn, setNewSiswaNisn] = useState('');
  const [newSiswaGender, setNewSiswaGender] = useState<'L' | 'P'>('L');
  const [siswaFormError, setSiswaFormError] = useState('');
  const [kelasFormError, setKelasFormError] = useState('');

  // Edit Siswa (perbaiki NISN placeholder, NIK, TTL, dll.)
  const [editingSiswa, setEditingSiswa] = useState<Siswa | null>(null);
  const [editName, setEditName] = useState('');
  const [editNisn, setEditNisn] = useState('');
  const [editNik, setEditNik] = useState('');
  const [editTtl, setEditTtl] = useState('');
  const [editGender, setEditGender] = useState<'L' | 'P'>('L');
  const [editHp, setEditHp] = useState('');
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);

  const [raporSiswa, setRaporSiswa] = useState<Siswa | null>(null);

  // ===== Kelola Ketua Kelas (admin) =====
  const isAdmin = currentUser?.role === 'admin' || currentUser?.role === 'super_admin';
  const [ketuaList, setKetuaList] = useState<Array<{ id: string; name: string; classId: string; ketuaStatus: string; approvedAt?: string }>>([]);
  const [ketuaAssign, setKetuaAssign] = useState<Record<string, string>>({}); // classId -> siswaId
  const [ketuaLoading, setKetuaLoading] = useState(false);
  const [ketuaMsg, setKetuaMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadKetuaList = async () => {
    try {
      const res = await fetch('/api/users/ketua', { headers: authHeaders() });
      const json = await res.json() as { success?: boolean; data?: Array<{ id: string; name: string; classId: string; ketuaStatus: string; approvedAt?: string }> };
      if (res.ok && json.success) setKetuaList(json.data || []);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    if (isAdmin) loadKetuaList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  const handleAppointKetua = async (classId: string) => {
    const siswaId = ketuaAssign[classId];
    if (!siswaId) {
      setKetuaMsg({ type: 'error', text: 'Pilih siswa terlebih dahulu.' });
      return;
    }
    setKetuaLoading(true);
    setKetuaMsg(null);
    try {
      const res = await fetch('/api/users/ketua', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ siswaId, classId }),
      });
      const json = await res.json() as { success?: boolean; error?: string; data?: { id: string; name: string; temporaryPassword?: string } };
      if (res.ok && json.success) {
        const passwordInfo = json.data?.temporaryPassword ? ` Password awal: ${json.data.temporaryPassword} (wajib segera diganti).` : '';
        setKetuaMsg({ type: 'success', text: `✅ ${json.data?.name} ditetapkan sebagai Ketua Kelas.${passwordInfo}` });
        await loadKetuaList();
      } else {
        setKetuaMsg({ type: 'error', text: json.error || 'Gagal menetapkan ketua kelas.' });
      }
    } catch {
      setKetuaMsg({ type: 'error', text: 'Gagal terhubung ke server.' });
    } finally {
      setKetuaLoading(false);
    }
  };

  const handleRevokeKetua = async (userId: string) => {
    setKetuaLoading(true);
    setKetuaMsg(null);
    try {
      const res = await fetch('/api/users/ketua', {
        method: 'DELETE',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ userId }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (res.ok && json.success) {
        setKetuaMsg({ type: 'success', text: 'Status ketua kelas dicabut.' });
        await loadKetuaList();
      } else {
        setKetuaMsg({ type: 'error', text: json.error || 'Gagal mencabut status.' });
      }
    } catch {
      setKetuaMsg({ type: 'error', text: 'Gagal terhubung ke server.' });
    } finally {
      setKetuaLoading(false);
    }
  };

  // FIXED: Add New Class submit with validation
  const handleAddClassSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setKelasFormError('');

    // Validate inputs
    const nameValidation = validateTextField(newClassName, 'Nama Kelas', 2, 20);
    if (!nameValidation.valid) {
      setKelasFormError(nameValidation.message);
      return;
    }

    const waliValidation = validateName(newWaliKelas);
    if (!waliValidation.valid) {
      setKelasFormError(waliValidation.message);
      return;
    }

    const created: Kelas = {
      id: 'k-' + Date.now(),
      name: newClassName.trim(),
      jurusanCode: newJurusanCode,
      tingkat: newTingkat,
      ruang: newRuang,
      waliKelas: newWaliKelas.trim(),
      jumlahSiswa: 0,
      jadwal: []
    };

    setKelasList([created, ...kelasList]);
    setShowAddClassModal(false);
    setNewClassName('');
    setNewWaliKelas('');
    setKelasFormError('');
  };

  // FIXED: Add New Siswa submit with validation
  const handleAddSiswaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSiswaFormError('');

    if (!selectedKelas) {
      setSiswaFormError('Kelas belum dipilih');
      return;
    }

    // Validate name
    const nameValidation = validateName(newSiswaName);
    if (!nameValidation.valid) {
      setSiswaFormError(nameValidation.message);
      return;
    }

    // Validate NISN
    const nisnValidation = validateNISN(newSiswaNisn);
    if (!nisnValidation.valid) {
      setSiswaFormError(nisnValidation.message);
      return;
    }

    // Check duplicate NISN
    const isDuplicate = siswaList.some(s => s.nisn === newSiswaNisn.trim());
    if (isDuplicate) {
      setSiswaFormError(`NISN ${newSiswaNisn} sudah terdaftar!`);
      return;
    }

    const nisn = newSiswaNisn.trim();
    let response: Response;
    try {
      response = await fetch('/api/users', {
        method: 'POST',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ name: newSiswaName.trim(), email: `s${nisn}@smksplusatthahirin.sch.id`, identifier: nisn, role: 'siswa', classId: selectedKelas.id, gender: newSiswaGender }),
      });
    } catch {
      setSiswaFormError('Gagal terhubung ke server.');
      return;
    }
    const result = await response.json().catch(() => ({})) as { error?: string; initialPassword?: string };
    if (!response.ok) {
      setSiswaFormError(result.error || 'Gagal membuat akun siswa.');
      return;
    }
    alert(`Akun siswa berhasil dibuat. Password awal: ${result.initialPassword || '-'} (catat sekarang, hanya ditampilkan sekali).`);
    try {
      await refreshSiswa();
    } catch {
      setSiswaFormError('Akun sudah dibuat, tetapi roster gagal dimuat ulang. Silakan refresh halaman.');
      return;
    }
    
    // Update count
    setKelasList(prev => prev.map(k => k.id === selectedKelas.id ? { ...k, jumlahSiswa: k.jumlahSiswa + 1 } : k));

    setShowAddSiswaModal(false);
    setNewSiswaName('');
    setNewSiswaNisn('');
    setSiswaFormError('');
  };

  // FIXED: Edit siswa (perbaiki NISN/NIK/TTL). NISN juga disinkronkan ke akun login.
  const openEditSiswa = (siswa: Siswa) => {
    setEditingSiswa(siswa);
    setEditName(siswa.name);
    setEditNisn(siswa.nisn);
    setEditNik(siswa.nik || '');
    setEditTtl(siswa.tanggalLahir || '');
    setEditGender(siswa.gender);
    setEditHp(siswa.noHpOrangTua || '');
    setEditError('');
  };

  const handleEditSiswaSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSiswa) return;
    setEditError('');
    setEditSaving(true);
    try {
      const name = editName.trim();
      const nisn = editNisn.trim();
      const nameValidation = validateName(name);
      if (!nameValidation.valid) { setEditError(nameValidation.message); return; }
      if (!validateNISN(nisn).valid && !/^12345678\d{2}$/.test(nisn)) {
        setEditError(validateNISN(nisn).message);
        return;
      }
      const isDuplicate = siswaList.some(s => s.id !== editingSiswa.id && s.nisn === nisn);
      if (isDuplicate) { setEditError(`NISN ${nisn} sudah terdaftar di siswa lain!`); return; }

      const updated: Siswa = {
        ...editingSiswa,
        name,
        nisn,
        nik: editNik.trim() || undefined,
        tanggalLahir: editTtl.trim() || undefined,
        gender: editGender,
        noHpOrangTua: editHp.trim() || undefined,
      };
      const res = await fetch('/api/users/nisn', {
        method: 'PATCH',
        headers: authHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ oldNisn: editingSiswa.nisn, newNisn: nisn, name, student: updated }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({})) as { error?: string };
        setEditError(j?.error || 'Gagal menyinkronkan data siswa.');
        return;
      }
      await refreshSiswa();
      setEditingSiswa(null);
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <div id="kelas-module" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Module Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-2">
            <Users className="w-3.5 h-3.5" />
            <span>Manajemen Rombongan Belajar</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pengelolaan Kelas & Jadwal Pelajaran
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Daftar Rombongan Belajar (Rombel), Penetapan Wali Kelas, Roster Siswa, dan Penjadwalan Mata Pelajaran.
          </p>
        </div>

        <button
          onClick={() => setShowAddClassModal(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-5 py-3 rounded-xl shadow-md transition-all cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>Tambah Kelas Baru</span>
        </button>
      </div>

      {/* GRID OF CLASSES */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {kelasList.map((k) => {
          const classStudents = siswaList.filter(s => s.classId === k.id);
          const studentCount = classStudents.length || k.jumlahSiswa;

          return (
            <div 
              key={k.id}
              className="bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-md transition-all p-6 space-y-5 flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-3 py-1 rounded-lg">
                    {k.jurusanCode} — Kelas {k.tingkat}
                  </span>
                  <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{k.ruang}</span>
                  </span>
                </div>

                <h3 className="text-2xl font-extrabold text-slate-900">{k.name}</h3>

                <div className="space-y-1.5 text-xs text-slate-600 pt-1">
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Wali Kelas:</span>
                    <span className="font-bold text-slate-800">{k.waliKelas}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-slate-400">Total Siswa Terdaftar:</span>
                    <span className="font-bold text-emerald-700">{studentCount} Siswa</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => {
                    setSelectedKelas(k);
                    setActiveSubTab('roster');
                  }}
                  className="flex-1 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs py-2.5 rounded-xl transition-colors cursor-pointer text-center"
                >
                  Siswa & Roster
                </button>
                <button
                  onClick={() => {
                    setSelectedKelas(k);
                    setActiveSubTab('jadwal');
                  }}
                  className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-bold text-xs py-2.5 rounded-xl border border-emerald-200 transition-colors cursor-pointer text-center"
                >
                  Jadwal Pelajaran
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ADMIN: KELOLA KETUA KELAS */}
      {isAdmin && (
        <div className="space-y-4 rounded-3xl border border-slate-200/90 bg-white p-4 shadow-xs sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="inline-flex items-center gap-2 text-xs font-bold text-amber-700 bg-amber-100 px-3 py-1 rounded-full mb-2">
                <Crown className="w-3.5 h-3.5" />
                <span>Otorisasi Ketua Kelas</span>
              </div>
              <h2 className="text-lg font-extrabold text-slate-900">Tetapkan / Cabut Ketua Kelas</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Ketua kelas yang disetujui admin dapat menginput presensi teman sekelasnya (hanya kelasnya sendiri).
              </p>
            </div>
            {ketuaLoading && <Loader2 className="w-5 h-5 animate-spin text-amber-600" />}
          </div>

          {ketuaMsg && (
            <div className={`text-xs font-semibold p-3 rounded-xl border flex items-center gap-2 ${
              ketuaMsg.type === 'success'
                ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                : 'bg-rose-50 border-rose-300 text-rose-800'
            }`}>
              {ketuaMsg.text}
            </div>
          )}

          <div className="space-y-3">
            {kelasList.map(k => {
              const current = ketuaList.find(kk => kk.classId === k.id);
              const classSiswa = siswaList.filter(s => s.classId === k.id);
              return (
                <div key={k.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-extrabold text-slate-900">{k.name}</div>
                      {current ? (
                        <div className="text-xs text-slate-600 mt-1 flex items-center gap-1.5">
                          <ShieldCheck className="w-3.5 h-3.5 text-amber-600" />
                          <span>
                            <strong>{current.name}</strong> — disetujui {current.approvedAt ? new Date(current.approvedAt).toLocaleDateString('id-ID') : '-'}
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 mt-1">Belum ada ketua kelas.</div>
                      )}
                    </div>

                    <div className="flex w-full flex-col items-stretch gap-2 md:w-auto md:flex-row md:items-center">
                      {current ? (
                        <button
                          onClick={() => handleRevokeKetua(current.id)}
                          disabled={ketuaLoading}
                          className="flex items-center gap-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <ShieldX className="w-3.5 h-3.5" />
                          Cabut Status
                        </button>
                      ) : (
                        <>
                          <select
                            value={ketuaAssign[k.id] || ''}
                            onChange={(e) => setKetuaAssign(prev => ({ ...prev, [k.id]: e.target.value }))}
                            className="min-w-0 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold cursor-pointer md:w-64"
                          >
                            <option value="">Pilih siswa...</option>
                            {classSiswa.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.nisn})</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAppointKetua(k.id)}
                            disabled={ketuaLoading || !ketuaAssign[k.id]}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white transition-colors hover:bg-amber-700 cursor-pointer disabled:opacity-50"
                          >
                            <Check className="w-3.5 h-3.5" />
                            Tetapkan
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-[10px] text-slate-400">
            Catatan: Saat menetapkan, akun siswa dibuat di sistem (login pakai NISN, password awal = NISN). Semua tindakan tercatat (approved_by & approved_at).
          </p>
        </div>
      )}

      {/* MODAL / DRAWER DETAIL KELAS */}
      {selectedKelas && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 sm:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in zoom-in-95 duration-200">
            
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4">
              <div className="min-w-0">
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                  {selectedKelas.jurusanCode}
                </span>
                <h3 className="break-words text-2xl font-extrabold text-slate-900 mt-1">{selectedKelas.name}</h3>
                <p className="break-words text-xs text-slate-500">Wali Kelas: {selectedKelas.waliKelas} • Ruang: {selectedKelas.ruang}</p>
              </div>
              <button 
                onClick={() => setSelectedKelas(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub Tabs Inside Detail Modal */}
            <div className="flex flex-col gap-3 border-b border-slate-200 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setActiveSubTab('roster')}
                  className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeSubTab === 'roster'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Daftar Siswa ({siswaList.filter(s => s.classId === selectedKelas.id).length})
                </button>
                <button
                  onClick={() => setActiveSubTab('jadwal')}
                  className={`pb-3 text-xs font-bold border-b-2 cursor-pointer transition-colors ${
                    activeSubTab === 'jadwal'
                      ? 'border-emerald-600 text-emerald-700'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Jadwal Pelajaran Mingguan
                </button>
              </div>

              {activeSubTab === 'roster' && (
                <button
                  onClick={() => setShowAddSiswaModal(true)}
                  className="bg-emerald-600 text-white font-bold text-xs px-3 py-1.5 rounded-lg flex items-center gap-1 cursor-pointer"
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Tambah Siswa</span>
                </button>
              )}
            </div>

            {/* Sub Tab Content: Roster Siswa */}
            {activeSubTab === 'roster' && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {siswaList.filter(s => s.classId === selectedKelas.id).map((siswa, idx) => (
                    <div key={siswa.id} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
                      <img src={siswa.foto} alt={siswa.name} className="w-10 h-10 rounded-full object-cover border border-emerald-500" />
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-bold text-slate-900 truncate">{idx + 1}. {siswa.name}</div>
                        <div className="text-[10px] text-slate-500 font-mono">NISN: {siswa.nisn}</div>
                        <div className="text-[10px] text-slate-400">NIK: {siswa.nik || '-'} • TTL: {siswa.tanggalLahir || '-'}</div>
                        <div className="text-[10px] text-slate-400">Kontak OrangTua: {siswa.noHpOrangTua || '-'}</div>
                      </div>
                      <button
                        onClick={() => openEditSiswa(siswa)}
                        title="Edit data siswa"
                        className="shrink-0 p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setRaporSiswa(siswa)}
                        title="Lihat rapor siswa"
                        className="shrink-0 p-2 bg-white border border-slate-200 rounded-lg text-slate-500 hover:text-emerald-600 hover:border-emerald-300 transition-colors cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Sub Tab Content: Jadwal Pelajaran */}
            {activeSubTab === 'jadwal' && (
              <div className="space-y-4">
                {selectedKelas.jadwal && selectedKelas.jadwal.length > 0 ? (
                  <div className="space-y-3">
                    {selectedKelas.jadwal.map((j, idx) => (
                      <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col items-start gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                        <div className="min-w-0 space-y-1 break-words">
                          <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md text-[10px]">
                            {j.hari} • Jam {j.jamKe} ({j.jamRentan})
                          </span>
                          <h4 className="font-bold text-slate-900 text-sm">{j.mataPelajaran}</h4>
                          <p className="text-slate-500">Guru Pengajar: {j.guru}</p>
                        </div>
                        <span className="text-slate-600 font-semibold bg-white px-2.5 py-1 rounded-md border border-slate-200">
                          {j.ruangan}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 text-xs">
                    Jadwal pelajaran belum diatur untuk kelas ini.
                  </div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedKelas(null)}
                className="bg-slate-800 text-white font-bold px-5 py-2 rounded-xl text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH KELAS */}
      {showAddClassModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Tambah Rombongan Belajar Baru</h3>
            
            {kelasFormError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <span className="text-rose-500">⚠</span>
                <span>{kelasFormError}</span>
              </div>
            )}
            
            <form onSubmit={handleAddClassSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Kelas (contoh: X MPLB 2)</label>
                <input 
                  type="text" 
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="X MPLB 2" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jurusan</label>
                <select 
                  value={newJurusanCode} 
                  onChange={(e) => setNewJurusanCode(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="MPLB">MPLB — Manajemen Perkantoran dan Layanan Bisnis</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Wali Kelas</label>
                <input 
                  type="text" 
                  value={newWaliKelas}
                  onChange={(e) => setNewWaliKelas(e.target.value)}
                  placeholder="Bpk. Suryadi, S.Pd." 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => { setShowAddClassModal(false); setKelasFormError(''); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Simpan Kelas
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL FORM TAMBAH SISWA */}
      {showAddSiswaModal && selectedKelas && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Tambah Siswa Baru ke {selectedKelas.name}</h3>
            
            {siswaFormError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <span className="text-rose-500">⚠</span>
                <span>{siswaFormError}</span>
              </div>
            )}
            
            <form onSubmit={handleAddSiswaSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input 
                  type="text" 
                  value={newSiswaName}
                  onChange={(e) => setNewSiswaName(e.target.value)}
                  placeholder="Ahmad Bagus Pratama" 
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NISN (10 digit)</label>
                <input 
                  type="text" 
                  value={newSiswaNisn}
                  onChange={(e) => setNewSiswaNisn(e.target.value)}
                  placeholder="0068123999" 
                  maxLength={10}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Format: 10 digit angka</p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                <select 
                  value={newSiswaGender}
                  onChange={(e: any) => setNewSiswaGender(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="L">Laki-Laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => { setShowAddSiswaModal(false); setSiswaFormError(''); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button 
                  type="submit" 
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Simpan Siswa
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL EDIT SISWA */}
      {editingSiswa && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="font-bold text-lg text-slate-900">Edit Data Siswa</h3>

            {editError && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
                <span className="text-rose-500">⚠</span>
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleEditSiswaSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap Siswa</label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  placeholder="Ahmad Bagus Pratama"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">NISN (10 digit)</label>
                <input
                  type="text"
                  value={editNisn}
                  onChange={(e) => setEditNisn(e.target.value)}
                  placeholder="0068123999"
                  maxLength={10}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-400 mt-1">Perubahan NISN otomatis disinkronkan ke akun login siswa.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">NIK</label>
                  <input
                    type="text"
                    value={editNik}
                    onChange={(e) => setEditNik(e.target.value)}
                    placeholder="3201264111080001"
                    maxLength={16}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal Lahir</label>
                  <input
                    type="date"
                    value={editTtl}
                    onChange={(e) => setEditTtl(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jenis Kelamin</label>
                  <select
                    value={editGender}
                    onChange={(e: any) => setEditGender(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="L">Laki-Laki</option>
                    <option value="P">Perempuan</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kontak Orang Tua</label>
                  <input
                    type="text"
                    value={editHp}
                    onChange={(e) => setEditHp(e.target.value)}
                    placeholder="081234567890"
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2 justify-end">
                <button
                  type="button"
                  onClick={() => { setEditingSiswa(null); setEditError(''); }}
                  className="px-4 py-2 bg-slate-200 hover:bg-slate-300 rounded-xl font-bold cursor-pointer transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {editSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {raporSiswa && (
        <RaporModal
          nisn={raporSiswa.nisn}
          name={raporSiswa.name}
          onClose={() => setRaporSiswa(null)}
        />
      )}

    </div>
  );
};
