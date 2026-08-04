import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS } from '../data/initialData';
import { School, LogIn, Lock, Mail, UserCheck, Shield, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
  onClose: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onClose }) => {
  const [loginType, setLoginType] = useState<'guru' | 'siswa'>('guru');
  const [emailOrNip, setEmailOrNip] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handleCustomLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!emailOrNip || !password) {
      setErrorMsg('Silakan isi email / NISN / NIP dan kata sandi Anda.');
      return;
    }

    // Match simulated user
    const matched = INITIAL_USERS.find(
      u => u.email.toLowerCase() === emailOrNip.toLowerCase() || u.nipNisn === emailOrNip
    );

    if (matched) {
      onLoginSuccess(matched);
      onClose();
    } else {
      // Fallback create dummy session for input
      const role: UserRole = loginType === 'guru' ? 'guru' : 'siswa';
      const dummyUser: User = {
        id: 'u-custom-' + Date.now(),
        name: emailOrNip.includes('@') ? emailOrNip.split('@')[0] : 'Pengguna SMK',
        email: emailOrNip.includes('@') ? emailOrNip : `${emailOrNip}@smkatthahirin.sch.id`,
        role: role,
        avatar: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
        nipNisn: emailOrNip,
        jabatan: role === 'guru' ? 'Guru Pengajar SMK' : 'Siswa SMK AT-THAHIRIN'
      };
      onLoginSuccess(dummyUser);
      onClose();
    }
  };

  const handleQuickPreset = (role: 'admin' | 'guru' | 'siswa') => {
    const preset = INITIAL_USERS.find(u => u.role === role);
    if (preset) {
      onLoginSuccess(preset);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-200 animate-in zoom-in-95 duration-200 relative overflow-hidden">
        
        {/* Top Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
              <School className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-extrabold text-lg text-slate-900">Login Portal SMK</h3>
              <p className="text-xs text-slate-500 font-medium">SMK AT-THAHIRIN DEPOK</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Quick Demo Selector Box */}
        <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
            <span className="flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Login Cepat Presets (Demo Mode)</span>
            </span>
            <span className="text-[10px] text-slate-400">1-Klik Langsung Masuk</span>
          </div>
          <div className="grid grid-cols-3 gap-2 pt-1">
            <button
              id="preset-admin-btn"
              onClick={() => handleQuickPreset('admin')}
              className="bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800 text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center"
            >
              Admin Sekolah
            </button>
            <button
              id="preset-guru-btn"
              onClick={() => handleQuickPreset('guru')}
              className="bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800 text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center"
            >
              Guru / Pendidik
            </button>
            <button
              id="preset-siswa-btn"
              onClick={() => handleQuickPreset('siswa')}
              className="bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-800 text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center"
            >
              Siswa / OrangTua
            </button>
          </div>
        </div>

        {/* Role Tab Selector */}
        <div className="flex bg-slate-100 p-1 rounded-xl">
          <button
            onClick={() => setLoginType('guru')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              loginType === 'guru' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portal Guru & Staf
          </button>
          <button
            onClick={() => setLoginType('siswa')}
            className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              loginType === 'siswa' 
                ? 'bg-white text-emerald-700 shadow-xs' 
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Portal Siswa / Orang Tua
          </button>
        </div>

        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleCustomLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              {loginType === 'guru' ? 'Email / NIP Guru' : 'NISN / Email Siswa'}
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input 
                type="text"
                value={emailOrNip}
                onChange={(e) => setEmailOrNip(e.target.value)}
                placeholder={loginType === 'guru' ? 'guru@smkatthahirin.sch.id' : '0068123491'}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kata Sandi / Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input 
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Masuk Sekarang</span>
          </button>
        </form>

        <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
          <p>Lupa kata sandi? Hubungi Unit Layanan IT Tata Usaha SMK AT-THAHIRIN.</p>
        </div>

      </div>
    </div>
  );
};
