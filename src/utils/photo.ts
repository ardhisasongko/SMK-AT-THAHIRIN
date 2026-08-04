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

/** Upload blob foto ke R2; mengembalikan URL internal, atau null bila gagal. */
export async function uploadPhoto(blob: Blob): Promise<string | null> {
  try {
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: authHeaders({ 'Content-Type': blob.type || 'image/jpeg' }),
      body: blob,
    });
    const json = await res.json() as { success?: boolean; url?: string };
    if (!res.ok || !json.success) return null;
    return json.url as string;
  } catch {
    return null;
  }
}