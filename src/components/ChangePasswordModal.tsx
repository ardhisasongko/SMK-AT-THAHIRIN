import { useState } from 'react';
import type { FormEvent } from 'react';
import { KeyRound, LogOut } from 'lucide-react';

interface Props { token: string; onChanged: () => void; onLogout: () => void }

export function ChangePasswordModal({ token, onChanged, onLogout }: Props) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError('Konfirmasi password tidak sama.');
    setLoading(true); setError('');
    try {
      const res = await fetch('/api/auth/change-password', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const json = await res.json() as { success?: boolean; error?: string };
      if (!res.ok || !json.success) setError(json.error || 'Gagal mengganti password.');
      else onChanged();
    } catch { setError('Gagal terhubung ke server.'); }
    finally { setLoading(false); }
  };

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/80 p-4 backdrop-blur-sm">
    <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
      <div className="flex items-center gap-3"><div className="rounded-xl bg-emerald-100 p-3 text-emerald-700"><KeyRound /></div><div><h2 className="font-extrabold text-slate-900">Ganti Password Awal</h2><p className="text-xs text-slate-500">Wajib dilakukan sebelum menggunakan aplikasi.</p></div></div>
      {error && <p className="rounded-xl bg-rose-50 p-3 text-xs font-bold text-rose-700">{error}</p>}
      <input type="password" required placeholder="Password saat ini" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
      <input type="password" required minLength={8} placeholder="Password baru (minimal 8 karakter)" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
      <input type="password" required placeholder="Ulangi password baru" value={confirm} onChange={e => setConfirm(e.target.value)} className="w-full rounded-xl border border-slate-200 p-3 text-sm" />
      <button disabled={loading} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white disabled:opacity-50 cursor-pointer">{loading ? 'Menyimpan...' : 'Ganti Password'}</button>
      <button type="button" onClick={onLogout} className="flex w-full items-center justify-center gap-2 text-xs font-bold text-slate-500 cursor-pointer"><LogOut className="h-4 w-4" />Keluar</button>
    </form>
  </div>;
}
