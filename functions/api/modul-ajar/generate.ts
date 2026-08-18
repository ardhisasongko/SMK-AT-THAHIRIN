// Generate Modul Ajar Kurikulum Merdeka dengan AI (pengganti endpoint Express).
import { callGeminiJson, GeminiError, isGeminiEnabled } from "../../_lib/gemini";
import { jsonResponse, errorResponse } from "../../_lib/response";
import type { AuthUser } from "../../_lib/auth";
import { consumeRateLimit } from "../../_lib/rate-limit";

interface Env {
  GEMINI_API_KEY?: string;
  GEMINI_ENABLED?: string;
  GEMINI_MODEL?: string;
  APP_NAME?: string;
  DB: D1Database;
}
type AuthData = Record<string, unknown> & { user: AuthUser | null };

type JsonRecord = Record<string, any>;

function isRecord(value: unknown): value is JsonRecord {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function isText(value: unknown, max = 5000): value is string {
  return typeof value === 'string' && Boolean(value.trim()) && value.length <= max;
}

function isTextArray(value: unknown, maxItems = 50): value is string[] {
  return Array.isArray(value) && value.length > 0 && value.length <= maxItems && value.every(item => isText(item));
}

export function isValidGeneratedModul(value: unknown): boolean {
  if (!isRecord(value) || !isText(value.judul, 300) || !isRecord(value.identitas)
    || !isText(value.identitas.sekolah, 200) || !isText(value.identitas.mataPelajaran, 200)
    || !isText(value.identitas.jurusan, 300) || !isText(value.identitas.faseKelas, 100)
    || !isText(value.identitas.alokasiWaktu, 100) || !isText(value.identitas.tahunAjaran, 50)
    || !isTextArray(value.profilPelajarPancasila) || !isTextArray(value.saranaPrasarana)
    || !isText(value.targetPesertaDidik) || !isText(value.modelPembelajaran, 300)
    || !isRecord(value.komponenInti)) return false;

  const inti = value.komponenInti;
  if (!isTextArray(inti.tujuanPembelajaran) || !isText(inti.pemahamanBermakna)
    || !isTextArray(inti.pertanyaanPemantik) || !isRecord(inti.kegiatanPembelajaran)
    || !isTextArray(inti.kegiatanPembelajaran.pendahuluan)
    || !isTextArray(inti.kegiatanPembelajaran.inti)
    || !isTextArray(inti.kegiatanPembelajaran.penutup)
    || !isRecord(inti.asesmen) || !isText(inti.asesmen.diagnostik)
    || !isText(inti.asesmen.formatif) || !isText(inti.asesmen.sumatif)
    || !isText(inti.pengayaanDanRemidial) || !isRecord(value.lampiran)) return false;

  return isText(value.lampiran.lembarKerjaSiswa)
    && isText(value.lampiran.bahanBacaanGuruSiswa)
    && isTextArray(value.lampiran.glosarium);
}

function validOptionalInput(value: unknown, max: number): boolean {
  return value === undefined || (typeof value === 'string' && value.length <= max);
}

export const onRequestPost: PagesFunction<Env, any, AuthData> = async ({ env, request, data }) => {
  if (!data.user) return errorResponse("Silakan login terlebih dahulu.", 401);
  if (!['guru', 'admin', 'super_admin'].includes(data.user.role)) return errorResponse("Anda tidak berwenang membuat modul.", 403);
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return errorResponse("Body permintaan harus berupa JSON yang valid.", 400);
  }
  if (!isRecord(body)) return errorResponse("Body permintaan tidak valid.", 400);

  try {
    const {
      mataPelajaran,
      jurusan,
      faseKelas,
      alokasiWaktu,
      elemenCP,
      tujuanPembelajaran,
      modelPembelajaran,
      profilPancasila,
      saranaPrasarana,
    } = body;

    if (typeof mataPelajaran !== 'string' || !mataPelajaran.trim() || mataPelajaran.length > 200
      || typeof faseKelas !== 'string' || !faseKelas.trim() || faseKelas.length > 100
      || !validOptionalInput(jurusan, 300) || !validOptionalInput(alokasiWaktu, 100)
      || !validOptionalInput(elemenCP, 2000) || !validOptionalInput(tujuanPembelajaran, 2000)
      || !validOptionalInput(modelPembelajaran, 300) || !validOptionalInput(profilPancasila, 500)
      || !validOptionalInput(saranaPrasarana, 1000)) {
      return errorResponse("Mata pelajaran dan Fase/Kelas wajib diisi.", 400);
    }
    if (!isGeminiEnabled(env.GEMINI_ENABLED, env.GEMINI_API_KEY)) {
      return errorResponse(env.GEMINI_ENABLED === undefined && !env.GEMINI_API_KEY
        ? "Layanan AI belum tersedia."
        : "Fitur AI sedang dinonaktifkan.", 503);
    }
    if (!env.GEMINI_API_KEY?.trim()) return errorResponse("Layanan AI belum tersedia.", 503);
    if (!(await consumeRateLimit(env.DB, `ai-modul:${data.user.id}`, 20, 24 * 60 * 60))) return errorResponse("Kuota pembuatan modul hari ini habis.", 429);

    const schoolName = env.APP_NAME || 'SMK PLUS AT-THAHIRIN';
    const prompt = `Buatkan Modul Ajar Kurikulum Merdeka lengkap dan terstruktur profesional untuk ${schoolName}.
Detail Input:
- Mata Pelajaran: ${mataPelajaran}
- Jurusan / Keahlian: ${jurusan || "Manajemen Perkantoran dan Layanan Bisnis (MPLB)"}
- Fase / Kelas: ${faseKelas}
- Alokasi Waktu: ${alokasiWaktu || "2 x 45 menit (1 Pertemuan)"}
- Elemen / Capaian Pembelajaran (CP): ${elemenCP || "Disesuaikan dengan standar SMK Kurikulum Merdeka Manajemen Perkantoran dan Layanan Bisnis"}
- Tujuan Pembelajaran (TP): ${tujuanPembelajaran || "Peserta didik mampu memahami dan mengaplikasikan kompetensi secara saintifik dan praktis"}
- Model Pembelajaran: ${modelPembelajaran || "Project Based Learning (PjBL)"}
- Dimensi Profil Pelajar Pancasila: ${profilPancasila || "Bernalar Kritis, Mandiri, Gotong Royong, Kreatif"}
- Sarana & Prasarana: ${saranaPrasarana || "Komputer/Laptop, Internet, LCD Projector, Scanner, Modul Kearsipan Digital"}

Susunlah dokumen Modul Ajar ${schoolName} ini dengan format JSON rapi dengan struktur:
{
  "judul": "Modul Ajar ...",
  "identitas": {
    "sekolah": "${schoolName}",
    "mataPelajaran": "...",
    "jurusan": "...",
    "faseKelas": "...",
    "alokasiWaktu": "...",
    "tahunAjaran": "2026/2027"
  },
  "profilPelajarPancasila": ["...", "..."],
  "saranaPrasarana": ["...", "..."],
  "targetPesertaDidik": "Siswa Reguler / Tipikal SMK Manajemen Perkantoran dan Layanan Bisnis",
  "modelPembelajaran": "...",
  "komponenInti": {
    "tujuanPembelajaran": ["...", "..."],
    "pemahamanBermakna": "...",
    "pertanyaanPemantik": ["...", "..."],
    "kegiatanPembelajaran": {
      "pendahuluan": ["... (beserta durasi)"],
      "inti": ["... (langkah-langkah praktis PjBL/PBL beserta durasi)"],
      "penutup": ["... (refleksi & umpan balik beserta durasi)"]
    },
    "asesmen": {
      "diagnostik": "...",
      "formatif": "...",
      "sumatif": "..."
    },
    "pengayaanDanRemidial": "..."
  },
  "lampiran": {
    "lembarKerjaSiswa": "Petunjuk singkat tugas praktikum / diskusi...",
    "bahanBacaanGuruSiswa": "Ringkasan materi inti...",
    "glosarium": ["istilah 1: penjelasan", "istilah 2: penjelasan"]
  }
}`;

    const generated = await callGeminiJson<unknown>(env.GEMINI_API_KEY, prompt, {
      systemInstruction:
        "Anda adalah pakar Pengembang Kurikulum SMK (Sekolah Menengah Kejuruan) Indonesia berpengalaman. Buatkan modul ajar Kurikulum Merdeka yang komprehensif, terstruktur, praktis, dan langsung dapat digunakan oleh guru ${schoolName}. Selalu berikan output dalam format JSON sesuai schema yang diminta.",
      maxOutputTokens: 16384,
      model: env.GEMINI_MODEL,
    });
    if (!isValidGeneratedModul(generated)) return errorResponse("Modul AI tidak memenuhi format yang diminta.", 502);

    return jsonResponse({ success: true, data: generated });
  } catch (error) {
    console.error("Error generating Modul Ajar:", error);
    return errorResponse("Gagal membuat modul ajar dengan AI.", error instanceof GeminiError && error.code === 'timeout' ? 504 : 502);
  }
};
