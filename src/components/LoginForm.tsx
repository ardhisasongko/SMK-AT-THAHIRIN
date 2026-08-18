import React, { useState } from 'react';
import { AuthSession } from '../types';
import { LogIn, Lock, Mail, AlertCircle, Eye, EyeOff, Loader2, GraduationCap, BriefcaseBusiness } from 'lucide-react';
import { loginRequest, isPasswordStrong } from '../utils/auth';
import { SCHOOL_INFO } from '../data/initialData';
import { Modal } from './ui/Modal';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  onClose: () => void;
}

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onClose }) => {
  const [loginType, setLoginType] = useState<'guru' | 'siswa'>('guru');
  const [emailOrNip, setEmailOrNip] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (identifier: string, pwd: string) => {
    setLoading(true);
    setErrorMsg('');
    const res = await loginRequest(identifier, pwd);
    setLoading(false);
    if (res.ok && res.session) {
      onLoginSuccess(res.session);
      onClose();
    } else {
      setErrorMsg(res.error || 'Login gagal. Silakan coba lagi.');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    const identifier = emailOrNip.trim();
    if (!identifier || !password) {
      setErrorMsg('Silakan isi email/NIP/NISN dan password Anda.');
      return;
    }
    const passwordCheck = isPasswordStrong(password);
    if (!passwordCheck.valid) {
      setErrorMsg(passwordCheck.message);
      return;
    }
    handleLogin(identifier, password);
  };

  return (
    <Modal onClose={onClose} className="space-y-6 sm:p-8 animate-in zoom-in-95 duration-200 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 overflow-hidden rounded-xl bg-emerald-600 text-white shadow-md">
            <img src="/school/school-mark.svg" alt="Logo portal SMK Plus At-Thahirin" className="h-full w-full" width="40" height="40" />
          </div>
          <div>
            <h3 className="font-extrabold text-lg text-slate-900">Login Portal SMK</h3>
            <p className="text-xs text-slate-500 font-medium">{SCHOOL_INFO.name}</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center text-sm font-bold cursor-pointer transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Role Tab Selector */}
      <div className="flex bg-slate-100 p-1 rounded-xl">
        <button
          onClick={() => setLoginType('guru')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            loginType === 'guru'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <BriefcaseBusiness className="h-3.5 w-3.5" />
          <span>Guru & Staf</span>
        </button>
        <button
          onClick={() => setLoginType('siswa')}
          className={`flex flex-1 items-center justify-center gap-1.5 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
            loginType === 'siswa'
              ? 'bg-white text-emerald-700 shadow-xs'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <GraduationCap className="h-3.5 w-3.5" />
          <span>Siswa / Orang Tua</span>
        </button>
      </div>

      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
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
              placeholder={loginType === 'guru' ? `guru@${SCHOOL_INFO.email.split('@')[1]}` : '0068123491'}
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
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full pl-10 pr-12 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3.5 top-3 text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">Password minimal 8 karakter</p>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-60"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogIn className="w-4 h-4" />}
          <span>{loading ? 'Memproses...' : 'Masuk Sekarang'}</span>
        </button>
      </form>

      <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100">
        <p>Lupa kata sandi? Hubungi Unit Layanan IT Tata Usaha {SCHOOL_INFO.name}.</p>
      </div>
    </Modal>
  );
};
