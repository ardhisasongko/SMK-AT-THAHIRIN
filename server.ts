import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

// Initialize Gemini Client
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health check endpoint
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", school: "SMKS PLUS AT THAHIRIN" });
});

// Generate Modul Ajar Kurikulum Merdeka AI Endpoint
app.post("/api/modul-ajar/generate", async (req, res) => {
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
      saranaPrasarana
    } = req.body;

    if (!mataPelajaran || !faseKelas) {
      return res.status(400).json({ error: "Mata pelajaran dan Fase/Kelas wajib diisi." });
    }

    const prompt = `Buatkan Modul Ajar Kurikulum Merdeka lengkap dan terstruktur profesional untuk SMKS PLUS AT THAHIRIN.
Detail Input:
- Mata Pelajaran: ${mataPelajaran}
- Jurusan / Keahlian: ${jurusan || "Administrasi Perkantoran"}
- Fase / Kelas: ${faseKelas}
- Alokasi Waktu: ${alokasiWaktu || "2 x 45 menit (1 Pertemuan)"}
- Elemen / Capaian Pembelajaran (CP): ${elemenCP || "Disesuaikan dengan standar SMK Kurikulum Merdeka Administrasi Perkantoran"}
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
  "targetPesertaDidik": "Siswa Reguler / Tipikal SMK Administrasi Perkantoran",
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

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: prompt,
      config: {
        systemInstruction: "Anda adalah pakar Pengembang Kurikulum SMK (Sekolah Menengah Kejuruan) Indonesia berpengalaman. Buatkan modul ajar Kurikulum Merdeka yang komprehensif, terstruktur, praktis, dan langsung dapat digunakan oleh guru SMKS PLUS AT THAHIRIN. Selalu berikan output dalam format JSON sesuai schema yang diminta.",
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            judul: { type: Type.STRING },
            identitas: {
              type: Type.OBJECT,
              properties: {
                sekolah: { type: Type.STRING },
                mataPelajaran: { type: Type.STRING },
                jurusan: { type: Type.STRING },
                faseKelas: { type: Type.STRING },
                alokasiWaktu: { type: Type.STRING },
                tahunAjaran: { type: Type.STRING },
              },
            },
            profilPelajarPancasila: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            saranaPrasarana: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            targetPesertaDidik: { type: Type.STRING },
            modelPembelajaran: { type: Type.STRING },
            komponenInti: {
              type: Type.OBJECT,
              properties: {
                tujuanPembelajaran: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                pemahamanBermakna: { type: Type.STRING },
                pertanyaanPemantik: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                kegiatanPembelajaran: {
                  type: Type.OBJECT,
                  properties: {
                    pendahuluan: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    inti: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                    penutup: {
                      type: Type.ARRAY,
                      items: { type: Type.STRING },
                    },
                  },
                },
                asesmen: {
                  type: Type.OBJECT,
                  properties: {
                    diagnostik: { type: Type.STRING },
                    formatif: { type: Type.STRING },
                    sumatif: { type: Type.STRING },
                  },
                },
                pengayaanDanRemidial: { type: Type.STRING },
              },
            },
            lampiran: {
              type: Type.OBJECT,
              properties: {
                lembarKerjaSiswa: { type: Type.STRING },
                bahanBacaanGuruSiswa: { type: Type.STRING },
                glosarium: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
              },
            },
          },
        },
      },
    });

    const jsonText = response.text || "{}";
    const result = JSON.parse(jsonText);
    res.json({ success: true, data: result });
  } catch (error: any) {
    console.error("Error generating Modul Ajar:", error);
    res.status(500).json({
      success: false,
      error: error.message || "Gagal membuat modul ajar dengan AI.",
    });
  }
});

// Setup Vite or Static serving
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`SMK AT-THAHIRIN Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
