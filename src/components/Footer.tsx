import React from 'react';
import { SCHOOL_INFO } from '../data/initialData';
import { School, MapPin, Phone, Mail, Globe, Facebook, Instagram, Youtube, Award, ExternalLink } from 'lucide-react';

interface FooterProps {
  setActiveTab: (tab: string) => void;
}

export const Footer: React.FC<FooterProps> = ({ setActiveTab }) => {
  return (
    <footer id="main-footer" className="bg-slate-900 text-slate-300 pt-16 pb-8 border-t border-slate-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10 mb-12">
          
          {/* Col 1: Identity */}
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-600 flex items-center justify-center text-white font-bold shadow-md">
                <School className="w-6 h-6" />
              </div>
              <div>
                <span className="font-extrabold text-xl text-white tracking-tight">{SCHOOL_INFO.name}</span>
                <p className="text-xs text-emerald-400 font-medium">Akreditasi {SCHOOL_INFO.akreditasi}</p>
              </div>
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              {SCHOOL_INFO.tagline}. Berkomitmen melahirkan lulusan vokasi berkualitas, mandiri, berkarakter mulia dan berdaya saing global.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Facebook className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Instagram className="w-4 h-4" />
              </a>
              <a href="#" className="w-9 h-9 rounded-full bg-slate-800 hover:bg-emerald-600 text-slate-300 hover:text-white flex items-center justify-center transition-colors">
                <Youtube className="w-4 h-4" />
              </a>
            </div>
          </div>

          {/* Col 2: Navigation Links */}
          <div>
            <h4 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Navigasi Utama
            </h4>
            <ul className="space-y-2.5 text-sm">
              <li>
                <button onClick={() => setActiveTab('landing')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Beranda & Profil</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('absensi')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Portal Presensi & Absensi</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('kelas')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Sistem Pengelolaan Kelas</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('modul-ajar')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Pembuat Modul Ajar AI</span>
                  <span className="text-[10px] bg-emerald-600 text-white font-bold px-1.5 py-0.2 rounded-xs">AI</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('forum')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Forum Diskusi Sekolah</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('notifikasi')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Pusat Notifikasi</span>
                </button>
              </li>
              <li>
                <button onClick={() => setActiveTab('profil')} className="hover:text-emerald-400 transition-colors flex items-center gap-1.5 cursor-pointer">
                  <span>Profil Pengguna Saya</span>
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Jurusan Keahlian */}
          <div>
            <h4 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Program Keahlian
            </h4>
            <ul className="space-y-2 text-sm text-slate-400">
              <li className="flex items-center gap-2">
                <span className="text-emerald-400 font-bold">AP</span> — Administrasi Perkantoran Digital
              </li>
            </ul>
          </div>

          {/* Col 4: Kontak & Alamat */}
          <div>
            <h4 className="text-white font-bold text-base mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              Kontak & Sekertariat
            </h4>
            <ul className="space-y-3 text-sm text-slate-400">
              <li className="flex items-start gap-2.5">
                <MapPin className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                <span>{SCHOOL_INFO.alamat}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Phone className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{SCHOOL_INFO.telepon}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{SCHOOL_INFO.email}</span>
              </li>
              <li className="flex items-center gap-2.5">
                <Globe className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>NPSN: {SCHOOL_INFO.npsn}</span>
              </li>
            </ul>
          </div>

        </div>

        {/* Bottom copyright */}
        <div className="pt-8 border-t border-slate-800 flex flex-col md:flex-row items-center justify-between text-xs text-slate-500 gap-4">
          <p>© 2026 {SCHOOL_INFO.name} MEGAMENDUNG BOGOR. Hak Cipta Dilindungi Undang-Undang.</p>
          <div className="flex items-center gap-4">
            <span className="hover:text-slate-300">Kurikulum Merdeka SMK</span>
            <span>•</span>
            <span className="hover:text-slate-300">Sistem Informasi Manajemen Sekolah v2.5</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
