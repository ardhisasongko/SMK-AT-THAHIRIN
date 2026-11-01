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

// --- Pengacakan deterministik per attempt (Pekerjaan: shuffle soal & opsi) ---
// PRNG mulberry32: kecil, cepat, dan konsisten antar-runtime (server saja).
export function createSeededRandom(seed: number): () => number {
  let state = (Number.isFinite(seed) ? Math.trunc(seed) : 0) >>> 0;
  return () => {
    state = (state + 0x6D2B79F5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffleWithSeed<T>(items: T[], seed: number): T[] {
  const result = [...items];
  const random = createSeededRandom(seed);
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

const DISPLAY_KEYS = ['A', 'B', 'C', 'D', 'E'];

// Acak urutan soal + opsi PG untuk satu attempt berdasarkan seed tersimpan.
// Setiap opsi hasil acakan membawa `key` = huruf tampilan (urutan tampil) dan
// `originalKey` = kunci asal, sehingga jawaban siswa selalu dikirim & dinilai
// sebagai kunci asal — penilaian server tidak berubah. Kunci jawaban benar &
// pembahasan TIDAK ikut diubah/dikirim di sini (pemanggil memakai
// getExamQuestions(..., false)). Seed null/0 = urutan asli (attempt lama).
export function shuffleQuestionsForAttempt<T extends { id: string; type?: string; options?: any[] }>(questions: T[], seed: number | null | undefined): T[] {
  if (seed == null || !Number.isFinite(seed) || Number(seed) === 0) return questions;
  const numericSeed = Math.trunc(Number(seed));
  const withShuffledOptions = questions.map((question, index) => {
    if (question.type === 'essai' || !Array.isArray(question.options) || question.options.length === 0) return question;
    const shuffledOptions = shuffleWithSeed(question.options, numericSeed + 7919 * (index + 1));
    return {
      ...question,
      options: shuffledOptions.map((option: any, optionIndex: number) => ({
        ...option,
        originalKey: option.originalKey ?? option.key,
        key: DISPLAY_KEYS[optionIndex] ?? option.key,
      })),
    };
  });
  return shuffleWithSeed(withShuffledOptions, numericSeed);
}

// Petunjuk kata kunci untuk layar koreksi guru (BUKAN nilai): berapa kata
// penting dari alternatif kunci terbaik yang muncul di jawaban siswa.
export function essayKeywordHint(answer: string, key: string): { matched: number; total: number; complete: boolean } {
  const answerTokens = new Set(significantTokens(typeof answer === 'string' ? answer : ''));
  let best = { matched: 0, total: 0, complete: false };
  for (const part of String(key || '').split('|')) {
    const tokens = significantTokens(part).filter(token => token.length >= 3);
    if (tokens.length === 0) {
      const normalizedPart = normalizeText(part);
      const hit = normalizedPart !== '' && answerTokens.has(normalizedPart);
      const candidate = { matched: hit ? 1 : 0, total: normalizedPart ? 1 : 0, complete: hit };
      if (candidate.matched > best.matched) best = candidate;
      continue;
    }
    const matched = tokens.filter(token => answerTokens.has(token)).length;
    const candidate = { matched, total: tokens.length, complete: matched === tokens.length };
    if (matched > best.matched || (matched === best.matched && candidate.total < best.total)) best = candidate;
  }
  return best;
}

export function pointPerQuestion(totalQuestions: number): number {
  return totalQuestions > 0 ? 100 / totalQuestions : 0;
}

export function roundScore1(value: number): number {
  return Math.round((Number(value) || 0) * 10) / 10;
}

// Skor resmi BARU: hanya soal PG yang dinilai otomatis. Esai tidak dinilai
// sistem sama sekali (dinilai guru lewat essay_scores_json). correctCount &
// wrongCount kini khusus PG; score = poin PG dibulatkan (final bila paket
// tanpa esai; sementara/"pgScore" bila esai menunggu koreksi guru).
export function scoreCbtAnswers(questions: Array<{ id: string; type?: string; correctAnswer?: string }>, answers: Record<string, string>) {
  const pgQuestions = questions.filter(question => question.type !== 'essai');
  const correctCount = pgQuestions.filter(question => {
    const answer = answers[question.id];
    return typeof answer === 'string' && answer.trim() !== '' && answer === question.correctAnswer;
  }).length;
  const wrongCount = pgQuestions.length - correctCount;
  const perQuestion = pointPerQuestion(questions.length);
  const pgScore = roundScore1(correctCount * perQuestion);
  return {
    correctCount,
    wrongCount,
    score: Math.round(correctCount * perQuestion),
    pgScore,
    pgCount: pgQuestions.length,
    essayCount: questions.length - pgQuestions.length,
    pointPerQuestion: perQuestion,
  };
}

export function parseEssayScores(value: unknown): { scores: Record<string, number>; notes: Record<string, string> } {
  const parsed = parseJson<any>(value, {});
  const scores: Record<string, number> = {};
  const notes: Record<string, string> = {};
  if (parsed && typeof parsed === 'object') {
    for (const [key, raw] of Object.entries(parsed.scores || {})) {
      const num = Number(raw);
      if (Number.isFinite(num)) scores[key] = num;
    }
    for (const [key, raw] of Object.entries(parsed.notes || {})) {
      if (typeof raw === 'string' && raw) notes[key] = raw;
    }
  }
  return { scores, notes };
}

// Attempt lama tidak punya grading_status (NULL) dan skornya sudah final.
export function gradingStatusOf(row: { grading_status?: unknown }): 'pending_grading' | 'graded' {
  return row?.grading_status === 'pending_grading' ? 'pending_grading' : 'graded';
}

export function parseProctorEvents(value: unknown): { tabSwitch: number; windowBlur: number; fullscreenExit: number } {
  const parsed = parseJson<any>(value, {});
  const pick = (raw: unknown) => (Number.isFinite(Number(raw)) && Number(raw) > 0 ? Math.trunc(Number(raw)) : 0);
  return {
    tabSwitch: pick(parsed?.tabSwitch),
    windowBlur: pick(parsed?.windowBlur),
    fullscreenExit: pick(parsed?.fullscreenExit),
  };
}

// Gerbang pembahasan siswa: kunci + penjelasan per soal hanya boleh dibuka
// bila SELURUH peserta ujian sudah selesai, agar siswa yang selesai lebih
// dulu tidak membocorkan kunci ke yang belum mengerjakan. Terbuka bila salah
// satu tercapai lebih dulu:
// (a) jendela ujian berakhir (status efektif 'completed', atau pada end_date
//     jam tutup close_time sudah lewat) — attempt tak tersubmit/expired tidak
//     menahan gerbang; atau
// (b) semua siswa aktif pada kelas target ujian (target Semua Kelas/'all' =
//     semua kelas) sudah punya attempt submitted/expired dan tidak ada
//     attempt in_progress yang masih hidup (in_progress yang expires_at-nya
//     sudah lewat diperlakukan sebagai expired).
// Berlaku sama untuk ujian resmi maupun latihan.
export async function isCbtReviewUnlocked(db: D1Database, exam: any): Promise<boolean> {
  if (effectiveCbtStatus(exam) === 'completed') return true;
  if (String(exam.end_date || '') === todayWIB() && exam.close_time && isValidTime(String(exam.close_time))
    && nowWIBMinutes() >= timeToMinutes(String(exam.close_time))) return true;

  const { results: attemptRows } = await db.prepare(
    'SELECT student_user_id, status, expires_at FROM cbt_attempts WHERE exam_id=?'
  ).bind(String(exam.id)).all<any>();
  const nowIso = new Date().toISOString();
  const finishedStudentIds = new Set<string>();
  for (const row of attemptRows as any[]) {
    const status = String(row.status || '');
    const expiredLive = status === 'in_progress' && String(row.expires_at || '') !== '' && String(row.expires_at) <= nowIso;
    if (status === 'in_progress' && !expiredLive) return false; // masih ada yang mengerjakan
    if (status === 'submitted' || status === 'expired' || expiredLive) finishedStudentIds.add(String(row.student_user_id));
  }

  const target = String(exam.class_target || '');
  const coversAll = target === 'all' || target === 'Semua Kelas MPLB';
  let classIds: string[] = [];
  if (!coversAll) {
    const classesRow = await db.prepare("SELECT value FROM app_data WHERE key = 'kelas_v1'").first<{ value: string }>();
    const classes = parseJson<any[]>(classesRow?.value, []);
    const byId = classes.find(item => String(item.id) === target);
    const byName = classes.find(item => String(item.name) === target);
    classIds = [String(byId?.id ?? byName?.id ?? target)];
  }
  const rosterQuery = coversAll
    ? "SELECT id FROM users WHERE role IN ('siswa','ketua_kelas') AND status='active' AND class_id IS NOT NULL"
    : `SELECT id FROM users WHERE role IN ('siswa','ketua_kelas') AND status='active' AND class_id IN (${classIds.map(() => '?').join(',')})`;
  const rosterStatement = coversAll ? db.prepare(rosterQuery) : db.prepare(rosterQuery).bind(...classIds);
  const { results: roster } = await rosterStatement.all<any>();
  // Roster kosong (data kelas belum terisi): jatuhkan ke bukti attempt saja —
  // di atas sudah dipastikan tidak ada attempt yang masih berjalan.
  if (!roster || roster.length === 0) return true;
  return (roster as any[]).every(student => finishedStudentIds.has(String(student.id)));
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

export async function canTakeExam(db: D1Database, user: AuthUser, exam: any, preloadedClasses?: any[]): Promise<boolean> {
  if (!isCbtStudent(user) || !user.classId) return false;
  if (exam.class_target === 'Semua Kelas MPLB' || exam.class_target === 'all' || exam.class_target === user.classId) return true;
  // PreloadedClasses: hindari membaca blob kelas_v1 berulang saat memeriksa banyak ujian.
  const classes = preloadedClasses ?? await (async () => {
    const classesRow = await db.prepare("SELECT value FROM app_data WHERE key = 'kelas_v1'").first<{ value: string }>();
    return parseJson<any[]>(classesRow?.value, []);
  })();
  return classes.some(item => item.id === user.classId && item.name === exam.class_target);
}

