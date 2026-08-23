import type { AuthUser } from './auth';

export const CBT_STAFF_ROLES = ['guru', 'admin', 'super_admin'];
export const CBT_STUDENT_ROLES = ['siswa', 'ketua_kelas'];
export const ANSWER_KEYS = new Set(['A', 'B', 'C', 'D', 'E']);
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function hashCbtToken(token: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(token.trim().toUpperCase()));
  return Array.from(new Uint8Array(bytes)).map(value => value.toString(16).padStart(2, '0')).join('');
}

export function isCbtStaff(user: AuthUser): boolean {
  return CBT_STAFF_ROLES.includes(user.role);
}

export function isCbtStudent(user: AuthUser): boolean {
  return CBT_STUDENT_ROLES.includes(user.role);
}

export function canManageCbtExam(user: AuthUser, exam: { teacher_user_id?: unknown; teacher_name?: unknown }): boolean {
  if (user.role === 'admin' || user.role === 'super_admin') return true;
  if (user.role !== 'guru') return false;
  return exam.teacher_user_id === user.id
    || (!exam.teacher_user_id && exam.teacher_name === user.name);
}

export function todayWIB(): string {
  return new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

export function nowWIBMinutes(): number {
  const now = new Date(Date.now() + 7 * 3600 * 1000);
  return now.getUTCHours() * 60 + now.getUTCMinutes();
}

export function timeToMinutes(value: string): number {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function isValidTime(value: unknown): value is string {
  return typeof value === 'string' && TIME_PATTERN.test(value);
}

export function cbtWindowOpen(exam: { open_time?: string | null; close_time?: string | null }, nowMinutes = nowWIBMinutes()): { open: boolean; reason?: string } {
  if (isValidTime(exam.open_time) && nowMinutes < timeToMinutes(exam.open_time)) {
    return { open: false, reason: `Ujian belum dibuka. Dibuka pukul ${exam.open_time} WIB.` };
  }
  if (isValidTime(exam.close_time) && nowMinutes >= timeToMinutes(exam.close_time)) {
    return { open: false, reason: `Ujian sudah ditutup. Ditutup pukul ${exam.close_time} WIB.` };
  }
  return { open: true };
}

export function effectiveCbtStatus(exam: { status: string; start_date: string; end_date: string; is_active?: number | null }): 'active' | 'upcoming' | 'inactive' | 'completed' {
  if (exam.status === 'completed' || exam.end_date < todayWIB()) return 'completed';
  if (Number(exam.is_active ?? 1) === 0) return 'inactive';
  if (exam.start_date > todayWIB()) return 'upcoming';
  return 'active';
}

export function parseJson<T>(value: unknown, fallback: T): T {
  try {
    return typeof value === 'string' ? JSON.parse(value) as T : fallback;
  } catch {
    return fallback;
  }
}

export function normalizeText(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

// Essai dinilai benar bila SEMUA kata penting dari salah satu alternatif kunci
// (dipisah "|") muncul sebagai kata utuh di jawaban siswa — bukan cukup satu
// substring. Ini mencegah gaming dengan menempelkan satu-dua kata kunci di
// jawaban asal. Kata pendek (<3 karakter, mis. angka) memakai fallback substring.
function significantTokens(value: string): string[] {
  // Bersihkan tanda baca di tepi token ("kegiatan." -> "kegiatan").
  return normalizeText(value).split(' ')
    .map(token => token.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ''))
    .filter(Boolean);
}

export function isEssayAnswerCorrect(answer: string, key: string): boolean {
  const normalizedAnswer = normalizeText(answer);
  if (!normalizedAnswer) return false;
  const answerTokens = new Set(significantTokens(answer));
  return key.split('|').some(part => {
    const tokens = significantTokens(part).filter(token => token.length >= 3);
    if (tokens.length === 0) {
      // Kunci pendek/angka: wajib cocok sebagai kata utuh ('2' tidak kena di '12').
      const normalizedPart = normalizeText(part);
      return normalizedPart !== '' && answerTokens.has(normalizedPart);
    }
    return tokens.every(token => answerTokens.has(token));
  });
}

export function scoreCbtAnswers(questions: Array<{ id: string; type?: string; correctAnswer?: string }>, answers: Record<string, string>) {
  const correctCount = questions.filter(question => {
    const answer = answers[question.id];
    if (typeof answer !== 'string' || !answer.trim()) return false;
    if (question.type === 'essai') return isEssayAnswerCorrect(answer, question.correctAnswer || '');
    return answer === question.correctAnswer;
  }).length;
  const wrongCount = questions.length - correctCount;
  return { correctCount, wrongCount, score: questions.length ? Math.round(correctCount / questions.length * 100) : 0 };
}

export function resolveMinSubmitSeconds(exam: { exam_type?: unknown; min_submit_minutes?: unknown; duration_minutes?: unknown }): number {
  if (String(exam?.exam_type || 'latihan') !== 'ujian') return 0;
  const duration = Number(exam?.duration_minutes || 0);
  const min = exam?.min_submit_minutes != null ? Number(exam.min_submit_minutes) : Math.round(duration * 0.8);
  if (!Number.isFinite(min) || min < 1) return 0;
  return Math.min(Math.round(min), Math.max(duration, 1)) * 60;
}

export function validateCbtExamInput(body: any, tokenRequired = true): string | null {
  const questions = Array.isArray(body?.questions) ? body.questions : [];
  if (typeof body?.title !== 'string' || !body.title.trim() || body.title.length > 200) return 'Judul ujian wajib diisi dan maksimal 200 karakter.';
  if (typeof body.subject !== 'string' || !body.subject.trim() || body.subject.length > 150) return 'Mata pelajaran wajib diisi dan maksimal 150 karakter.';
  if (!Number.isInteger(body.durationMinutes) || body.durationMinutes < 1 || body.durationMinutes > 300) return 'Durasi ujian harus 1-300 menit.';
  if (tokenRequired && (typeof body.token !== 'string' || body.token.trim().length < 4 || body.token.length > 32)) return 'Token ujian harus 4-32 karakter.';
  if (!tokenRequired && body.token && (typeof body.token !== 'string' || body.token.trim().length < 4 || body.token.length > 32)) return 'Token ujian harus 4-32 karakter.';
  if (!isValidDate(body.startDate) || !isValidDate(body.endDate) || body.endDate < body.startDate) return 'Rentang tanggal ujian tidak valid.';
  if (body.examType !== undefined && body.examType !== null && body.examType !== 'latihan' && body.examType !== 'ujian') return 'Jenis ujian harus "latihan" atau "ujian".';
  if (body.minSubmitMinutes !== undefined && body.minSubmitMinutes !== null) {
    if (!Number.isInteger(body.minSubmitMinutes) || body.minSubmitMinutes < 1 || body.minSubmitMinutes > body.durationMinutes) return 'Waktu minimal kirim harus 1 sampai durasi ujian (menit).';
  }
  if (body.openTime && !isValidTime(body.openTime)) return 'Jam buka harus berformat HH:MM (contoh: 08:00).';
  if (body.closeTime && !isValidTime(body.closeTime)) return 'Jam tutup harus berformat HH:MM (contoh: 11:30).';
  if (body.openTime && body.closeTime && timeToMinutes(body.closeTime) <= timeToMinutes(body.openTime)) return 'Jam tutup harus lebih lambat dari jam buka.';
  return validateCbtQuestions(questions);
}

export function validateCbtQuestions(questions: unknown): string | null {
  if (!Array.isArray(questions)) return 'Daftar soal tidak valid.';
  if (questions.length < 1 || questions.length > 200) return 'Jumlah soal harus 1-200.';

  const questionIds = new Set<string>();
  for (const question of questions) {
    const id = typeof question?.id === 'string' ? question.id.trim() : '';
    if (!id || id.length > 100 || questionIds.has(id)) return 'Setiap soal harus memiliki ID unik maksimal 100 karakter.';
    questionIds.add(id);
    if (typeof question.question !== 'string' || !question.question.trim() || question.question.length > 2000) return 'Pertanyaan tidak valid.';
    if (question.type === 'essai') {
      if (typeof question.correctAnswer !== 'string' || !question.correctAnswer.trim() || question.correctAnswer.length > 2000) return 'Kunci jawaban essai wajib diisi (maksimal 2000 karakter).';
      if (Array.isArray(question.options) && question.options.length > 0) return 'Soal essai tidak boleh memiliki opsi pilihan ganda.';
      continue;
    }
    if (!ANSWER_KEYS.has(question.correctAnswer)) return 'Kunci jawaban pilihan ganda tidak valid.';
    if (!Array.isArray(question.options) || question.options.length !== ANSWER_KEYS.size) return 'Setiap soal wajib memiliki opsi A-E lengkap.';
    const optionKeys = new Set<string>();
    for (const option of question.options) {
      if (!option || !ANSWER_KEYS.has(option.key) || optionKeys.has(option.key) || typeof option.text !== 'string' || !option.text.trim() || option.text.length > 1000) return 'Opsi A-E harus unik dan berisi teks.';
      optionKeys.add(option.key);
    }
    if (optionKeys.size !== ANSWER_KEYS.size) return 'Setiap soal wajib memiliki opsi A-E lengkap.';
  }
  return null;
}

function isValidDate(value: unknown): value is string {
  if (typeof value !== 'string' || !DATE_PATTERN.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export async function getExamQuestions(db: D1Database, examId: string, includeAnswers: boolean): Promise<any[]> {
  const { results } = await db.prepare(
    'SELECT id, question, question_type, options_json, correct_answer, explanation FROM cbt_questions WHERE exam_id = ? ORDER BY position'
  ).bind(examId).all();
  return results.map((row: any) => ({
    id: String(row.id),
    question: String(row.question),
    type: String(row.question_type || 'pg') as 'pg' | 'essai',
    options: parseJson(row.options_json, []),
    ...(includeAnswers ? { correctAnswer: row.correct_answer != null ? String(row.correct_answer) : undefined, explanation: row.explanation ? String(row.explanation) : undefined } : {}),
  }));
}

export async function canTakeExam(db: D1Database, user: AuthUser, exam: any): Promise<boolean> {
  if (!isCbtStudent(user) || !user.classId) return false;
  if (exam.class_target === 'Semua Kelas MPLB' || exam.class_target === 'all' || exam.class_target === user.classId) return true;
  const classesRow = await db.prepare("SELECT value FROM app_data WHERE key = 'kelas_v1'").first<{ value: string }>();
  const classes = parseJson<any[]>(classesRow?.value, []);
  return classes.some(item => item.id === user.classId && item.name === exam.class_target);
}

