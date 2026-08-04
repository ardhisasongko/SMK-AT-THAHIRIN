import React, { useState } from 'react';
import { ModulAjar, ModulAjarData, User } from '../types';
import { SCHOOL_INFO } from '../data/initialData';
import { 
  BookOpen, 
  Sparkles, 
  Printer, 
  Download, 
  Search, 
  Check, 
  Plus, 
  Eye, 
  FileText, 
  School, 
  Loader2,
  Calendar,
  Layers,
  Award,
  ChevronRight,
  ArrowLeft,
  Copy,
  Trash2
} from 'lucide-react';

interface ModulAjarSectionProps {
  modulList: ModulAjar[];
  setModulList: React.Dispatch<React.SetStateAction<ModulAjar[]>>;
  currentUser: User | null;
}

export const ModulAjarSection: React.FC<ModulAjarSectionProps> = ({
  modulList,
  setModulList,
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<'generator' | 'koleksi'>('generator');
  const [selectedModul, setSelectedModul] = useState<ModulAjar | null>(null);

  // Form inputs for AI Modul Generator
  const [mataPelajaran, setMataPelajaran] = useState('Otomatisasi Tata Kelola Kearsipan Digital');
  const [jurusan, setJurusan] = useState('Manajemen Perkantoran dan Layanan Bisnis (MPLB)');
  const [faseKelas, setFaseKelas] = useState('Fase F (Kelas XI)');
  const [alokasiWaktu, setAlokasiWaktu] = useState('4 x 45 Menit (2 Pertemuan)');
  const [elemenCP, setElemenCP] = useState('Pengelolaan Dokumen, Digitalisasi Arsip & Pengindeksan Berkas Perkantoran');
  const [tujuanPembelajaran, setTujuanPembelajaran] = useState('Peserta didik mampu memahami konsep pengelolaan dokumen, melakukan pemindaian (scanning), serta membuat struktur kearsipan digital berbasis cloud');
  const [modelPembelajaran, setModelPembelajaran] = useState('Project Based Learning (PjBL)');
  const [profilPancasila, setProfilPancasila] = useState('Bernalar Kritis, Kreatif, Mandiri');
  const [saranaPrasarana, setSaranaPrasarana] = useState('Lab Manajemen Perkantoran, Komputer, Scanner Digital, Cloud Storage');

  // AI Loading & Error State
  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [generatedResult, setGeneratedResult] = useState<ModulAjarData | null>(null);

  // Handle AI Generate call to server /api/modul-ajar/generate
  const handleGenerateAI = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsGenerating(true);
    setGenerateError('');
    setGeneratedResult(null);

    try {
      const response = await fetch('/api/modul-ajar/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mataPelajaran,
          jurusan,
          faseKelas,
          alokasiWaktu,
          elemenCP,
          tujuanPembelajaran,
          modelPembelajaran,
          profilPancasila,
          saranaPrasarana
        })
      });

      const json = await response.json() as { success?: boolean; data?: unknown; error?: string };

      if (json.success && json.data) {
        setGeneratedResult(json.data);
      } else {
        throw new Error(json.error || 'Gagal menghasilkan modul ajar dengan AI.');
      }
    } catch (err: any) {
      console.error('AI Modul Error:', err);
      setGenerateError(err.message || 'Terjadi kesalahan sistem saat memanggil AI Gemini.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Save generated module to repo
  const handleSaveToKoleksi = () => {
    if (!generatedResult) return;

    const newModul: ModulAjar = {
      id: 'm-' + Date.now(),
      judul: generatedResult.judul || `Modul Ajar ${mataPelajaran}`,
      mataPelajaran: mataPelajaran,
      jurusan: jurusan,
      faseKelas: faseKelas,
      alokasiWaktu: alokasiWaktu,
      tanggalDibuat: new Date().toISOString().split('T')[0],
      pembuat: currentUser ? currentUser.name : `Guru ${SCHOOL_INFO.name}`,
      data: generatedResult
    };

    setModulList([newModul, ...modulList]);
    setSelectedModul(newModul);
    setActiveTab('koleksi');
    setGeneratedResult(null);
  };

  return (
    <div id="modul-ajar-module" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      
      {/* Module Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 text-xs font-bold text-emerald-700 bg-emerald-100 px-3 py-1 rounded-full mb-2">
            <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
            <span>AI Powered Kurikulum Merdeka SMK</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
            Pembuatan & Pengelolaan Modul Ajar AI
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Generator Modul Ajar Kurikulum Merdeka otomatis berbasis Gemini 3.6 Flash untuk {SCHOOL_INFO.name}.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
          <button
            onClick={() => { setActiveTab('generator'); setSelectedModul(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'generator' && !selectedModul
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Sparkles className="w-4 h-4 text-emerald-600" />
            <span>Generator AI</span>
          </button>

          <button
            onClick={() => { setActiveTab('koleksi'); setSelectedModul(null); }}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'koleksi' && !selectedModul
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Koleksi Tersimpan ({modulList.length})</span>
          </button>
        </div>
      </div>

      {/* GENERATOR TAB */}
      {activeTab === 'generator' && !selectedModul && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Form Inputs (5 cols) */}
          <div className="lg:col-span-5 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-5">
            <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
              <Sparkles className="w-5 h-5 text-emerald-600" />
              <h3 className="font-extrabold text-base text-slate-900">Form Input Parameter Modul</h3>
            </div>

            <form onSubmit={handleGenerateAI} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Mata Pelajaran</label>
                <input 
                  type="text"
                  value={mataPelajaran}
                  onChange={(e) => setMataPelajaran(e.target.value)}
                  disabled={isGenerating}
                  required
                  placeholder="Pemrograman Web & Perangkat Bergerak"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Jurusan / Keahlian</label>
                  <select 
                    value={jurusan}
                    onChange={(e) => setJurusan(e.target.value)}
                    disabled={isGenerating}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="Manajemen Perkantoran dan Layanan Bisnis (MPLB)">Manajemen Perkantoran dan Layanan Bisnis (MPLB)</option>
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">Fase / Kelas</label>
                  <select 
                    value={faseKelas}
                    onChange={(e) => setFaseKelas(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                  >
                    <option value="Fase E (Kelas X)">Fase E (Kelas X)</option>
                    <option value="Fase F (Kelas XI)">Fase F (Kelas XI)</option>
                    <option value="Fase F (Kelas XII)">Fase F (Kelas XII)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Alokasi Waktu</label>
                <input 
                  type="text"
                  value={alokasiWaktu}
                  onChange={(e) => setAlokasiWaktu(e.target.value)}
                  placeholder="4 x 45 Menit (2 Pertemuan)"
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Elemen / Capaian Pembelajaran (CP)</label>
                <textarea 
                  rows={2}
                  value={elemenCP}
                  onChange={(e) => setElemenCP(e.target.value)}
                  placeholder="Pengembangan Aplikasi Web..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Tujuan Pembelajaran (TP)</label>
                <textarea 
                  rows={2}
                  value={tujuanPembelajaran}
                  onChange={(e) => setTujuanPembelajaran(e.target.value)}
                  placeholder="Peserta didik mampu..."
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-900"
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Model Pembelajaran</label>
                <select 
                  value={modelPembelajaran}
                  onChange={(e) => setModelPembelajaran(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl font-semibold text-slate-900"
                >
                  <option value="Project Based Learning (PjBL)">Project Based Learning (PjBL)</option>
                  <option value="Problem Based Learning (PBL)">Problem Based Learning (PBL)</option>
                  <option value="Discovery / Inquiry Learning">Discovery / Inquiry Learning</option>
                  <option value="Teaching Factory (TeFa)">Teaching Factory (TeFa) Industri</option>
                </select>
              </div>

              <button
                type="submit"
                disabled={isGenerating}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-bold py-3.5 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-xs"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Gemini AI Sedang Menyusun Dokumen...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>Generasi Modul Ajar Lengkap dengan AI</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* AI Output / Document Preview (7 cols) */}
          <div className="lg:col-span-7 bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-6">
            
            {isGenerating && (
              <div className="py-20 text-center space-y-4">
                <div className="w-16 h-16 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto animate-bounce">
                  <Sparkles className="w-8 h-8" />
                </div>
                <h3 className="text-lg font-bold text-slate-900">Merancang Modul Ajar Kurikulum Merdeka...</h3>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">
                  AI Gemini 3.6 Flash sedang menyusun komponen inti, kegiatan pendahuluan, inti, penutup, serta asesmen praktikum untuk {SCHOOL_INFO.name}.
                </p>
              </div>
            )}

            {generateError && (
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl text-rose-700 text-xs space-y-1">
                <div className="font-bold">Gagal Membuat Modul Ajar:</div>
                <div>{generateError}</div>
              </div>
            )}

            {!isGenerating && !generatedResult && !generateError && (
              <div className="py-20 text-center text-slate-400 space-y-3">
                <BookOpen className="w-12 h-12 mx-auto text-slate-300" />
                <div className="text-sm font-bold text-slate-700">Dokumen Modul Ajar Belum Digenerasi</div>
                <p className="text-xs max-w-xs mx-auto">
                  Silakan isi parameter di sebelah kiri lalu klik tombol "Generasi Modul Ajar Lengkap dengan AI".
                </p>
              </div>
            )}

            {/* GENERATED RESULT DOCUMENT DISPLAY */}
            {generatedResult && (
              <div className="space-y-6 animate-in fade-in duration-300">
                <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700">
                    <Check className="w-4 h-4 text-emerald-600" />
                    <span>Modul Ajar Berhasil Dibuat oleh AI!</span>
                  </div>
                  <button
                    onClick={handleSaveToKoleksi}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-4 py-2 rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
                  >
                    <Plus className="w-4 h-4" />
                    <span>Simpan ke Koleksi</span>
                  </button>
                </div>

                {/* Printable Document Box */}
                <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-6 text-slate-800 text-xs leading-relaxed font-sans shadow-inner">
                  
                  {/* Kop Sekolah */}
                  <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
                    <h2 className="text-base font-extrabold uppercase tracking-wide text-slate-900">{SCHOOL_INFO.name}</h2>
                    <p className="text-[11px] font-semibold text-slate-600">DOKUMEN MODUL AJAR KURIKULUM MERDEKA</p>
                    <p className="text-[10px] text-slate-500">{SCHOOL_INFO.alamat}</p>
                  </div>

                  <h3 className="text-sm font-bold text-center text-slate-900 uppercase tracking-tight">
                    {generatedResult.judul}
                  </h3>

                  {/* Identitas Table */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">I. INFORMASI UMUM</h4>
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      <div><strong>Nama Sekolah:</strong> {generatedResult.identitas?.sekolah || SCHOOL_INFO.name}</div>
                      <div><strong>Mata Pelajaran:</strong> {generatedResult.identitas?.mataPelajaran}</div>
                      <div><strong>Konsentrasi Keahlian:</strong> {generatedResult.identitas?.jurusan}</div>
                      <div><strong>Fase / Kelas:</strong> {generatedResult.identitas?.faseKelas}</div>
                      <div><strong>Alokasi Waktu:</strong> {generatedResult.identitas?.alokasiWaktu}</div>
                      <div><strong>Model Pembelajaran:</strong> {generatedResult.modelPembelajaran}</div>
                    </div>
                  </div>

                  {/* Profil Pancasila */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">II. PROFIL PELAJAR PANCASILA</h4>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      {generatedResult.profilPelajarPancasila?.map((p, idx) => (
                        <li key={idx}>{p}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Tujuan Pembelajaran */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">III. TUJUAN PEMBELAJARAN</h4>
                    <ul className="list-disc list-inside space-y-1 pl-2">
                      {generatedResult.komponenInti?.tujuanPembelajaran?.map((tp, idx) => (
                        <li key={idx}>{tp}</li>
                      ))}
                    </ul>
                  </div>

                  {/* Kegiatan Pembelajaran */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">IV. KEGIATAN PEMBELAJARAN</h4>
                    
                    <div className="space-y-1 bg-white p-3 rounded-xl border">
                      <div className="font-bold text-emerald-800">1. Pendahuluan:</div>
                      <ul className="list-disc list-inside space-y-1 pl-2">
                        {generatedResult.komponenInti?.kegiatanPembelajaran?.pendahuluan?.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1 bg-white p-3 rounded-xl border">
                      <div className="font-bold text-emerald-800">2. Kegiatan Inti:</div>
                      <ul className="list-disc list-inside space-y-1 pl-2">
                        {generatedResult.komponenInti?.kegiatanPembelajaran?.inti?.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="space-y-1 bg-white p-3 rounded-xl border">
                      <div className="font-bold text-emerald-800">3. Penutup:</div>
                      <ul className="list-disc list-inside space-y-1 pl-2">
                        {generatedResult.komponenInti?.kegiatanPembelajaran?.penutup?.map((item, idx) => (
                          <li key={idx}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  {/* Asesmen */}
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">V. ASESMEN & PENILAIAN</h4>
                    <p><strong>Diagnostik:</strong> {generatedResult.komponenInti?.asesmen?.diagnostik}</p>
                    <p><strong>Formatif:</strong> {generatedResult.komponenInti?.asesmen?.formatif}</p>
                    <p><strong>Sumatif:</strong> {generatedResult.komponenInti?.asesmen?.sumatif}</p>
                  </div>

                </div>

              </div>
            )}

          </div>

        </div>
      )}

      {/* KOLEKSI MODUL AJAR TERSIMPAN TAB */}
      {activeTab === 'koleksi' && !selectedModul && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-6 space-y-6">
          <div className="flex items-center justify-between pb-4 border-b border-slate-100">
            <h3 className="font-bold text-lg text-slate-900">Daftar Modul Ajar Tersimpan</h3>
            <button
              onClick={() => setActiveTab('generator')}
              className="bg-emerald-600 text-white text-xs font-bold px-4 py-2 rounded-xl flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Buat Modul Ajar AI Baru</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {modulList.map((m) => (
              <div key={m.id} className="p-5 rounded-2xl border border-slate-200 bg-slate-50 hover:bg-white hover:shadow-md transition-all space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <span className="text-[10px] font-bold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-xs">
                    {m.jurusan}
                  </span>
                  <h4 className="font-bold text-slate-900 text-sm leading-snug">{m.judul}</h4>
                  <div className="text-xs text-slate-500 space-y-0.5">
                    <div>Mapel: <strong>{m.mataPelajaran}</strong></div>
                    <div>Fase/Kelas: <strong>{m.faseKelas}</strong></div>
                    <div>Pembuat: <strong>{m.pembuat}</strong></div>
                  </div>
                </div>

                <div className="pt-3 border-t border-slate-200 flex items-center justify-between">
                  <span className="text-[10px] text-slate-400 font-mono">{m.tanggalDibuat}</span>
                  <button
                    onClick={() => setSelectedModul(m)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Lihat Dokumen</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* DETAIL VIEW SELECTED MODUL FROM KOLEKSI */}
      {selectedModul && (
        <div className="bg-white rounded-3xl border border-slate-200/90 shadow-xs p-8 space-y-6 max-w-4xl mx-auto">
          <div className="flex items-center justify-between pb-4 border-b border-slate-200">
            <button
              onClick={() => setSelectedModul(null)}
              className="flex items-center gap-1 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Kembali ke Koleksi</span>
            </button>

            <button
              onClick={() => window.print()}
              className="bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold px-4 py-2.5 rounded-xl cursor-pointer flex items-center gap-2"
            >
              <Printer className="w-4 h-4" />
              <span>Cetak Modul Ajar / PDF</span>
            </button>
          </div>

          <div className="bg-slate-50 p-8 rounded-2xl border border-slate-200 space-y-6 text-slate-800 text-xs leading-relaxed font-sans">
            <div className="text-center border-b-2 border-slate-900 pb-4 space-y-1">
              <h2 className="text-lg font-extrabold uppercase tracking-wide text-slate-900">{SCHOOL_INFO.name}</h2>
              <p className="text-xs font-semibold text-slate-600">DOKUMEN MODUL AJAR KURIKULUM MERDEKA</p>
              <p className="text-[10px] text-slate-500">{SCHOOL_INFO.alamat}</p>
            </div>

            <h3 className="text-base font-bold text-center text-slate-900 uppercase tracking-tight">
              {selectedModul.judul}
            </h3>

            <div className="space-y-2">
              <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">I. INFORMASI UMUM</h4>
              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div><strong>Mata Pelajaran:</strong> {selectedModul.data.identitas?.mataPelajaran}</div>
                <div><strong>Konsentrasi Keahlian:</strong> {selectedModul.data.identitas?.jurusan}</div>
                <div><strong>Fase / Kelas:</strong> {selectedModul.data.identitas?.faseKelas}</div>
                <div><strong>Alokasi Waktu:</strong> {selectedModul.data.identitas?.alokasiWaktu}</div>
              </div>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">II. PROFIL PELAJAR PANCASILA</h4>
              <ul className="list-disc list-inside space-y-1 pl-2">
                {selectedModul.data.profilPelajarPancasila?.map((p, idx) => (
                  <li key={idx}>{p}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-1">
              <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">III. TUJUAN PEMBELAJARAN</h4>
              <ul className="list-disc list-inside space-y-1 pl-2">
                {selectedModul.data.komponenInti?.tujuanPembelajaran?.map((tp, idx) => (
                  <li key={idx}>{tp}</li>
                ))}
              </ul>
            </div>

            <div className="space-y-3">
              <h4 className="font-bold text-slate-900 border-b pb-1 uppercase tracking-wider text-[11px]">IV. KEGIATAN PEMBELAJARAN</h4>
              <div className="space-y-1 bg-white p-3 rounded-xl border">
                <div className="font-bold text-emerald-800">1. Pendahuluan:</div>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  {selectedModul.data.komponenInti?.kegiatanPembelajaran?.pendahuluan?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1 bg-white p-3 rounded-xl border">
                <div className="font-bold text-emerald-800">2. Kegiatan Inti:</div>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  {selectedModul.data.komponenInti?.kegiatanPembelajaran?.inti?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-1 bg-white p-3 rounded-xl border">
                <div className="font-bold text-emerald-800">3. Penutup:</div>
                <ul className="list-disc list-inside space-y-1 pl-2">
                  {selectedModul.data.komponenInti?.kegiatanPembelajaran?.penutup?.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
