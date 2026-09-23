import { clean, json, readSession, sameOrigin } from "./_qna-admin-common.mjs";

const BUILTIN_CATEGORIES = [
  { id: "mamonot", name: "דיני ממונות" },
  { id: "shabbat", name: "שבת" },
  { id: "kashrut", name: "איסור והיתר וכשרות" },
  { id: "tefila", name: "תפילה וברכות" },
  { id: "avelut", name: "אבלות" },
  { id: "sukkot", name: "מועדים וסוכות" },
  { id: "musar", name: "מוסר והנהגה" },
  { id: "kabbalah", name: "קבלה" }
];
const QNA_MARKER = "window.weeklyQnaEntries = window.weeklyQnaEntries || [";
const CUSTOM_CATEGORIES_PATH = "qna-custom-categories.js";
const GITHUB_API = "https://api.github.com";
const NOTIFICATION_EMAIL = process.env.QNA_NOTIFICATION_EMAIL || "bl0527009541@gmail.com";

function githubHeaders() {
  return {
    "Accept": "application/vnd.github+json",
    "Authorization": `Bearer ${process.env.GITHUB_CONTENT_TOKEN || ""}`,
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "mevakshei-panecha-qna-publisher"
  };
}

async function github(path, options = {}) {
  const response = await fetch(`${GITHUB_API}${path}`, {
    ...options,
    headers: { ...githubHeaders(), ...(options.headers || {}) }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!response.ok) {
    const error = new Error(`GitHub ${response.status}`);
    error.status = response.status;
    error.details = data;
    throw error;
  }
  return data;
}

function decodeBase64(value) {
  const binary = atob(String(value || "").replace(/\s/gu, ""));
  return new TextDecoder().decode(Uint8Array.from(binary, (character) => character.charCodeAt(0)));
}

function slugify(value) {
  return clean(value, 300)
    .normalize("NFKD")
    .replace(/[\u0591-\u05c7]/gu, "")
    .toLowerCase()
    .replace(/[״”“"׳'`]/gu, "")
    .replace(/[^a-z0-9\u05d0-\u05ea]+/gu, "-")
    .replace(/-+/gu, "-")
    .replace(/^-|-$/gu, "")
    .slice(0, 82)
    .replace(/-$/u, "");
}

async function shortHash(value) {
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
  return [...digest.slice(0, 5)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function validatePayload(body, categories) {
  const entry = {
    publishedAt: todayInJerusalem(),
    targetCategoryId: clean(body.targetCategoryId, 82),
    title: clean(body.title, 240),
    question: clean(body.question, 12000),
    answer: clean(body.answer, 40000)
  };
  if (!categories.some((category) => category.id === entry.targetCategoryId)) throw new Error("יש לבחור קטגוריה תקינה.");
  if (entry.title.length < 4) throw new Error("יש להזין כותרת מלאה.");
  if (entry.question.length < 8) throw new Error("טקסט השאלה קצר מדי.");
  if (entry.answer.length < 8) throw new Error("טקסט התשובה קצר מדי.");
  return entry;
}

function parseCustomCategories(source) {
  const match = String(source || "").match(/window\.qnaCustomCategories\s*=\s*window\.qnaCustomCategories\s*\|\|\s*(\[[\s\S]*?\]);/u);
  if (!match) throw new Error("מבנה קובץ הקטגוריות אינו מוכר.");
  const categories = JSON.parse(match[1]);
  if (!Array.isArray(categories)) throw new Error("רשימת הקטגוריות אינה תקינה.");
  return categories
    .map((category) => ({ id: clean(category?.id, 82), name: clean(category?.name, 80) }))
    .filter((category) => category.id && category.name);
}

function serializeCustomCategories(categories) {
  return `window.qnaCustomCategories = window.qnaCustomCategories || ${JSON.stringify(categories, null, 2)};\n`;
}

async function resolveCategory(body, customCategories) {
  const requestedId = clean(body.targetCategoryId, 82);
  const allCategories = [...BUILTIN_CATEGORIES, ...customCategories];
  if (requestedId !== "__new__") {
    if (!allCategories.some((category) => category.id === requestedId)) throw new Error("יש לבחור קטגוריה תקינה.");
    return { id: requestedId, categories: customCategories, added: false };
  }

  const name = clean(body.newCategoryName, 80).replace(/\s+/gu, " ");
  if (name.length < 2) throw new Error("יש להזין שם מלא לקטגוריה החדשה.");
  const existing = allCategories.find((category) => category.name === name);
  if (existing) return { id: existing.id, categories: customCategories, added: false };

  const base = slugify(name) || `category-${await shortHash(name)}`;
  let id = base;
  if (allCategories.some((category) => category.id === id)) id = `${base.slice(0, 70)}-${await shortHash(name)}`;
  return {
    id,
    categories: [...customCategories, { id, name }],
    added: true
  };
}

function todayInJerusalem() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const value = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${value("year")}-${value("month")}-${value("day")}`;
}

function serializeEntry(entry) {
  return JSON.stringify(entry, null, 2)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029")
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n");
}

function insertEntry(source, entry) {
  if (!source.includes(QNA_MARKER)) throw new Error("מבנה קובץ השו״ת אינו מוכר.");
  if (source.includes(`\"id\": \"${entry.id}\"`) || source.includes(`id: \"${entry.id}\"`)) {
    throw new Error("שאלה זו כבר פורסמה באתר.");
  }
  return source.replace(QNA_MARKER, `${QNA_MARKER}\n${serializeEntry(entry)},`);
}

function insertSitemap(source, entry) {
  if (!source.includes("</urlset>")) throw new Error("מבנה מפת האתר אינו מוכר.");
  const loc = `https://www.mevakshei-panecha.co.il/qna.html?question=${encodeURIComponent(entry.id)}`;
  if (source.includes(loc)) return source;
  return source.replace("</urlset>", `  <url><loc>${loc}</loc><lastmod>${entry.publishedAt}</lastmod></url>\n</urlset>`);
}

async function readRepositoryState(owner, repo, branch) {
  const ref = await github(`/repos/${owner}/${repo}/git/ref/heads/${encodeURIComponent(branch)}`);
  const commit = await github(`/repos/${owner}/${repo}/git/commits/${ref.object.sha}`);
  const [qnaFile, sitemapFile, categoriesFile] = await Promise.all([
    github(`/repos/${owner}/${repo}/contents/weekly-qna.js?ref=${ref.object.sha}`),
    github(`/repos/${owner}/${repo}/contents/sitemap.xml?ref=${ref.object.sha}`),
    github(`/repos/${owner}/${repo}/contents/${CUSTOM_CATEGORIES_PATH}?ref=${ref.object.sha}`)
  ]);
  return {
    headSha: ref.object.sha,
    treeSha: commit.tree.sha,
    qna: decodeBase64(qnaFile.content),
    sitemap: decodeBase64(sitemapFile.content),
    customCategoriesSource: decodeBase64(categoriesFile.content)
  };
}

async function createBlob(owner, repo, content) {
  return github(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" })
  });
}

async function commitEntry(owner, repo, branch, entry, state, customCategories, categoryAdded) {
  const qna = insertEntry(state.qna, entry);
  const sitemap = insertSitemap(state.sitemap, entry);
  const categorySource = serializeCustomCategories(customCategories);
  const [qnaBlob, sitemapBlob, categoriesBlob] = await Promise.all([
    createBlob(owner, repo, qna),
    createBlob(owner, repo, sitemap),
    createBlob(owner, repo, categorySource)
  ]);
  const tree = await github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: state.treeSha,
      tree: [
        { path: "weekly-qna.js", mode: "100644", type: "blob", sha: qnaBlob.sha },
        { path: "sitemap.xml", mode: "100644", type: "blob", sha: sitemapBlob.sha },
        { path: CUSTOM_CATEGORIES_PATH, mode: "100644", type: "blob", sha: categoriesBlob.sha }
      ]
    })
  });
  const commit = await github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `${categoryAdded ? "Add category and publish" : "Publish"} Q&A: ${entry.title}`,
      tree: tree.sha,
      parents: [state.headSha]
    })
  });
  await github(`/repos/${owner}/${repo}/git/refs/heads/${encodeURIComponent(branch)}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sha: commit.sha, force: false })
  });
  return commit.sha;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function sendPublicationNotification(entry, categoryName, url, commitSha) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("Q&A publication notification skipped: RESEND_API_KEY is missing");
    return false;
  }
  const from = process.env.QNA_FROM_EMAIL || process.env.CONTACT_FROM_EMAIL || process.env.INNER_JUDGE_FROM_EMAIL || "forms@send.torat-avi.co.il";
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": `qna-published/${entry.id}`
      },
      body: JSON.stringify({
        from,
        to: [NOTIFICATION_EMAIL],
        subject: `שו״ת חדש פורסם באתר - ${entry.title}`,
        html: `<!doctype html><html lang="he" dir="rtl"><body style="margin:0;padding:28px;background:#f3eee2;font-family:Arial,sans-serif;direction:rtl;"><div style="max-width:680px;margin:auto;background:#fffdf8;border:1px solid #d7c68f;"><header style="padding:24px;background:#00452d;color:#efd574;text-align:center;font-size:21px;font-weight:700;">שו״ת חדש פורסם באתר מבקשי פניך</header><div style="padding:26px;color:#244b38;line-height:1.8;"><h1 style="font-size:22px;margin:0 0 12px;">${escapeHtml(entry.title)}</h1><p><strong>קטגוריה:</strong> ${escapeHtml(categoryName)}</p><p><strong>תאריך:</strong> ${escapeHtml(entry.publishedAt)}</p><p><a href="${escapeHtml(url)}" style="display:inline-block;padding:11px 20px;border-radius:8px;background:#b58a34;color:#fff;text-decoration:none;font-weight:700;">פתיחת השו״ת באתר</a></p></div></div></body></html>`,
        text: `שו״ת חדש פורסם באתר מבקשי פניך\n\n${entry.title}\nקטגוריה: ${categoryName}\nתאריך: ${entry.publishedAt}\n\n${url}\n\nCommit: ${commitSha}`
      })
    });
    if (!response.ok) {
      const details = await response.json().catch(() => ({}));
      console.error("Q&A publication notification failed", response.status, details?.name || details?.message || "unknown");
      return false;
    }
    return true;
  } catch (error) {
    console.error("Q&A publication notification failed", error?.message || "unknown");
    return false;
  }
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);
    if (!sameOrigin(request)) return json({ ok: false, message: "בקשה לא מורשית." }, 403);
    const session = await readSession(request);
    if (!session) return json({ ok: false, message: "יש להתחבר מחדש." }, 401);
    if (Number(request.headers.get("content-length") || 0) > 60000) return json({ ok: false, message: "המסמך גדול מדי לפרסום." }, 413);

    const repository = String(process.env.GITHUB_REPOSITORY || "Barak333/torat-avi-site");
    const [owner, repo] = repository.split("/");
    const branch = String(process.env.GITHUB_BRANCH || "main");
    if (!owner || !repo || !process.env.GITHUB_CONTENT_TOKEN) {
      return json({ ok: false, message: "מערכת הפרסום עדיין אינה מחוברת למאגר האתר." }, 503);
    }

    try {
      if (request.method === "GET") {
        const state = await readRepositoryState(owner, repo, branch);
        return json({ ok: true, categories: [...BUILTIN_CATEGORIES, ...parseCustomCategories(state.customCategoriesSource)] });
      }
      const body = await request.json();
      if (body.action === "connection-test") {
        const state = await readRepositoryState(owner, repo, branch);
        if (!state.qna.includes(QNA_MARKER) || !state.sitemap.includes("</urlset>")) {
          throw new Error("מבנה קובצי האתר אינו תקין לפרסום.");
        }
        return json({ ok: true, connected: true });
      }
      const state = await readRepositoryState(owner, repo, branch);
      const currentCustomCategories = parseCustomCategories(state.customCategoriesSource);
      const resolvedCategory = await resolveCategory(body, currentCustomCategories);
      body.targetCategoryId = resolvedCategory.id;
      const allCategories = [...BUILTIN_CATEGORIES, ...resolvedCategory.categories];
      const entry = validatePayload(body, allCategories);
      const hash = await shortHash(`${entry.title}|${entry.question}`);
      entry.id = `weekly-${slugify(entry.title) || "question"}-${entry.publishedAt}-${hash}`;
      const commitSha = await commitEntry(owner, repo, branch, entry, state, resolvedCategory.categories, resolvedCategory.added);
      const url = `https://www.mevakshei-panecha.co.il/qna.html?question=${encodeURIComponent(entry.id)}`;
      const categoryName = allCategories.find((category) => category.id === entry.targetCategoryId)?.name || entry.targetCategoryId;
      const notificationSent = await sendPublicationNotification(entry, categoryName, url, commitSha);
      return json({
        ok: true,
        id: entry.id,
        url,
        commitSha,
        notificationSent,
        category: { id: entry.targetCategoryId, name: categoryName }
      });
    } catch (error) {
      const safeMessage = error?.status === 401 || error?.status === 403
        ? "החיבור המאובטח למאגר האתר דורש חידוש."
        : (error?.message || "הפרסום נכשל. יש לנסות שוב.");
      return json({ ok: false, message: safeMessage }, error?.status === 409 || error?.status === 422 ? 409 : 500);
    }
  }
};
