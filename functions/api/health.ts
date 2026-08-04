interface Env {
  DB: D1Database;
  APP_NAME?: string;
}

export const onRequestGet: PagesFunction<Env> = async ({ env }) => {
  let dbStatus = "ok";
  try {
    await env.DB.prepare("SELECT 1").first();
  } catch {
    dbStatus = "error";
  }

  return new Response(
    JSON.stringify({
      status: "ok",
      school: "SMKS PLUS AT THAHIRIN",
      app: env.APP_NAME || "SMKS PLUS AT THAHIRIN",
      db: dbStatus,
      time: new Date().toISOString(),
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
};