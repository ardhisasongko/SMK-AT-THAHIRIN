/**
 * Helper respons JSON untuk Pages Functions (Cloudflare).
 */

export function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

export function errorResponse(message: string, status = 500): Response {
  return jsonResponse({ success: false, error: message }, status);
}
