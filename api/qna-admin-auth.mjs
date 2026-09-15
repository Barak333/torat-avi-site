import {
  clearSessionCookie,
  createSession,
  json,
  readSession,
  sameOrigin,
  sessionCookie,
  verifyPassword
} from "./_qna-admin-common.mjs";

const attempts = globalThis.__qnaAdminLoginAttempts || new Map();
globalThis.__qnaAdminLoginAttempts = attempts;

function clientKey(request) {
  return (request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown")
    .split(",")[0].trim().slice(0, 128);
}

function isLimited(request) {
  const key = clientKey(request);
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || now - current.startedAt > 15 * 60 * 1000) {
    attempts.set(key, { startedAt: now, count: 1 });
    return false;
  }
  current.count += 1;
  return current.count > 8;
}

export default {
  async fetch(request) {
    const secureCookie = new URL(request.url).protocol === "https:";
    if (request.method === "GET") {
      const session = await readSession(request);
      return json({ authenticated: Boolean(session), email: session?.email || "" });
    }

    if (!sameOrigin(request)) return json({ ok: false, message: "בקשה לא מורשית." }, 403);

    if (request.method === "DELETE") {
      return json({ ok: true }, 200, { "Set-Cookie": clearSessionCookie(secureCookie) });
    }

    if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);
    if (Number(request.headers.get("content-length") || 0) > 5000) return json({ ok: false, message: "הבקשה גדולה מדי." }, 413);
    if (isLimited(request)) return json({ ok: false, message: "בוצעו ניסיונות כניסה רבים. יש להמתין 15 דקות." }, 429);

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: "הנתונים אינם תקינים." }, 400);
    }

    const allowedEmail = String(process.env.QNA_ADMIN_EMAIL || "").trim().toLowerCase();
    const email = String(body.email || "").trim().toLowerCase();
    const validPassword = await verifyPassword(body.password, process.env.QNA_ADMIN_PASSWORD_HASH);
    if (!allowedEmail || email !== allowedEmail || !validPassword) {
      return json({ ok: false, message: "כתובת המייל או הסיסמה אינן נכונות." }, 401);
    }

    attempts.delete(clientKey(request));
    const token = await createSession(allowedEmail);
    return json({ ok: true, email: allowedEmail }, 200, { "Set-Cookie": sessionCookie(token, secureCookie) });
  }
};
