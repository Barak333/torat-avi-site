(() => {
  const INITIAL_SITE_PUBLICATION_DATE = "2026-06-25";
  const formatter = new Intl.DateTimeFormat("he-IL", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
  let sortDirection = "desc";
  let originalOrder = 0;

  function normalizeHebrewSearch(value) {
    return String(value || "")
      .normalize("NFKD")
      .replace(/[\u0591-\u05C7]/gu, "")
      .toLocaleLowerCase("he-IL")
      .replace(/[^\p{L}\p{N}\s]/gu, " ")
      .replace(/י+/gu, "י")
      .replace(/ו+/gu, "ו")
      .replace(/\s+/gu, " ")
      .trim();
  }

  function enableFlexibleArchiveSearch() {
    const search = document.getElementById("qnaSearch");
    const archive = document.getElementById("alonim-qna");
    if (!search || !archive || search.dataset.flexibleHebrewSearch === "true") return;
    search.dataset.flexibleHebrewSearch = "true";

    const applyFlexibleSearch = () => {
      const query = normalizeHebrewSearch(search.value);
      if (!query) return;

      const lookup = itemMap();
      let archiveHasMatches = false;
      archive.querySelectorAll(".alonim-subtopic").forEach((subtopic) => {
        let subtopicHasMatches = false;
        subtopic.querySelectorAll(":scope .alonim-item").forEach((item) => {
          const source = lookup.get(String(item.dataset.qnaId || ""));
          const searchableText = `${item.textContent || ""} ${source ? JSON.stringify(source) : ""}`;
          const matches = normalizeHebrewSearch(searchableText).includes(query);
          item.hidden = !matches;
          if (matches) subtopicHasMatches = true;
        });
        subtopic.hidden = !subtopicHasMatches;
        if (subtopicHasMatches) archiveHasMatches = true;
      });

      archive.hidden = !archiveHasMatches;
      archive.classList.toggle("is-active", archiveHasMatches);
    };

    search.addEventListener("input", applyFlexibleSearch);
    if (search.value.trim()) applyFlexibleSearch();
  }

  function itemMap() {
    const items = new Map();
    (window.alonimQnaCategories || []).forEach((category) => {
      (category.items || []).forEach((item) => {
        const id = item.permalinkId || item.id;
        if (id) items.set(String(id), item);
      });
    });
    return items;
  }

  function decoratePublishedDates() {
    const lookup = itemMap();
    document.querySelectorAll(".alonim-qna-section .alonim-item").forEach((article) => {
      const button = article.querySelector(":scope > button");
      const item = lookup.get(String(article.dataset.qnaId || ""));
      const publishedAt = String(
        item?.publishedAt || item?.createdAt || INITIAL_SITE_PUBLICATION_DATE
      ).slice(0, 10);
      article.dataset.publishedAt = publishedAt;
      if (!article.dataset.archiveOriginalOrder) {
        originalOrder += 1;
        article.dataset.archiveOriginalOrder = String(originalOrder);
      }

      const title = button?.querySelector(":scope > strong");
      if (!button || !title || button.querySelector(".alonim-published")) return;

      const titleGroup = document.createElement("div");
      titleGroup.className = "alonim-title-group";
      button.insertBefore(titleGroup, title);
      titleGroup.append(title);

      const published = document.createElement("time");
      published.className = "alonim-published";
      published.dateTime = publishedAt;
      published.textContent = `פורסם באתר: ${formatter.format(new Date(`${publishedAt}T12:00:00`))}`;
      titleGroup.append(published);
    });
  }

  function sortArchive(direction = sortDirection) {
    sortDirection = direction === "asc" ? "asc" : "desc";
    document.querySelectorAll(".alonim-qna-section .alonim-subtopic-list").forEach((list) => {
      const current = Array.from(list.querySelectorAll(":scope > .alonim-item"));
      const sorted = [...current].sort((first, second) => {
        const firstDate = first.dataset.publishedAt || INITIAL_SITE_PUBLICATION_DATE;
        const secondDate = second.dataset.publishedAt || INITIAL_SITE_PUBLICATION_DATE;
        const dateResult = sortDirection === "asc"
          ? firstDate.localeCompare(secondDate)
          : secondDate.localeCompare(firstDate);
        if (dateResult) return dateResult;
        return Number(first.dataset.archiveOriginalOrder || 0)
          - Number(second.dataset.archiveOriginalOrder || 0);
      });
      if (sorted.some((item, index) => item !== current[index])) list.append(...sorted);
    });
  }

  function ensureDateSort() {
    const layout = document.querySelector(".alonim-qna-section .alonim-qna-layout");
    const filterBar = layout?.querySelector(":scope > .alonim-qna-filterbar");
    if (!layout || !filterBar || layout.querySelector(":scope > .alonim-date-sort")) return;

    const sort = document.createElement("div");
    sort.className = "alonim-date-sort";
    sort.setAttribute("role", "group");
    sort.setAttribute("aria-label", "מיון השו״ת המקיף לפי תאריך פרסום");
    const label = document.createElement("strong");
    label.textContent = "מיון לפי תאריך:";
    sort.append(label);

    [
      ["desc", "מהחדש לישן"],
      ["asc", "מהישן לחדש"]
    ].forEach(([value, text]) => {
      const button = document.createElement("button");
      button.type = "button";
      button.dataset.dateSort = value;
      button.classList.toggle("is-active", sortDirection === value);
      button.setAttribute("aria-pressed", String(sortDirection === value));
      button.textContent = text;
      button.addEventListener("click", () => {
        sort.querySelectorAll("[data-date-sort]").forEach((option) => {
          const isActive = option === button;
          option.classList.toggle("is-active", isActive);
          option.setAttribute("aria-pressed", String(isActive));
        });
        sortArchive(value);
      });
      sort.append(button);
    });

    filterBar.after(sort);
  }

  function enhanceArchive() {
    decoratePublishedDates();
    ensureDateSort();
    sortArchive();
    enableFlexibleArchiveSearch();
  }

  let frame = 0;
  const scheduleDecoration = () => {
    if (frame) return;
    frame = window.requestAnimationFrame(() => {
      frame = 0;
      enhanceArchive();
    });
  };

  enhanceArchive();
  window.toratAviLiveContentReady?.then(scheduleDecoration).catch(() => {});

  const archive = document.querySelector('[data-render="alonim-qna"]');
  if (archive) {
    new MutationObserver(scheduleDecoration).observe(archive, { childList: true, subtree: true });
  }
})();
