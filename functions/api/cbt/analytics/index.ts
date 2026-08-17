import type { AuthUser } from '../../../_lib/auth';
import { ensureLegacyCbtMigrated } from '../../../_lib/cbt';
import { jsonResponse } from '../../../_lib/response';

interface Env { DB: D1Database }
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const SCORE_BUCKETS = [
  { label: '0–49', min: 0, max: 49 },
  { label: '50–59', min: 50, max: 59 },
  { label: '60–69', min: 60, max: 69 },
  { label: '70–79', min: 70, max: 79 },
  { label: '80–89', min: 80, max: 89 },
  { label: '90–100', min: 90, max: 100 },
];

// Pengerjaan dianggap "cepat" bila waktu tempuh ≤ 25% durasi ujian.
export const FAST_RATIO = 0.25;
// "Mencurigakan" bila cepat DAN nilai ≥ 75 (kemungkinan jawaban dibocorkan/asal).
export const SUSPICIOUS_SCORE = 75;

export const onRequestGet: PagesFunction<Env, any, AuthData> = async ({ env, data }) => {
  if (!data.user) return jsonResponse({ success: false, error: 'Silakan login.' }, 401);
  const isAdmin = data.user.role === 'admin' || data.user.role === 'super_admin';
  if (!isAdmin && data.user.role !== 'guru') return jsonResponse({ success: false, error: 'Tidak berwenang.' }, 403);
  await ensureLegacyCbtMigrated(env.DB);

  const baseSelect = `
    SELECT exams.id AS examId, exams.title, exams.subject, exams.class_target AS classTarget,
      exams.exam_type AS examType, exams.duration_minutes AS durationMinutes,
      attempts.id AS attemptId, attempts.student_name AS studentName, attempts.nisn AS nisn,
      attempts.score AS score, attempts.time_spent_seconds AS timeSpentSeconds,
      attempts.submitted_at AS submittedAt
    FROM cbt_attempts attempts
    JOIN cbt_exams exams ON exams.id = attempts.exam_id
    WHERE attempts.status='submitted'`;
  const scope = isAdmin
    ? ''
    : ` AND (exams.teacher_user_id=? OR (exams.teacher_user_id IS NULL AND exams.teacher_name=?))`;

  const { results } = await (isAdmin
    ? env.DB.prepare(baseSelect).all()
    : env.DB.prepare(baseSelect + scope).bind(data.user.id, data.user.name).all());

  const byExam = new Map<string, any>();
  for (const row of results as any[]) {
    const examId = String(row.examId);
    if (!byExam.has(examId)) {
      byExam.set(examId, {
        examId,
        title: String(row.title),
        subject: String(row.subject),
        classTarget: String(row.classTarget),
        examType: String(row.examType || 'latihan'),
        durationMinutes: Number(row.durationMinutes) || 0,
        studentCount: 0,
        avgScore: 0,
        bestScore: null,
        worstScore: null,
        buckets: SCORE_BUCKETS.map(bucket => ({ label: bucket.label, count: 0 })),
        fastAttempts: [],
      });
    }
    const exam = byExam.get(examId);
    const score = Number(row.score);
    const timeSpentSeconds = Number(row.timeSpentSeconds) || 0;
    exam.studentCount += 1;
    exam.avgScore += score;
    exam.bestScore = exam.bestScore === null ? score : Math.max(exam.bestScore, score);
    exam.worstScore = exam.worstScore === null ? score : Math.min(exam.worstScore, score);
    const bucket = SCORE_BUCKETS.find(item => score >= item.min && score <= item.max);
    if (bucket) exam.buckets[SCORE_BUCKETS.indexOf(bucket)].count += 1;

    const fastSeconds = Math.round(exam.durationMinutes * 60 * FAST_RATIO);
    if (fastSeconds > 0 && timeSpentSeconds > 0 && timeSpentSeconds <= fastSeconds) {
      exam.fastAttempts.push({
        attemptId: String(row.attemptId),
        studentName: String(row.studentName),
        nisn: String(row.nisn),
        score,
        timeSpentSeconds,
        submittedAt: row.submittedAt ? String(row.submittedAt) : null,
        suspicious: score >= SUSPICIOUS_SCORE,
      });
    }
  }

  const exams = [...byExam.values()]
    .map(exam => ({ ...exam, avgScore: exam.studentCount ? Math.round((exam.avgScore / exam.studentCount) * 10) / 10 : 0 }))
    .sort((a, b) => a.title.localeCompare(b.title));

  return jsonResponse({ success: true, data: { exams, fastRatio: FAST_RATIO, suspiciousScore: SUSPICIOUS_SCORE } });
};