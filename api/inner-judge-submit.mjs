const RABBI_EMAIL = process.env.INNER_JUDGE_RABBI_EMAIL || "Hraraviby@gmail.com";
const LOGO_URL = process.env.INNER_JUDGE_LOGO_URL || "https://www.mevakshei-panecha.co.il/assets/mevakshei-panecha-nav-logo.webp";
const SITE_URL = "https://www.mevakshei-panecha.co.il";
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000;
const RATE_LIMIT_MAX_ATTEMPTS = 5;
const rateLimitStore = globalThis.__innerJudgeRateLimitStore || new Map();
globalThis.__innerJudgeRateLimitStore = rateLimitStore;

const fields = [
  ["fullName", "שם מלא"],
  ["age", "גיל"],
  ["phone", "טלפון"],
  ["email", "אימייל"],
  ["maritalStatus", "מצב משפחתי"],
  ["childrenCount", "מספר ילדים"],
  ["mainDifficulty", "מהו הקושי המרכזי שמביא לתהליך כעת?"],
  ["reactionGap", "מקרה שבו הגבתי אחרת מכפי שהייתי רוצה"],
  ["repeatingPattern", "התנהגות או תחושה שחוזרת בחיי"],
  ["homeRelationship", "הבית והזוגיות"],
  ["childrenRelationship", "הקשר עם הילדים"],
  ["workLife", "העבודה והפרנסה"],
  ["socialLife", "החברה והמשפחה המורחבת"],
  ["selfTestimony", "האדם מול עצמו"],
  ["faithPurpose", "אמונה ושליחות"],
  ["heartPain", "מה כואב לי במציאות הנוכחית?"],
  ["desiredSelf", "מי אני מבקש להיות?"],
  ["fearBarrier", "מה אני חושש שימנע ממני להגיע לשם?"],
  ["signature", "חתימה"],
  ["signatureDate", "תאריך ההצהרה"]
];

const requiredFields = [
  "fullName", "age", "phone", "email", "maritalStatus", "mainDifficulty",
  "reactionGap", "repeatingPattern", "homeRelationship", "workLife", "socialLife",
  "selfTestimony", "faithPurpose", "heartPain", "desiredSelf", "fearBarrier", "signature"
];

const shortFields = new Set(["fullName", "age", "phone", "email", "maritalStatus", "childrenCount", "signature", "signatureDate", "caseNumber", "openDate"]);

