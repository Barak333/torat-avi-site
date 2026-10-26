import qnaSeo from "../qna-seo-index.mjs";

const BASE_URL = "https://www.mevakshei-panecha.co.il";
const SHARE_IMAGE = `${BASE_URL}/assets/mevakshei-panecha-social-share-square-4k.jpg?v=20260907-2`;

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function clean(value = "") {
  return String(value).replace(/\s+/gu, " ").trim();
}

function descriptionFor(entry) {
  const value = clean(entry.question || entry.title);
  return value.length > 155 ? `${value.slice(0, 152).trim()}...` : value;
}

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(String(value || ""))) return "מאת הרב איתי בן יוסף";
  return `פורסם: ${new Intl.DateTimeFormat("he-IL", {
    timeZone: "Asia/Jerusalem",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(new Date(`${value}T12:00:00+03:00`))}`;
}

function contentParagraphs(value) {
  return String(value || "")
    .split(/\n{2,}/u)
    .map((paragraph) => clean(paragraph))
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
    .join("");
}

function structuredData(entry, canonicalUrl) {
  return JSON.stringify({
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Article",
        "@id": `${canonicalUrl}#article`,
        mainEntityOfPage: canonicalUrl,
        headline: entry.title || entry.question,
        description: descriptionFor(entry),
        articleBody: entry.answer || "",
        datePublished: entry.publishedAt || undefined,
        inLanguage: "he",
        author: {
          "@type": "Person",
          name: "הרב איתי בן יוסף",
          url: `${BASE_URL}/about.html`
        },
        publisher: {
          "@type": "Organization",
          name: "מבקשי פניך",
          url: `${BASE_URL}/`
        }
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: "מבקשי פניך", item: `${BASE_URL}/` },
          { "@type": "ListItem", position: 2, name: "שאלות ותשובות", item: `${BASE_URL}/qna.html` },
          { "@type": "ListItem", position: 3, name: entry.title, item: canonicalUrl }
        ]
      }
    ]
  }).replaceAll("<", "\\u003c");
}

