/**
 * Utilitas geolokasi (tap location) untuk presensi.
 */

export interface GeoResult {
  lat: number;
  lng: number;
  label?: string;
}

function locationErrorMsg(code: number): string {
  switch (code) {
    case 1: return 'Izin lokasi ditolak. Aktifkan izin lokasi di browser.';
    case 2: return 'Tidak dapat menentukan posisi saat ini.';
    case 3: return 'Waktu deteksi lokasi habis. Coba lagi.';
    default: return 'Gagal mendapatkan lokasi.';
  }
}

export function getCurrentLocation(timeoutMs = 10000): Promise<GeoResult> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      reject(new Error('Geolokasi tidak didukung oleh browser ini.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => reject(new Error(locationErrorMsg(err.code))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 }
    );
  });
}

export function mapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export function mapsLink(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}