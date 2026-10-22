(() => {
  const shortCode = (window.location.pathname.match(/^\/q\/([a-z0-9]{5,12})\/?$/i)?.[1]
    || new URLSearchParams(window.location.search).get("id")
    || "").toLowerCase();
  const card = document.querySelector("[data-qna-share-card]");

  const getShortCode = (value) => {
    const source = String(value || "");
    let hash = 2166136261;
    for (let index = 0; index < source.length; index += 1) {
      hash ^= source.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
  };

  const loadScript = (src) => new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = src;
    script.addEventListener("load", resolve, { once: true });
    script.addEventListener("error", reject, { once: true });
    document.head.append(script);
  });

  const appendText = (container, value) => {
    String(value || "").split(/\n{2,}/).map((text) => text.trim()).filter(Boolean).forEach((text) => {
      const wordCount = text.split(/\s+/).length;
      const isHeading = wordCount <= 9 && text.length <= 82 && !/[.!?…:]$/.test(text) && !/^["״׳']/.test(text);
      const element = document.createElement(isHeading ? "h3" : "p");
      element.textContent = text;
      container.append(element);
    });
  };

  const updateMetadata = (entry, canonicalUrl) => {
    const title = `${entry.title || entry.question || "שאלה ותשובה"} | הרב איתי בן יוסף - מבקשי פניך`;
    const descriptionSource = String(entry.question || entry.title || "").replace(/\s+/g, " ").trim();
    const description = descriptionSource.length > 155
      ? `${descriptionSource.slice(0, 152).trim()}...`
      : descriptionSource;
    document.title = title;
    const values = {
      'meta[name="description"]': description,
      'meta[property="og:title"]': title,
      'meta[property="og:description"]': description,
      'meta[property="og:url"]': canonicalUrl,
      'meta[name="twitter:title"]': title,
      'meta[name="twitter:description"]': description
    };
    Object.entries(values).forEach(([selector, content]) => {
      const element = document.querySelector(selector);
      if (element) element.content = content;
    });
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;
  };

  const renderEntry = (entry) => {
    if (!card) return;
    const canonicalUrl = `https://www.mevakshei-panecha.co.il/q/${shortCode}`;
    updateMetadata(entry, canonicalUrl);
    card.replaceChildren();
    card.classList.remove("is-loading", "is-error");

    const eyebrow = document.createElement("span");
    eyebrow.className = "qna-share-eyebrow";
    eyebrow.textContent = entry.category || "שאלה ותשובה";
    const title = document.createElement("h1");
    title.textContent = entry.title || entry.question || "שאלה ותשובה";
    const meta = document.createElement("div");
    meta.className = "qna-share-meta";
    meta.textContent = entry.publishedAt
      ? `פורסם: ${new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${entry.publishedAt}T12:00:00`))}`
      : "מאת הרב איתי בן יוסף";

    const questionSection = document.createElement("section");
    questionSection.className = "qna-share-section qna-share-question";
    const questionHeading = document.createElement("h2");
    questionHeading.textContent = "השאלה";
    questionSection.append(questionHeading);
    appendText(questionSection, entry.question || entry.title);

    const answerSection = document.createElement("section");
    answerSection.className = "qna-share-section qna-share-answer";
    const answerHeading = document.createElement("h2");
    answerHeading.textContent = "התשובה";
    answerSection.append(answerHeading);
    appendText(answerSection, entry.answer);

    const actions = document.createElement("div");
    actions.className = "qna-share-actions";
    const whatsapp = document.createElement("a");
    whatsapp.className = "qna-share-primary";
    whatsapp.href = `https://wa.me/?text=${encodeURIComponent(`${document.title}\n${canonicalUrl}`)}`;
    whatsapp.target = "_blank";
    whatsapp.rel = "noopener";
    whatsapp.textContent = "שיתוף ב-WhatsApp";
    const allQuestions = document.createElement("a");
    allQuestions.className = "qna-share-secondary";
    allQuestions.href = `/qna.html?question=${encodeURIComponent(entry.id || "")}`;
    allQuestions.textContent = "לכל השאלות והתשובות";
    actions.append(whatsapp, allQuestions);

    card.append(eyebrow, title, meta, questionSection, answerSection, actions);

    const structuredData = document.createElement("script");
    structuredData.type = "application/ld+json";
    structuredData.textContent = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Article",
      mainEntityOfPage: canonicalUrl,
      headline: entry.title || entry.question,
      articleBody: entry.answer || "",
      datePublished: entry.publishedAt || undefined,
      inLanguage: "he",
      author: { "@type": "Person", name: "הרב איתי בן יוסף", url: "https://www.mevakshei-panecha.co.il/about.html" },
      publisher: { "@type": "Organization", name: "מבקשי פניך", url: "https://www.mevakshei-panecha.co.il/" }
    });
    document.head.append(structuredData);
  };

  const showError = () => {
    if (!card) return;
    card.classList.remove("is-loading");
    card.classList.add("is-error");
    card.innerHTML = '<h1>השאלה לא נמצאה</h1><p>ייתכן שהקישור אינו שלם. אפשר להיכנס למאגר השאלות והתשובות ולחפש אותה שם.</p><a class="qna-share-primary" href="/qna.html">למאגר השאלות והתשובות</a>';
  };

  const findWeeklyEntry = () => (window.weeklyQnaEntries || []).find((entry) => getShortCode(entry.id) === shortCode);
  const weeklyEntry = findWeeklyEntry();
  if (weeklyEntry) {
    renderEntry({ ...weeklyEntry, category: "השו״ת השבועי" });
    return;
  }

  Promise.resolve()
    .then(() => loadScript("/qna-library.min.js?v=20261018-scroll-stability-1"))
    .then(() => loadScript("/qna-custom-categories.js?v=20260923-1"))
    .then(() => loadScript("/qna-permalinks.min.js?v=20261018-scroll-stability-1"))
    .then(() => {
      const entry = Object.values(window.qnaPermalinkEntries || {}).find((item) => getShortCode(item.id) === shortCode);
      if (entry) renderEntry(entry);
      else showError();
    })
    .catch(showError);
})();