function page(entry) {
  const canonicalUrl = `${BASE_URL}/q/${entry.code}`;
  const title = `${clean(entry.title || entry.question || "שאלה ותשובה")} | הרב איתי בן יוסף - מבקשי פניך`;
  const description = descriptionFor(entry);
  const archiveUrl = `/qna.html?question=${encodeURIComponent(entry.id)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(`${title}\n${canonicalUrl}`)}`;
  const related = Object.values(qnaSeo.entries)
    .filter((item) => item.code !== entry.code && item.category === entry.category)
    .slice(0, 5);
  const relatedMarkup = related.length
    ? `<aside class="related" aria-labelledby="related-heading"><h2 id="related-heading">שאלות נוספות בנושא</h2><ul>${related.map((item) => `<li><a href="/q/${item.code}">${escapeHtml(item.title)}</a></li>`).join("")}</ul></aside>`
    : "";
  return `<!doctype html>
<html lang="he" dir="rtl">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1">
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}">
  <link rel="canonical" href="${canonicalUrl}">
  <link rel="alternate" type="application/rss+xml" title="שו״ת מבקשי פניך" href="${BASE_URL}/feed.xml">
  <meta property="og:type" content="article">
  <meta property="og:locale" content="he_IL">
  <meta property="og:site_name" content="מבקשי פניך">
  <meta property="og:title" content="${escapeHtml(title)}">
  <meta property="og:description" content="${escapeHtml(description)}">
  <meta property="og:url" content="${canonicalUrl}">
  <meta property="og:image" content="${SHARE_IMAGE}">
  <meta property="og:image:width" content="4096">
  <meta property="og:image:height" content="4096">
  <meta property="og:image:alt" content="מבקשי פניך - השער שלך לחיים אחרים">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(title)}">
  <meta name="twitter:description" content="${escapeHtml(description)}">
  <meta name="twitter:image" content="${SHARE_IMAGE}">
  <link rel="icon" href="/assets/favicon.ico?v=20260831-logo-1" sizes="any">
  <link rel="apple-touch-icon" sizes="180x180" href="/assets/mevakshei-panecha-app-180.png?v=20260831-logo-1">
  <meta name="theme-color" content="#002b18">
  <script type="application/ld+json">${structuredData(entry, canonicalUrl)}</script>
  <style>
    :root{--forest:#00351d;--deep:#001d10;--gold:#c7a63b;--paper:#fffdf8;--ink:#14251e;--muted:#66756e}
    *{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;color:var(--ink);background:radial-gradient(circle at 50% 0,rgba(214,187,91,.16),transparent 34rem),linear-gradient(180deg,#f8f4e8,#fffdf8 38%,#f4f0e5);font-family:"Noto Serif Hebrew","Frank Ruhl Libre",Georgia,serif;line-height:1.82}
    a{color:inherit;text-decoration:none}.header{position:sticky;top:0;z-index:10;display:flex;align-items:center;justify-content:space-between;gap:20px;min-height:88px;padding:10px max(18px,calc((100vw - 1120px)/2));background:rgba(255,253,248,.94);border-bottom:1px solid rgba(145,110,22,.22);backdrop-filter:blur(14px);box-shadow:0 10px 35px rgba(0,31,17,.08)}
    .brand img{display:block;width:190px;height:66px;object-fit:contain}.nav{padding:10px 17px;border:1px solid rgba(166,130,31,.42);border-radius:999px;color:var(--forest);background:linear-gradient(180deg,#fffef9,#f3ead0);font-weight:900;box-shadow:0 8px 18px rgba(0,45,24,.1)}
    main{width:min(960px,calc(100% - 28px));margin:0 auto;padding:56px 0 86px}.intro{text-align:center;margin-bottom:30px}.intro span{display:block;color:#90701d;font-weight:900;letter-spacing:.04em}.intro strong{display:block;margin-top:4px;color:var(--forest);font-size:clamp(1.3rem,3vw,1.75rem)}
    article{position:relative;padding:clamp(26px,5vw,58px);border:1px solid rgba(178,142,40,.38);border-radius:18px;background:linear-gradient(145deg,rgba(255,255,255,.98),rgba(255,252,241,.98));box-shadow:0 28px 75px rgba(0,39,21,.15),inset 0 1px rgba(255,255,255,.9);overflow:hidden}article:before{content:"";position:absolute;inset:0 0 auto;height:5px;background:linear-gradient(90deg,transparent,#9d7720,#ead977,#9d7720,transparent)}
    .eyebrow{display:block;color:#9b7820;font-weight:900;text-align:center}h1{max-width:820px;margin:10px auto 8px;color:var(--forest);font-size:clamp(2rem,5.2vw,3.6rem);line-height:1.22;text-align:center}.meta{text-align:center;color:var(--muted);font-weight:700}.section{margin-top:34px;padding:clamp(22px,4vw,38px);border-radius:14px}.question{background:#f1eee3;border:1px solid rgba(0,53,29,.1)}.answer{background:#fff;border:1px solid rgba(183,145,36,.24);box-shadow:0 16px 40px rgba(0,39,21,.07)}.section h2{margin:0 0 15px;color:var(--forest);font-size:clamp(1.55rem,3vw,2.15rem)}.section p{margin:0 0 17px;font-size:clamp(1.02rem,2vw,1.13rem);white-space:pre-line}.related{margin-top:32px;padding:25px;border-top:1px solid rgba(178,142,40,.3)}.related h2{margin:0 0 14px;color:var(--forest);font-size:1.45rem}.related ul{margin:0;padding:0 22px 0 0}.related li{margin:8px 0}.related a{text-decoration:underline;text-decoration-color:rgba(159,121,27,.45);text-underline-offset:4px}.actions{display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin-top:36px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:50px;padding:11px 22px;border-radius:10px;font-weight:900;transition:transform .18s ease,box-shadow .18s ease}.primary{color:#fffdf0;background:linear-gradient(180deg,#075535,#002a18);border:1px solid #d6bd58;box-shadow:0 12px 25px rgba(0,42,24,.25)}.secondary{color:var(--forest);background:#fff9e9;border:1px solid rgba(167,130,27,.42)}.primary:hover,.secondary:hover{transform:translateY(-2px);box-shadow:0 16px 28px rgba(0,42,24,.2)}footer{text-align:center;padding:26px 16px;color:rgba(255,255,255,.78);background:var(--deep);border-top:2px solid #b99631}footer strong{color:#f1dc87}
    @media(max-width:640px){.header{min-height:72px}.brand img{width:132px;height:48px}.nav{padding:8px 12px;font-size:.87rem}main{padding-top:30px}article{border-radius:13px}.section{margin-top:24px}.actions>*{width:100%}}@media(prefers-reduced-motion:reduce){*{scroll-behavior:auto!important;transition:none!important}}
  </style>
</head>
<body>
  <header class="header"><a class="brand" href="/" aria-label="מבקשי פניך - דף הבית"><img src="/assets/mevakshei-panecha-nav-logo.webp?v=20260831-logo-1" width="520" height="319" alt="מבקשי פניך"></a><a class="nav" href="/qna.html">לכל השאלות והתשובות</a></header>
  <main><div class="intro"><span>בית הוראה תורת אבי</span><strong>תשובותיו של הרב איתי בן יוסף</strong></div><article>
    <span class="eyebrow">${escapeHtml(entry.category || "שאלה ותשובה")}</span>
    <h1>${escapeHtml(entry.title || entry.question)}</h1>
    <div class="meta">${escapeHtml(formatDate(entry.publishedAt))}</div>
    <section class="section question"><h2>השאלה</h2>${contentParagraphs(entry.question || entry.title)}</section>
    <section class="section answer"><h2>התשובה</h2>${contentParagraphs(entry.answer)}</section>
    ${relatedMarkup}
    <div class="actions"><a class="primary" href="${whatsappUrl}" target="_blank" rel="noopener">שיתוף ב-WhatsApp</a><a class="secondary" href="${archiveUrl}">לכל השאלות והתשובות</a></div>
  </article></main>
  <footer><strong>מבקשי פניך</strong> - השער שלך לחיים אחרים</footer>
</body>
</html>`;
}

function notFound() {
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,follow"><title>השאלה לא נמצאה | מבקשי פניך</title><style>body{margin:0;display:grid;min-height:100vh;place-items:center;background:#fffaf0;color:#00351d;font-family:Arial,sans-serif;text-align:center}main{max-width:620px;padding:30px}a{display:inline-block;margin-top:18px;padding:12px 22px;border-radius:9px;background:#00351d;color:#fff;text-decoration:none;font-weight:700}</style></head><body><main><h1>השאלה לא נמצאה</h1><p>ייתכן שהקישור אינו שלם. אפשר להיכנס למאגר השאלות והתשובות ולחפש אותה שם.</p><a href="/qna.html">למאגר השאלות והתשובות</a></main></body></html>`;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const code = clean(url.searchParams.get("id")).toLowerCase();
    const entry = qnaSeo.entries[code];
    return new Response(entry ? page(entry) : notFound(), {
      status: entry ? 200 : 404,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": entry ? "public, s-maxage=3600, stale-while-revalidate=86400" : "public, s-maxage=60",
        "X-Content-Type-Options": "nosniff"
      }
    });
  }
};
