import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Archive, Edit, KeyRound, Plus, RefreshCw, Search, ShieldCheck, Upload, UserCog, UserX, X } from 'lucide-react';
import type { User } from '../types';
import { authHeaders } from '../utils/auth';
import { Modal } from './ui/Modal';

type ManagedUser = { id: string; name: string; email: string; nipNisn: string; role: string; classId?: string; jabatan?: string; status: string; createdAt: string };
type Audit = { id: string; actor_name: string; actor_role: string; action: string; target_name?: string; reason?: string; created_at: string };

export function UserManagementSection({ currentUser }: { currentUser: User }) {
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [audit, setAudit] = useState<Audit[]>([]);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('active');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ManagedUser | null>(null);
  const [credentials, setCredentials] = useState<Array<{ identifier: string; password: string }> | null>(null);
  const [message, setMessage] = useState('');
  const [form, setForm] = useState({ name: '', email: '', identifier: '', role: 'guru', classId: '', jabatan: '' });
  const isSuper = currentUser.role === 'super_admin';

  const load = async () => {
    const [u, a] = await Promise.all([
      fetch(`/api/users?status=${status}`, { headers: authHeaders() }),
      fetch('/api/users/audit', { headers: authHeaders() }),
    ]);
    const uj = await u.json() as { data?: ManagedUser[] };
    const aj = await a.json() as { data?: Audit[] };
    setUsers(uj.data || []); setAudit(aj.data || []);
  };
  useEffect(() => { load(); }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  const create = async (e: FormEvent) => {
    e.preventDefault(); setMessage('');
    const res = await fetch('/api/users', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(form) });
    const json = await res.json() as { success?: boolean; error?: string; initialPassword?: string };
    if (!res.ok) return setMessage(json.error || 'Gagal membuat akun.');
    setCredentials([{ identifier: form.identifier, password: json.initialPassword! }]);
    setShowCreate(false); setForm({ name: '', email: '', identifier: '', role: 'guru', classId: '', jabatan: '' }); load();
  };
  const saveEdit = async (e: FormEvent) => {
    e.preventDefault(); if (!editing) return;
    const res = await fetch('/api/users', { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: editing.id, name: editing.name, email: editing.email, identifier: editing.nipNisn, role: editing.role, classId: editing.classId || null, jabatan: editing.jabatan || null, reason: 'Pembaruan data melalui panel admin' }) });
    const json = await res.json() as { error?: string };
    if (!res.ok) return setMessage(json.error || 'Gagal memperbarui akun.');
    setEditing(null); load();
  };
  const importCsv = async (file: File) => {
    setMessage('');
    const lines = (await file.text()).split(/\r?\n/).filter(Boolean);
    if (lines.length < 2) return setMessage('CSV tidak memiliki data.');
    const headers = lines[0].split(',').map(v => v.trim());
    const created: Array<{ identifier: string; password: string }> = [];
    for (const line of lines.slice(1)) {
      const values = line.split(',').map(v => v.trim());
      const row = Object.fromEntries(headers.map((h, i) => [h, values[i] || '']));
      const res = await fetch('/api/users', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify(row) });
      const json = await res.json() as { error?: string; initialPassword?: string };
      if (!res.ok) { setMessage(`Impor berhenti pada ${row.name || 'baris data'}: ${json.error || 'gagal'}`); break; }
      created.push({ identifier: row.identifier, password: json.initialPassword! });
    }
    if (created.length) setCredentials(created);
    load();
  };

  const setActive = async (u: ManagedUser, next: 'active' | 'inactive') => {
    const reason = prompt(`Alasan ${next === 'active' ? 'mengaktifkan' : 'menonaktifkan'} akun ${u.name}:`);
    if (!reason) return;
    await fetch('/api/users', { method: 'PATCH', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: u.id, status: next, reason }) });
    load();
  };
  const archive = async (u: ManagedUser) => {
    const reason = prompt(`Alasan mengarsipkan akun ${u.name}:`); if (!reason) return;
    await fetch('/api/users', { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: u.id, reason }) }); load();
  };
  const permanentDelete = async (u: ManagedUser) => {
    const reason = prompt(`Alasan menghapus permanen akun ${u.name}:`); if (!reason) return;
    const password = prompt('Masukkan password Super Admin untuk konfirmasi:'); if (!password) return;
    const res = await fetch('/api/users', { method: 'DELETE', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: u.id, reason, password, permanent: true }) });
    const json = await res.json() as { success?: boolean; error?: string };
    if (!res.ok) return setMessage(json.error || 'Gagal menghapus permanen.');
    load();
  };
  const resetPassword = async (u: ManagedUser) => {
    if (!confirm(`Reset password ${u.name}? Semua sesi akun akan dikeluarkan.`)) return;
    const res = await fetch('/api/users/reset-password', { method: 'POST', headers: authHeaders({ 'Content-Type': 'application/json' }), body: JSON.stringify({ id: u.id }) });
    const json = await res.json() as { initialPassword?: string; error?: string };
    if (!res.ok) return setMessage(json.error || 'Gagal reset password.');
    setCredentials([{ identifier: u.nipNisn, password: json.initialPassword! }]); load();
  };
  const visible = users.filter(u => `${u.name} ${u.email} ${u.nipNisn}`.toLowerCase().includes(search.toLowerCase()));

  return <div className="mx-auto min-w-0 max-w-7xl space-y-6 overflow-hidden px-4 py-8 sm:px-6 lg:px-8">
    <div className="flex flex-col justify-between gap-4 rounded-3xl bg-slate-900 p-6 text-white sm:flex-row sm:items-center sm:p-8">
      <div className="min-w-0"><span className="text-xs font-bold text-emerald-400">{isSuper ? 'SUPER ADMIN' : 'ADMINISTRATOR'}</span><h1 className="mt-1 text-2xl font-extrabold">Manajemen Pengguna</h1><p className="mt-1 text-xs text-slate-300">Kelola akun tanpa menghapus riwayat akademik.</p></div>
      <div className="flex flex-col gap-2 sm:flex-row"><label className="flex items-center justify-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm font-bold cursor-pointer"><Upload className="h-4 w-4" />Impor CSV<input type="file" accept=".csv,text/csv" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) importCsv(f); e.target.value = ''; }} /></label><button onClick={() => setShowCreate(true)} className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold cursor-pointer"><Plus className="h-4 w-4" />Tambah Pengguna</button></div>
    </div>
    {message && <p className="rounded-xl bg-rose-50 p-3 text-sm font-bold text-rose-700">{message}</p>}
    <div className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col gap-3 sm:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, email, atau nomor identitas" className="w-full rounded-xl border border-slate-200 py-2.5 pl-9 pr-3 text-sm" /></div><select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 px-3 text-sm"><option value="active">Aktif</option><option value="inactive">Nonaktif</option><option value="archived">Arsip</option><option value="all">Semua</option></select></div>
      <div className="mt-4 grid gap-3">
        {visible.map(u => <div key={u.id} className="flex min-w-0 flex-col justify-between gap-3 overflow-hidden rounded-xl border border-slate-200 p-4 md:flex-row md:items-center"><div className="min-w-0"><div className="flex min-w-0 flex-wrap items-center gap-2"><strong className="min-w-0 break-words text-sm text-slate-900">{u.name}</strong><span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase">{u.role}</span><span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${u.status === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}`}>{u.status}</span></div><p className="mt-1 break-all text-xs leading-4 text-slate-500"><span className="whitespace-nowrap">{u.nipNisn}</span><span className="mx-1">·</span>{u.email}</p></div><div className="flex shrink-0 flex-wrap gap-2"><button onClick={() => setEditing({ ...u })} className="rounded-lg bg-blue-50 p-2 text-blue-700 cursor-pointer" title="Edit akun"><Edit className="h-4 w-4" /></button><button onClick={() => resetPassword(u)} className="rounded-lg bg-slate-100 p-2 text-slate-600 cursor-pointer" title="Reset password"><KeyRound className="h-4 w-4" /></button>{u.status === 'active' ? <button onClick={() => setActive(u, 'inactive')} className="rounded-lg bg-amber-50 p-2 text-amber-700 cursor-pointer" title="Nonaktifkan"><UserX className="h-4 w-4" /></button> : u.status !== 'archived' && <button onClick={() => setActive(u, 'active')} className="rounded-lg bg-emerald-50 p-2 text-emerald-700 cursor-pointer" title="Aktifkan"><RefreshCw className="h-4 w-4" /></button>}{u.status !== 'archived' ? <button onClick={() => archive(u)} className="rounded-lg bg-rose-50 p-2 text-rose-700 cursor-pointer" title="Arsipkan"><Archive className="h-4 w-4" /></button> : isSuper && <button onClick={() => permanentDelete(u)} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-bold text-white cursor-pointer">Hapus Permanen</button>}</div></div>)}
      </div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="mb-3 flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-emerald-600" />Audit Aktivitas Terbaru</h2><div className="grid gap-2">{audit.slice(0, 20).map(a => <div key={a.id} className="rounded-lg bg-slate-50 p-3 text-xs"><strong>{a.actor_name}</strong> · {a.action} · {a.target_name || '-'}<span className="block text-slate-400">{a.created_at}{a.reason ? ` · ${a.reason}` : ''}</span></div>)}</div></div>
    {showCreate && <Modal onClose={() => setShowCreate(false)} scrollable className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-extrabold">Tambah Akun</h2><button onClick={() => setShowCreate(false)}><X /></button></div><form onSubmit={create} className="space-y-3"><input required placeholder="Nama lengkap" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input required type="email" placeholder="Email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input required placeholder="NIK/NIP/NISN" value={form.identifier} onChange={e => setForm({ ...form, identifier: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full rounded-xl border p-3 text-sm"><option value="guru">Guru</option><option value="siswa">Siswa</option>{isSuper && <option value="admin">Admin</option>}</select><input placeholder="ID kelas (untuk siswa, opsional)" value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input placeholder="Jabatan (opsional)" value={form.jabatan} onChange={e => setForm({ ...form, jabatan: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><button className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-bold text-white cursor-pointer">Buat Akun</button></form></Modal>}
    {editing && <Modal onClose={() => setEditing(null)} scrollable className="space-y-4"><div className="flex items-center justify-between"><h2 className="font-extrabold">Edit Akun</h2><button onClick={() => setEditing(null)}><X /></button></div><form onSubmit={saveEdit} className="space-y-3"><input required value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input required type="email" value={editing.email} onChange={e => setEditing({ ...editing, email: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input required value={editing.nipNisn} onChange={e => setEditing({ ...editing, nipNisn: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><select value={editing.role} onChange={e => setEditing({ ...editing, role: e.target.value })} className="w-full rounded-xl border p-3 text-sm"><option value="guru">Guru</option><option value="siswa">Siswa</option>{isSuper && <option value="admin">Admin</option>}</select><input placeholder="ID kelas" value={editing.classId || ''} onChange={e => setEditing({ ...editing, classId: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><input placeholder="Jabatan" value={editing.jabatan || ''} onChange={e => setEditing({ ...editing, jabatan: e.target.value })} className="w-full rounded-xl border p-3 text-sm" /><button className="w-full rounded-xl bg-blue-600 py-3 text-sm font-bold text-white cursor-pointer">Simpan Perubahan</button></form></Modal>}
    {credentials && <Modal onClose={() => setCredentials(null)} scrollable><div className="space-y-4 text-center"><UserCog className="mx-auto h-10 w-10 text-emerald-600" /><h2 className="font-extrabold">Kredensial Awal</h2><p className="text-xs text-rose-600">Ditampilkan satu kali. Serahkan langsung kepada pemilik akun.</p><div className="max-h-64 space-y-2 overflow-y-auto rounded-xl bg-slate-100 p-4 text-left text-sm">{credentials.map(c => <div key={c.identifier} className="border-b border-slate-200 pb-2 last:border-0"><p>Username: <strong>{c.identifier}</strong></p><p>Password: <strong>{c.password}</strong></p></div>)}</div><button onClick={() => setCredentials(null)} className="w-full rounded-xl bg-slate-900 py-3 text-sm font-bold text-white cursor-pointer">Saya Sudah Mencatat</button></div></Modal>}
  </div>;
}
