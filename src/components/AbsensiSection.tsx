import React, { useState } from 'react';
import { PresensiRecord, PresensiStatus, Kelas, Siswa, User } from '../types';
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
  FileText
} from 'lucide-react';

interface AbsensiSectionProps {
  presensiList: PresensiRecord[];
  setPresensiList: React.Dispatch<React.SetStateAction<PresensiRecord[]>>;
  kelasList: Kelas[];
  siswaList: Siswa[];
  currentUser: User | null;
}

export const AbsensiSection: React.FC<AbsensiSectionProps> = ({
  presensiList,
  setPresensiList,
  kelasList,
  siswaList,
  currentUser
}) => {
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [selectedClassId, setSelectedClassId] = useState<string>(kelasList[0]?.id || 'k1');
  const [activeTabMode, setActiveTabMode] = useState<'harian' | 'qr-scanner' | 'rekap'>('harian');

  // QR Simulator state
  const [qrNisnInput, setQrNisnInput] = useState<string>('');
  const [scanMessage, setScanMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Filtered Siswa for selected class
  const classSiswa = siswaList.filter(s => s.classId === selectedClassId);
  const selectedKelasInfo = kelasList.find(k => k.id === selectedClassId);

  // Get presensi records for selected Date and Class
  const classPresensi = presensiList.filter(
    p => p.tanggal === selectedDate && p.classId === selectedClassId
  );

  // Stats calculation
  const totalSiswaSelectedClass = classSiswa.length;
  const countHadir = classPresensi.filter(p => p.status === 'Hadir').length;
  const countSakit = classPresensi.filter(p => p.status === 'Sakit').length;
  const countIzin = classPresensi.filter(p => p.status === 'Izin').length;
  const countAlpa = classPresensi.filter(p => p.status === 'Alpa').length;
  const totalInputed = countHadir + countSakit + countIzin + countAlpa;

  // Handler to update or create presensi record
  const handleUpdateStatus = (siswa: Siswa, newStatus: PresensiStatus, note?: string) => {
    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    setPresensiList(prev => {
      const existingIndex = prev.findIndex(
        p => p.tanggal === selectedDate && p.siswaId === siswa.id
      );

      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          status: newStatus,
          keterangan: note !== undefined ? note : updated[existingIndex].keterangan,
          waktuInput: timeStr
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
          waktuInput: timeStr
        };
        return [newRecord, ...prev];
      }
    });
  };

  // QR Scan Handler
  const handleQrScanSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!qrNisnInput.trim()) return;

    const matchedSiswa = siswaList.find(s => s.nisn === qrNisnInput.trim() || s.id === qrNisnInput.trim());

    if (matchedSiswa) {
      handleUpdateStatus(matchedSiswa, 'Hadir');
      setScanMessage({
        type: 'success',
        text: `Presensi BERHASIL! ${matchedSiswa.name} (NISN: ${matchedSiswa.nisn}) dicatat HADIR pukul ${new Date().toLocaleTimeString('id-ID')}`
      });
      setQrNisnInput('');
    } else {
      setScanMessage({
        type: 'error',
        text: `NISN "${qrNisnInput}" tidak ditemukan dalam database siswa SMK AT-THAHIRIN.`
      });
    }

    setTimeout(() => {
      setScanMessage(null);
    }, 4000);
  };

  // Quick mark all present
  const handleMarkAllHadir = () => {
    classSiswa.forEach(siswa => {
      handleUpdateStatus(siswa, 'Hadir');
    });
  };

  return (
    <div id="absensi-module" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Header Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-2">
            <UserCheck className="w-3.5 h-3.5" />
            <span>Sistem Pengelolaan Absensi Vokasi</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Presensi & Kehadiran Siswa SMK AT-THAHIRIN
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Catat presensi harian per kelas, scan QR Kartu Pelajar, serta pantau persentase kehadiran real-time.
          </p>
        </div>

        {/* Tab Buttons */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
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
        </div>
      </div>

      {/* STATS OVERVIEW CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-1">
          <div className="text-xs font-semibold text-slate-500">Siswa di Kelas ini</div>
          <div className="text-2xl font-extrabold text-slate-900">{totalSiswaSelectedClass} <span className="text-xs font-normal text-slate-400">siswa</span></div>
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

      {/* MODE 1: PRESENSI HARIAN MANUALL CHECKLIST */}
      {activeTabMode === 'harian' && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs overflow-hidden space-y-6 p-6">
          
          {/* Controls Bar: Select Date & Class */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-slate-100">
            <div className="flex flex-wrap items-center gap-4">
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

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilih Kelas:</label>
                <select
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  className="px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                >
                  {kelasList.map(k => (
                    <option key={k.id} value={k.id}>
                      {k.name} — Wali Kelas: {k.waliKelas}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                onClick={handleMarkAllHadir}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2.5 rounded-xl shadow-xs transition-colors cursor-pointer flex items-center gap-1.5"
              >
                <Check className="w-4 h-4" />
                <span>Tandai Semua Hadir</span>
              </button>
            </div>
          </div>

          {/* Student Roster Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 text-xs uppercase font-bold tracking-wider border-b border-slate-200">
                  <th className="py-3 px-4">No</th>
                  <th className="py-3 px-4">Siswa</th>
                  <th className="py-3 px-4">NISN</th>
                  <th className="py-3 px-4 text-center">Status Presensi</th>
                  <th className="py-3 px-4">Keterangan / Catatan</th>
                  <th className="py-3 px-4 text-right">Waktu Input</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-sm">
                {classSiswa.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-400">
                      Tidak ada data siswa untuk kelas yang dipilih.
                    </td>
                  </tr>
                ) : (
                  classSiswa.map((siswa, idx) => {
                    const record = classPresensi.find(p => p.siswaId === siswa.id);
                    const currentStatus = record?.status || 'Hadir';

                    return (
                      <tr key={siswa.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-3 px-4 text-xs font-semibold text-slate-400">{idx + 1}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-3">
                            <img src={siswa.foto} alt={siswa.name} className="w-9 h-9 rounded-full object-cover border border-slate-200" />
                            <div>
                              <div className="font-bold text-slate-900 text-sm">{siswa.name}</div>
                              <div className="text-[11px] text-slate-400">Gender: {siswa.gender === 'L' ? 'Laki-Laki' : 'Perempuan'}</div>
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 text-xs font-mono font-semibold text-slate-600">{siswa.nisn}</td>
                        <td className="py-3 px-4">
                          <div className="flex items-center justify-center gap-1.5">
                            {(['Hadir', 'Sakit', 'Izin', 'Alpa'] as PresensiStatus[]).map(st => {
                              const isSelected = currentStatus === st;
                              let activeClass = '';
                              if (st === 'Hadir') activeClass = isSelected ? 'bg-emerald-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-emerald-100';
                              if (st === 'Sakit') activeClass = isSelected ? 'bg-amber-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-amber-100';
                              if (st === 'Izin') activeClass = isSelected ? 'bg-blue-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-blue-100';
                              if (st === 'Alpa') activeClass = isSelected ? 'bg-rose-600 text-white font-bold shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-rose-100';

                              return (
                                <button
                                  key={st}
                                  onClick={() => handleUpdateStatus(siswa, st)}
                                  className={`px-3 py-1.5 rounded-lg text-xs transition-all cursor-pointer ${activeClass}`}
                                >
                                  {st}
                                </button>
                              );
                            })}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <input 
                            type="text"
                            defaultValue={record?.keterangan || ''}
                            placeholder="Catatan..."
                            onBlur={(e) => handleUpdateStatus(siswa, currentStatus, e.target.value)}
                            className="w-full text-xs px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:outline-none focus:bg-white focus:ring-1 focus:ring-emerald-500"
                          />
                        </td>
                        <td className="py-3 px-4 text-right text-xs font-mono text-slate-500">
                          {record?.waktuInput || '-'}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

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
                  onClick={() => {
                    setQrNisnInput(s.nisn);
                    handleQrScanSubmit();
                  }}
                  className="bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-800 border border-slate-200 text-xs px-2.5 py-1.5 rounded-lg font-mono font-medium transition-all cursor-pointer flex items-center gap-1.5"
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
              onChange={(e) => setQrNisnInput(e.target.value)}
              placeholder="Masukkan NISN atau Scan QR..."
              className="flex-1 px-4 py-3 bg-slate-50 border border-slate-300 rounded-xl text-sm font-mono text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <button
              type="submit"
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl shadow-md cursor-pointer text-sm"
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
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pb-4 border-b border-slate-100">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Rekap Laporan Kehadiran Siswa</h3>
              <p className="text-xs text-slate-500">SMK AT-THAHIRIN DEPOK — Semester Ganjil 2026/2027</p>
            </div>
            
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 bg-slate-900 text-white font-bold text-xs px-4 py-2.5 rounded-xl hover:bg-slate-800 cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Laporan / PDF</span>
            </button>
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
                {siswaList.map(siswa => {
                  const sRecords = presensiList.filter(p => p.siswaId === siswa.id);
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
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};
