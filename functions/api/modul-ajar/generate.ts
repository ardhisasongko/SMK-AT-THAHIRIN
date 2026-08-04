// Generate Modul Ajar Kurikulum Merdeka dengan AI (pengganti endpoint Express).
import { callGeminiJson } from "../../_lib/gemini";
import { jsonResponse, errorResponse } from "../../_lib/response";

interface Env {
  GEMINI_API_KEY?: string;
}

export const onRequestPost: PagesFunction<Env> = async ({ env, request }) => {
  try {
    const body = (await request.json()) as {
      mataPelajaran?: string;
      jurusan?: string;
      faseKelas?: string;
      alokasiWaktu?: string;
      elemenCP?: string;
      tujuanPembelajaran?: string;
      modelPembelajaran?: string;
      profilPancasila?: string;
      saranaPrasarana?: string;
    };
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

    if (!mataPelajaran || !faseKelas) {
      return errorResponse("Mata pelajaran dan Fase/Kelas wajib diisi.", 400);
    }

    const prompt = `Buatkan Modul Ajar Kurikulum Merdeka lengkap dan terstruktur profesional untuk SMKS PLUS AT THAHIRIN.
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

Susunlah dokumen Modul Ajar SMKS PLUS AT THAHIRIN ini dengan format JSON rapi dengan struktur:
{
  "judul": "Modul Ajar ...",
  "identitas": {
    "sekolah": "SMKS PLUS AT THAHIRIN",
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

    const data = await callGeminiJson<any>(env.GEMINI_API_KEY, prompt, {
      systemInstruction:
        "Anda adalah pakar Pengembang Kurikulum SMK (Sekolah Menengah Kejuruan) Indonesia berpengalaman. Buatkan modul ajar Kurikulum Merdeka yang komprehensif, terstruktur, praktis, dan langsung dapat digunakan oleh guru SMKS PLUS AT THAHIRIN. Selalu berikan output dalam format JSON sesuai schema yang diminta.",
    });

    return jsonResponse({ success: true, data });
  } catch (error: any) {
    console.error("Error generating Modul Ajar:", error);
    return errorResponse(error.message || "Gagal membuat modul ajar dengan AI.");
  }
};