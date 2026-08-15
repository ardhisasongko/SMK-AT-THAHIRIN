// Generate soal CBT via AI (pengganti pemanggilan Gemini langsung dari browser).
import { callGeminiJson } from "../../_lib/gemini";
import { jsonResponse, errorResponse } from "../../_lib/response";
import type { AuthUser } from "../../_lib/auth";
import { consumeRateLimit } from "../../_lib/rate-limit";
import { validateCbtQuestions } from "../../_lib/cbt";

interface Env {
  GEMINI_API_KEY?: string;
  DB: D1Database;
}
type AuthData = Record<string, unknown> & { user: AuthUser | null };

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user) return errorResponse("Silakan login terlebih dahulu.", 401);
  if (!['guru', 'admin', 'super_admin'].includes(data.user.role)) return errorResponse("Anda tidak berwenang membuat soal.", 403);
  if (!(await consumeRateLimit(env.DB, `ai-cbt:${data.user.id}`, 20, 24 * 60 * 60))) return errorResponse("Kuota pembuatan soal hari ini habis.", 429);
  try {
    const body = (await request.json()) as { subject?: string; count?: number };
    const { subject, count = 5 } = body;

    if (typeof subject !== 'string' || !subject.trim() || subject.length > 200 || !Number.isInteger(count) || count < 1 || count > 50) {
      return errorResponse("Mata pelajaran wajib diisi dan jumlah soal harus 1-50.", 400);
    }

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

    const parsed = await callGeminiJson<any[]>(env.GEMINI_API_KEY, prompt, {
      systemInstruction:
        "Anda adalah guru SMK Manajemen Perkantoran dan Layanan Bisnis (MPLB). Hasilkan soal ujian berkualitas dengan kunci jawaban yang benar. Output hanya JSON array.",
      temperature: 0.7,
    });

    const normalized = (Array.isArray(parsed) ? parsed : []).map((q: any, i: number) => ({
      id: q.id || `ai-${Date.now()}-${i}`,
      question: q.question || "",
      options: Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((o: any) => ({ key: o.key, text: o.text }))
        : [],
      correctAnswer: q.correctAnswer || "A",
      points: q.points || 1,
      explanation: q.explanation || "",
    }));

    const validationError = validateCbtQuestions(normalized);
    if (validationError) return errorResponse(`Soal AI tidak memenuhi format CBT: ${validationError}`, 502);

    return jsonResponse({ success: true, data: normalized });
  } catch (error: any) {
    console.error("Error generating CBT questions:", error);
    return errorResponse("Gagal membuat soal CBT dengan AI.");
  }
};
