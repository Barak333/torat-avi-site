import { clean, json, readSession, sameOrigin } from "./_qna-admin-common.mjs";

const CATEGORIES = new Set(["mamonot", "sukkot", "avelut", "tefila", "musar", "kabbalah", "shabbat", "kashrut"]);
const QNA_MARKER = "window.weeklyQnaEntries = window.weeklyQnaEntries || [";
const GITHUB_API = "https://api.github.com";

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

function validatePayload(body) {
  const entry = {
    publishedAt: todayInJerusalem(),
    targetCategoryId: clean(body.targetCategoryId, 30),
    title: clean(body.title, 240),
    question: clean(body.question, 12000),
    answer: clean(body.answer, 40000)
  };
  if (!CATEGORIES.has(entry.targetCategoryId)) throw new Error("יש לבחור קטגוריה תקינה.");
  if (entry.title.length < 4) throw new Error("יש להזין כותרת מלאה.");
  if (entry.question.length < 8) throw new Error("טקסט השאלה קצר מדי.");
  if (entry.answer.length < 8) throw new Error("טקסט התשובה קצר מדי.");
  return entry;
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
  const [qnaFile, sitemapFile] = await Promise.all([
    github(`/repos/${owner}/${repo}/contents/weekly-qna.js?ref=${ref.object.sha}`),
    github(`/repos/${owner}/${repo}/contents/sitemap.xml?ref=${ref.object.sha}`)
  ]);
  return {
    headSha: ref.object.sha,
    treeSha: commit.tree.sha,
    qna: decodeBase64(qnaFile.content),
    sitemap: decodeBase64(sitemapFile.content)
  };
}

async function createBlob(owner, repo, content) {
  return github(`/repos/${owner}/${repo}/git/blobs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content, encoding: "utf-8" })
  });
}

async function commitEntry(owner, repo, branch, entry) {
  const state = await readRepositoryState(owner, repo, branch);
  const qna = insertEntry(state.qna, entry);
  const sitemap = insertSitemap(state.sitemap, entry);
  const [qnaBlob, sitemapBlob] = await Promise.all([
    createBlob(owner, repo, qna),
    createBlob(owner, repo, sitemap)
  ]);
  const tree = await github(`/repos/${owner}/${repo}/git/trees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      base_tree: state.treeSha,
      tree: [
        { path: "weekly-qna.js", mode: "100644", type: "blob", sha: qnaBlob.sha },
        { path: "sitemap.xml", mode: "100644", type: "blob", sha: sitemapBlob.sha }
      ]
    })
  });
  const commit = await github(`/repos/${owner}/${repo}/git/commits`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      message: `Publish Q&A: ${entry.title}`,
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

export default {
  async fetch(request) {
    if (request.method !== "POST") return json({ ok: false, message: "Method not allowed" }, 405);
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
      const body = await request.json();
      if (body.action === "connection-test") {
        const state = await readRepositoryState(owner, repo, branch);
        if (!state.qna.includes(QNA_MARKER) || !state.sitemap.includes("</urlset>")) {
          throw new Error("מבנה קובצי האתר אינו תקין לפרסום.");
        }
        return json({ ok: true, connected: true });
      }
      const entry = validatePayload(body);
      const hash = await shortHash(`${entry.title}|${entry.question}`);
      entry.id = `weekly-${slugify(entry.title) || "question"}-${entry.publishedAt}-${hash}`;
      const commitSha = await commitEntry(owner, repo, branch, entry);
      return json({
        ok: true,
        id: entry.id,
        url: `https://www.mevakshei-panecha.co.il/qna.html?question=${encodeURIComponent(entry.id)}`,
        commitSha
      });
    } catch (error) {
      const safeMessage = error?.status === 401 || error?.status === 403
        ? "החיבור המאובטח למאגר האתר דורש חידוש."
        : (error?.message || "הפרסום נכשל. יש לנסות שוב.");
      return json({ ok: false, message: safeMessage }, error?.status === 409 || error?.status === 422 ? 409 : 500);
    }
  }
};