function json(data, status = 200) {
  return Response.json(data, {
    status,
    headers: {
      "Cache-Control": "no-store, max-age=0",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function cleanValue(value, maxLength) {
  return String(value ?? "").replace(/\u0000/g, "").trim().slice(0, maxLength);
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
  if (rateLimitStore.size > 1000) {
    for (const [key, value] of rateLimitStore) {
      if (now - value.startedAt >= RATE_LIMIT_WINDOW_MS) rateLimitStore.delete(key);
    }
  }
  return current.attempts > RATE_LIMIT_MAX_ATTEMPTS;
}

function emailShell(content, previewText = "") {
  return `<!doctype html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width"></head>
<body style="margin:0;padding:0;background:#f3eee2;color:#143b2a;font-family:Arial,'Noto Sans Hebrew',sans-serif;direction:rtl;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(previewText)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background:#f3eee2;">
    <tr><td align="center" style="padding:34px 14px;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:680px;border-collapse:collapse;background:#fffdf8;border:1px solid #d7c68f;box-shadow:0 18px 44px rgba(0,49,29,.12);">
        <tr><td align="center" style="padding:30px 28px 25px;background:#00452d;border-bottom:4px solid #c9a63a;">
          <img src="${LOGO_URL}" width="250" height="153" alt="מבקשי פניך" style="display:block;width:250px;max-width:82%;height:auto;margin:0 auto 20px;border:0;outline:none;text-decoration:none;">
          <div style="color:#efd574;font-size:13px;font-weight:700;letter-spacing:.5px;">הדיין הפנימי • מבקשי פניך - הרב איתי בן יוסף</div>
        </td></tr>
        <tr><td style="padding:42px 38px 38px;">${content}</td></tr>
        <tr><td align="center" style="padding:20px 28px;border-top:1px solid #e3d8b9;color:#7b867f;font-size:12px;line-height:1.7;">
          בית המדרש מבקשי פניך • הודעה אישית וחסויה<br>
          <a href="${SITE_URL}" style="color:#00613b;font-weight:700;">www.mevakshei-panecha.co.il</a>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function confirmationEmail(data) {
  const firstName = escapeHtml(data.fullName);
  const caseNumber = escapeHtml(data.caseNumber);
  return emailShell(`
    <div style="text-align:center;">
      <div style="width:72px;height:72px;line-height:72px;margin:0 auto 24px;border-radius:50%;background:#f1db7c;color:#06432c;font-size:36px;font-weight:700;">✓</div>
      <p style="margin:0 0 8px;color:#9a7514;font-size:13px;font-weight:700;">שלום ${firstName}, השאלון התקבל</p>
      <h1 style="margin:0;color:#063f29;font-family:Georgia,'Frank Ruhl Libre',serif;font-size:34px;line-height:1.3;">הרב קיבל את תשובותיך הכנות</h1>
      <p style="margin:15px 0 0;color:#415d4e;font-size:20px;line-height:1.65;">המסע שלך יישלח אליך בהקדם.</p>
    </div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-collapse:collapse;border-top:1px solid #dfd3b2;border-bottom:1px solid #dfd3b2;">
      <tr><td align="center" style="padding:17px 8px;color:#708077;font-size:13px;">מספר השאלון<br><strong style="display:block;margin-top:5px;color:#174a35;font-size:16px;">${caseNumber}</strong></td></tr>
    </table>
    <p style="margin:28px 0 0;color:#5d7065;font-size:15px;line-height:1.85;text-align:center;">כעת מתחיל שלב העיון האישי. הרב יקרא את התשובות ויכין עבורכם מסמך PDF מפורט, הכולל את מפת המסע ודרך התיקון האישית.</p>
    <p style="margin:20px 0 0;padding:17px 20px;border-right:3px solid #bd941f;background:#f8f3e7;color:#385646;font-size:14px;line-height:1.75;">אין צורך למלא את השאלון פעם נוספת. הודעה זו מאשרת כי התשובות הגיעו בהצלחה.</p>
  `, "הרב קיבל את תשובותיך הכנות - המסע שלך יישלח אליך בהקדם.");
}

function rabbiEmail(data, submittedAt) {
  const rows = fields.map(([key, label]) => {
    const value = data[key] || "לא נמסר";
    return `<tr>
      <td style="width:31%;padding:14px 16px;border-bottom:1px solid #e7dec7;color:#90701a;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
      <td style="padding:14px 16px;border-bottom:1px solid #e7dec7;color:#234a38;font-size:14px;line-height:1.8;white-space:pre-wrap;vertical-align:top;">${escapeHtml(value)}</td>
    </tr>`;
  }).join("");

  return emailShell(`
    <p style="margin:0;color:#9a7514;font-size:13px;font-weight:700;">שאלון חדש התקבל לעיון</p>
    <h1 style="margin:7px 0 10px;color:#063f29;font-family:Georgia,'Frank Ruhl Libre',serif;font-size:32px;line-height:1.3;">כתב הבירור של ${escapeHtml(data.fullName)}</h1>
    <p style="margin:0;color:#67776e;font-size:14px;line-height:1.7;">מספר שאלון: <strong style="color:#174a35;">${escapeHtml(data.caseNumber)}</strong> • התקבל: ${escapeHtml(submittedAt)}</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:28px;border-collapse:collapse;border:1px solid #dfd3b2;background:#fff;">${rows}</table>
    <p style="margin:24px 0 0;padding:16px 19px;border-right:3px solid #00613b;background:#f1f6f2;color:#385646;font-size:13px;line-height:1.75;">התוכן במייל זה אישי וחסוי ונועד לעיון הרב לצורך הכנת מסלול התיקון בלבד.</p>
  `, `שאלון חדש מאת ${data.fullName}`);
}

function plainConfirmation(data) {
  return `הדיין הפנימי • מבקשי פניך - הרב איתי בן יוסף\n\nשלום ${data.fullName},\nהרב קיבל את תשובותיך הכנות - המסע שלך יישלח אליך בהקדם.\n\nמספר השאלון: ${data.caseNumber}\n\nכעת מתחיל שלב העיון האישי. הרב יקרא את התשובות ויכין עבורכם מסמך PDF מפורט.`;
}

function plainRabbi(data, submittedAt) {
  const answers = fields.map(([key, label]) => `${label}:\n${data[key] || "לא נמסר"}`).join("\n\n");
  return `שאלון חדש התקבל לעיון\nמספר שאלון: ${data.caseNumber}\nהתקבל: ${submittedAt}\n\n${answers}`;
}

export default {
  async fetch(request) {
    const apiKey = process.env.RESEND_API_KEY;
    const configuredFrom = process.env.INNER_JUDGE_FROM_EMAIL || "inner-judge@send.torat-avi.co.il";
    if (request.method === "GET") return json({ configured: Boolean(apiKey) });
    if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);

    const contentLength = Number(request.headers.get("content-length") || 0);
    if (contentLength > 120000) return json({ ok: false, message: "השאלון גדול מדי לשליחה." }, 413);

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

    if (cleanValue(body.website, 200)) return json({ ok: true, caseNumber: "", submittedAt: "" });
    if (isRateLimited(request)) return json({ ok: false, message: "נשלחו מספר בקשות בזמן קצר. יש להמתין כרבע שעה ולנסות שוב." }, 429);

    const data = {};
    for (const [key] of fields) data[key] = cleanValue(body[key], shortFields.has(key) ? 250 : 8000);
    data.caseNumber = cleanValue(body.caseNumber, 40).replace(/[^0-9A-Za-z-]/g, "") || `IJ-${Date.now()}`;
    data.openDate = cleanValue(body.openDate, 40);
    const submissionToken = cleanValue(body.submissionToken, 80).replace(/[^0-9A-Za-z-]/g, "") || crypto.randomUUID();

    const missing = requiredFields.filter((key) => !data[key]);
    if (missing.length || body.privacyConsent !== true) return json({ ok: false, message: "יש להשלים את כל שדות החובה ולאשר את מדיניות הפרטיות." }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) || data.email.length > 254) return json({ ok: false, message: "כתובת האימייל אינה תקינה." }, 400);
    if (data.phone.replace(/\D/g, "").length < 8) return json({ ok: false, message: "מספר הטלפון אינו תקין." }, 400);

    if (!apiKey) return json({ ok: false, message: "מערכת השליחה טרם הופעלה. התשובות נשמרו במכשיר ואפשר לנסות שוב לאחר החיבור." }, 503);

    const from = configuredFrom.includes("<") ? configuredFrom : `הדיין הפנימי <${configuredFrom}>`;
    const submittedAt = new Intl.DateTimeFormat("he-IL", {
      dateStyle: "long",
      timeStyle: "short",
      timeZone: "Asia/Jerusalem"
    }).format(new Date());

    const emails = [
      {
        from,
        to: [RABBI_EMAIL],
        reply_to: data.email,
        subject: `שאלון הדיין הפנימי - ${data.fullName} - ${data.caseNumber}`,
        html: rabbiEmail(data, submittedAt),
        text: plainRabbi(data, submittedAt),
        tags: [{ name: "form", value: "inner-judge" }, { name: "recipient", value: "rabbi" }]
      },
      {
        from,
        to: [data.email],
        reply_to: RABBI_EMAIL,
        subject: "הרב קיבל את תשובותיך - הדיין הפנימי",
        html: confirmationEmail(data),
        text: plainConfirmation(data),
        tags: [{ name: "form", value: "inner-judge" }, { name: "recipient", value: "submitter" }]
      }
    ];

    const resendResponse = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `inner-judge/${submissionToken}`
      },
      body: JSON.stringify(emails)
    });

    if (!resendResponse.ok) {
      const error = await resendResponse.json().catch(() => ({}));
      console.error("Inner judge email delivery failed", resendResponse.status, error?.name || error?.message || "unknown");
      return json({ ok: false, message: "לא ניתן היה להשלים את השליחה כעת. התשובות נשמרו במכשיר ואפשר לנסות שוב בעוד מספר דקות." }, 502);
    }

    return json({
      ok: true,
      caseNumber: data.caseNumber,
      submittedAt: new Date().toLocaleDateString("he-IL", { timeZone: "Asia/Jerusalem" })
    });
  }
};
