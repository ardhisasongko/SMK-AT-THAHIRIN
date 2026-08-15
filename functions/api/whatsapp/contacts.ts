import type { AuthUser } from '../../_lib/auth';
import { jsonResponse } from '../../_lib/response';
import { maskPhone, normalizeIndonesianPhone } from '../../_lib/whatsapp';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };
const allowed = (u: AuthUser | null) => !!u && ['super_admin', 'admin'].includes(u.role);

export function consentTransition(previousConsentAt: string | null | undefined, consent: boolean): 'granted' | 'revoked' | null {
  if (Boolean(previousConsentAt) === consent) return null;
  return consent ? 'granted' : 'revoked';
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!allowed(data.user)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  const roster = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'siswa_v1'").first();
  const students = roster ? JSON.parse(String(roster.value)) as any[] : [];
  const { results } = await env.DB.prepare(`SELECT c.*,
    (SELECT provenance FROM whatsapp_consent_events e WHERE e.student_id=c.student_id ORDER BY recorded_at DESC LIMIT 1) consent_provenance,
    (SELECT recorded_at FROM whatsapp_consent_events e WHERE e.student_id=c.student_id AND e.action='revoked' ORDER BY recorded_at DESC LIMIT 1) revoked_at
    FROM guardian_contacts c`).all();
  const byStudent = new Map(results.map((r: any) => [String(r.student_id), r]));
  return jsonResponse({ success: true, data: students.map(s => {
    const c: any = byStudent.get(String(s.id)) || {};
    return { studentId: s.id, studentName: s.name, nisn: s.nisn, classId: s.classId,
      guardian1Name: c.guardian_1_name || '', guardian1Phone: c.guardian_1_phone || '', guardian1Masked: maskPhone(c.guardian_1_phone), guardian1Enabled: Number(c.guardian_1_enabled || 0) === 1,
      guardian2Name: c.guardian_2_name || '', guardian2Phone: c.guardian_2_phone || '', guardian2Masked: maskPhone(c.guardian_2_phone), guardian2Enabled: Number(c.guardian_2_enabled || 0) === 1,
      consentAt: c.consent_at || null, consentProvenance: c.consent_provenance || null, revokedAt: c.revoked_at || null };
  }) });
};

export const onRequestPut: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!allowed(data.user)) return jsonResponse({ success: false, error: 'Akses ditolak.' }, 403);
  let b: any; try { b = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  if (!b.studentId) return jsonResponse({ success: false, error: 'Siswa wajib dipilih.' }, 400);
  const roster = await env.DB.prepare("SELECT value FROM app_data WHERE key = 'siswa_v1'").first();
  let students: any[] = [];
  try { students = roster ? JSON.parse(String(roster.value)) : []; } catch { return jsonResponse({ success: false, error: 'Data siswa tidak dapat dibaca.' }, 500); }
  if (!Array.isArray(students)) return jsonResponse({ success: false, error: 'Data siswa tidak dapat dibaca.' }, 500);
  if (!students.some(student => String(student.id) === String(b.studentId))) return jsonResponse({ success: false, error: 'Siswa tidak ditemukan.' }, 404);
  const p1 = b.guardian1Phone ? normalizeIndonesianPhone(b.guardian1Phone) : null;
  const p2 = b.guardian2Phone ? normalizeIndonesianPhone(b.guardian2Phone) : null;
  if ((b.guardian1Phone && !p1) || (b.guardian2Phone && !p2)) return jsonResponse({ success: false, error: 'Format nomor WhatsApp tidak valid.' }, 400);
  if ((b.guardian1Enabled || b.guardian2Enabled) && !b.consent) return jsonResponse({ success: false, error: 'Persetujuan wali wajib dicatat.' }, 400);
  const now = new Date().toISOString();
  const previous: any = await env.DB.prepare('SELECT consent_at FROM guardian_contacts WHERE student_id=?').bind(b.studentId).first();
  const consent = Boolean(b.consent && (b.guardian1Enabled || b.guardian2Enabled));
  const provenance = String(b.consentProvenance || 'admin_panel').slice(0, 100);
  const contactStatement = env.DB.prepare(`INSERT INTO guardian_contacts
    (student_id, guardian_1_name, guardian_1_phone, guardian_1_enabled, guardian_2_name, guardian_2_phone, guardian_2_enabled, consent_at, updated_by, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(student_id) DO UPDATE SET guardian_1_name=excluded.guardian_1_name, guardian_1_phone=excluded.guardian_1_phone,
    guardian_1_enabled=excluded.guardian_1_enabled, guardian_2_name=excluded.guardian_2_name, guardian_2_phone=excluded.guardian_2_phone,
    guardian_2_enabled=excluded.guardian_2_enabled, consent_at=excluded.consent_at, updated_by=excluded.updated_by, updated_at=excluded.updated_at`)
    .bind(b.studentId, b.guardian1Name || null, p1, consent && b.guardian1Enabled ? 1 : 0, b.guardian2Name || null, p2, consent && b.guardian2Enabled ? 1 : 0, consent ? (previous?.consent_at || now) : null, data.user!.id, now);
  const consentAction = consentTransition(previous?.consent_at, consent);
  const statements = [contactStatement];
  if (consentAction) {
    statements.push(env.DB.prepare('INSERT INTO whatsapp_consent_events (id,student_id,action,provenance,recorded_by,recorded_at) VALUES (?,?,?,?,?,?)')
      .bind(`consent-${crypto.randomUUID()}`,b.studentId,consentAction,provenance,data.user!.id,now));
  }
  await env.DB.batch(statements);
  return jsonResponse({ success: true, data: { guardian1Masked: maskPhone(p1), guardian2Masked: maskPhone(p2) } });
};
