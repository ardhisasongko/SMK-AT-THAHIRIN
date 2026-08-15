// Helper Gemini AI via REST API (works on Cloudflare Workers).

export const DEFAULT_GEMINI_MODEL = "gemini-3.6-flash";

export type GeminiErrorCode = "timeout" | "upstream" | "blocked" | "invalid_response";

export class GeminiError extends Error {
  constructor(public readonly code: GeminiErrorCode, message: string) {
    super(message);
    this.name = "GeminiError";
  }
}

export interface GeminiConfig {
  systemInstruction?: string;
  responseMimeType?: "application/json" | "text/plain";
  temperature?: number;
  maxOutputTokens?: number;
  model?: string;
  timeoutMs?: number;
  maxRetries?: number;
  retryBaseDelayMs?: number;
  fetchImpl?: typeof fetch;
  sleep?: (milliseconds: number) => Promise<void>;
  random?: () => number;
}

export function isGeminiEnabled(value: string | undefined, _apiKey: string | undefined): boolean {
  if (value === undefined || value.trim() === "") return false;
  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

function retryableStatus(status: number): boolean {
  return status === 429 || status >= 500;
}

function retryDelay(attempt: number, base: number, random: () => number): number {
  const exponential = base * 2 ** attempt;
  return exponential + Math.floor(random() * Math.max(1, base));
}

function extractCandidateText(payload: any): string {
  if (payload?.promptFeedback?.blockReason) {
    throw new GeminiError("blocked", "Gemini memblokir prompt berdasarkan kebijakan keamanan.");
  }

  const candidate = payload?.candidates?.[0];
  if (!candidate) throw new GeminiError("invalid_response", "Gemini tidak mengembalikan kandidat.");
  if (candidate.finishReason !== "STOP") {
    const code = candidate.finishReason === "SAFETY" ? "blocked" : "invalid_response";
    throw new GeminiError(code, `Gemini berhenti dengan alasan ${String(candidate.finishReason || "tidak diketahui")}.`);
  }
  if (candidate.safetyRatings?.some((rating: any) => rating?.blocked === true)) {
    throw new GeminiError("blocked", "Kandidat Gemini diblokir berdasarkan kebijakan keamanan.");
  }

  const parts = candidate.content?.parts;
  if (!Array.isArray(parts) || parts.some((part: any) => typeof part?.text !== "string")) {
    throw new GeminiError("invalid_response", "Format kandidat Gemini tidak valid.");
  }
  const text = parts.map((part: any) => part.text).join("").trim();
  if (!text) throw new GeminiError("invalid_response", "Gemini mengembalikan respons kosong.");
  return text;
}

export async function callGemini(
  apiKey: string | undefined,
  prompt: string,
  config: GeminiConfig = {}
): Promise<string> {
  const normalizedApiKey = apiKey?.trim();
  if (!normalizedApiKey) throw new GeminiError("upstream", "GEMINI_API_KEY belum dikonfigurasi.");

  const model = config.model?.trim() || DEFAULT_GEMINI_MODEL;
  const timeoutMs = config.timeoutMs ?? 20_000;
  const maxRetries = config.maxRetries ?? 2;
  const baseDelay = config.retryBaseDelayMs ?? 200;
  const fetchImpl = config.fetchImpl ?? fetch;
  const sleep = config.sleep ?? (milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds)));
  const random = config.random ?? Math.random;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(normalizedApiKey)}`;
  const body: any = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: config.responseMimeType || "text/plain",
      candidateCount: 1,
      maxOutputTokens: config.maxOutputTokens ?? 8192,
    },
  };

  if (config.systemInstruction) body.systemInstruction = { parts: [{ text: config.systemInstruction }] };
  if (config.temperature !== undefined) body.generationConfig.temperature = config.temperature;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response | undefined;
    try {
      response = await fetchImpl(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      if (!response.ok) {
        if (retryableStatus(response.status) && attempt < maxRetries) {
          await response.body?.cancel();
          clearTimeout(timeout);
          await sleep(retryDelay(attempt, baseDelay, random));
          continue;
        }
        await response.body?.cancel();
        throw new GeminiError("upstream", `Gemini API gagal dengan status ${response.status}.`);
      }

      return extractCandidateText(await response.json());
    } catch (error) {
      if (error instanceof GeminiError) throw error;
      if (controller.signal.aborted || (error instanceof Error && error.name === "AbortError")) {
        throw new GeminiError("timeout", "Permintaan Gemini melewati batas waktu.");
      }
      if (!response && attempt < maxRetries) {
        clearTimeout(timeout);
        await sleep(retryDelay(attempt, baseDelay, random));
        continue;
      }
      throw new GeminiError(response?.ok ? "invalid_response" : "upstream",
        response?.ok ? "Respons Gemini bukan JSON yang valid." : "Gemini tidak dapat dihubungi.");
    } finally {
      clearTimeout(timeout);
    }
  }

  throw new GeminiError("upstream", "Gemini API gagal setelah percobaan ulang.");
}

function jsonSlice(raw: string): string | null {
  const start = raw.search(/[\[{]/);
  if (start < 0) return null;
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  for (let index = start; index < raw.length; index++) {
    const character = raw[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
      continue;
    }
    if (character === '"') inString = true;
    else if (character === "{" || character === "[") stack.push(character);
    else if (character === "}" || character === "]") {
      const expected = character === "}" ? "{" : "[";
      if (stack.pop() !== expected) return null;
      if (stack.length === 0) return raw.slice(start, index + 1);
    }
  }
  return null;
}

export function parseGeminiJson<T>(raw: string): T {
  const trimmed = raw.trim();
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)?.[1];
  for (const candidate of [trimmed, fenced, jsonSlice(fenced ?? trimmed)]) {
    if (!candidate) continue;
    try {
      return JSON.parse(candidate) as T;
    } catch {
      // Try the next constrained representation.
    }
  }
  throw new GeminiError("invalid_response", "Output Gemini bukan JSON yang valid.");
}

export async function callGeminiJson<T>(
  apiKey: string | undefined,
  prompt: string,
  config: GeminiConfig = {}
): Promise<T> {
  return parseGeminiJson<T>(await callGemini(apiKey, prompt, {
    ...config,
    responseMimeType: "application/json",
  }));
}
