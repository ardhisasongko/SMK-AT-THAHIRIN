import React, { useState } from 'react';
import { SCHOOL_INFO } from '../data/initialData';
import { 
  User as UserIcon, 
  Calendar, 
  UserCheck, 
  BookOpen, 
  Users, 
  Settings, 
  ShieldCheck, 
  Mail, 
  Phone, 
  MapPin, 
  Clock, 
  FileText, 
  Download, 
  Search, 
  Plus, 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  HelpCircle,
  Database,
  BarChart3,
  Edit,
  Sparkles,
  Award
} from 'lucide-react';
import { User, Kelas, Siswa, PresensiRecord, ModulAjar } from '../types';

interface ProfilSectionProps {
  currentUser: User | null;
  kelasList: Kelas[];
  siswaList: Siswa[];
  presensiList: PresensiRecord[];
  modulList: ModulAjar[];
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
}

export const ProfilSection: React.FC<ProfilSectionProps> = ({
  currentUser,
  kelasList,
  siswaList,
  presensiList,
  modulList,
  setActiveTab,
  onOpenLogin
}) => {
  // Active inner profile sub-tab
  const [activeSubTab, setActiveSubTab] = useState<string>('pribadi');

  // Search filter for Admin user list
  const [userSearchQuery, setUserSearchQuery] = useState<string>('');
  const [userRoleFilter, setUserRoleFilter] = useState<string>('all');

  // Edit Personal Info Modal Simulator
  const [showEditModal, setShowEditModal] = useState<boolean>(false);
  const [editName, setEditName] = useState<string>(currentUser?.name || '');
  const [editEmail, setEditEmail] = useState<string>(currentUser?.email || '');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>('');

  if (!currentUser) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto text-slate-400">
          <UserIcon className="w-8 h-8" />
        </div>
        <h2 className="text-xl font-extrabold text-slate-800">
          Anda Belum Masuk ke Portal Akun
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Silakan masuk terlebih dahulu untuk mengakses halaman profil personal, melihat jadwal pelajaran, riwayat absensi, atau akses pengelolaan sistem.
        </p>
        <button
          onClick={onOpenLogin}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-2.5 rounded-xl shadow-md text-xs cursor-pointer"
        >
          Masuk Portal Akun
        </button>
      </div>
    );
  }

  const role = currentUser.role;

  // Derive Student Data if user is Siswa
  const studentData = siswaList.find(s => s.name === currentUser.name || s.nisn === currentUser.nipNisn) || siswaList[0];
  const studentClass = kelasList.find(k => k.id === currentUser.classId || k.id === studentData?.classId) || kelasList[0];
  const studentPresensiHistory = presensiList.filter(p => p.siswaName === currentUser.name || p.nisn === currentUser.nipNisn || p.siswaId === studentData?.id);

  // Stats calculation for Student Presensi
  const totalPresensiCount = studentPresensiHistory.length || 1;
  const hadirCount = studentPresensiHistory.filter(p => p.status === 'Hadir').length;
  const sakitCount = studentPresensiHistory.filter(p => p.status === 'Sakit').length;
  const izinCount = studentPresensiHistory.filter(p => p.status === 'Izin').length;
  const alpaCount = studentPresensiHistory.filter(p => p.status === 'Alpa').length;
  const hadirPercent = ((hadirCount / totalPresensiCount) * 100).toFixed(1);

  // Derive Teacher Data if user is Guru
  const teacherClasses = kelasList.filter(k => k.waliKelas.includes(currentUser.name) || k.jadwal.some(j => j.guru.includes(currentUser.name)));
  const teacherModuls = modulList.filter(m => m.pembuat.includes(currentUser.name) || m.pembuat.includes('Ahmad Fauzi'));

  // Save profile changes handler
  const handleSaveProfile = (e: React.FormEvent) => {
    e.preventDefault();
    currentUser.name = editName;
    currentUser.email = editEmail;
    setSaveSuccessMsg('Informasi profil berhasil diperbarui!');
    setTimeout(() => setSaveSuccessMsg(''), 3000);
    setShowEditModal(false);
  };

  return (
    <div id="profil-section" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Top Main Profile Card Banner */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sm:p-8 space-y-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-r from-slate-900 via-emerald-950 to-slate-900"></div>

        <div className="relative pt-8 flex flex-col sm:flex-row items-start sm:items-end justify-between gap-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-end gap-5 text-center sm:text-left w-full sm:w-auto">
            <div className="relative">
              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                className="w-24 h-24 rounded-2xl object-cover border-4 border-white shadow-lg bg-white"
              />
              <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white ${
                role === 'admin' ? 'bg-purple-500' : role === 'guru' ? 'bg-blue-500' : 'bg-emerald-500'
              }`}></span>
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900">
                  {currentUser.name}
                </h1>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold capitalize ${
                  role === 'admin' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                  role === 'guru' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                  'bg-emerald-100 text-emerald-800 border border-emerald-200'
                }`}>
                  {role === 'admin' ? 'Administrator TU' : role === 'guru' ? 'Tenaga Pendidik / Guru' : 'Siswa Active'}
                </span>
              </div>

              <div className="text-xs text-slate-500 font-medium flex flex-wrap items-center justify-center sm:justify-start gap-3">
                <span>NIP/NISN: <strong className="text-slate-700">{currentUser.nipNisn || '0068123491'}</strong></span>
                <span>•</span>
                <span>{currentUser.jabatan || (role === 'siswa' ? `Siswa ${studentClass?.name}` : 'Guru Produktif')}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto justify-center sm:justify-end">
            <button
              id="edit-profile-btn"
              onClick={() => {
                setEditName(currentUser.name);
                setEditEmail(currentUser.email);
                setShowEditModal(true);
              }}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition-colors cursor-pointer"
            >
              <Edit className="w-3.5 h-3.5 text-slate-500" />
              <span>Edit Informasi</span>
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold p-3 rounded-xl flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Sub-Tabs Navigation Customized per Role */}
        <div className="border-t border-slate-100 pt-4 flex flex-wrap items-center gap-2">
          
          {/* Universal Personal Info Tab */}
          <button
            id="tab-profile-pribadi"
            onClick={() => setActiveSubTab('pribadi')}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeSubTab === 'pribadi'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
            }`}
          >
            <UserIcon className="w-4 h-4" />
            <span>Informasi Pribadi</span>
          </button>

          {/* Role: SISWA Specific Tabs */}
          {role === 'siswa' && (
            <>
              <button
                id="tab-profile-jadwal-siswa"
                onClick={() => setActiveSubTab('jadwal')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'jadwal'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Calendar className="w-4 h-4" />
                <span>Jadwal Pelajaran Saya</span>
              </button>

              <button
                id="tab-profile-absensi-siswa"
                onClick={() => setActiveSubTab('absensi')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'absensi'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <UserCheck className="w-4 h-4" />
                <span>Riwayat Absensi Saya</span>
              </button>
            </>
          )}

          {/* Role: GURU Specific Tabs */}
          {role === 'guru' && (
            <>
              <button
                id="tab-profile-kelas-guru"
                onClick={() => setActiveSubTab('kelas-diajar')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'kelas-diajar'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Daftar Kelas Yang Diajar</span>
              </button>

              <button
                id="tab-profile-modul-guru"
                onClick={() => setActiveSubTab('modul-dibuat')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'modul-dibuat'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Modul Ajar Yang Dibuat</span>
              </button>
            </>
          )}

          {/* Role: ADMIN Specific Tabs */}
          {role === 'admin' && (
            <>
              <button
                id="tab-profile-semua-pengguna"
                onClick={() => setActiveSubTab('semua-pengguna')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'semua-pengguna'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Users className="w-4 h-4" />
                <span>Kelola Semua Pengguna</span>
              </button>

              <button
                id="tab-profile-pengelolaan-sistem"
                onClick={() => setActiveSubTab('sistem')}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  activeSubTab === 'sistem'
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'bg-slate-50 hover:bg-slate-100 text-slate-600'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Akses Pengelolaan Sistem</span>
              </button>
            </>
          )}

        </div>

      </div>

      {/* SUB-TAB CONTENT DISPLAY */}

      {/* 1. INFORMASI PRIBADI (UNIVERSAL) */}
      {activeSubTab === 'pribadi' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <UserIcon className="w-4 h-4 text-emerald-600" />
              <span>Detail Data Diri</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Nama Lengkap</span>
                <span className="font-bold text-slate-800">{currentUser.name}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Email Utama</span>
                <span className="font-bold text-slate-800">{currentUser.email}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Nomor Induk ({role === 'siswa' ? 'NISN' : 'NIP'})</span>
                <span className="font-mono font-bold text-slate-800">{currentUser.nipNisn || '19890215 201502 1 003'}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-50">
                <span className="text-slate-500">Jabatan / Role</span>
                <span className="font-bold text-emerald-700 capitalize">{currentUser.jabatan || currentUser.role}</span>
              </div>
              {role === 'siswa' && (
                <div className="flex justify-between py-1 border-b border-slate-50">
                  <span className="text-slate-500">Kelas Aktif</span>
                  <span className="font-bold text-slate-800">{studentClass?.name || 'X RPL 1'}</span>
                </div>
              )}
              <div className="flex justify-between py-1">
                <span className="text-slate-500">Status Keaktifan</span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Aktif Terdaftar</span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-blue-600" />
              <span>Instansi & Keamanan Akun</span>
            </h3>

            <div className="space-y-3 text-xs">
              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <MapPin className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">{SCHOOL_INFO.name}</div>
                  <div className="text-[11px] text-slate-500">{SCHOOL_INFO.alamat}</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-xl">
                <Phone className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-slate-800">Kontak Darurat / Wali</div>
                  <div className="text-[11px] text-slate-500">{studentData?.noHpOrangTua || '(021) 7752091'}</div>
                </div>
              </div>

              <div className="p-3 bg-emerald-50/80 border border-emerald-200 rounded-xl text-emerald-900 space-y-1">
                <div className="font-bold flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  <span>Sistem Otentikasi Terintegrasi</span>
                </div>
                <p className="text-[11px] text-emerald-800">
                  Akun Anda terhubung dengan Google Workspace / Sistem Dapodik Sekolah.
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* 2. SISWA - JADWAL PELAJARAN SAYA */}
      {role === 'siswa' && activeSubTab === 'jadwal' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-emerald-600" />
                <span>Jadwal Pelajaran Kelas {studentClass?.name || 'X RPL 1'}</span>
              </h2>
              <p className="text-xs text-slate-500">
                Wali Kelas: {studentClass?.waliKelas} | Ruang: {studentClass?.ruang}
              </p>
            </div>

            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-3 py-1.5 rounded-lg text-xs transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Cetak Jadwal</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3 rounded-tl-xl">Hari</th>
                  <th className="p-3">Jam Ke</th>
                  <th className="p-3">Waktu</th>
                  <th className="p-3">Mata Pelajaran</th>
                  <th className="p-3">Guru Pengampu</th>
                  <th className="p-3 rounded-tr-xl">Ruangan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {(studentClass?.jadwal || []).map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="p-3 font-bold text-slate-900">{item.hari}</td>
                    <td className="p-3 text-slate-500">{item.jamKe}</td>
                    <td className="p-3 text-emerald-700 font-semibold">{item.jamRentan}</td>
                    <td className="p-3 font-bold text-slate-900">{item.mataPelajaran}</td>
                    <td className="p-3 text-slate-600">{item.guru}</td>
                    <td className="p-3">
                      <span className="bg-slate-100 border border-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono text-[10px]">
                        {item.ruangan}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. SISWA - RIWAYAT ABSENSI SAYA */}
      {role === 'siswa' && activeSubTab === 'absensi' && (
        <div className="space-y-6">
          
          {/* Summary Metric Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            <div className="bg-emerald-600 text-white rounded-xl p-4 shadow-sm">
              <div className="text-[11px] font-bold text-emerald-100 uppercase">Persentase Kehadiran</div>
              <div className="text-2xl font-extrabold mt-1">{hadirPercent}%</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Hadir</div>
              <div className="text-2xl font-extrabold text-emerald-600 mt-1">{hadirCount}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Sakit</div>
              <div className="text-2xl font-extrabold text-amber-600 mt-1">{sakitCount}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Izin</div>
              <div className="text-2xl font-extrabold text-blue-600 mt-1">{izinCount}</div>
            </div>

            <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-2xs">
              <div className="text-[11px] font-bold text-slate-500 uppercase">Total Alpa</div>
              <div className="text-2xl font-extrabold text-rose-600 mt-1">{alpaCount}</div>
            </div>
          </div>

          {/* Detailed Attendance History Table */}
          <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 border-b border-slate-100 pb-3">
              <UserCheck className="w-4 h-4 text-emerald-600" />
              <span>Log Riwayat Kehadiran Terperinci</span>
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                    <th className="p-3">Tanggal</th>
                    <th className="p-3">Jam Absen</th>
                    <th className="p-3">Status Kehadiran</th>
                    <th className="p-3">Keterangan Catatan</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {studentPresensiHistory.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400 italic">
                        Belum ada riwayat presensi tercatat untuk akun ini.
                      </td>
                    </tr>
                  ) : (
                    studentPresensiHistory.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/80">
                        <td className="p-3 font-bold text-slate-900">{p.tanggal}</td>
                        <td className="p-3 font-mono text-slate-500">{p.waktuInput}</td>
                        <td className="p-3">
                          <span className={`px-2.5 py-1 rounded-full font-bold text-[10px] ${
                            p.status === 'Hadir' ? 'bg-emerald-100 text-emerald-800' :
                            p.status === 'Sakit' ? 'bg-amber-100 text-amber-800' :
                            p.status === 'Izin' ? 'bg-blue-100 text-blue-800' :
                            'bg-rose-100 text-rose-800'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600">{p.keterangan || '-'}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* 4. GURU - DAFTAR KELAS YANG DIAJAR */}
      {role === 'guru' && activeSubTab === 'kelas-diajar' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              <span>Daftar Kelas Pengampuan & Wali Kelas</span>
            </h2>
            <span className="text-xs text-slate-500 font-bold">Total {teacherClasses.length} Kelas</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {teacherClasses.map((k) => (
              <div key={k.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs hover:shadow-md transition-all space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-lg font-extrabold text-slate-900">{k.name}</h3>
                    <p className="text-xs text-slate-500">{k.ruang}</p>
                  </div>
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-3 py-1 rounded-full">
                    {k.jumlahSiswa} Siswa
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between text-slate-600">
                    <span>Wali Kelas:</span>
                    <strong className="text-slate-900">{k.waliKelas}</strong>
                  </div>
                  <div className="flex justify-between text-slate-600">
                    <span>Konsentrasi Jurusan:</span>
                    <strong className="text-blue-700">{k.jurusanCode}</strong>
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={() => setActiveTab('absensi')}
                    className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-3.5 py-1.5 rounded-lg text-xs cursor-pointer transition-colors"
                  >
                    Buka Absensi Kelas
                  </button>
                  <button
                    onClick={() => setActiveTab('forum')}
                    className="text-xs font-bold text-blue-600 hover:underline cursor-pointer"
                  >
                    Forum Kelas →
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. GURU - MODUL AJAR YANG DIBUAT */}
      {role === 'guru' && activeSubTab === 'modul-dibuat' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-3">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-blue-600" />
                <span>Modul Ajar Kurikulum Merdeka Tergenerasi</span>
              </h2>
              <p className="text-xs text-slate-500">Daftar perangkat ajar AI yang telah Anda terbitkan</p>
            </div>

            <button
              onClick={() => setActiveTab('modul-ajar')}
              className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-bold px-4 py-2 rounded-xl text-xs shadow-md transition-colors cursor-pointer self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Modul Ajar AI Baru</span>
            </button>
          </div>

          <div className="space-y-4">
            {teacherModuls.map((m) => (
              <div key={m.id} className="bg-white rounded-2xl border border-slate-200 p-5 shadow-2xs hover:shadow-md transition-all space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    {m.faseKelas}
                  </span>
                  <span className="text-[11px] text-slate-400 font-medium">Dibuat: {m.tanggalDibuat}</span>
                </div>

                <h3 className="text-sm font-extrabold text-slate-900">{m.judul}</h3>

                <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600 pt-2 border-t border-slate-100">
                  <div>Mata Pelajaran: <strong>{m.mataPelajaran}</strong></div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setActiveTab('modul-ajar')}
                      className="bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold px-3 py-1 rounded-lg text-xs cursor-pointer"
                    >
                      Buka Modul
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. ADMIN - PENGELOLAAN SEMUA PENGGUNA */}
      {role === 'admin' && activeSubTab === 'semua-pengguna' && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-600" />
                <span>Pengelolaan Semua Pengguna Sistem</span>
              </h2>
              <p className="text-xs text-slate-500">Daftar akun Siswa, Dewan Guru, dan Administrator sekolah</p>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg p-2 text-xs font-bold text-slate-700 outline-none"
              >
                <option value="all">Semua Peran (Role)</option>
                <option value="siswa">Siswa</option>
                <option value="guru">Guru</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* User List Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-900 text-white font-bold">
                  <th className="p-3 rounded-tl-xl">Pengguna</th>
                  <th className="p-3">Role</th>
                  <th className="p-3">Email Akun</th>
                  <th className="p-3">NIP / NISN</th>
                  <th className="p-3 rounded-tr-xl">Aksi Akses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {siswaList
                  .filter(s => userRoleFilter === 'all' || userRoleFilter === 'siswa')
                  .map(s => (
                    <tr key={s.id} className="hover:bg-slate-50">
                      <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                        <img src={s.foto} alt={s.name} className="w-7 h-7 rounded-full object-cover" />
                        <span>{s.name}</span>
                      </td>
                      <td className="p-3">
                        <span className="bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full text-[10px]">Siswa</span>
                      </td>
                      <td className="p-3 text-slate-500">{s.name.toLowerCase().replace(/\s+/g, '')}@smksplusatthahirin.sch.id</td>
                      <td className="p-3 font-mono">{s.nisn}</td>
                      <td className="p-3">
                        <button 
                          onClick={() => alert(`Sistem Admin: Reset kata sandi akun ${s.name} telah dikirim ke email!`)}
                          className="text-purple-600 hover:underline font-bold text-[11px] cursor-pointer"
                        >
                          Reset Akses
                        </button>
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 7. ADMIN - AKSES PENGELOLAAN SISTEM */}
      {role === 'admin' && activeSubTab === 'sistem' && (
        <div className="space-y-6">
          <div className="bg-gradient-to-r from-purple-900 via-slate-900 to-slate-900 text-white p-6 rounded-2xl shadow-lg space-y-2">
            <h2 className="text-lg font-extrabold flex items-center gap-2">
              <Settings className="w-5 h-5 text-purple-400" />
              <span>Akses Pengelolaan & Integrasi Sistem Sekolah</span>
            </h2>
            <p className="text-xs text-slate-300">
              Panel kendali admin untuk mengunduh laporan rekapitulasi, mengelola database, dan memantau kesehatan server.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-xs">
              <div className="p-3 bg-blue-50 text-blue-600 rounded-xl w-fit">
                <Database className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Rekapitulasi Data Absensi</h3>
              <p className="text-xs text-slate-500">Ekspor rekapitulasi kehadiran mingguan & bulanan dalam format CSV / Excel.</p>
              <button 
                onClick={() => alert('Mengunduh Laporan Rekapitulasi Presensi Sekolah (CSV)...')}
                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl text-xs w-full transition-colors cursor-pointer"
              >
                Unduh Rekap CSV
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-xs">
              <div className="p-3 bg-purple-50 text-purple-600 rounded-xl w-fit">
                <BarChart3 className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Backup Data Sistem</h3>
              <p className="text-xs text-slate-500">Simpan cadangan data jadwal, siswa, dan modul ajar ke penyimpanan terenkripsi.</p>
              <button 
                onClick={() => alert('Berhasil membuat cadangan database sistem!')}
                className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-2 px-4 rounded-xl text-xs w-full transition-colors cursor-pointer"
              >
                Jalankan Backup
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-3 shadow-xs">
              <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl w-fit">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-slate-900">Audit Keamanan Server</h3>
              <p className="text-xs text-slate-500">Periksa status keamanan SSL, izin pengguna, dan aktivitas log terkini.</p>
              <button 
                onClick={() => alert('Status Server: Normal (0 Ancaman Terdeteksi)')}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 px-4 rounded-xl text-xs w-full transition-colors cursor-pointer"
              >
                Cek Log Keamanan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* EDIT PROFILE MODAL */}
      {showEditModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl border border-slate-200">
            <h3 className="text-base font-bold text-slate-900">Edit Profil Saya</h3>
            <form onSubmit={handleSaveProfile} className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alamat Email</label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-100 font-bold"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-1.5 rounded-lg"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
