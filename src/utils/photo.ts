/**
 * Utilitas foto presensi: kompresi di client + upload ke R2.
 * Kompresi penting agar pemakaian R2 hemat (muat 120 siswa / 1 semester).
 */
import { authHeaders } from './auth';

/** Kompres gambar ke JPEG (max dimensi & kualitas), hasil Blob. */
export function compressImage(file: File, maxDim = 800, quality = 0.6): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * scale));
        canvas.height = Math.max(1, Math.round(img.height * scale));
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas tidak didukung.')); return; }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => (blob ? resolve(blob) : reject(new Error('Gagal kompres foto.'))),
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Gagal membaca gambar.'));
      img.src = reader.result as string;
    };
    reader.onerror = () => reject(new Error('Gagal membaca file.'));
    reader.readAsDataURL(file);
  });
}

/** Upload blob foto; mengembalikan respons sukses, atau null bila gagal. */
async function postBlob(body: Blob, query = ''): Promise<{ success: boolean; id?: string; url?: string } | null> {
  try {
    const res = await fetch(`/api/upload${query}`, {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': body.type || 'image/jpeg' }),
      body,
    });
    const json = await res.json() as { success?: boolean; id?: string; url?: string };
    if (!res.ok || json.success !== true) return null;
    return { success: true, id: json.id, url: json.url };
  } catch {
    return null;
  }
}

/**
 * Kompres & upload foto presensi: kirim versi FULL (untuk arsip Drive) dan
 * THUMBNAIL kecil (permanen di D1 agar UI tetap cepat untuk seluruh riwayat).
 * Mengembalikan URL internal (fotoUrl), atau null bila gagal.
 */
export async function uploadPhoto(file: File): Promise<string | null> {
  const fullBlob = await compressImage(file, 800, 0.6);
  const thumbBlob = await compressImage(file, 160, 0.5);

  const full = await postBlob(fullBlob);
  if (!full || !full.id) return null;

  await postBlob(thumbBlob, `?id=${full.id}`); // best-effort; thumb tidak kritis
  return full.url || null;
}