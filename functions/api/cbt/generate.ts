// Generate soal CBT via AI (pengganti pemanggilan Gemini langsung dari browser).
import { callGeminiJson, GeminiError, isGeminiEnabled } from "../../_lib/gemini";
import { jsonResponse, errorResponse } from "../../_lib/response";
import type { AuthUser } from "../../_lib/auth";
import { consumeRateLimit } from "../../_lib/rate-limit";
import { validateCbtQuestions } from "../../_lib/cbt";

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_ENABLED?: string;
  GEMINI_MODEL?: string;
  DB: D1Database;
}
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export function validateGeneratedCbt(value: unknown, expectedCount: number): any[] | null {
  if (!Array.isArray(value) || value.length !== expectedCount) return null;
  const questions = value.map((question: any) => {
    if (!question || typeof question !== 'object' || question.type !== 'pg'
      || typeof question.id !== 'string' || !question.id.trim()
      || typeof question.question !== 'string' || !question.question.trim()
      || !Array.isArray(question.options)
      || typeof question.correctAnswer !== 'string'
      || question.points !== 1
      || typeof question.explanation !== 'string' || !question.explanation.trim() || question.explanation.length > 2000) return null;
    return {
      id: question.id.trim(),
      question: question.question.trim(),
      options: question.options.map((option: any) => ({ key: option?.key, text: option?.text })),
      correctAnswer: question.correctAnswer,
      points: question.points,
      explanation: question.explanation.trim(),
    };
  });
  if (questions.some(question => question === null) || validateCbtQuestions(questions)) return null;
  return questions;
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user) return errorResponse("Silakan login terlebih dahulu.", 401);
  if (!['guru', 'admin', 'super_admin'].includes(data.user.role)) return errorResponse("Anda tidak berwenang membuat soal.", 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body permintaan harus berupa JSON yang valid.", 400);
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return errorResponse("Body permintaan tidak valid.", 400);

  try {
    const { subject, count = 5 } = body as { subject?: string; count?: number };

    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || !Number.isInteger(count) || count < 1 || count > 50) {
      return errorResponse("Mata pelajaran wajib diisi dan jumlah soal harus 1-50.", 400);
    }
    if (!isGeminiEnabled(env.GEMINI_ENABLED, env.GEMINI_API_KEY)) {
      return errorResponse(env.GEMINI_ENABLED === undefined && !env.GEMINI_API_KEY
        ? "Layanan AI belum tersedia."
        : "Fitur AI sedang dinonaktifkan.", 503);
    }
    if (!env.GEMINI_API_KEY?.trim()) return errorResponse("Layanan AI belum tersedia.", 503);
    if (!(await consumeRateLimit(env.DB, `ai-cbt:${data.user.id}`, 20, 24 * 60 * 60))) return errorResponse("Kuota pembuatan soal hari ini habis.", 429);

    const prompt = `Buatkan ${count} soal pilihan ganda untuk mata pelajaran "${subject}" untuk tingkat SMK Manajemen Perkantoran dan Layanan Bisnis (MPLB). Setiap soal wajib memiliki tepat 5 opsi A-E dengan teks yang tidak kosong.
Format JSON murni tanpa markdown/backticks:
[
  {
    "id": "ai-1",
    "type": "pg",
    "question": "Pertanyaan soal...",
    "options": [
      { "key": "A", "text": "Pilihan A" },
      { "key": "B", "text": "Pilihan B" },
      { "key": "C", "text": "Pilihan C" },
      { "key": "D", "text": "Pilihan D" },
      { "key": "E", "text": "Pilihan E" }
    ],
    "correctAnswer": "A",
    "points": 1,
    "explanation": "Penjelasan singkat jawaban benar"
  }
]`;

    const parsed = await callGeminiJson<unknown>(env.GEMINI_API_KEY, prompt, {
      systemInstruction:
        "Anda adalah guru SMK Manajemen Perkantoran dan Layanan Bisnis (MPLB). Hasilkan soal ujian berkualitas dengan kunci jawaban yang benar. Output hanya JSON array.",
      temperature: 0.7,
      maxOutputTokens: 16384,
      model: env.GEMINI_MODEL,
    });

    const normalized = validateGeneratedCbt(parsed, count);
    if (!normalized) return errorResponse("Soal AI tidak memenuhi format CBT yang diminta.", 502);

    return jsonResponse({ success: true, data: normalized });
  } catch (error) {
    console.error("Error generating CBT questions:", error);
    return errorResponse("Gagal membuat soal CBT dengan AI.", error instanceof GeminiError && error.code === 'timeout' ? 504 : 502);
  }
};
