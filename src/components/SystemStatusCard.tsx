import React, { useEffect, useState } from 'react';
import { Activity, Database, Users, ShieldAlert, Lock, Sparkles, MessageCircle, GitBranch, Loader2 } from 'lucide-react';
import { authHeaders } from '../utils/auth';

interface SystemStatusData {
  generatedAt: string;
  latestMigration: string;
  db: { ok: boolean; latencyMs: number | null };
  activeSessions: number | null;
  loginFailures24h: number | null;
  activeLockouts: number | null;
  aiQuotaToday: { day: string; used: number; limit: number };
  features: {
    geminiEnabled: boolean;
    geminiConfigured: boolean;
    twoFactorConfigured: boolean;
    turnstileEnabled: boolean;
  };
}

interface IntegrationStatusData {
  system?: SystemStatusData;
  whatsapp?: {
    configured?: boolean;
    enabled?: boolean;
    gatewayStatus?: string | null;
    lastHeartbeatAt?: string | null;
    emergencyPause?: boolean;
  };
}

function StatTile({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: string; hint?: string }) {
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs space-y-1">
      <div className="flex items-center gap-2 text-slate-500">
        {icon}
        <span className="text-[11px] font-bold uppercase tracking-wide">{label}</span>
      </div>
      <p className="text-lg font-extrabold text-slate-900 break-words">{value}</p>
      {hint && <p className="text-[11px] text-slate-400">{hint}</p>}
    </div>
  );
}

function formatHeartbeat(value: string | null | undefined): string {
  if (!value) return 'Belum pernah terhubung';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }) + ' WIB';
}

/**
 * Panel status sistem untuk admin/super_admin (hardening Fase E).
 * Membaca /api/integrations/status (bagian `system` dari Fase E + status
 * gateway WhatsApp yang sudah ada). Fail-soft: bila gagal dimuat, kartu
 * tidak dirender agar tidak mengganggu panel admin lainnya.
 */
export const SystemStatusCard: React.FC = () => {
  const [data, setData] = useState<IntegrationStatusData | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/integrations/status', { headers: authHeaders() });
        const json = await res.json() as { success?: boolean; data?: IntegrationStatusData };
        if (!cancelled) {
          if (res.ok && json.success && json.data?.system) setData(json.data);
          else setFailed(true);
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (failed) return null;
  if (!data?.system) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs text-xs text-slate-500 flex items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" /> Memuat status sistem...
      </div>
    );
  }

  const system = data.system;
  const whatsapp = data.whatsapp || {};
  const quotaText = system.aiQuotaToday.limit > 0
    ? `${system.aiQuotaToday.used} / ${system.aiQuotaToday.limit}`
    : `${system.aiQuotaToday.used} (tanpa batas)`;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
        <Activity className="w-4 h-4 text-emerald-600" />
        Status Sistem & Keamanan
        <span className="text-[10px] font-semibold text-slate-400">
          diperbarui {new Date(system.generatedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })} WIB
        </span>
      </h3>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile
          icon={<Database className="w-4 h-4" />}
          label="Database"
          value={system.db.ok ? 'Sehat' : 'Bermasalah'}
          hint={system.db.latencyMs !== null ? `Latensi ${system.db.latencyMs} ms` : 'Tidak terjangkau'}
        />
        <StatTile
          icon={<Users className="w-4 h-4" />}
          label="Sesi Aktif"
          value={system.activeSessions === null ? '—' : String(system.activeSessions)}
          hint="Pengguna yang sedang login"
        />
        <StatTile
          icon={<ShieldAlert className="w-4 h-4" />}
          label="Login Gagal 24 Jam"
          value={system.loginFailures24h === null ? '—' : String(system.loginFailures24h)}
          hint="Percobaan login yang ditolak"
        />
        <StatTile
          icon={<Lock className="w-4 h-4" />}
          label="Lockout Aktif"
          value={system.activeLockouts === null ? '—' : String(system.activeLockouts)}
          hint="Akun/IP yang sedang dikunci"
        />
        <StatTile
          icon={<Sparkles className="w-4 h-4" />}
          label="Kuota AI Hari Ini"
          value={quotaText}
          hint={`Per ${system.aiQuotaToday.day} (WIB)`}
        />
        <StatTile
          icon={<MessageCircle className="w-4 h-4" />}
          label="Gateway WhatsApp"
          value={whatsapp.configured === false ? 'Belum diatur' : String(whatsapp.gatewayStatus || 'Tidak diketahui')}
          hint={`Heartbeat: ${formatHeartbeat(whatsapp.lastHeartbeatAt)}`}
        />
        <StatTile
          icon={<GitBranch className="w-4 h-4" />}
          label="Migrasi Dikenal Kode"
          value={system.latestMigration}
          hint="Versi skema terakhir pada rilis ini"
        />
        <StatTile
          icon={<ShieldAlert className="w-4 h-4" />}
          label="Fitur Keamanan"
          value={[
            system.features.twoFactorConfigured ? '2FA siap' : '2FA belum dikonfigurasi',
            system.features.turnstileEnabled ? 'Turnstile aktif' : 'Turnstile mati',
          ].join(' · ')}
          hint={system.features.geminiEnabled ? 'Gemini aktif' : 'Gemini nonaktif'}
        />
      </div>
    </div>
  );
};
