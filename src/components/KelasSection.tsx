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
  Loader2
} from 'lucide-react';

interface KelasSectionProps {
  kelasList: Kelas[];
  setKelasList: React.Dispatch<React.SetStateAction<Kelas[]>>;
  siswaList: Siswa[];
  setSiswaList: React.Dispatch<React.SetStateAction<Siswa[]>>;
  currentUser: User | null;
}

export const KelasSection: React.FC<KelasSectionProps> = ({
  kelasList,
  setKelasList,
  siswaList,
  setSiswaList,
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

  // ===== Kelola Ketua Kelas (admin) =====
  const isAdmin = currentUser?.role === 'admin';
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
      const json = await res.json() as { success?: boolean; error?: string; data?: { id: string; name: string } };
      if (res.ok && json.success) {
        setKetuaMsg({ type: 'success', text: `✅ ${json.data?.name} ditetapkan sebagai Ketua Kelas.` });
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
  const handleAddSiswaSubmit = (e: React.FormEvent) => {
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

    const createdSiswa: Siswa = {
      id: 's-' + Date.now(),
      nisn: newSiswaNisn.trim(),
      name: newSiswaName.trim(),
      classId: selectedKelas.id,
      gender: newSiswaGender,
      foto: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
      noHpOrangTua: '0812' + Math.floor(10000000 + Math.random() * 90000000)
    };

    setSiswaList([...siswaList, createdSiswa]);
    
    // Update count
    setKelasList(prev => prev.map(k => k.id === selectedKelas.id ? { ...k, jumlahSiswa: k.jumlahSiswa + 1 } : k));

    setShowAddSiswaModal(false);
    setNewSiswaName('');
    setNewSiswaNisn('');
    setSiswaFormError('');
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
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-4">
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

                    <div className="flex flex-wrap items-center gap-2">
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
                            className="px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold cursor-pointer"
                          >
                            <option value="">Pilih siswa...</option>
                            {classSiswa.map(s => (
                              <option key={s.id} value={s.id}>{s.name} ({s.nisn})</option>
                            ))}
                          </select>
                          <button
                            onClick={() => handleAppointKetua(k.id)}
                            disabled={ketuaLoading || !ketuaAssign[k.id]}
                            className="flex items-center gap-1.5 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-2 rounded-xl transition-colors cursor-pointer disabled:opacity-50"
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
            
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-0.5 rounded-md">
                  {selectedKelas.jurusanCode}
                </span>
                <h3 className="text-2xl font-extrabold text-slate-900 mt-1">{selectedKelas.name}</h3>
                <p className="text-xs text-slate-500">Wali Kelas: {selectedKelas.waliKelas} • Ruang: {selectedKelas.ruang}</p>
              </div>
              <button 
                onClick={() => setSelectedKelas(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            {/* Sub Tabs Inside Detail Modal */}
            <div className="flex items-center justify-between border-b border-slate-200">
              <div className="flex gap-4">
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
                        <div className="text-[10px] text-slate-400">Kontak OrangTua: {siswa.noHpOrangTua || '-'}</div>
                      </div>
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
                      <div key={idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                        <div className="space-y-1">
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

    </div>
  );
};
