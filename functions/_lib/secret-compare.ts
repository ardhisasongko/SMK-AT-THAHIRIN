/**
 * Perbandingan secret konstan-waktu untuk Pages Functions.
 *
 * Kedua nilai di-hash SHA-256 terlebih dahulu (digest selalu 32 byte,
 * sehingga panjang secret asli tidak bocor lewat waktu), lalu digest
 * dibandingkan byte per byte tanpa keluar lebih awal. Menggantikan
 * perbandingan `===`/`!==` pada secret & hash token yang peka waktu.
 */
export async function secretEquals(provided: string, expected: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const [providedDigest, expectedDigest] = await Promise.all([
    crypto.subtle.digest('SHA-256', encoder.encode(provided)),
    crypto.subtle.digest('SHA-256', encoder.encode(expected)),
  ]);
  const a = new Uint8Array(providedDigest);
  const b = new Uint8Array(expectedDigest);
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a[i] ^ b[i];
  return difference === 0;
}
