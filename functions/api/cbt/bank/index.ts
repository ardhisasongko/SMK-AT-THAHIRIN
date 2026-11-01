import type { AuthUser } from '../../../_lib/auth';
import { isCbtStaff, parseJson, validateCbtQuestions } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

// Bank soal CBT: soal dipakai ulang lintas ujian. Guru mengelola miliknya;
// admin/super_admin melihat & mengelola semua. Siswa tidak punya akses.
// Menyalin soal bank ke paket ujian adalah snapshot (baris cbt_questions
// baru) — mengubah bank tidak mengubah ujian yang sudah dibuat.

function rowToItem(row: any) {
  return {
    id: String(row.id),
    subject: String(row.subject),
    topic: row.topic ? String(row.topic) : '',
    type: String(row.question_type || 'pg') as 'pg' | 'essai',
    question: String(row.question),
    options: parseJson(row.options_json, []),
    correctAnswer: row.correct_answer != null ? String(row.correct_answer) : '',
    explanation: row.explanation ? String(row.explanation) : '',
    ownerUserId: String(row.owner_user_id),
    ownerName: String(row.owner_name),
    createdAt: String(row.created_at || ''),
    updatedAt: String(row.updated_at || ''),
  };
}

function canManageBankItem(user: AuthUser, row: { owner_user_id?: unknown; owner_name?: unknown }): boolean {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  return row.owner_user_id === user.id || (!row.owner_user_id && row.owner_name === user.name);
}

function validateBankInput(body: any): string | null {
  if (typeof body?.subject !== 'string' || !body.subject.trim() || body.subject.length > 150) return 'Mata pelajaran wajib diisi dan maksimal 150 karakter.';
  if (body.topic != null && body.topic !== '' && (typeof body.topic !== 'string' || body.topic.length > 150)) return 'Topik maksimal 150 karakter.';
  const question = body?.question;
  if (!question || typeof question !== 'object') return 'Soal tidak valid.';
  return validateCbtQuestions([{ ...question, id: 'bank-item' }]);
}

function questionFields(body: any) {
  const question = body.question;
  return {
    subject: String(body.subject).trim(),
    topic: typeof body.topic === 'string' && body.topic.trim() ? body.topic.trim() : null,
    type: question.type === 'essai' ? 'essai' : 'pg',
    question: String(question.question).trim(),
    optionsJson: JSON.stringify((question.options || []).map((option: any) => ({ key: option.key, text: String(option.text).trim() }))),
    correctAnswer: question.type === 'essai' ? String(question.correctAnswer).trim() : question.correctAnswer,
    explanation: question.explanation ? String(question.explanation).slice(0, 2000) : null,
  };
}

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  const isAdmin = data.user.role === 'admin' || data.user.role === 'super_admin';
  const url = new URL(request.url);
  const subject = url.searchParams.get('subject') || '';
  const search = (url.searchParams.get('q') || '').toLowerCase();
  const query = isAdmin
    ? 'SELECT * FROM cbt_question_bank ORDER BY updated_at DESC'
    : 'SELECT * FROM cbt_question_bank WHERE owner_user_id=? OR (owner_user_id IS NULL AND owner_name=?) ORDER BY updated_at DESC';
  const statement = isAdmin ? env.DB.prepare(query) : env.DB.prepare(query).bind(data.user.id, data.user.name);
  const { results } = await statement.all();
  const items = (results as any[]).map(rowToItem).filter(item =>
    (!subject || item.subject === subject) && (!search || item.question.toLowerCase().includes(search) || item.subject.toLowerCase().includes(search) || (item.topic || '').toLowerCase().includes(search)));
  return jsonResponse({ success: true, data: items });
};

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const validationError = validateBankInput(body);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);
  const fields = questionFields(body);
  const id = `bank-${crypto.randomUUID()}`;
  await env.DB.prepare(`INSERT INTO cbt_question_bank (id,owner_user_id,owner_name,subject,topic,question_type,question,options_json,correct_answer,explanation) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .bind(id, data.user.id, data.user.name, fields.subject, fields.topic, fields.type, fields.question, fields.optionsJson, fields.correctAnswer, fields.explanation).run();
  const row = await env.DB.prepare('SELECT * FROM cbt_question_bank WHERE id=?').bind(id).first<any>();
  return jsonResponse({ success: true, data: rowToItem(row) }, 201);
};

export const onRequestPatch: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const row = await env.DB.prepare('SELECT * FROM cbt_question_bank WHERE id=?').bind(String(body?.id || '')).first<any>();
  if (!row) return jsonResponse({ success: false, error: 'Soal bank tidak ditemukan.' }, 404);
  if (!canManageBankItem(data.user, row)) return jsonResponse({ success: false, error: 'Anda hanya dapat mengelola soal bank milik sendiri.' }, 403);
  const validationError = validateBankInput(body);
  if (validationError) return jsonResponse({ success: false, error: validationError }, 400);
  const fields = questionFields(body);
  await env.DB.prepare(`UPDATE cbt_question_bank SET subject=?,topic=?,question_type=?,question=?,options_json=?,correct_answer=?,explanation=?,updated_at=datetime('now') WHERE id=?`)
    .bind(fields.subject, fields.topic, fields.type, fields.question, fields.optionsJson, fields.correctAnswer, fields.explanation, row.id).run();
  const updated = await env.DB.prepare('SELECT * FROM cbt_question_bank WHERE id=?').bind(row.id).first<any>();
  return jsonResponse({ success: true, data: rowToItem(updated) });
};

export const onRequestDelete: PagesFunction<Env, any, AuthData> = async ({ env, data, request }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  if (!isCbtStaff(data.user)) return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  let body: any;
  try { body = await request.json(); } catch { return jsonResponse({ success: false, error: 'Body harus JSON.' }, 400); }
  const row = await env.DB.prepare('SELECT * FROM cbt_question_bank WHERE id=?').bind(String(body?.id || '')).first<any>();
  if (!row) return jsonResponse({ success: false, error: 'Soal bank tidak ditemukan.' }, 404);
  if (!canManageBankItem(data.user, row)) return jsonResponse({ success: false, error: 'Anda hanya dapat menghapus soal bank milik sendiri.' }, 403);
  await env.DB.prepare('DELETE FROM cbt_question_bank WHERE id=?').bind(row.id).run();
  return jsonResponse({ success: true, data: { id: String(row.id) } });
};
