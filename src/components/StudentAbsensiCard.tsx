/**
 * StudentAbsensiCard — UI sederhana untuk siswa.
 * Kartu hari ini + riwayat 14 hari + kehadiran kelas.
 */
import React, { useState, useEffect, useRef } from 'react';
import { PresensiRecord, PresensiStatus, PresensiLokasi, Siswa, User } from '../types';
import { uploadPhoto } from '../utils/photo';
import { getCurrentLocation, mapsUrl } from '../utils/geo';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Clock,
  Camera,
  MapPin,
  Navigation,
  Loader2,
  ImagePlus,
  Trash2,
  ExternalLink,
  UserCheck,
  Users,
  Calendar,
  X
} from 'lucide-react';

interface Props {
  presensiList: PresensiRecord[];
  setPresensiList: React.Dispatch<React.SetStateAction<PresensiRecord[]>>;
  siswaList: Siswa[];
  currentUser: User;
}

function isBeforeCutoff(): boolean {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.getUTCHours() < 8;
}

function formatTime(iso: string): string {
  try {
    return iso.replace('T', ' ').slice(0, 16);
  } catch {
    return iso;
  }
}

export const StudentAbsensiCard: React.FC<Props> = ({
  presensiList,
  setPresensiList,
  siswaList,
  currentUser
}) => {
  const today = new Date().toISOString().split('T')[0];
  const myNisn = currentUser.nipNisn || '';

  // Data siswa saya dari daftar siswa
  const mySiswa = siswaList.find(s => s.nisn === myNisn);
  const myClassId = currentUser.classId || mySiswa?.classId || '';

  // Record hari ini
  const myRecordToday = presensiList.find(
    p => p.tanggal === today && p.nisn === myNisn
  );

  // Riwayat 14 hari terakhir
  const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString().split('T')[0];
  const myHistory = presensiList
    .filter(p => p.nisn === myNisn && p.tanggal >= twoWeeksAgo && p.tanggal <= today)
    .sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  // Kehadiran kelas hari ini
  const classStudents = siswaList.filter(s => s.classId === myClassId);
  const classPresensi = presensiList.filter(
    p => p.tanggal === today && p.classId === myClassId
  );
  const classMap = new Map<string, { siswa: typeof classStudents[number]; record: PresensiRecord | undefined }>(classStudents.map(s => {
    const rec = classPresensi.find(p => p.siswaId === s.id);
    return [s.id, { siswa: s, record: rec }];
  }));

  // State modal input/edit
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState<PresensiStatus>(myRecordToday?.status || 'Hadir');
  const [note, setNote] = useState(myRecordToday?.keterangan || '');
  const [fotoFile, setFotoFile] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState(myRecordToday?.fotoUrl ? `${myRecordToday.fotoUrl}?link=1` : '');
  const [lokasi, setLokasi] = useState<PresensiLokasi | null>(myRecordToday?.lokasi || null);
  const [locStatus, setLocStatus] = useState<'idle' | 'loading' | 'error' | 'done'>('idle');
  const [locMsg, setLocMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const canEditNow = isBeforeCutoff();
  const hasRecord = !!myRecordToday;

  const openEdit = () => {
    setIsEditing(true);
    setStatus(myRecordToday?.status || 'Hadir');
    setNote(myRecordToday?.keterangan || '');
    setFotoFile(null);
    setFotoPreview(myRecordToday?.fotoUrl ? `${myRecordToday.fotoUrl}?link=1` : '');
    setLokasi(myRecordToday?.lokasi || null);
    setLocStatus('idle');
    setLocMsg('');
    setMsg(null);
  };

  const handleFotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFotoFile(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleLocate = async () => {
    setLocStatus('loading');
    setLocMsg('');
    try {
      const loc = await getCurrentLocation();
      setLokasi(loc);
      setLocStatus('done');
    } catch (err) {
      setLocStatus('error');
      setLocMsg(err instanceof Error ? err.message : 'Gagal mengambil lokasi.');
    }
  };

  const handleSave = async () => {
    if (!mySiswa) return;
    setSaving(true);
    setMsg(null);

    // Upload foto jika ada
    let newFotoUrl: string | undefined;
    if (fotoFile) {
      try {
        const url = await uploadPhoto(fotoFile);
        if (!url) throw new Error('Upload foto gagal.');
        newFotoUrl = url;
      } catch (err) {
        setSaving(false);
        setMsg({ type: 'error', text: err instanceof Error ? err.message : 'Upload foto gagal.' });
        return;
      }
    } else if (fotoPreview && myRecordToday?.fotoUrl) {
      newFotoUrl = myRecordToday.fotoUrl;
    }

    const now = new Date();
    const timeStr = now.toTimeString().split(' ')[0];

    setPresensiList(prev => {
      const existingIndex = prev.findIndex(p => p.tanggal === today && p.nisn === myNisn);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = {
          ...updated[existingIndex],
          status,
          keterangan: note,
          waktuInput: timeStr,
          fotoUrl: newFotoUrl !== undefined ? newFotoUrl : updated[existingIndex].fotoUrl,
          lokasi: lokasi || updated[existingIndex].lokasi
        };
        return updated;
      } else {
        return [{
          id: `p-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tanggal: today,
          classId: myClassId,
          siswaId: mySiswa.id,
          siswaName: mySiswa.name,
          nisn: myNisn,
          status,
          keterangan: note,
          waktuInput: timeStr,
          fotoUrl: newFotoUrl,
          lokasi: lokasi || undefined
        }, ...prev];
      }
    });

    setSaving(false);
    setIsEditing(false);
    setMsg({ type: 'success', text: 'Presensi berhasil disimpan!' });
  };

  const statusColor = (s: PresensiStatus) => {
    if (s === 'Hadir') return 'bg-emerald-100 text-emerald-700 border-emerald-200';
    if (s === 'Sakit') return 'bg-amber-100 text-amber-700 border-amber-200';
    if (s === 'Izin') return 'bg-blue-100 text-blue-700 border-blue-200';
    return 'bg-rose-100 text-rose-700 border-rose-200';
  };

  return (
    <div className="space-y-6">
      {/* Pesan sukses/error */}
      {msg && (
        <div className={`text-sm px-4 py-3 rounded-xl border ${msg.type === 'success' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
          {msg.text}
        </div>
      )}

      {/* KARTU HARI INI */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center">
            <UserCheck className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Kehadiran Hari Ini</h3>
            <p className="text-xs text-slate-500">{new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
          </div>
        </div>

        {myRecordToday ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1.5 rounded-lg text-sm font-bold border ${statusColor(myRecordToday.status)}`}>
                {myRecordToday.status}
              </span>
              <span className="text-xs text-slate-500">• {myRecordToday.waktuInput}</span>
            </div>

            {myRecordToday.fotoUrl && (
              <a href={`${myRecordToday.fotoUrl}?link=1`} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-emerald-600 hover:underline">
                Lihat Foto <ExternalLink className="w-3 h-3" />
              </a>
            )}

            {myRecordToday.lokasi && (
              <a href={mapsUrl(myRecordToday.lokasi.lat, myRecordToday.lokasi.lng)} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1 text-xs text-sky-600 hover:underline ml-2">
                <MapPin className="w-3 h-3" /> Lokasi
              </a>
            )}

            {canEditNow && (
              <button onClick={openEdit}
                className="mt-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors cursor-pointer">
                Edit Presensi
              </button>
            )}

            {!canEditNow && (
              <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg border border-amber-200">
                ⏰ Edit hanya bisa dilakukan sebelum jam 08:00 WIB
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {canEditNow ? (
              <>
                <p className="text-sm text-slate-600">Anda belum mengisi presensi hari ini.</p>
                <button onClick={openEdit}
                  className="px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold rounded-xl transition-colors cursor-pointer shadow-sm">
                  Isi Presensi Sekarang
                </button>
              </>
            ) : (
              <div className="text-center py-4">
                <Clock className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-500">Batas waktu input sudah lewat (jam 08:00 WIB)</p>
                <p className="text-xs text-slate-400 mt-1">Hubungi guru/admin jika perlu input presensi.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* MODAL INPUT/EDIT */}
      {isEditing && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h3 className="font-bold text-slate-900">{hasRecord ? 'Edit Presensi' : 'Input Presensi'}</h3>
              <button onClick={() => setIsEditing(false)} className="text-slate-400 hover:text-slate-700 cursor-pointer p-1 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-5">
              {/* Status */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Status</label>
                <div className="flex flex-wrap gap-2">
                  {(['Hadir', 'Sakit', 'Izin'] as PresensiStatus[]).map(st => {
                    const isSelected = status === st;
                    const map: Record<PresensiStatus, string> = {
                      Hadir: isSelected ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-slate-600 border-slate-200 hover:border-emerald-400',
                      Sakit: isSelected ? 'bg-amber-600 text-white border-amber-600' : 'bg-white text-slate-600 border-slate-200 hover:border-amber-400',
                      Izin: isSelected ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-600 border-slate-200 hover:border-blue-400',
                      Alpa: 'bg-white text-slate-300 border-slate-100 cursor-not-allowed'
                    };
                    return (
                      <button key={st} type="button"
                        onClick={() => setStatus(st)}
                        className={`px-5 py-2.5 rounded-xl border text-sm font-semibold transition-colors cursor-pointer ${map[st]}`}>
                        {st}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Foto */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Foto Presensi</label>
                {fotoPreview ? (
                  <div className="relative">
                    <img src={fotoPreview} alt="Preview" className="w-full max-h-48 object-cover rounded-xl border border-slate-200" />
                    <button type="button" onClick={() => { setFotoFile(null); setFotoPreview(''); }}
                      className="absolute top-2 right-2 w-8 h-8 rounded-lg bg-rose-600 text-white flex items-center justify-center shadow cursor-pointer hover:bg-rose-700">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 w-full h-28 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 cursor-pointer hover:border-emerald-400 hover:text-emerald-500 transition-colors">
                    <ImagePlus className="w-6 h-6" />
                    <span className="text-xs font-semibold">Ambil / Pilih Foto</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleFotoChange} className="hidden" />
                  </label>
                )}
              </div>

              {/* Lokasi */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Lokasi (Tap Location)</label>
                {lokasi && (
                  <div className="bg-sky-50 border border-sky-200 rounded-xl p-3 flex items-center justify-between mb-2">
                    <span className="text-xs font-mono text-sky-800">
                      <MapPin className="w-3 h-3 inline mr-1" />
                      {lokasi.lat.toFixed(5)}, {lokasi.lng.toFixed(5)}
                    </span>
                    <a href={mapsUrl(lokasi.lat, lokasi.lng)} target="_blank" rel="noreferrer"
                      className="text-xs text-sky-600 hover:underline flex items-center gap-1 font-semibold">
                      Maps <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                )}
                <button type="button" onClick={handleLocate} disabled={locStatus === 'loading'}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-slate-900 text-white text-sm font-semibold cursor-pointer hover:bg-slate-800 disabled:opacity-60 disabled:cursor-not-allowed">
                  {locStatus === 'loading' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Navigation className="w-4 h-4" />}
                  {locStatus === 'loading' ? 'Mendeteksi...' : (lokasi ? 'Perbarui Lokasi' : 'Deteksi Lokasi')}
                </button>
                {locStatus === 'error' && <p className="text-xs text-rose-600 mt-1">{locMsg}</p>}
              </div>

              {/* Catatan */}
              <div>
                <label className="text-xs font-bold text-slate-600 uppercase tracking-wide mb-2 block">Keterangan</label>
                <textarea value={note} onChange={e => setNote(e.target.value)} rows={2}
                  placeholder="Catatan (opsional)..."
                  className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white resize-none" />
              </div>

              {/* Simpan */}
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setIsEditing(false)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-slate-100 text-slate-700 text-sm font-semibold cursor-pointer hover:bg-slate-200 transition-colors">
                  Batal
                </button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-sm font-semibold cursor-pointer hover:bg-emerald-700 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Simpan
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* RIWAYAT SAYA (14 hari) */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-900">Riwayat Saya (14 Hari)</h3>
        </div>
        {myHistory.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Belum ada riwayat.</p>
        ) : (
          <div className="space-y-2">
            {myHistory.map(rec => (
              <div key={`${rec.tanggal}-${rec.siswaId}`} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                <span className="text-xs text-slate-500 font-mono w-20">{rec.tanggal}</span>
                <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor(rec.status)}`}>{rec.status}</span>
                {rec.fotoUrl && (
                  <a href={`${rec.fotoUrl}?link=1`} target="_blank" rel="noreferrer" className="text-emerald-500 hover:text-emerald-700">
                    <Camera className="w-3.5 h-3.5" />
                  </a>
                )}
                {rec.lokasi && (
                  <a href={mapsUrl(rec.lokasi.lat, rec.lokasi.lng)} target="_blank" rel="noreferrer" className="text-sky-500 hover:text-sky-700">
                    <MapPin className="w-3.5 h-3.5" />
                  </a>
                )}
                <span className="text-xs text-slate-400 ml-auto">{rec.waktuInput}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* KEHADIRAN KELAS HARI INI */}
      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Users className="w-5 h-5 text-slate-500" />
          <h3 className="font-bold text-slate-900">Kehadiran Kelas Hari Ini</h3>
        </div>
        {classStudents.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-4">Tidak ada data kelas.</p>
        ) : (
          <div className="space-y-2">
            {classStudents.map(s => {
              const entry = classMap.get(s.id);
              const rec = entry?.record;
              return (
                <div key={s.id} className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                  <img src={s.foto} alt={s.name} className="w-8 h-8 rounded-full object-cover border border-slate-200" />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold text-slate-800 truncate block">{s.name}</span>
                    <span className="text-xs text-slate-400 font-mono">{s.nisn}</span>
                  </div>
                  {rec ? (
                    <span className={`px-2 py-0.5 rounded text-xs font-bold ${statusColor(rec.status)}`}>{rec.status}</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded text-xs font-bold bg-slate-100 text-slate-400">-</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};