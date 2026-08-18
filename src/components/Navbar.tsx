import React, { useState } from 'react';
import { User } from '../types';
import { SCHOOL_INFO } from '../data/initialData';
import { LogOut, Menu, X } from 'lucide-react';

interface NavbarProps {
  setActiveTab: (tab: string) => void;
  currentUser: User;
  onLogoutClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  setActiveTab,
  currentUser,
  onLogoutClick
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const roleLabel = currentUser.role === 'guru'
    ? 'Guru / Pendidik'
    : currentUser.role === 'super_admin'
      ? 'Super Administrator'
      : currentUser.role === 'admin'
      ? 'Administrator'
      : currentUser.role === 'ketua_kelas'
        ? 'Ketua Kelas'
        : 'Siswa';

  return (
    <header id="main-header" className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex min-h-16 items-center justify-between gap-3 py-2 sm:min-h-18 sm:py-0">
          
          {/* School Brand */}
          <div 
            className="flex min-w-0 items-center gap-2.5 cursor-pointer group sm:gap-3"
            onClick={() => setActiveTab('landing')}
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-800 text-white shadow-md shadow-emerald-700/20 transition-transform group-hover:scale-105 sm:h-11 sm:w-11">
              <img src="/school/school-mark.svg" alt="Logo portal SMK Plus At Thahirin" className="h-full w-full" width="44" height="44" />
            </div>
            <div className="min-w-0">
              <div className="flex min-w-0 items-center gap-1.5">
                <span className="truncate text-[15px] font-extrabold tracking-tight text-slate-900 transition-colors group-hover:text-emerald-700 sm:text-lg">
                  {SCHOOL_INFO.name}
                </span>
                <span className="hidden shrink-0 rounded-xs border border-emerald-300 bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-emerald-800 md:inline">
                  MEGAMENDUNG
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Sistem Informasi & Pembelajaran Terpadu
              </p>
            </div>
          </div>

          {/* User Auth Section */}
          <div className="hidden sm:flex items-center gap-3">
            <div
              id="user-profile-button"
              className="flex items-center gap-2.5 bg-slate-50 hover:bg-slate-100/90 p-1.5 pr-2 pl-3 rounded-full border border-slate-200/80 shadow-2xs transition-all"
            >
              <div 
                className="text-right cursor-pointer group"
                onClick={() => setActiveTab('profil')}
                title={`Lihat profil: ${currentUser.name}`}
              >
                <div className="text-xs font-bold text-slate-800 leading-tight max-w-[130px] md:max-w-[160px] truncate group-hover:text-emerald-700 transition-colors">
                  {currentUser.name}
                </div>
                <div className="text-[10px] font-semibold text-emerald-600 capitalize max-w-[130px] md:max-w-[160px] truncate">
                  {roleLabel}
                </div>
              </div>

              <img
                src={currentUser.avatar}
                alt={currentUser.name}
                onClick={() => setActiveTab('profil')}
                title="Lihat Profil Saya"
                className="w-8 h-8 rounded-full object-cover border-2 border-emerald-500 shadow-xs cursor-pointer hover:scale-105 transition-transform shrink-0"
              />

              <div className="h-4 w-px bg-slate-200 mx-0.5"></div>

              <button
                id="user-logout-btn"
                onClick={onLogoutClick}
                title="Keluar dari Akun"
                className="w-7 h-7 rounded-full bg-slate-200/80 hover:bg-rose-100 hover:text-rose-600 text-slate-600 flex items-center justify-center transition-colors cursor-pointer shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Mobile Menu Button */}
          <div className="flex shrink-0 items-center gap-2 sm:hidden">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label={mobileMenuOpen ? 'Tutup menu akun' : 'Buka menu akun'}
              aria-expanded={mobileMenuOpen}
              aria-controls="mobile-account-menu"
              className="rounded-lg p-2 text-slate-600 transition-colors hover:bg-slate-100 cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer: menu akun saja (navigasi sudah dihandle BottomDock) */}
      {mobileMenuOpen && (
        <div id="mobile-account-menu" className="border-t border-slate-200 bg-white px-4 pt-4 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top duration-200 sm:hidden">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400 px-1">
            Menu Akun
          </p>

          <div className="pt-1">
            <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
              <div
                className="flex min-w-0 items-center gap-3 cursor-pointer group"
                onClick={() => {
                  setActiveTab('profil');
                  setMobileMenuOpen(false);
                }}
              >
                <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">{currentUser.name}</div>
                  <div className="text-xs text-emerald-600 font-semibold capitalize truncate">
                    {roleLabel}
                  </div>
                </div>
              </div>
              <button
                onClick={() => {
                  onLogoutClick();
                  setMobileMenuOpen(false);
                }}
                className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors shrink-0"
                title="Keluar dari akun"
              >
                <LogOut className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
