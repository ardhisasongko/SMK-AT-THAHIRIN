import React, { useState } from 'react';
import { SCHOOL_INFO, JURUSAN_LIST, BERITA_LIST } from '../data/initialData';
import { Jurusan, Berita } from '../types';
import { 
  GraduationCap, 
  Award, 
  Users, 
  Building2, 
  TrendingUp, 
  ChevronRight, 
  Code, 
  Network, 
  Car, 
  Calculator, 
  Briefcase, 
  CheckCircle2, 
  ArrowRight,
  Sparkles,
  UserCheck,
  BookOpen,
  Calendar,
  MapPin,
  ExternalLink,
  Quote,
  ShieldCheck,
  MessageSquare,
  Bell,
  User as UserIcon,
  LogIn,
  Layers,
  FileText
} from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
  isAuthenticated: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab, onOpenLogin, isAuthenticated }) => {
  const [selectedJurusan, setSelectedJurusan] = useState<Jurusan | null>(null);
  const [selectedBerita, setSelectedBerita] = useState<Berita | null>(null);

  const getJurusanIcon = (iconName: string) => {
    switch (iconName) {
      case 'Code': return Code;
      case 'Network': return Network;
      case 'Car': return Car;
      case 'Calculator': return Calculator;
      case 'Briefcase': return Briefcase;
      default: return GraduationCap;
    }
  };

  return (
    <div id="landing-page" className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      
      {/* HERO SECTION */}
      <section className="relative overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 py-10 text-white sm:py-16 lg:py-24">
        {/* Background Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-12 lg:gap-12">
            
            {/* Left Column Text & Action */}
            <div className="space-y-5 text-center lg:col-span-7 lg:text-left">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1.5 text-[11px] font-semibold text-emerald-300 backdrop-blur-md sm:px-3.5 sm:text-xs">
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-emerald-400 sm:h-4 sm:w-4" />
                <span>Portal Pendidikan Digital Terpadu</span>
              </div>

              <h1 className="mx-auto max-w-3xl text-[2rem] font-extrabold leading-[1.12] tracking-tight text-white sm:text-5xl lg:mx-0 lg:text-6xl">
                Membangun Generasi Vokasi <span className="bg-gradient-to-r from-emerald-400 to-teal-200 bg-clip-text text-transparent">Unggul & Siap Kerja</span>
              </h1>

              <p className="mx-auto max-w-2xl text-sm leading-6 text-slate-300 sm:text-lg sm:leading-relaxed lg:mx-0">
                Selamat datang di <strong>{SCHOOL_INFO.name}</strong>, sekolah kejuruan terakreditasi B yang memadukan pembelajaran industri, teknologi digital, dan penguatan karakter.
              </p>

              <div className="grid w-full grid-cols-2 gap-2.5 pt-1 sm:flex sm:w-auto sm:flex-wrap sm:items-center sm:justify-center lg:justify-start">
                {!isAuthenticated && (
                  <button
                    id="hero-cta-login"
                    onClick={onOpenLogin}
                    className="col-span-2 flex min-w-0 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-600/30 transition-all hover:scale-[1.02] hover:bg-emerald-500 cursor-pointer sm:w-auto sm:px-5 sm:py-3 sm:text-sm"
                  >
                    <LogIn className="w-4 h-4 shrink-0" />
                    <span>Masuk Portal</span>
                  </button>
                )}

                <button
                  id="hero-cta-cbt"
                  onClick={() => setActiveTab('cbt')}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-emerald-500/20 cursor-pointer sm:px-5 sm:py-3 sm:text-sm"
                >
                  <FileText className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Ujian CBT</span>
                </button>

                <button
                  id="hero-cta-absensi"
                  onClick={() => setActiveTab('absensi')}
                  className="flex min-w-0 items-center justify-center gap-1.5 rounded-xl border border-slate-600 bg-slate-800/80 px-2.5 py-2.5 text-xs font-bold text-white shadow-md transition-all hover:scale-[1.02] hover:bg-slate-700 cursor-pointer sm:px-5 sm:py-3 sm:text-sm"
                >
                  <UserCheck className="w-4 h-4 shrink-0 text-emerald-400" />
                  <span>Absensi</span>
                </button>
              </div>

              {/* Feature Tags */}
              <div className="grid grid-cols-3 gap-2 border-t border-slate-700/70 pt-5 text-center sm:gap-4 lg:text-left">
                <div>
                  <div className="text-xl font-extrabold text-white sm:text-2xl">{SCHOOL_INFO.stats.persenKerja}</div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-400 sm:text-xs">Terserap Industri & Kuliah</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-white sm:text-2xl">{SCHOOL_INFO.stats.mitraIndustri}+</div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-400 sm:text-xs">Mitra Industri</div>
                </div>
                <div>
                  <div className="text-xl font-extrabold text-emerald-400 sm:text-2xl">{SCHOOL_INFO.akreditasi}</div>
                  <div className="mt-1 text-[10px] leading-4 text-slate-400 sm:text-xs">Akreditasi Sekolah</div>
                </div>
              </div>
            </div>

            {/* Right Column Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-800">
                  <img 
                    src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&auto=format&fit=crop&q=80" 
                    alt={`Siswa ${SCHOOL_INFO.name} Praktikum`} 
                    fetchPriority="high"
                    decoding="async"
                    className="h-64 w-full object-cover sm:h-80 lg:h-96"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/40 to-transparent"></div>
                  
                  <div className="absolute bottom-0 inset-x-0 p-6 space-y-2 text-white">
                    <div className="flex items-center gap-2 text-xs font-semibold text-emerald-400">
                      <ShieldCheck className="w-4 h-4" />
                      <span>Standar Industri & Sertifikasi Profesi BNSP</span>
                    </div>
                    <h3 className="font-bold text-lg leading-snug">
                      Praktikum Berbasis Industri & Project-Based Learning
                    </h3>
                    <p className="text-xs text-slate-300">
                      Siswa dididik langsung oleh praktisi industri dan guru tersertifikasi nasional.
                    </p>
                  </div>
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-5 -left-5 bg-white text-slate-800 p-4 rounded-2xl shadow-xl border border-slate-200 hidden sm:flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                    <GraduationCap className="w-6 h-6" />
                  </div>
                  <div>
                    <div className="text-xs text-slate-500 font-semibold">Tahun Ajaran Aktif</div>
                    <div className="text-sm font-extrabold text-slate-900">2026 / 2027</div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>



      {/* STATS STRIP */}
      <section className="bg-emerald-700 text-white py-8 border-y border-emerald-600 shadow-inner">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">{SCHOOL_INFO.stats.siswa}+</div>
              <div className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Peserta Didik Aktif</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">{SCHOOL_INFO.stats.guru}</div>
              <div className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Tenaga Pendidik & Staf</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">{SCHOOL_INFO.stats.jurusan}</div>
              <div className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Program Keahlian</div>
            </div>
            <div className="space-y-1">
              <div className="text-3xl lg:text-4xl font-extrabold tracking-tight">{SCHOOL_INFO.stats.mitraIndustri}+</div>
              <div className="text-xs font-semibold text-emerald-100 uppercase tracking-wider">Mitra Dunia Kerja</div>
            </div>
          </div>
        </div>
      </section>

      {/* SAMBUTAN KEPALA SEKOLAH */}
      <section className="border-b border-slate-200 bg-white py-10 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 items-center gap-6 rounded-3xl border border-slate-200/80 bg-slate-50 p-5 shadow-xs sm:gap-8 sm:p-8 lg:grid-cols-12 lg:p-12">
            
            <div className="lg:col-span-4 text-center">
              <div className="relative inline-block">
                <img
                  src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=400&auto=format&fit=crop&q=80"
                  alt={SCHOOL_INFO.kepalaSekolah}
                  loading="lazy"
                  decoding="async"
                  className="mx-auto h-36 w-36 rounded-full border-4 border-emerald-600 object-cover shadow-xl sm:h-48 sm:w-48 lg:h-56 lg:w-56"
                />
                <div className="absolute bottom-2 right-2 bg-emerald-600 text-white p-2 rounded-full shadow-md">
                  <Quote className="w-5 h-5" />
                </div>
              </div>
              <h3 className="mt-3 text-base font-bold text-slate-900 sm:mt-4 sm:text-lg">{SCHOOL_INFO.kepalaSekolah}</h3>
              <p className="text-xs font-semibold text-emerald-700">Kepala Sekolah</p>
            </div>

            <div className="space-y-4 text-slate-700 lg:col-span-8">
              <div className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full">
                Sambutan Kepala Sekolah
              </div>
              <h2 className="text-xl font-extrabold leading-snug text-slate-900 sm:text-3xl">
                "Menyiapkan SDM Kejuruan Berkarakter, Berdaya Saing, dan Siap Menjawab Tantangan Industri Masa Depan"
              </h2>
              <p className="text-sm leading-6 text-slate-600 sm:text-base sm:leading-relaxed">
                {SCHOOL_INFO.sambutan}
              </p>
              <div className="grid gap-2 pt-2 text-xs font-bold text-slate-600 sm:grid-cols-3 sm:gap-3">
                <span className="rounded-lg bg-white px-3 py-2 border border-slate-200">✓ Kurikulum Berbasis Industri</span>
                <span className="rounded-lg bg-white px-3 py-2 border border-slate-200">✓ Sertifikasi BNSP</span>
                <span className="rounded-lg bg-white px-3 py-2 border border-slate-200">✓ Pembentukan Karakter Mulia</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* JURUSAN / PROGRAM KEAHLIAN SECTION */}
      <section className="bg-slate-50 py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mx-auto mb-9 max-w-3xl space-y-3 text-center sm:mb-14">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full">
              Pilihan Keahlian Unggulan
            </span>
            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
              Program Keahlian {SCHOOL_INFO.name}
            </h2>
            <p className="text-sm leading-6 text-slate-600 sm:text-base">
              Dirancang khusus untuk mencetak tenaga profesional Manajemen Perkantoran dan Layanan Bisnis (MPLB) yang kompeten, responsif, dan siap kerja di industri modern.
            </p>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 lg:gap-8">
            {JURUSAN_LIST.map((jur) => {
              const IconComp = getJurusanIcon(jur.iconName);
              return (
                <div 
                  key={jur.id} 
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
                >
                  <div className="space-y-4 p-5 sm:p-6">
                    <div className="flex items-center justify-between">
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${jur.color} text-white flex items-center justify-center shadow-md`}>
                        <IconComp className="w-6 h-6" />
                      </div>
                      <span className="text-xs font-extrabold bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200">
                        {jur.code}
                      </span>
                    </div>

                    <h3 className="text-xl font-bold text-slate-900 group-hover:text-emerald-700 transition-colors">
                      {jur.name}
                    </h3>

                    <p className="text-sm text-slate-600 leading-relaxed line-clamp-3">
                      {jur.description}
                    </p>

                    <div className="pt-2">
                      <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Prospek Karir Utama:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {jur.prospekKerja.slice(0, 3).map((pk, idx) => (
                          <span key={idx} className="w-full rounded-md bg-slate-100 px-2 py-1 text-xs font-medium leading-4 text-slate-700 sm:w-auto">
                            • {pk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-start gap-3 border-t border-slate-100 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <span className="text-xs font-medium leading-4 text-slate-500">
                      Kaprog: <strong>{jur.kepalaJurusan}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedJurusan(jur)}
                      className="flex items-center gap-1 text-xs font-bold text-emerald-700 hover:text-emerald-800 cursor-pointer"
                    >
                      <span>Detail Jurusan</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

        </div>
      </section>

      {/* QUICK ACCESS PORTAL BANNER */}
      <section className="bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 py-10 text-white sm:py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col items-center justify-between gap-6 rounded-3xl border border-white/15 bg-white/10 p-5 backdrop-blur-md sm:p-8 md:flex-row">
            <div className="space-y-2 text-center md:text-left">
              <span className="bg-emerald-500/30 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
                Fitur Utama Aplikasi
              </span>
              <h3 className="text-xl font-extrabold sm:text-2xl">Sistem Informasi Absensi & Pembuatan Modul Ajar AI</h3>
              <p className="text-sm text-slate-200 max-w-xl">
                Kelola presensi harian siswa dengan scanner QR dan hasilkan Modul Ajar Kurikulum Merdeka otomatis menggunakan teknologi AI Gemini.
              </p>
            </div>
            
            <div className="grid w-full grid-cols-1 gap-3 sm:w-auto sm:grid-cols-2">
              <button
                onClick={() => setActiveTab('absensi')}
                className="flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-emerald-800 shadow-md hover:bg-emerald-50 cursor-pointer"
              >
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>Pengelolaan Absensi</span>
              </button>
              <button
                onClick={() => setActiveTab('modul-ajar')}
                className="flex items-center justify-center gap-2 rounded-xl border border-emerald-400/30 bg-emerald-600 px-5 py-3 text-sm font-bold text-white shadow-md hover:bg-emerald-500 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Modul Ajar AI</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BERITA & PENGUMUMAN */}
      <section className="border-b border-slate-200 bg-white py-12 sm:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="mb-9 flex flex-col justify-between gap-4 sm:mb-12 sm:flex-row sm:items-end">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full">
                Kabar {SCHOOL_INFO.name}
              </span>
              <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-3xl">
                Berita, Prestasi & Pengumuman Terbaru
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">Diperbarui secara berkala</span>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3 lg:gap-8">
            {BERITA_LIST.map((berita) => (
              <div 
                key={berita.id} 
                className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-lg transition-all flex flex-col justify-between group"
              >
                <div>
                  <div className="relative h-48 overflow-hidden bg-slate-100">
                    <img 
                      src={berita.gambar} 
                      alt={berita.judul} 
                      loading="lazy"
                      decoding="async"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                      {berita.kategori}
                    </span>
                  </div>

                  <div className="space-y-3 p-5 sm:p-6">
                    <div className="grid gap-1.5 text-xs text-slate-500">
                      <span className="flex items-center gap-2 whitespace-nowrap">
                        <Calendar className="h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        {berita.tanggal}
                      </span>
                      <span className="pl-5 leading-4">{berita.penulis}</span>
                    </div>

                    <h3 className="text-lg font-bold leading-snug text-slate-900 transition-colors group-hover:text-emerald-700">
                      {berita.judul}
                    </h3>

                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {berita.ringkasan}
                    </p>
                  </div>
                </div>

                <div className="p-5 pt-0 sm:p-6 sm:pt-0">
                  <button
                    onClick={() => setSelectedBerita(berita)}
                    className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1.5 cursor-pointer"
                  >
                    <span>Baca Selengkapnya</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>

        </div>
      </section>

      {/* MODAL DETAIL JURUSAN */}
      {selectedJurusan && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 lg:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-start justify-between border-b border-slate-100 pb-4">
              <div>
                <span className="text-xs font-bold bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-md">
                  {selectedJurusan.code}
                </span>
                <h3 className="text-2xl font-bold text-slate-900 mt-1">{selectedJurusan.name}</h3>
                <p className="text-xs text-slate-500">Kepala Jurusan: {selectedJurusan.kepalaJurusan}</p>
              </div>
              <button 
                onClick={() => setSelectedJurusan(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-sm text-slate-600 leading-relaxed">
              {selectedJurusan.description}
            </p>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">Prospek Karir Lulusan:</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {selectedJurusan.prospekKerja.map((p, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs font-medium text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-200">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{p}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-2">Fasilitas Laboratorium:</h4>
                <ul className="space-y-1.5 text-xs text-slate-600">
                  {selectedJurusan.fasilitas.map((f, idx) => (
                    <li key={idx} className="flex items-center gap-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedJurusan(null)}
                className="bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup Detail
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DETAIL BERITA */}
      {selectedBerita && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 lg:p-8 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto animate-in fade-in duration-200">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-xs font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-md">
                  {selectedBerita.kategori}
                </span>
                <h3 className="text-xl font-bold text-slate-900 mt-2 leading-snug">{selectedBerita.judul}</h3>
                <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                  <span>{selectedBerita.tanggal}</span>
                  <span>•</span>
                  <span>Oleh {selectedBerita.penulis}</span>
                </div>
              </div>
              <button 
                onClick={() => setSelectedBerita(null)}
                className="p-2 rounded-full hover:bg-slate-100 text-slate-500 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <img 
              src={selectedBerita.gambar} 
              alt={selectedBerita.judul}
              className="w-full h-64 object-cover rounded-xl border border-slate-200"
            />

            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-line">
              {selectedBerita.konten}
            </p>

            <div className="pt-4 border-t border-slate-100 flex justify-end">
              <button
                onClick={() => setSelectedBerita(null)}
                className="bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs hover:bg-slate-700 cursor-pointer"
              >
                Tutup Berita
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
