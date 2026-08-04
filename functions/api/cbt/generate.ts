// Generate soal CBT via AI (pengganti pemanggilan Gemini langsung dari browser).
import { callGeminiJson, jsonResponse, errorResponse } from "../../_lib/gemini";

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = (await request.json()) as { subject?: string; count?: number };
    const { subject, count = 5 } = body;

    if (!subject) {
      return errorResponse("Mata pelajaran wajib diisi.", 400);
    }

    const prompt = `Buatkan ${count} soal ujian untuk mata pelajaran "${subject}" untuk tingkat SMK Administrasi Perkantoran dengan VARIASI TIPE SOAL:
- 60% soal pilihan ganda (type: "pg", 5 opsi A-E)
- 20% soal benar/salah (type: "truefalse", 2 opsi A="Benar", B="Salah")
- 20% soal essay (type: "essay", options: [], correctAnswer: "A", expectedAnswer: "kata,kunci,jawaban")
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
        "Anda adalah guru SMK Administrasi Perkantoran. Hasilkan soal ujian berkualitas dengan kunci jawaban yang benar. Output hanya JSON array.",
      temperature: 0.7,
    });

    const normalized = (Array.isArray(parsed) ? parsed : []).map((q: any, i: number) => ({
      id: q.id || `ai-${Date.now()}-${i}`,
      type: q.type === "essay" ? "essay" : q.type === "truefalse" ? "truefalse" : "pg",
      question: q.question || "",
      options: Array.isArray(q.options) && q.options.length > 0
        ? q.options.map((o: any) => ({ key: o.key, text: o.text }))
        : [],
      correctAnswer: q.correctAnswer || "A",
      expectedAnswer: q.expectedAnswer,
      points: q.points || 1,
      explanation: q.explanation || "",
    }));

    return jsonResponse({ success: true, data: normalized });
  } catch (error: any) {
    console.error("Error generating CBT questions:", error);
    return errorResponse(error.message || "Gagal membuat soal CBT dengan AI.");
  }
};