import React, { useEffect, useState } from 'react';
import { AuthSession, UserRole } from '../types';
import { School, LogIn, Lock, Mail, UserCheck, Shield, Sparkles, CheckCircle, AlertCircle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { loginRequest, isPasswordStrong, fetchDemoCredentials, DemoCredentials } from '../utils/auth';
import { SCHOOL_INFO } from '../data/initialData';
import { Modal } from './ui/Modal';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  onClose: () => void;
}

const QUICK_PRESET_STYLES: Record<string, string> = {
  admin: 'bg-purple-950/80 hover:bg-purple-900 text-purple-200 border border-purple-800',
  guru: 'bg-blue-950/80 hover:bg-blue-900 text-blue-200 border border-blue-800',
  ketua: 'bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800',
  siswa: 'bg-emerald-950/80 hover:bg-emerald-900 text-emerald-200 border border-emerald-800',
};

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onClose }) => {
  const [loginType, setLoginType] = useState<'guru' | 'siswa'>('guru');
  const [emailOrNip, setEmailOrNip] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [demoCreds, setDemoCreds] = useState<DemoCredentials[]>([]);

  useEffect(() => {
    let active = true;
    fetchDemoCredentials().then((data) => {
      if (active) setDemoCreds(data);
    });
    return () => {
      active = false;
    };
  }, []);

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

  const handleQuickPreset = (key: string) => {
    if (loading) return;
    const cred = demoCreds.find((c) => c.key === key);
    if (!cred) return;
    handleLogin(cred.identifier, cred.password);
  };

  return (
    <Modal onClose={onClose} className="space-y-6 sm:p-8 animate-in zoom-in-95 duration-200 relative overflow-hidden">
      {/* Top Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold shadow-md">
            <School className="w-6 h-6" />
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

      {/* Quick Demo Selector Box */}
      <div className="bg-slate-900 text-white p-3.5 rounded-2xl border border-slate-800 space-y-2">
        <div className="flex items-center justify-between text-xs font-semibold text-emerald-400">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Login Cepat Presets (Demo Mode)</span>
          </span>
          <span className="text-[10px] text-slate-400">1-Klik Langsung Masuk</span>
        </div>
        <div className="grid grid-cols-4 gap-2 pt-1">
          {demoCreds.map((cred) => (
            <button
              key={cred.key}
              id={`preset-${cred.key}-btn`}
              onClick={() => handleQuickPreset(cred.key)}
              disabled={loading}
              className={`text-xs py-1.5 px-2 rounded-lg font-bold transition-all cursor-pointer text-center disabled:opacity-50 ${QUICK_PRESET_STYLES[cred.key] || 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700'}`}
            >
              {cred.role}
            </button>
          ))}
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
              placeholder={loginType === 'guru' ? 'guru@smksplusatthahirin.sch.id' : '0068123491'}
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
          <p className="text-[10px] text-slate-400 mt-1">Password minimal 6 karakter</p>
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

      <div className="text-center text-xs text-slate-400 pt-2 border-t border-slate-100 space-y-2">
        <p>Lupa kata sandi? Hubungi Unit Layanan IT Tata Usaha {SCHOOL_INFO.name}.</p>
        <details className="text-left bg-slate-50 p-3 rounded-lg">
          <summary className="cursor-pointer text-emerald-600 font-semibold">
            Lihat Kredensial Default (Demo)
          </summary>
          <div className="mt-2 space-y-1.5 text-[10px] font-mono">
            {demoCreds.map((cred) => (
              <div key={cred.key} className="bg-white p-2 rounded border border-slate-200">
                <strong>{cred.role}:</strong> {cred.identifier} / {cred.password}
              </div>
            ))}
          </div>
        </details>
      </div>
    </Modal>
  );
};
