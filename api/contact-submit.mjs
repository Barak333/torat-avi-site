const RABBI_EMAIL = process.env.CONTACT_RABBI_EMAIL || process.env.INNER_JUDGE_RABBI_EMAIL || "Hraraviby@gmail.com";
const FROM_EMAIL = process.env.CONTACT_FROM_EMAIL || process.env.INNER_JUDGE_FROM_EMAIL || "forms@send.torat-avi.co.il";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 8;
const rateLimitStore = globalThis.__contactRateLimitStore || new Map();
globalThis.__contactRateLimitStore = rateLimitStore;

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function clean(value, maxLength = 4000) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function isRateLimited(request) {
  const now = Date.now();
  const forwardedFor = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
  const clientKey = forwardedFor.split(",")[0].trim().slice(0, 128);
  const current = rateLimitStore.get(clientKey);
  if (!current || now - current.startedAt >= RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientKey, { startedAt: now, attempts: 1 });
    return false;
  }
  current.attempts += 1;
  return current.attempts > RATE_LIMIT_MAX_ATTEMPTS;
}

export default {
  async fetch(request) {
    const apiKey = process.env.RESEND_API_KEY;
    if (request.method === "GET") return json({ configured: Boolean(apiKey) });
    if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 30000) return json({ ok: false, message: "הפנייה גדולה מדי לשליחה." }, 413);

    const origin = request.headers.get("origin");
    if (origin) {
      try {
        if (new URL(origin).host !== new URL(request.url).host) return json({ ok: false, message: "בקשה לא מורשית." }, 403);
      } catch {
        return json({ ok: false, message: "בקשה לא מורשית." }, 403);
      }
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json({ ok: false, message: "הנתונים שנשלחו אינם תקינים." }, 400);
    }

    if (clean(body.website, 200)) return json({ ok: true });
    if (isRateLimited(request)) return json({ ok: false, message: "נשלחו מספר פניות בזמן קצר. יש להמתין כרבע שעה ולנסות שוב." }, 429);

    const data = {
      intent: clean(body.intent, 120) || "פנייה מהאתר",
      fullName: clean(body.fullName || body.name, 160),
      phone: clean(body.phone, 80),
      email: clean(body.email, 254),
      topic: clean(body.topic || body.subject, 200),
      question: clean(body.question, 8000)
    };

    if (!data.fullName || !data.question || (!data.phone && !data.email)) {
      return json({ ok: false, message: "יש למלא שם, תוכן פנייה ולפחות דרך חזרה אחת." }, 400);
    }
    if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) {
      return json({ ok: false, message: "כתובת האימייל אינה תקינה." }, 400);
    }
    if (data.phone && data.phone.replace(/\D/g, "").length < 8) {
      return json({ ok: false, message: "מספר הטלפון אינו תקין." }, 400);
    }
    if (!apiKey) return json({ ok: false, message: "מערכת השליחה טרם הופעלה. אפשר לפנות כעת בטלפון או בוואטסאפ." }, 503);

    const from = FROM_EMAIL.includes("<") ? FROM_EMAIL : `בית ההוראה מבקשי פניך <${FROM_EMAIL}>`;
    const rows = [
      ["סוג הפנייה", data.intent],
      ["שם", data.fullName],
      ["טלפון", data.phone || "לא נמסר"],
      ["אימייל", data.email || "לא נמסר"],
      ["נושא", data.topic || "לא נמסר"],
      ["תוכן הפנייה", data.question]
    ].map(([label, value]) => `<tr><td style="width:28%;padding:12px;border-bottom:1px solid #e6ddc7;color:#967414;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td><td style="padding:12px;border-bottom:1px solid #e6ddc7;color:#244b38;line-height:1.75;white-space:pre-wrap;vertical-align:top;">${escapeHtml(value)}</td></tr>`).join("");

    const resendResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [RABBI_EMAIL],
        ...(data.email ? { reply_to: data.email } : {}),
        subject: `${data.intent} - ${data.fullName}`,
        html: `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;padding:28px;background:#f3eee2;font-family:Arial,sans-serif;direction:rtl;"><div style="max-width:720px;margin:auto;background:#fffdf8;border:1px solid #d7c68f;"><header style="padding:25px;background:#00452d;color:#efd574;text-align:center;font-size:20px;font-weight:700;">פנייה חדשה מאתר מבקשי פניך</header><table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">${rows}</table></div></body></html>`,
        text: `פנייה חדשה מאתר מבקשי פניך\n\nסוג הפנייה: ${data.intent}\nשם: ${data.fullName}\nטלפון: ${data.phone || "לא נמסר"}\nאימייל: ${data.email || "לא נמסר"}\nנושא: ${data.topic || "לא נמסר"}\n\n${data.question}`
      })
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.json().catch(() => ({}));
      console.error("Contact form delivery failed", resendResponse.status, error?.name || error?.message || "unknown");
      return json({ ok: false, message: "לא ניתן היה להשלים את השליחה כעת. אפשר לנסות שוב בעוד מספר דקות." }, 502);
    }

    return json({ ok: true });
  }
};
