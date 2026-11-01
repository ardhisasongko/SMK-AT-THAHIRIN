import React, { useEffect, useRef, useState } from 'react';
import { AuthSession } from '../types';
import { LogIn, Lock, Mail, AlertCircle, Eye, EyeOff, Loader2, GraduationCap, BriefcaseBusiness, ShieldCheck, ArrowLeft } from 'lucide-react';
import { loginRequest, verifyTwoFactorRequest } from '../utils/auth';
import { SCHOOL_INFO } from '../data/initialData';
import { Modal } from './ui/Modal';

interface LoginFormProps {
  onLoginSuccess: (session: AuthSession) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widgetId?: string) => void;
      remove: (widgetId?: string) => void;
    };
  }
}

const TURNSTILE_SCRIPT_SRC = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess, onClose }) => {
  const [loginType, setLoginType] = useState<'guru' | 'siswa'>('guru');
  const [emailOrNip, setEmailOrNip] = useState('');
  const [password, setPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  // Langkah kedua login (2FA): token tantangan dari server + kode pengguna.
  const [challengeToken, setChallengeToken] = useState<string | null>(null);
  const [twoFactorCode, setTwoFactorCode] = useState('');
  // Turnstile (hardening Fase C): site key hanya ada bila fitur aktif di
  // server; kosong = widget tidak dirender dan login seperti biasa.
  const [turnstileSiteKey, setTurnstileSiteKey] = useState<string | null>(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const turnstileContainerRef = useRef<HTMLDivElement | null>(null);
  const turnstileWidgetIdRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/login-config');
        const json = await res.json() as { data?: { turnstileSiteKey?: string | null } };
        if (!cancelled && json?.data?.turnstileSiteKey) setTurnstileSiteKey(json.data.turnstileSiteKey);
      } catch { /* fitur mati = login biasa */ }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!turnstileSiteKey || !turnstileContainerRef.current) return;
    let disposed = false;
    const renderWidget = () => {
      if (disposed || !window.turnstile || !turnstileContainerRef.current) return;
      if (turnstileWidgetIdRef.current) return;
      try {
        turnstileWidgetIdRef.current = window.turnstile.render(turnstileContainerRef.current, {
          sitekey: turnstileSiteKey,
          callback: (token: string) => setTurnstileToken(token),
          'expired-callback': () => setTurnstileToken(''),
          'error-callback': () => setTurnstileToken(''),
        });
      } catch { /* widget gagal render = server tetap memverifikasi */ }
    };
    if (window.turnstile) {
      renderWidget();
    } else {
      const existing = document.querySelector<HTMLScriptElement>('script[data-turnstile-script]');
      if (existing) {
        existing.addEventListener('load', renderWidget);
      } else {
        const script = document.createElement('script');
        script.src = TURNSTILE_SCRIPT_SRC;
        script.async = true;
        script.dataset.turnstileScript = 'true';
        script.addEventListener('load', renderWidget);
        document.head.appendChild(script);
      }
    }
    return () => {
      disposed = true;
      if (window.turnstile && turnstileWidgetIdRef.current) {
        try { window.turnstile.remove(turnstileWidgetIdRef.current); } catch { /* abaikan */ }
        turnstileWidgetIdRef.current = null;
      }
    };
  }, [turnstileSiteKey]);

  const resetTurnstile = () => {
    setTurnstileToken('');
    if (window.turnstile && turnstileWidgetIdRef.current) {
      try { window.turnstile.reset(turnstileWidgetIdRef.current); } catch { /* abaikan */ }
    }
  };

  const handleLogin = async (identifier: string, pwd: string) => {
    setLoading(true);
    setErrorMsg('');
    const res = await loginRequest(identifier, pwd, turnstileToken || undefined);
    setLoading(false);
    if (res.ok && res.twoFactorRequired && res.challengeToken) {
      setChallengeToken(res.challengeToken);
      setTwoFactorCode('');
      return;
    }
    if (res.ok && res.session) {
      onLoginSuccess(res.session);
      onClose();
    } else {
      resetTurnstile();
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
    if (turnstileSiteKey && !turnstileToken) {
      setErrorMsg('Silakan selesaikan verifikasi keamanan (centang Turnstile) terlebih dahulu.');
      return;
    }
    // Sengaja TANPA gerbang kekuatan password di sini: kebijakan password
    // hanya berlaku saat MENETAPKAN password baru. Password lama yang sah
    // (dibuat sebelum kebijakan baru) tetap harus bisa dipakai login.
    handleLogin(identifier, password);
  };

  const handleVerifyTwoFactor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !challengeToken) return;
    const code = twoFactorCode.trim();
    if (!code) {
      setErrorMsg('Silakan isi kode verifikasi dari aplikasi authenticator atau kode pemulihan Anda.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    const res = await verifyTwoFactorRequest(challengeToken, code);
    setLoading(false);
    if (res.ok && res.session) {
      onLoginSuccess(res.session);
      onClose();
    } else {
      setErrorMsg(res.error || 'Kode verifikasi salah. Silakan coba lagi.');
    }
  };

  const backToPasswordStep = () => {
    setChallengeToken(null);
    setTwoFactorCode('');
    setErrorMsg('');
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

      {challengeToken ? (
        <div className="space-y-4">
        {errorMsg && (
          <div className="bg-rose-50 border border-rose-200 text-rose-700 text-xs p-3 rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}
        <form onSubmit={handleVerifyTwoFactor} className="space-y-4">
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs p-3 rounded-xl flex items-start gap-2">
            <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
            <span>Akun Anda dilindungi verifikasi dua langkah. Masukkan kode 6 digit dari aplikasi authenticator, atau salah satu kode pemulihan Anda.</span>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kode Verifikasi
            </label>
            <div className="relative">
              <ShieldCheck className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
              <input
                type="text"
                inputMode="text"
                autoComplete="one-time-code"
                autoFocus
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                placeholder="123456 atau XXXX-XXXX"
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">Kode berlaku singkat dan hanya dapat dipakai sekali. Kode pemulihan juga hanya berlaku satu kali.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-md transition-all cursor-pointer flex items-center justify-center gap-2 text-sm disabled:opacity-60"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
            <span>{loading ? 'Memverifikasi...' : 'Verifikasi & Masuk'}</span>
          </button>
          <button
            type="button"
            onClick={backToPasswordStep}
            className="w-full text-slate-500 hover:text-slate-700 font-semibold py-1 rounded-xl transition-colors cursor-pointer flex items-center justify-center gap-1.5 text-xs"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Kembali ke langkah password</span>
          </button>
        </form>
        </div>
      ) : (
      <>
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
          <p className="text-[10px] text-slate-400 mt-1">Gunakan password yang kuat: minimal 10 karakter, kombinasi huruf dan angka.</p>
        </div>

        {turnstileSiteKey && (
          <div className="flex justify-center">
            <div ref={turnstileContainerRef} />
          </div>
        )}

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
      </>
      )}
    </Modal>
  );
};
