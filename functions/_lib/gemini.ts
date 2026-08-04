// Helper Gemini AI via REST API (works on Cloudflare Workers)
// GEMINI_API_KEY dibaca dari context.env pada setiap handler yang memanggil.

const GEMINI_MODEL = "gemini-3.6-flash";

interface GeminiConfig {
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
}

export async function callGemini(
  apiKey: string | undefined,
  prompt: string,
  config: GeminiConfig = {}
) {
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY belum dikonfigurasi sebagai Secret di Cloudflare Pages.");
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;

  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: config.responseMimeType || "text/plain",
    },
  };

  if (config.systemInstruction) {
    body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  }
  if (config.temperature !== undefined) {
    body.generationConfig.temperature = config.temperature;
  }

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText.slice(0, 300)}`);
  }

  const json: any = await res.json();
  const text = json?.candidates?.[0]?.content?.parts
    ?.map((p: any) => p.text || "")
    .join("");
  return text || "";
}

export async function callGeminiJson<T>(
  apiKey: string | undefined,
  prompt: string,
  config: GeminiConfig = {}
): Promise<T> {
  const raw = await callGemini(apiKey, prompt, {
    ...config,
    responseMimeType: "application/json",
  });
  const cleaned = raw
    .replace(/```json/g, "")
    .replace(/```/g, "")
    .trim();
  return JSON.parse(cleaned) as T;
}

export function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function errorResponse(message: string, status = 500) {
  return jsonResponse({ success: false, error: message }, status);
}