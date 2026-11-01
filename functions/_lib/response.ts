/**
 * Helper respons JSON untuk Pages Functions (Cloudflare).
 */

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      // Respons API adalah JSON murni, bukan dokumen: CSP paling ketat aman
      // di sini dan menutup penyalahgunaan respons sebagai halaman/objek.
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Referrer-Policy': 'no-referrer',
      'Permissions-Policy': 'camera=(self), geolocation=(self), microphone=()',
      'Cross-Origin-Resource-Policy': 'same-origin',
      'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ success: false, error: message }, status);
}
