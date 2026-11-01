/**
 * Perbandingan secret konstan-waktu: kedua nilai di-hash SHA-256 (digest
 * selalu 32 byte) lalu dibandingkan tanpa keluar lebih awal, agar waktu
 * respons tidak membocorkan posisi perbedaan token.
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
