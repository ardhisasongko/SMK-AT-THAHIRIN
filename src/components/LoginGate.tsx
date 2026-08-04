import React from 'react';
import { Lock, LogIn, School } from 'lucide-react';
import { getDefaultCredentialsInfo } from '../utils/auth';

interface LoginGateProps {
  title?: string;
  description?: string;
  onLoginClick: () => void;
  onGoHome: () => void;
}

export const LoginGate: React.FC<LoginGateProps> = ({
  title = 'Halaman Terproteksi',
  description = 'Anda harus masuk ke akun untuk mengakses halaman ini.',
  onLoginClick,
  onGoHome,
}) => {
  const credentials = getDefaultCredentialsInfo();

  return (
    <div className="max-w-3xl mx-auto px-4 py-16 sm:py-20">
      <div className="bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden">
        <div className="bg-gradient-to-tr from-emerald-700 to-teal-800 px-6 py-8 sm:px-10 text-center">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-white">{title}</h1>
          <p className="text-emerald-100 text-sm mt-2 max-w-md mx-auto">{description}</p>
        </div>

        <div className="p-6 sm:p-10">
          <button
            onClick={onLoginClick}
            className="w-full flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3.5 rounded-xl shadow-md transition-all cursor-pointer text-sm"
          >
            <LogIn className="w-5 h-5" />
            <span>Masuk / Login Sekarang</span>
          </button>

          <div className="mt-4">
            <button
              onClick={onGoHome}
              className="w-full flex items-center justify-center gap-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold py-3 rounded-xl transition-colors cursor-pointer text-sm"
            >
              <School className="w-4 h-4" />
              <span>Kembali ke Beranda</span>
            </button>
          </div>

          <div className="mt-8 bg-slate-50 border border-slate-200 rounded-2xl p-4">
            <p className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-3 text-center">
              Akun Demo Untuk Mencoba
            </p>
            <div className="grid gap-2">
              {credentials.map((cred) => (
                <div key={cred.role} className="flex items-center justify-between bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-xs">
                  <div>
                    <span className="font-bold text-slate-800">{cred.role}</span>
                    <p className="text-slate-500 font-mono mt-0.5">{cred.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Password</p>
                    <p className="font-mono font-semibold text-emerald-700">{cred.password}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
