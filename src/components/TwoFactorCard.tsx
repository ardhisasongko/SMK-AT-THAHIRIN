import React, { useCallback, useEffect, useState } from 'react';
import { ShieldCheck, ShieldAlert, KeyRound, Copy, Check, Loader2 } from 'lucide-react';
import { authHeaders } from '../utils/auth';

interface TwoFactorStatus {
  applicable: boolean;
  configured: boolean;
  enabled: boolean;
  recoveryCodesRemaining: number;
}

async function apiJson(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: any }> {
  const res = await fetch(path, {
    ...init,
    headers: authHeaders({ 'Content-Type': 'application/json', ...(init?.headers as Record<string, string> | undefined) }),
  });
  let json: any = null;
  try { json = await res.json(); } catch { /* respons kosong */ }
  return { ok: res.ok && Boolean(json?.success), status: res.status, data: json };
}

/**
 * Kartu pengelolaan verifikasi dua langkah (2FA TOTP) di Profil.
 * Hanya dirender untuk role staf (guru/admin/super_admin); siswa dan ketua
 * kelas tidak ditawari fitur ini. Semua panggilan jaringan fail-soft agar
 * kartu tidak pernah merusak render halaman profil.
 */
export const TwoFactorCard: React.FC = () => {
  const [status, setStatus] = useState<TwoFactorStatus | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [pendingSecret, setPendingSecret] = useState('');
  const [otpAuthUrl, setOtpAuthUrl] = useState('');
  const [activateCode, setActivateCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);
  const [disableCode, setDisableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [copied, setCopied] = useState(false);

  const loadStatus = useCallback(async () => {
    try {
      const res = await apiJson('/api/auth/2fa/status');
      if (res.ok && res.data?.data) setStatus(res.data.data as TwoFactorStatus);
      else setLoadFailed(true);
    } catch {
      setLoadFailed(true);
    }
  }, []);

  useEffect(() => { void loadStatus(); }, [loadStatus]);

  const startSetup = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await apiJson('/api/auth/2fa/setup', { method: 'POST', body: JSON.stringify({}) });
      if (res.ok) {
        setPendingSecret(String(res.data.data.secret || ''));
        setOtpAuthUrl(String(res.data.data.otpAuthUrl || ''));
      } else {
        setError(res.data?.error || 'Gagal menyiapkan verifikasi dua langkah.');
      }
    } catch { setError('Gagal terhubung ke server.'); }
    finally { setBusy(false); }
  };

  const confirmActivate = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await apiJson('/api/auth/2fa/activate', { method: 'POST', body: JSON.stringify({ code: activateCode }) });
      if (res.ok) {
        setRecoveryCodes(Array.isArray(res.data.data.recoveryCodes) ? res.data.data.recoveryCodes : []);
        setPendingSecret('');
        setActivateCode('');
        await loadStatus();
      } else {
        setError(res.data?.error || 'Kode verifikasi salah.');
      }
    } catch { setError('Gagal terhubung ke server.'); }
    finally { setBusy(false); }
  };

  const confirmDisable = async () => {
    setBusy(true); setError(''); setMessage('');
    try {
      const res = await apiJson('/api/auth/2fa/disable', {
        method: 'POST',
        body: JSON.stringify({ code: disableCode || undefined, currentPassword: disablePassword || undefined }),
      });
      if (res.ok) {
        setMessage('Verifikasi dua langkah telah dinonaktifkan.');
        setDisableCode('');
        setDisablePassword('');
        await loadStatus();
      } else {
        setError(res.data?.error || 'Gagal menonaktifkan verifikasi dua langkah.');
      }
    } catch { setError('Gagal terhubung ke server.'); }
    finally { setBusy(false); }
  };

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(pendingSecret);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* salin manual tetap tersedia */ }
  };

  if (loadFailed) return null;
  if (!status) {
    return (
      <div className="mt-6 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat status keamanan akun...
      </div>
    );
  }
  if (!status.applicable) return null;

  return (
    <div className="mt-6 min-w-0 bg-white rounded-2xl border border-slate-200 p-4 sm:p-6 shadow-xs space-y-4">
      <h3 className="text-sm font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
        <ShieldCheck className="w-4 h-4 text-emerald-600" />
        <span>Verifikasi Dua Langkah (2FA)</span>
        <span className={`ml-auto text-[10px] font-bold px-2 py-0.5 rounded-full ${status.enabled ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'}`}>
          {status.enabled ? 'Aktif' : 'Belum Aktif'}
        </span>
      </h3>

      {error && <p className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">{error}</p>}
      {message && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-xs font-semibold text-emerald-800">{message}</p>}

      {!status.configured && (
        <div className="flex items-start gap-3 p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-900">
          <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
          <p className="text-[11px]">Fitur ini belum dikonfigurasi di server sekolah (kunci enkripsi 2FA belum dipasang oleh administrator sistem), sehingga belum dapat diaktifkan.</p>
        </div>
      )}

      {status.configured && !status.enabled && !pendingSecret && recoveryCodes.length === 0 && (
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 leading-relaxed">
            Lindungi akun staf Anda dengan kode 6 digit dari aplikasi authenticator (Google Authenticator, Microsoft Authenticator, Authy, dan sejenisnya). Setelah aktif, login memerlukan password <strong>dan</strong> kode tersebut.
          </p>
          <button
            type="button" onClick={startSetup} disabled={busy}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
            Siapkan Verifikasi Dua Langkah
          </button>
        </div>
      )}

      {status.configured && !status.enabled && pendingSecret && (
        <div className="space-y-3 text-xs">
          <p className="text-slate-600 leading-relaxed">
            1. Buka aplikasi authenticator, pilih tambah akun manual, lalu masukkan kunci rahasia berikut (atau salin tautan otpauth di bawahnya):
          </p>
          <div className="flex items-center gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
            <code className="min-w-0 break-all font-mono font-bold text-slate-800 tracking-wider">{pendingSecret}</code>
            <button type="button" onClick={copySecret} className="shrink-0 text-slate-500 hover:text-slate-700 cursor-pointer" aria-label="Salin kunci rahasia">
              {copied ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
            </button>
          </div>
          <p className="break-all font-mono text-[10px] text-slate-400">{otpAuthUrl}</p>
          <p className="text-slate-600">2. Masukkan kode 6 digit yang tampil di aplikasi untuk menyelesaikan aktivasi:</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" value={activateCode}
              onChange={(e) => setActivateCode(e.target.value)} placeholder="123456"
              className="w-full sm:w-44 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm tracking-widest focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:bg-white"
            />
            <button
              type="button" onClick={confirmActivate} disabled={busy || !activateCode.trim()}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              Verifikasi & Aktifkan
            </button>
          </div>
        </div>
      )}

      {recoveryCodes.length > 0 && (
        <div className="space-y-3 text-xs p-3 bg-amber-50 border border-amber-200 rounded-xl">
          <p className="font-bold text-amber-900">Simpan kode pemulihan ini sekarang — hanya ditampilkan satu kali.</p>
          <p className="text-amber-800 text-[11px]">Setiap kode hanya dapat dipakai satu kali untuk login bila Anda kehilangan akses ke aplikasi authenticator.</p>
          <div className="grid grid-cols-2 gap-1.5 font-mono font-bold text-slate-800">
            {recoveryCodes.map(code => <span key={code} className="bg-white border border-amber-200 rounded-lg px-2 py-1.5 text-center tracking-widest">{code}</span>)}
          </div>
          <button
            type="button" onClick={() => setRecoveryCodes([])}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-4 py-2 rounded-xl text-xs cursor-pointer"
          >
            Saya Sudah Menyimpan Kode Pemulihan
          </button>
        </div>
      )}

      {status.enabled && (
        <div className="space-y-3 text-xs">
          <p className="text-slate-600">
            Verifikasi dua langkah aktif. Sisa kode pemulihan yang belum terpakai: <strong>{status.recoveryCodesRemaining}</strong>.
            Bila Anda kehilangan authenticator dan seluruh kode pemulihan, minta administrator menonaktifkan 2FA akun Anda.
          </p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <input
              type="text" inputMode="numeric" autoComplete="one-time-code" value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)} placeholder="Kode authenticator (untuk menonaktifkan)"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
            />
            <input
              type="password" value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)} placeholder="atau password akun Anda"
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-rose-400 focus:bg-white"
            />
          </div>
          <button
            type="button" onClick={confirmDisable} disabled={busy || (!disableCode.trim() && !disablePassword)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-4 py-2.5 rounded-xl text-xs cursor-pointer disabled:opacity-60 inline-flex items-center gap-2"
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldAlert className="w-4 h-4" />}
            Nonaktifkan Verifikasi Dua Langkah
          </button>
        </div>
      )}
    </div>
  );
};
