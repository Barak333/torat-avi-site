(() => {
  const list = document.querySelector("[data-updates-list]");
  const status = document.querySelector("[data-updates-status]");
  const count = document.querySelector("[data-updates-count]");
  if (!list || !status) return;

  const typeLabels = {
    PDF: "PDF",
    DOCX: "Word",
    JPG: "תמונה",
    JPEG: "תמונה",
    PNG: "תמונה",
  };

  const formatDate = (value) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return new Intl.DateTimeFormat("he-IL", {
      dateStyle: "long",
      timeZone: "Asia/Jerusalem",
    }).format(date);
  };

  const renderFile = (file) => {
    const article = document.createElement("article");
    article.className = "updates-file-card";

    const badge = document.createElement("span");
    badge.className = "updates-file-type";
    badge.textContent = typeLabels[file.type] || file.type || "קובץ";

    const heading = document.createElement("h2");
    heading.textContent = file.title || file.originalFilename || "קובץ חדש";

    const meta = document.createElement("p");
    meta.className = "updates-file-meta";
    const details = [formatDate(file.date), file.sender].filter(Boolean);
    meta.textContent = details.join(" | ");

    const filename = document.createElement("p");
    filename.className = "updates-file-name";
    filename.textContent = file.originalFilename || file.filename || "";

    article.append(badge, heading, meta, filename);
    if (file.url) {
      const link = document.createElement("a");
      link.className = "btn btn-primary updates-download";
      link.href = file.url;
      if (file.download) link.download = file.originalFilename || "";
      link.textContent = file.actionLabel || "לפתיחה";
      article.append(link);
    }
    return article;
  };

  const staticFiles = fetch("public/uploads/beit-din/files.json", { cache: "no-store" })
    .then((response) => {
      if (!response.ok) throw new Error("index");
      return response.json();
    })
    .then((data) => Array.isArray(data.files) ? data.files.map((file) => ({
      ...file,
      download: true,
      actionLabel: "להורדת הקובץ"
    })) : [])
    .catch(() => []);

  const managedItems = (window.toratAviLiveContentReady || Promise.resolve([])).then((items) => items
    .filter((item) => item.type === "announcement" || (item.type === "ruling" && item.assetUrl))
    .map((item) => {
      const url = item.linkUrl || item.assetUrl || "";
      const extension = url.split("?")[0].split(".").pop()?.toUpperCase() || "עדכון";
      return {
        title: item.title,
        type: item.type === "announcement" && !item.assetUrl ? "עדכון" : extension,
        date: item.publishedAt,
        sender: item.categoryId,
        originalFilename: item.summary || "",
        url,
        download: Boolean(item.assetUrl),
        actionLabel: item.assetUrl ? "להורדת הקובץ" : "לפרטים"
      };
    }));

  Promise.all([staticFiles, managedItems]).then(([files, managed]) => {
    const seen = new Set();
    const combined = [...managed, ...files].filter((item) => {
      const key = item.url || `${item.title}|${item.date}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    list.replaceChildren(...combined.map(renderFile));
    status.hidden = combined.length > 0;
    status.textContent = combined.length ? "" : "עדיין לא פורסמו עדכונים חדשים.";
    if (count) count.textContent = String(combined.length);
  });
})();
