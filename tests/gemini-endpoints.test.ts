import { beforeEach, describe, expect, it, vi } from 'vitest';
import { callGeminiJson } from '../functions/_lib/gemini';
import { consumeRateLimit } from '../functions/_lib/rate-limit';
import { onRequestPost as generateCbt } from '../functions/api/cbt/generate';
import { onRequestPost as generateModul } from '../functions/api/modul-ajar/generate';

vi.mock('../functions/_lib/gemini', async () => {
  const actual = await vi.importActual<typeof import('../functions/_lib/gemini')>('../functions/_lib/gemini');
  return { ...actual, callGeminiJson: vi.fn() };
});

vi.mock('../functions/_lib/rate-limit', () => ({ consumeRateLimit: vi.fn() }));

const USER = { id: 'guru-1', role: 'guru' } as any;
const DB = {} as D1Database;

function request(path: string, body: unknown) {
  return new Request(`https://school.test${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function cbtQuestion() {
  return {
    id: 'ai-1',
    type: 'pg',
    question: 'Pertanyaan?',
    options: ['A', 'B', 'C', 'D', 'E'].map(key => ({ key, text: `Pilihan ${key}` })),
    correctAnswer: 'A',
    points: 1,
    explanation: 'Karena A benar.',
  };
}

function modul() {
  return {
    judul: 'Modul Ajar Kearsipan',
    identitas: {
      sekolah: 'SMKS PLUS AT THAHIRIN', mataPelajaran: 'Kearsipan', jurusan: 'MPLB',
      faseKelas: 'Fase F', alokasiWaktu: '2 x 45 menit', tahunAjaran: '2026/2027',
    },
    profilPelajarPancasila: ['Mandiri'],
    saranaPrasarana: ['Komputer'],
    targetPesertaDidik: 'Siswa SMK',
    modelPembelajaran: 'PjBL',
    komponenInti: {
      tujuanPembelajaran: ['Memahami arsip'],
      pemahamanBermakna: 'Arsip mendukung pekerjaan.',
      pertanyaanPemantik: ['Mengapa arsip penting?'],
      kegiatanPembelajaran: { pendahuluan: ['Apersepsi'], inti: ['Praktik'], penutup: ['Refleksi'] },
      asesmen: { diagnostik: 'Tanya jawab', formatif: 'Observasi', sumatif: 'Proyek' },
      pengayaanDanRemidial: 'Latihan lanjutan.',
    },
    lampiran: {
      lembarKerjaSiswa: 'Instruksi kerja.', bahanBacaanGuruSiswa: 'Ringkasan.', glosarium: ['Arsip: rekaman'],
    },
  };
}

beforeEach(() => {
  vi.mocked(callGeminiJson).mockReset();
  vi.mocked(consumeRateLimit).mockReset();
  vi.mocked(consumeRateLimit).mockResolvedValue(true);
});

describe('endpoint Gemini', () => {
  it('tidak mengonsumsi kuota CBT untuk input invalid, missing key, atau disabled', async () => {
    const invalid = await generateCbt({
      env: { DB, GEMINI_API_KEY: 'key' }, request: request('/api/cbt/generate', { subject: '', count: 5 }), data: { user: USER },
    } as any);
    const missingKey = await generateCbt({
      env: { DB }, request: request('/api/cbt/generate', { subject: 'Kearsipan', count: 5 }), data: { user: USER },
    } as any);
    const missingFlag = await generateCbt({
      env: { DB, GEMINI_API_KEY: 'key' }, request: request('/api/cbt/generate', { subject: 'Kearsipan', count: 5 }), data: { user: USER },
    } as any);
    const disabled = await generateCbt({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'false' }, request: request('/api/cbt/generate', { subject: 'Kearsipan' }), data: { user: USER },
    } as any);

    expect([invalid.status, missingKey.status, missingFlag.status, disabled.status]).toEqual([400, 503, 503, 503]);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(callGeminiJson).not.toHaveBeenCalled();
  });

  it('meneruskan model env dan hanya menerima jumlah/schema soal yang tepat', async () => {
    vi.mocked(callGeminiJson).mockResolvedValueOnce([cbtQuestion()]);
    const success = await generateCbt({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'true', GEMINI_MODEL: 'gemini-test' },
      request: request('/api/cbt/generate', { subject: 'Kearsipan', count: 1 }), data: { user: USER },
    } as any);

    expect(success.status).toBe(200);
    expect(consumeRateLimit).toHaveBeenCalledOnce();
    expect(callGeminiJson).toHaveBeenCalledWith('key', expect.any(String), expect.objectContaining({
      model: 'gemini-test', maxOutputTokens: 16384,
    }));

    vi.mocked(callGeminiJson).mockResolvedValueOnce([]);
    const invalidOutput = await generateCbt({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'true' },
      request: request('/api/cbt/generate', { subject: 'Kearsipan', count: 1 }), data: { user: USER },
    } as any);
    expect(invalidOutput.status).toBe(502);
    expect(await invalidOutput.json()).toEqual({ success: false, error: 'Soal AI tidak memenuhi format CBT yang diminta.' });
  });

  it('memvalidasi semua panjang input modul sebelum kuota', async () => {
    const response = await generateModul({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'true' },
      request: request('/api/modul-ajar/generate', {
        mataPelajaran: 'Kearsipan', faseKelas: 'Fase F', elemenCP: 'x'.repeat(2001),
      }),
      data: { user: USER },
    } as any);

    expect(response.status).toBe(400);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(callGeminiJson).not.toHaveBeenCalled();
  });

  it('tidak mengonsumsi kuota modul saat key hilang atau fitur disabled', async () => {
    const missingKey = await generateModul({
      env: { DB }, request: request('/api/modul-ajar/generate', { mataPelajaran: 'Kearsipan', faseKelas: 'Fase F' }), data: { user: USER },
    } as any);
    const disabled = await generateModul({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'off' },
      request: request('/api/modul-ajar/generate', { mataPelajaran: 'Kearsipan', faseKelas: 'Fase F' }), data: { user: USER },
    } as any);

    expect([missingKey.status, disabled.status]).toEqual([503, 503]);
    expect(consumeRateLimit).not.toHaveBeenCalled();
    expect(callGeminiJson).not.toHaveBeenCalled();
  });

  it('menolak schema modul tidak lengkap dan menerima schema lengkap tanpa network nyata', async () => {
    vi.mocked(callGeminiJson).mockResolvedValueOnce({ judul: 'Tidak lengkap' });
    const invalid = await generateModul({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'true' }, request: request('/api/modul-ajar/generate', { mataPelajaran: 'Kearsipan', faseKelas: 'Fase F' }), data: { user: USER },
    } as any);
    expect(invalid.status).toBe(502);

    vi.mocked(callGeminiJson).mockResolvedValueOnce(modul());
    const success = await generateModul({
      env: { DB, GEMINI_API_KEY: 'key', GEMINI_ENABLED: 'true' }, request: request('/api/modul-ajar/generate', { mataPelajaran: 'Kearsipan', faseKelas: 'Fase F' }), data: { user: USER },
    } as any);
    expect(success.status).toBe(200);
    expect(await success.json()).toMatchObject({ success: true, data: { judul: 'Modul Ajar Kearsipan' } });
  });
});
