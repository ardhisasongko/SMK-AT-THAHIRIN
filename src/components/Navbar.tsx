import React, { useState } from 'react';
import { User } from '../types';
import { SCHOOL_INFO } from '../data/initialData';
import { 
  School, 
  UserCheck, 
  Users, 
  BookOpen, 
  Home, 
  LogIn, 
  LogOut, 
  Menu, 
  X, 
  ChevronDown,
  ShieldAlert,
  GraduationCap,
  MessageSquare,
  Bell,
  User as UserIcon,
  FileText
} from 'lucide-react';

interface NavbarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  currentUser: User | null;
  unreadCount?: number;
  onLoginClick: () => void;
  onLogoutClick: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  unreadCount = 2,
  onLoginClick,
  onLogoutClick
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Guest navbar items (hanya halaman publik)
  const guestNavItems = [
    { id: 'landing', label: 'Beranda', icon: Home },
  ];

  // Logged in user navbar items (Tailored for logged in members)
  const userNavItems = [
    { id: 'landing', label: 'Beranda', icon: Home },
    { id: 'cbt', label: 'Ujian CBT', icon: FileText },
    { id: 'absensi', label: 'Sistem Absensi', icon: UserCheck },
    { id: 'kelas', label: 'Pengelolaan Kelas', icon: Users },
    ...(currentUser?.role === 'admin' || currentUser?.role === 'guru' 
      ? [{ id: 'modul-ajar', label: 'Modul Ajar AI', icon: BookOpen }] 
      : []),
    { id: 'forum', label: 'Forum Diskusi', icon: MessageSquare },
    { id: 'notifikasi', label: 'Notifikasi', icon: Bell, badge: unreadCount },
    { id: 'profil', label: 'Profil Saya', icon: UserIcon },
  ];

  const navItems = currentUser ? userNavItems : guestNavItems;

  return (
    <header id="main-header" className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      {/* Top Notification Bar */}
      <div className="bg-slate-900 text-slate-300 text-xs py-1.5 px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              Sistem Informasi {SCHOOL_INFO.name}
            </span>
            <span className="hidden sm:inline text-slate-500">|</span>
            <span className="hidden sm:inline text-slate-400">Tahun Ajaran 2026/2027</span>
          </div>
          
          <div className="flex items-center gap-3 text-xs">
            <a href={`tel:${SCHOOL_INFO.telepon}`} className="hidden md:inline hover:text-white transition-colors">
              {SCHOOL_INFO.telepon}
            </a>
          </div>
        </div>
      </div>

      {/* Main Navigation */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-18">
          
          {/* School Brand */}
          <div 
            className="flex items-center gap-3 cursor-pointer group"
            onClick={() => setActiveTab('landing')}
          >
            <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-800 flex items-center justify-center text-white shadow-md shadow-emerald-700/20 group-hover:scale-105 transition-transform">
              <School className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-lg tracking-tight text-slate-900 group-hover:text-emerald-700 transition-colors">
                  {SCHOOL_INFO.name}
                </span>
                <span className="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-1.5 py-0.5 rounded-xs border border-emerald-300 uppercase">
                  MEGAMENDUNG
                </span>
              </div>
              <p className="text-xs text-slate-500 font-medium hidden sm:block">
                Sistem Informasi & Pembelajaran Terpadu
              </p>
            </div>
          </div>

          {/* Center Info Badge / Quick Title indicator */}
          <div className="hidden xl:flex items-center gap-2 bg-slate-100/80 px-3 py-1.5 rounded-full border border-slate-200 text-xs text-slate-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Navigasi menu aktif di dock bawah layar</span>
          </div>

          {/* User Auth Section */}
          <div className="hidden sm:flex items-center gap-3">
            {currentUser ? (
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
                    {currentUser.role === 'guru' ? 'Guru / Pendidik' : currentUser.role === 'admin' ? 'Administrator' : 'Siswa'}
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
            ) : (
              <button
                id="open-login-modal-btn"
                onClick={onLoginClick}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2 rounded-lg shadow-sm hover:shadow-md transition-all cursor-pointer"
              >
                <LogIn className="w-4 h-4" />
                <span>Masuk Portal</span>
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <div className="lg:hidden flex items-center gap-2">
            <button
              id="mobile-menu-toggle"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Drawer Navigation */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-slate-200 bg-white px-4 pt-3 pb-6 space-y-2 shadow-xl animate-in slide-in-from-top duration-200">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  setActiveTab(item.id);
                  setMobileMenuOpen(false);
                }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-colors cursor-pointer ${
                  isActive
                    ? 'bg-emerald-50 text-emerald-700 font-bold border border-emerald-200'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span>{item.label}</span>
                {item.id === 'modul-ajar' && (
                  <span className="ml-auto text-[10px] bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full">
                    AI Gemini
                  </span>
                )}
              </button>
            );
          })}

          <div className="pt-3 border-t border-slate-100">
            {currentUser ? (
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div 
                  className="flex items-center gap-3 cursor-pointer group"
                  onClick={() => {
                    setActiveTab('profil');
                    setMobileMenuOpen(false);
                  }}
                >
                  <img src={currentUser.avatar} alt={currentUser.name} className="w-10 h-10 rounded-full object-cover border-2 border-emerald-500 shrink-0" />
                  <div className="min-w-0">
                    <div className="text-sm font-bold text-slate-800 group-hover:text-emerald-700 transition-colors truncate">{currentUser.name}</div>
                    <div className="text-xs text-emerald-600 font-semibold capitalize truncate">
                      {currentUser.role === 'guru' ? 'Guru / Pendidik' : currentUser.role === 'admin' ? 'Administrator' : 'Siswa'}
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
            ) : (
              <button
                onClick={() => {
                  onLoginClick();
                  setMobileMenuOpen(false);
                }}
                className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white font-bold py-3 rounded-xl shadow-md cursor-pointer"
              >
                <LogIn className="w-5 h-5" />
                <span>Masuk Portal Akun</span>
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
