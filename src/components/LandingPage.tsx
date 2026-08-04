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
  Layers
} from 'lucide-react';

interface LandingPageProps {
  setActiveTab: (tab: string) => void;
  onOpenLogin: () => void;
}

export const LandingPage: React.FC<LandingPageProps> = ({ setActiveTab, onOpenLogin }) => {
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
      <section className="relative bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950 text-white overflow-hidden py-16 lg:py-24">
        {/* Background Decorative Grid */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)] opacity-30"></div>
        
        {/* Glow Effects */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 blur-3xl rounded-full pointer-events-none"></div>

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* Left Column Text & Action */}
            <div className="lg:col-span-7 space-y-6 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 bg-emerald-500/10 border border-emerald-500/20 px-3.5 py-1.5 rounded-full text-emerald-400 text-xs font-semibold backdrop-blur-md">
                <Sparkles className="w-4 h-4 text-emerald-400" />
                <span>Penerimaan Siswa Baru & Portal Digital Terpadu</span>
              </div>

              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-white leading-tight">
                Membangun Generasi Vokasi <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-200">Unggul & siap Kerja</span>
              </h1>

              <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Selamat Datang di <strong>{SCHOOL_INFO.name}</strong>. Sekolah Menengah Kejuruan swasta terakreditasi B yang memadukan Kurikulum Merdeka industri, penguasaan teknologi digital Administrasi Perkantoran, dan penguatan karakter.
              </p>

              <div className="pt-2 flex flex-wrap items-center justify-center lg:justify-start gap-3">
                <button
                  id="hero-cta-absensi"
                  onClick={() => setActiveTab('absensi')}
                  className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-xl shadow-lg shadow-emerald-600/30 hover:scale-[1.02] transition-all cursor-pointer text-sm"
                >
                  <UserCheck className="w-4 h-4" />
                  <span>Presensi QR Code</span>
                </button>

                <button
                  id="hero-cta-kelas"
                  onClick={() => setActiveTab('kelas')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-white font-bold px-5 py-3 rounded-xl border border-slate-700 shadow-md hover:scale-[1.02] transition-all cursor-pointer text-sm"
                >
                  <Users className="w-4 h-4 text-emerald-400" />
                  <span>Pengelolaan Kelas</span>
                </button>

                <button
                  id="hero-cta-modul"
                  onClick={() => setActiveTab('modul-ajar')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-emerald-300 font-bold px-5 py-3 rounded-xl border border-slate-700 shadow-md hover:scale-[1.02] transition-all cursor-pointer text-sm"
                >
                  <BookOpen className="w-4 h-4" />
                  <span>Modul Ajar AI</span>
                </button>

                <button
                  id="hero-cta-forum"
                  onClick={() => setActiveTab('forum')}
                  className="flex items-center gap-2 bg-slate-800 hover:bg-slate-700 text-amber-300 font-bold px-5 py-3 rounded-xl border border-slate-700 shadow-md hover:scale-[1.02] transition-all cursor-pointer text-sm"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span>Forum Diskusi</span>
                </button>
              </div>

              {/* Feature Tags */}
              <div className="pt-6 border-t border-slate-800 grid grid-cols-3 gap-4 text-center lg:text-left">
                <div>
                  <div className="text-2xl font-extrabold text-white">{SCHOOL_INFO.stats.persenKerja}</div>
                  <div className="text-xs text-slate-400">Terserap Industri & Kuliah</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-white">{SCHOOL_INFO.stats.mitraIndustri}+</div>
                  <div className="text-xs text-slate-400">Perusahaan Mitra IDUKA</div>
                </div>
                <div>
                  <div className="text-2xl font-extrabold text-emerald-400">Akreditasi {SCHOOL_INFO.akreditasi}</div>
                  <div className="text-xs text-slate-400">Unggul & Terpercaya</div>
                </div>
              </div>
            </div>

            {/* Right Column Visual Card */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md lg:max-w-none">
                <div className="relative rounded-2xl overflow-hidden border border-slate-700 shadow-2xl bg-slate-800">
                  <img 
                    src="https://images.unsplash.com/photo-1524178232363-1fb2b075b655?w=800&auto=format&fit=crop&q=80" 
                    alt="Siswa SMK AT-THAHIRIN Praktikum" 
                    className="w-full h-80 lg:h-96 object-cover"
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

      {/* QUICK ACCESS SHORTCUTS TOOLBAR */}
      <section className="bg-slate-900 border-b border-slate-800 text-slate-200 py-5 px-4 shadow-md">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-4 bg-slate-800/90 p-4 rounded-2xl border border-slate-700/80 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 flex items-center justify-center shrink-0 font-bold">
                <Sparkles className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  Akses Cepat Portal Sekolah
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] font-extrabold px-2 py-0.5 rounded-full border border-emerald-500/30">
                    Pintasan Fitur
                  </span>
                </h3>
                <p className="text-xs text-slate-400">
                  Navigasi langsung ke layanan utama SMKS PLUS AT THAHIRIN Megamendung
                </p>
              </div>
            </div>

            {/* Quick Action Button Pills */}
            <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto justify-start lg:justify-end">
              <button
                id="quick-shortcut-absensi"
                onClick={() => setActiveTab('absensi')}
                className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold px-3.5 py-2 rounded-xl transition-all shadow-xs cursor-pointer hover:scale-105"
              >
                <UserCheck className="w-3.5 h-3.5" />
                <span>Absensi QR</span>
              </button>

              <button
                id="quick-shortcut-kelas"
                onClick={() => setActiveTab('kelas')}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-slate-600 cursor-pointer hover:scale-105"
              >
                <Users className="w-3.5 h-3.5 text-blue-400" />
                <span>Jadwal Kelas AP</span>
              </button>

              <button
                id="quick-shortcut-modul"
                onClick={() => setActiveTab('modul-ajar')}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-slate-600 cursor-pointer hover:scale-105"
              >
                <BookOpen className="w-3.5 h-3.5 text-emerald-400" />
                <span>Modul AI</span>
              </button>

              <button
                id="quick-shortcut-forum"
                onClick={() => setActiveTab('forum')}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-slate-600 cursor-pointer hover:scale-105"
              >
                <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
                <span>Forum Diskusi</span>
              </button>

              <button
                id="quick-shortcut-notifikasi"
                onClick={() => setActiveTab('notifikasi')}
                className="flex items-center gap-1.5 bg-slate-700 hover:bg-slate-600 text-slate-100 text-xs font-bold px-3.5 py-2 rounded-xl transition-all border border-slate-600 cursor-pointer hover:scale-105"
              >
                <Bell className="w-3.5 h-3.5 text-indigo-400" />
                <span>Notifikasi</span>
              </button>

              <button
                id="quick-shortcut-login"
                onClick={onOpenLogin}
                className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-bold px-3.5 py-2 rounded-xl border border-emerald-500/30 transition-all cursor-pointer hover:scale-105"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Masuk Portal</span>
              </button>
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
      <section className="py-16 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="bg-slate-50 rounded-3xl p-8 lg:p-12 border border-slate-200/80 shadow-xs grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            
            <div className="lg:col-span-4 text-center">
              <div className="relative inline-block">
                <img 
                  src="https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=400&auto=format&fit=crop&q=80" 
                  alt={SCHOOL_INFO.kepalaSekolah}
                  className="w-48 h-48 lg:w-56 lg:h-56 rounded-full object-cover mx-auto border-4 border-emerald-600 shadow-xl"
                />
                <div className="absolute bottom-2 right-2 bg-emerald-600 text-white p-2 rounded-full shadow-md">
                  <Quote className="w-5 h-5" />
                </div>
              </div>
              <h3 className="text-lg font-bold text-slate-900 mt-4">{SCHOOL_INFO.kepalaSekolah}</h3>
              <p className="text-xs font-semibold text-emerald-700">Kepala Sekolah {SCHOOL_INFO.name}</p>
            </div>

            <div className="lg:col-span-8 space-y-4 text-slate-700">
              <div className="inline-block bg-emerald-100 text-emerald-800 font-bold text-xs px-3 py-1 rounded-full">
                Sambutan Kepala Sekolah
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-slate-900 leading-snug">
                "Menyiapkan SDM Kejuruan Berkarakter, Berdaya Saing, dan Siap Menjawab Tantangan Industri Masa Depan"
              </h2>
              <p className="text-base leading-relaxed text-slate-600">
                {SCHOOL_INFO.sambutan}
              </p>
              <div className="pt-2 flex items-center gap-4 text-xs font-bold text-slate-500">
                <span>✓ Kurikulum Berbasis Industri</span>
                <span>•</span>
                <span>✓ Sertifikasi BNSP</span>
                <span>•</span>
                <span>✓ Pembentukan Karakter Mulia</span>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* JURUSAN / PROGRAM KEAHLIAN SECTION */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
            <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full">
              Pilihan Keahlian Unggulan
            </span>
            <h2 className="text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight">
              Program Keahlian {SCHOOL_INFO.name}
            </h2>
            <p className="text-slate-600 text-base">
              Dirancang khusus untuk mencetak tenaga profesional Administrasi Perkantoran digital yang kompeten, responsif, dan siap kerja di industri modern.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {JURUSAN_LIST.map((jur) => {
              const IconComp = getJurusanIcon(jur.iconName);
              return (
                <div 
                  key={jur.id} 
                  className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col justify-between overflow-hidden group hover:-translate-y-1"
                >
                  <div className="p-6 space-y-4">
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
                          <span key={idx} className="bg-slate-100 text-slate-700 text-xs px-2 py-0.5 rounded-md font-medium">
                            • {pk}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="p-4 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-xs text-slate-500 font-medium">
                      Kaprog: <strong>{jur.kepalaJurusan}</strong>
                    </span>
                    <button
                      onClick={() => setSelectedJurusan(jur)}
                      className="text-xs font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
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
      <section className="py-12 bg-gradient-to-r from-emerald-800 via-teal-800 to-slate-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-white/10 p-8 rounded-3xl border border-white/15 backdrop-blur-md">
            <div className="space-y-2 text-center md:text-left">
              <span className="bg-emerald-500/30 text-emerald-200 text-xs font-bold px-3 py-1 rounded-full">
                Fitur Utama Aplikasi
              </span>
              <h3 className="text-2xl font-extrabold">Sistem Informasi Absensi & Pembuatan Modul Ajar AI</h3>
              <p className="text-sm text-slate-200 max-w-xl">
                Kelola presensi harian siswa dengan scanner QR dan hasilkan Modul Ajar Kurikulum Merdeka otomatis menggunakan teknologi AI Gemini.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-3">
              <button
                onClick={() => setActiveTab('absensi')}
                className="bg-white text-emerald-800 hover:bg-emerald-50 font-bold px-5 py-3 rounded-xl shadow-md cursor-pointer text-sm flex items-center gap-2"
              >
                <UserCheck className="w-4 h-4 text-emerald-700" />
                <span>Pengelolaan Absensi</span>
              </button>
              <button
                onClick={() => setActiveTab('modul-ajar')}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-5 py-3 rounded-xl shadow-md cursor-pointer text-sm flex items-center gap-2 border border-emerald-400/30"
              >
                <Sparkles className="w-4 h-4 text-amber-300" />
                <span>Modul Ajar AI</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* BERITA & PENGUMUMAN */}
      <section className="py-20 bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          
          <div className="flex flex-col sm:flex-row sm:items-end justify-between mb-12 gap-4">
            <div>
              <span className="text-xs font-bold text-emerald-600 uppercase tracking-widest bg-emerald-100 px-3 py-1 rounded-full">
                Kabar SMK AT-THAHIRIN
              </span>
              <h2 className="text-3xl font-extrabold text-slate-900 tracking-tight mt-2">
                Berita, Prestasi & Pengumuman Terbaru
              </h2>
            </div>
            <span className="text-xs text-slate-500 font-medium">Diperbarui secara berkala</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
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
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <span className="absolute top-3 left-3 bg-slate-900/80 backdrop-blur-md text-white text-[11px] font-bold px-2.5 py-1 rounded-md">
                      {berita.kategori}
                    </span>
                  </div>

                  <div className="p-6 space-y-3">
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{berita.tanggal}</span>
                      <span>•</span>
                      <span>{berita.penulis}</span>
                    </div>

                    <h3 className="font-bold text-lg text-slate-900 group-hover:text-emerald-700 transition-colors leading-snug">
                      {berita.judul}
                    </h3>

                    <p className="text-sm text-slate-600 line-clamp-3 leading-relaxed">
                      {berita.ringkasan}
                    </p>
                  </div>
                </div>

                <div className="p-6 pt-0">
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
