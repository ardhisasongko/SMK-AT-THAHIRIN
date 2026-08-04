// Generic JSON collection storage backed by Cloudflare D1.
// Routes:
//   GET /api/data                 -> list all collection keys
//   GET /api/data/:key            -> get a collection JSON value
//   PUT /api/data/:key            -> upsert a collection (body = full JSON array/object)
//   DELETE /api/data/:key         -> delete a collection

interface Env {
  DB: D1Database;
}

export const onRequestGet: PagesFunction<Env> = async ({ env, params }) => {
  const { key } = params as { key?: string };
  const db = env.DB;

  if (!key) {
    const { results } = await db
      .prepare("SELECT key, updated_at FROM app_data ORDER BY key")
      .all();
    return json({ success: true, data: results });
  }

  const k = String(key);
  const row = await db.prepare("SELECT value FROM app_data WHERE key = ?").bind(k).first();
  if (!row) {
    return json({ success: true, data: null }, 200);
  }
  return json({ success: true, data: JSON.parse(row.value as string) });
};

export const onRequestPut: PagesFunction<Env> = async ({ env, params, request }) => {
  const { key } = params as { key?: string };
  if (!key) {
    return json({ success: false, error: "Key tidak ditemukan." }, 400);
  }
  const k = String(key);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ success: false, error: "Body harus berupa JSON." }, 400);
  }

  const now = Math.floor(Date.now() / 1000);
  await env.DB
    .prepare(
      `INSERT INTO app_data (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    )
    .bind(k, JSON.stringify(body), now)
    .run();

  return json({ success: true, data: body });
};

export const onRequestDelete: PagesFunction<Env> = async ({ env, params }) => {
  const { key } = params as { key?: string };
  if (!key) {
    return json({ success: false, error: "Key tidak ditemukan." }, 400);
  }
  await env.DB.prepare("DELETE FROM app_data WHERE key = ?").bind(String(key)).run();
  return json({ success: true });
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}