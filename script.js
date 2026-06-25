const body = document.body;
const menuToggle = document.querySelector(".menu-toggle");
const storageKey = "orHanefeshContent";
const siteActivityKey = "toratAviLastSiteActivityV1";
const siteReturnTimeout = 2 * 60 * 1000;
let deferredInstallPrompt = null;

window.toratAviLiveContentReady = window.toratAviLiveContentReady || fetch("/api/content?limit=500", {
  headers: { accept: "application/json" },
  cache: "no-store"
})
  .then((response) => response.ok ? response.json() : { items: [] })
  .then((payload) => Array.isArray(payload.items) ? payload.items : [])
  .catch(() => []);

function readSiteActivity() {
  try {
    return Number(window.localStorage.getItem(siteActivityKey)) || 0;
  } catch {
    return 0;
  }
}

function markSiteActivity() {
  try {
    window.localStorage.setItem(siteActivityKey, String(Date.now()));
  } catch {
    // Browsing continues normally when storage is unavailable.
  }
}

const siteArrivalTime = Date.now();
const previousSiteActivity = readSiteActivity();
window.toratAviVisitState = {
  inactivityMs: previousSiteActivity
    ? Math.max(0, siteArrivalTime - previousSiteActivity)
    : Number.POSITIVE_INFINITY,
  timeoutMs: siteReturnTimeout
};
markSiteActivity();

window.setInterval(() => {
  if (!document.hidden) markSiteActivity();
}, 10000);

window.addEventListener("pagehide", markSiteActivity);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    markSiteActivity();
    return;
  }

  const returnedAt = Date.now();
  const lastActivity = readSiteActivity();
  const inactivityMs = lastActivity
    ? Math.max(0, returnedAt - lastActivity)
    : Number.POSITIVE_INFINITY;

  window.toratAviVisitState = {
    inactivityMs,
    timeoutMs: siteReturnTimeout
  };
  markSiteActivity();

  if (inactivityMs >= siteReturnTimeout) {
    window.dispatchEvent(new CustomEvent("toratavi:returned-after-inactivity", {
      detail: { inactivityMs }
    }));
  }
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  });
}

function ensureUtilityControls() {
  const main = document.querySelector("main");
  if (main && !main.id) main.id = "main-content";
  if (!document.querySelector(".skip-link")) {
    const skipLink = document.createElement("a");
    skipLink.className = "skip-link";
    skipLink.href = "#main-content";
    skipLink.textContent = "דלג לתוכן המרכזי";
    document.body.prepend(skipLink);
  }

  if (!document.querySelector(".scroll-progress")) {
    const progress = document.createElement("div");
    progress.className = "scroll-progress";
    progress.setAttribute("aria-hidden", "true");
    progress.innerHTML = "<span></span>";
    document.body.prepend(progress);
  }

  if (!document.querySelector(".accessibility-panel")) {
    const panel = document.createElement("div");
    panel.className = "accessibility-panel";
    panel.innerHTML = `
      <button class="accessibility-toggle" type="button" aria-expanded="false" aria-controls="accessibilityMenu" aria-label="פתיחת כלי נגישות">♿</button>
      <div class="accessibility-menu" id="accessibilityMenu" role="region" aria-label="כלי נגישות" hidden>
        <strong>כלי נגישות</strong>
        <button type="button" data-accessibility="font-plus">הגדלת טקסט</button>
        <button type="button" data-accessibility="font-minus">הקטנת טקסט</button>
        <button type="button" data-accessibility="contrast">ניגודיות גבוהה</button>
        <button type="button" data-accessibility="links">הדגשת קישורים</button>
        <button type="button" data-accessibility="motion">צמצום אנימציות</button>
        <button type="button" data-accessibility="reset">איפוס</button>
      </div>
    `;
    document.body.append(panel);
  }

  if (!document.querySelector(".back-to-top")) {
    const top = document.createElement("button");
    top.className = "back-to-top";
    top.type = "button";
    top.setAttribute("aria-label", "חזרה לראש הדף");
    top.textContent = "↑";
    document.body.append(top);
  }

  if (!document.querySelector(".install-app-button")) {
    const installButton = document.createElement("button");
    installButton.className = "install-app-button";
    installButton.type = "button";
    installButton.hidden = true;
    installButton.textContent = "התקנת האפליקציה";
    installButton.setAttribute("aria-label", "התקנת תורת אבי במסך הבית");
    document.body.append(installButton);
  }
}

ensureUtilityControls();

const installAppButton = document.querySelector(".install-app-button");
const mobileInstallQuery = window.matchMedia("(max-width: 760px)");

function syncInstallButtonPosition() {
  if (!installAppButton) return;
  installAppButton.classList.toggle("is-away-from-top", window.scrollY > 80);
}

function isStandaloneApp() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function syncInstallButtonVisibility() {
  if (!installAppButton) return;
  installAppButton.hidden = !mobileInstallQuery.matches || isStandaloneApp();
  syncInstallButtonPosition();
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  syncInstallButtonVisibility();
});

window.addEventListener("scroll", syncInstallButtonPosition, { passive: true });
window.addEventListener("resize", syncInstallButtonVisibility);
mobileInstallQuery.addEventListener?.("change", syncInstallButtonVisibility);
syncInstallButtonVisibility();

installAppButton?.addEventListener("click", async () => {
  if (!deferredInstallPrompt) {
    alert("להתקנה: פתח את תפריט הדפדפן ובחר התקנת אפליקציה או הוסף למסך הבית.");
    return;
  }
  installAppButton.hidden = true;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice.catch(() => {});
  deferredInstallPrompt = null;
});

window.addEventListener("appinstalled", () => {
  deferredInstallPrompt = null;
  if (installAppButton) installAppButton.hidden = true;
});

function enhanceBaseAccessibility() {
  document.querySelectorAll("svg:not([aria-label]):not([role])").forEach((svg) => {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
  });

  document.querySelectorAll("input, select, textarea").forEach((field, index) => {
    if (!field.id) field.id = `field-${index + 1}`;
    const wrapperLabel = field.closest("label");
    const previousLabel = field.previousElementSibling?.tagName === "LABEL" ? field.previousElementSibling : null;
    const parentFieldLabel = field.closest(".field")?.querySelector("label");
    const label = wrapperLabel || previousLabel || parentFieldLabel;
    if (label && !label.getAttribute("for")) label.setAttribute("for", field.id);
    if (!field.getAttribute("aria-label") && !field.getAttribute("aria-labelledby") && !label) {
      field.setAttribute("aria-label", field.placeholder || field.name || "שדה טופס");
    }
  });

  document.querySelectorAll(".site-search-dialog, .levado-help-dialog").forEach((dialog) => {
    dialog.setAttribute("role", "dialog");
    dialog.setAttribute("aria-modal", "true");
    if (!dialog.hasAttribute("aria-hidden")) dialog.setAttribute("aria-hidden", dialog.hidden ? "true" : "false");
  });

  document.querySelectorAll(".quick-cart-icon svg, .quick-site-search svg, .qna-hero-search svg").forEach((svg) => {
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");
  });

  document.querySelectorAll(".menu-toggle span, .nav-dropdown-caret").forEach((node) => {
    node.setAttribute("aria-hidden", "true");
  });
}

enhanceBaseAccessibility();

const progressBar = document.querySelector(".scroll-progress span");
function updateScrollProgress() {
  const max = document.documentElement.scrollHeight - window.innerHeight;
  const progress = max > 0 ? (window.scrollY / max) * 100 : 0;
  if (progressBar) progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  document.body.classList.toggle("scrolled", window.scrollY > 360);
}

window.addEventListener("scroll", updateScrollProgress, { passive: true });
updateScrollProgress();

document.querySelector(".back-to-top")?.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});

const accessibilityToggle = document.querySelector(".accessibility-toggle");
const accessibilityMenu = document.querySelector(".accessibility-menu");
accessibilityToggle?.addEventListener("click", () => {
  const isOpen = accessibilityMenu?.hidden === false;
  if (accessibilityMenu) accessibilityMenu.hidden = isOpen;
  accessibilityToggle.setAttribute("aria-expanded", String(!isOpen));
});

document.querySelectorAll("[data-accessibility]").forEach((button) => {
  button.addEventListener("click", () => {
    const action = button.dataset.accessibility;
    const currentScale = Number(document.documentElement.dataset.fontScale || 1);
    if (action === "font-plus") document.documentElement.dataset.fontScale = String(Math.min(1.25, currentScale + 0.08));
    if (action === "font-minus") document.documentElement.dataset.fontScale = String(Math.max(0.9, currentScale - 0.08));
    if (action === "contrast") document.body.classList.toggle("high-contrast");
    if (action === "links") document.body.classList.toggle("highlight-links");
    if (action === "motion") document.body.classList.toggle("reduce-motion");
    if (action === "reset") {
      document.documentElement.dataset.fontScale = "1";
      document.body.classList.remove("high-contrast", "highlight-links", "reduce-motion");
    }
  });
});

function getSiteContent() {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || "{}");
    const content = { ...(window.siteSeedContent || {}), ...saved };
    if (Array.isArray(window.toratAviManagedAnnouncements)) {
      content.announcements = [
        ...window.toratAviManagedAnnouncements,
        ...(Array.isArray(content.announcements) ? content.announcements : [])
      ];
    }
    return content;
  } catch {
    const content = window.siteSeedContent || {};
    return Array.isArray(window.toratAviManagedAnnouncements)
      ? { ...content, announcements: [...window.toratAviManagedAnnouncements, ...(content.announcements || [])] }
      : content;
  }
}

function setActiveNavigation() {
  const nav = document.querySelector(".main-nav");
  if (!nav) return;

  const currentFile = decodeURIComponent(window.location.pathname.split("/").pop() || "index.html").toLowerCase();
  const currentHash = decodeURIComponent(window.location.hash || "");
  const articleHashes = new Set(["#hitbonenut"]);
  const articleFiles = new Set(["articles.html", "articles-shabbat.html", "articles-moadim.html", "articles-hitbonenut.html"]);
  const soulFiles = new Set(["soul-torah.html", "growth.html", "emuna.html", "zugiyut.html", "levado.html", "children-education.html"]);

  nav.querySelectorAll("a").forEach((link) => {
    link.removeAttribute("aria-current");
    link.classList.remove("is-active-link", "is-parent-active");
  });
  nav.querySelectorAll(".nav-dropdown").forEach((dropdown) => dropdown.classList.remove("is-active"));

  const getLinkState = (link) => {
    const href = link.getAttribute("href") || "";
    const url = new URL(href, window.location.href);
    return {
      file: decodeURIComponent(url.pathname.split("/").pop() || "index.html").toLowerCase(),
      hash: decodeURIComponent(url.hash || "")
    };
  };

  const isArticleContext = articleFiles.has(currentFile);
  const isSoulContext = soulFiles.has(currentFile);

  nav.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
    const trigger = dropdown.querySelector(".nav-dropdown-trigger");
    const triggerText = (trigger?.textContent || "").trim();
    const submenuLinks = Array.from(dropdown.querySelectorAll(".nav-dropdown-menu a"));
    let activeSubLink = null;

    if (triggerText.startsWith("מאמרים") && isArticleContext) {
      activeSubLink = submenuLinks.find((link) => {
        const state = getLinkState(link);
        return state.file === currentFile && (!state.hash || state.hash === currentHash);
      }) || null;
    }

    if (triggerText.startsWith("נפש") && isSoulContext) {
      activeSubLink = submenuLinks.find((link) => getLinkState(link).file === currentFile) || null;
    }

    if (activeSubLink || (triggerText.startsWith("מאמרים") && isArticleContext) || (triggerText.startsWith("נפש") && isSoulContext)) {
      dropdown.classList.add("is-active");
      trigger?.classList.add("is-parent-active");
      activeSubLink?.setAttribute("aria-current", "page");
      activeSubLink?.classList.add("is-active-link");
    }
  });

  if (isArticleContext || isSoulContext) return;

  nav.querySelectorAll(":scope > a").forEach((link) => {
    const state = getLinkState(link);
    const hashMatches = !state.hash || state.hash === currentHash;
    if (state.file === currentFile && hashMatches) {
      link.setAttribute("aria-current", "page");
      link.classList.add("is-active-link");
    }
  });
}

setActiveNavigation();
window.addEventListener("hashchange", setActiveNavigation);

if (menuToggle) {
  menuToggle.addEventListener("click", () => {
    const isOpen = body.classList.toggle("nav-open");
    menuToggle.setAttribute("aria-expanded", String(isOpen));
  });

  document.addEventListener("click", (event) => {
    if (!body.classList.contains("nav-open")) return;
    const header = document.querySelector(".site-header");
    if (header && !header.contains(event.target)) {
      body.classList.remove("nav-open");
      menuToggle.setAttribute("aria-expanded", "false");
    }
  });
}

document.querySelectorAll(".main-nav a").forEach((link) => {
  link.addEventListener("click", () => {
    if (link.classList.contains("nav-dropdown-trigger")) return;
    body.classList.remove("nav-open");
    menuToggle?.setAttribute("aria-expanded", "false");
  });
});

document.querySelectorAll(".nav-dropdown").forEach((dropdown) => {
  const trigger = dropdown.querySelector(".nav-dropdown-trigger");
  trigger?.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelectorAll(".nav-dropdown.is-open").forEach((openDropdown) => {
      if (openDropdown !== dropdown) {
        openDropdown.classList.remove("is-open");
        openDropdown.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
      }
    });
    const isOpen = dropdown.classList.toggle("is-open");
    trigger.setAttribute("aria-expanded", String(isOpen));
  });
});

function setupMobileFooterAccordions() {
  const footer = document.querySelector(".site-footer");
  if (!footer) return;

  const mobileQuery = window.matchMedia("(max-width: 760px)");
  const groups = Array.from(footer.querySelectorAll(".footer-grid > div")).filter((group) => {
    return !group.classList.contains("footer-brand") && group.querySelector("h3");
  });

  groups.forEach((group, index) => {
    const heading = group.querySelector("h3");
    const content = group.querySelector(".footer-links, p");
    if (!heading || !content || group.classList.contains("footer-accordion-ready")) return;

    const button = document.createElement("button");
    const contentId = `footerAccordion${index + 1}`;
    button.type = "button";
    button.className = "footer-accordion-toggle";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", contentId);
    button.innerHTML = `<span>${heading.textContent.trim()}</span><span class="footer-accordion-icon" aria-hidden="true"></span>`;

    heading.textContent = "";
    heading.append(button);
    content.id = content.id || contentId;
    content.classList.add("footer-accordion-content");
    group.classList.add("footer-accordion-ready");

    button.addEventListener("click", () => {
      if (!mobileQuery.matches) return;
      const isOpen = group.classList.toggle("is-open");
      button.setAttribute("aria-expanded", String(isOpen));
      content.hidden = !isOpen;
    });
  });

  function syncFooterAccordions() {
    groups.forEach((group) => {
      const button = group.querySelector(".footer-accordion-toggle");
      const content = group.querySelector(".footer-accordion-content");
      if (!button || !content) return;
      if (mobileQuery.matches) {
        const isOpen = group.classList.contains("is-open");
        button.setAttribute("aria-expanded", String(isOpen));
        content.hidden = !isOpen;
      } else {
        content.hidden = false;
        button.setAttribute("aria-expanded", "true");
      }
    });
  }

  syncFooterAccordions();
  mobileQuery.addEventListener?.("change", syncFooterAccordions);
}

setupMobileFooterAccordions();

document.querySelectorAll("[data-whatsapp-join]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const phone = form.querySelector('input[name="phone"]')?.value.trim() || "";
    const message = `אני רוצה להצטרף לקהילה. מספר הפלאפון שלי: ${phone}`;
    window.open(`https://wa.me/972527009541?text=${encodeURIComponent(message)}`, "_blank", "noopener");
  });
});

const counters = document.querySelectorAll("[data-count-to]");
if (counters.length) {
  const counterObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const number = entry.target;
      const target = Number(number.dataset.countTo || 0);
      const duration = 1500;
      const start = performance.now();
      const formatter = new Intl.NumberFormat("he-IL");

      function tick(now) {
        const progress = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - progress, 3);
        number.textContent = formatter.format(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      }

      requestAnimationFrame(tick);
      counterObserver.unobserve(number);
    });
  }, { threshold: 0.55 });

  counters.forEach((counter) => counterObserver.observe(counter));
}

document.addEventListener("click", (event) => {
  if (event.target.closest(".nav-dropdown")) return;
  document.querySelectorAll(".nav-dropdown.is-open").forEach((dropdown) => {
    dropdown.classList.remove("is-open");
    dropdown.querySelector(".nav-dropdown-trigger")?.setAttribute("aria-expanded", "false");
  });
});

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        entry.target.classList.add("is-zoom-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.12 }
);

  document.querySelectorAll(".reveal, .zoom-reveal, .reveal-drop, .directory-card").forEach((el) => observer.observe(el));

document.querySelectorAll("[data-donation-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-donation-mode]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const mode = button.dataset.donationMode;
    document.querySelectorAll("[data-mode-copy]").forEach((copy) => {
      copy.hidden = copy.dataset.modeCopy !== mode;
    });
    const hiddenInput = document.querySelector("[name='donationType']");
    if (hiddenInput) hiddenInput.value = mode === "monthly" ? "הוראת קבע חודשית" : "תרומה חד פעמית";
    const amountPresets = {
      single: [
        ["50", "פותחים אור"],
        ["250", "שותף תורה"],
        ["500", "מרבים פעילות"],
        ["750", "מחזקים בית"],
      ],
      monthly: [
        ["250", "שותפות קבועה"],
        ["500", "מחזיקים שיעורים"],
        ["750", "מרחיבים מענה"],
        ["1000", "עמוד של פעילות"],
      ],
    };
    document.querySelectorAll(".premium-amounts [data-amount]").forEach((amountButton, index) => {
      const preset = amountPresets[mode]?.[index];
      if (!preset) return;
      const [amount, label] = preset;
      amountButton.dataset.amount = amount;
      amountButton.querySelector("strong").textContent = `₪${amount}`;
      amountButton.querySelector("span").textContent = label;
      amountButton.classList.toggle("is-active", index === 1);
    });
    const custom = document.querySelector("[name='customAmount']");
    if (custom) custom.value = mode === "monthly" ? "500" : "250";
  });
});

document.querySelectorAll("[data-amount]").forEach((button) => {
  button.addEventListener("click", () => {
    document.querySelectorAll("[data-amount]").forEach((item) => item.classList.remove("is-active"));
    button.classList.add("is-active");
    const custom = document.querySelector("[name='customAmount']");
    if (custom) custom.value = button.dataset.amount;
  });
});

document.querySelectorAll("[data-copy-value]").forEach((button) => {
  button.addEventListener("click", async () => {
    const value = button.dataset.copyValue || "";
    try {
      await navigator.clipboard.writeText(value);
    } catch (error) {
      const helper = document.createElement("textarea");
      helper.value = value;
      helper.setAttribute("readonly", "");
      helper.style.position = "fixed";
      helper.style.opacity = "0";
      document.body.appendChild(helper);
      helper.select();
      document.execCommand("copy");
      helper.remove();
    }
    const previous = button.textContent;
    button.textContent = "הועתק";
    setTimeout(() => {
      button.textContent = previous;
    }, 1400);
  });
});

document.querySelectorAll(".faq-item button").forEach((button) => {
  button.addEventListener("click", () => {
    const item = button.closest(".faq-item");
    const isOpen = item.classList.toggle("is-open");
    button.setAttribute("aria-expanded", String(isOpen));
  });
});

const qnaSearch = document.getElementById("qnaSearch");
if (qnaSearch) {
  const qnaTabs = document.querySelectorAll(".qna-category-tabs a");
  const qnaTopics = document.querySelectorAll(".qna-topic");
  const searchParams = new URLSearchParams(window.location.search);
  const incomingQnaQuery = (searchParams.get("q") || searchParams.get("search") || "").trim();
  let activeQnaTopic = window.location.hash && document.querySelector(window.location.hash)
    ? window.location.hash.slice(1)
    : (qnaTabs[0]?.getAttribute("href") || "#shabbat").slice(1);

  const resetQnaVisibility = () => {
    document.querySelectorAll(".faq-item, .choshen-item, .shabbat-item, .issur-item, .issur-letter, .alonim-item, .weekly-qna-item").forEach((item) => {
      item.hidden = false;
    });
    document.querySelectorAll(".shabbat-subtopic, .issur-subtopic, .alonim-subtopic").forEach((subtopic) => {
      subtopic.hidden = false;
    });
  };

  const setActiveQnaTopic = (topicId, { clearSearch = true } = {}) => {
    activeQnaTopic = topicId;
    qnaTabs.forEach((tab) => {
      const isActive = tab.getAttribute("href") === `#${topicId}`;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
    qnaTopics.forEach((topic) => {
      topic.hidden = topic.id !== topicId;
      topic.classList.toggle("is-active", topic.id === topicId);
    });
    if (clearSearch) qnaSearch.value = "";
    resetQnaVisibility();
  };
  window.setActiveQnaTopicFromLink = setActiveQnaTopic;

  const filterActiveQnaTopic = () => {
    const query = qnaSearch.value.trim().toLowerCase();
    if (!query) {
      setActiveQnaTopic(activeQnaTopic, { clearSearch: false });
      return;
    }

    qnaTopics.forEach((topic) => {
      let topicHasVisibleItems = false;

      topic.querySelectorAll(".faq-item, .choshen-item, .shabbat-item, .issur-item, .issur-letter, .alonim-item, .weekly-qna-item").forEach((item) => {
        const text = item.textContent.toLowerCase();
        const isMatch = text.includes(query);
        item.hidden = !isMatch;
        if (isMatch) topicHasVisibleItems = true;
      });

      topic.querySelectorAll(".shabbat-subtopic, .issur-subtopic, .alonim-subtopic").forEach((subtopic) => {
        const hasVisibleItems = Array.from(subtopic.querySelectorAll(".shabbat-item, .issur-item, .issur-letter, .alonim-item")).some((item) => !item.hidden);
        subtopic.hidden = !hasVisibleItems;
      });

      topic.hidden = !topicHasVisibleItems;
      topic.classList.toggle("is-active", topicHasVisibleItems);
    });
  };

  const topicHasQnaMatch = (topic, query) => {
    if (!query) return false;
    return Array.from(topic.querySelectorAll(".faq-item, .choshen-item, .shabbat-item, .issur-item, .issur-letter, .alonim-item, .weekly-qna-item")).some((item) => item.textContent.toLowerCase().includes(query));
  };

  window.applyQnaSearchFromUrl = () => {
    if (!incomingQnaQuery) return;
    const query = incomingQnaQuery.toLowerCase();
    const matchingTopic = Array.from(qnaTopics).find((topic) => topicHasQnaMatch(topic, query));
    if (matchingTopic) {
      setActiveQnaTopic(matchingTopic.id, { clearSearch: false });
    }
    qnaSearch.value = incomingQnaQuery;
    filterActiveQnaTopic();
    (qnaSearch.closest(".qna-hero-search") || qnaSearch.closest(".qna-section-head"))?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  qnaTabs.forEach((tab) => {
    tab.setAttribute("role", "tab");
    tab.addEventListener("click", (event) => {
      event.preventDefault();
      const topicId = tab.getAttribute("href").replace("#", "");
      setActiveQnaTopic(topicId);
      history.replaceState(null, "", `${location.pathname}#${topicId}`);
    });
  });

  document.querySelector(".qna-category-tabs")?.setAttribute("role", "tablist");
  setActiveQnaTopic(activeQnaTopic, { clearSearch: false });
  qnaSearch.addEventListener("input", filterActiveQnaTopic);
  qnaSearch.closest("form")?.addEventListener("submit", (event) => {
    event.preventDefault();
    filterActiveQnaTopic();
    document.querySelector(".qna-categories-section")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });
}

function renderChoshenMishpat() {
  const target = document.querySelector('[data-render="choshen-mishpat"]');
  const items = window.choshenMishpatContent || [];
  if (!target || !items.length) return;
  target.innerHTML = items.map((item, index) => `
    <article class="choshen-item">
      <button type="button" aria-expanded="false">
        <span class="choshen-number">${String(index + 1).padStart(2, "0")}</span>
        <span class="choshen-head">
          <span class="choshen-meta">${item.heading || "שו״ת ממונות"}</span>
          <strong>${item.title || ""}</strong>
        </span>
        <span class="choshen-open-icon" aria-hidden="true"></span>
      </button>
      <div class="choshen-body" hidden></div>
    </article>
  `).join("");

  target.querySelectorAll(".choshen-item").forEach((node, index) => {
    const body = node.querySelector(".choshen-body");
    const overview = buildChoshenOverview(items[index]);
    if (overview) {
      body.append(
        buildChoshenDivider("תקציר הסימן", "summary"),
        overview,
        buildChoshenDivider("בהרחבה", "full")
      );
    }
    let listIndex = 0;
    (items[index].paragraphs || []).forEach((paragraph) => {
      const p = document.createElement("p");
      const sourceRuns = typeof paragraph === "string" ? [{ text: paragraph, bold: false }] : paragraph.runs || [{ text: paragraph.text || "", bold: false }];
      const runs = sourceRuns.reduce((merged, run) => {
        const previous = merged[merged.length - 1];
        if (previous && previous.bold === run.bold) previous.text += run.text;
        else merged.push({ ...run });
        return merged;
      }, []);
      const isList = typeof paragraph === "object" && paragraph.isList;
      if (isList) {
        listIndex += 1;
        p.className = "doc-list-paragraph";
        const marker = document.createElement("span");
        marker.className = "doc-list-marker";
        marker.textContent = `${listIndex}.`;
        p.append(marker);
      }
      runs.forEach((run) => {
        const node = document.createElement(run.bold ? "strong" : "span");
        node.textContent = run.text;
        p.append(node);
      });
      body.append(p);
    });
    node.querySelector("button")?.addEventListener("click", () => {
      const isOpen = body.hidden === false;
      body.hidden = isOpen;
      node.classList.toggle("is-open", !isOpen);
      node.querySelector("button").setAttribute("aria-expanded", String(!isOpen));
    });
  });
}

renderChoshenMishpat();

function getChoshenParagraphText(paragraph) {
  if (typeof paragraph === "string") return paragraph;
  return paragraph?.text || "";
}

function cleanChoshenExcerpt(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/^(שאלה|תשובה|מסקנת הדברים|פסק הדין)\s*[:：]?\s*/u, "")
    .trim();
}

function trimChoshenExcerpt(text, maxLength = 420) {
  const value = cleanChoshenExcerpt(text);
  if (value.length <= maxLength) return value;
  const slice = value.slice(0, maxLength);
  const sentenceEnd = Math.max(slice.lastIndexOf("."), slice.lastIndexOf("?"), slice.lastIndexOf("!"));
  const wordEnd = slice.lastIndexOf(" ");
  const end = sentenceEnd > maxLength * 0.55 ? sentenceEnd + 1 : wordEnd;
  return `${slice.slice(0, end > 0 ? end : maxLength).trim()}...`;
}

function getChoshenQuestion(item) {
  const paragraphs = item?.paragraphs || [];
  const questionLines = [];
  let collecting = false;
  paragraphs.forEach((paragraph) => {
    const text = getChoshenParagraphText(paragraph).trim();
    if (!text) return;
    if (/^תשובה\s*[:：]?/u.test(text)) {
      collecting = false;
      return;
    }
    if (/^שאלה\s*[:：]?/u.test(text)) collecting = true;
    if (collecting) questionLines.push(cleanChoshenExcerpt(text));
  });
  const explicitQuestion = questionLines.filter(Boolean).join(" ");
  if (explicitQuestion) return explicitQuestion;
  const titleIndex = paragraphs.findIndex((paragraph) => getChoshenParagraphText(paragraph).trim() === item?.title);
  const answerIndex = paragraphs.findIndex((paragraph) => /^תשובה\s*[:：]?/u.test(getChoshenParagraphText(paragraph).trim()));
  if (titleIndex < 0 || answerIndex < 0 || answerIndex <= titleIndex) return "";
  return paragraphs
    .slice(titleIndex + 1, answerIndex)
    .map(getChoshenParagraphText)
    .map(cleanChoshenExcerpt)
    .filter((text) => text && text !== "מספר שאלות בעניין דומה:")
    .join(" ");
}

function getChoshenRuling(item) {
  const paragraphs = (item?.paragraphs || []).map(getChoshenParagraphText).map((text) => text.trim()).filter(Boolean);
  const conclusionIndex = paragraphs.findIndex((text) => /^(מסקנת הדברים|פסק הדין)\s*[:：]?/u.test(text));
  if (conclusionIndex >= 0) {
    const conclusionText = cleanChoshenExcerpt(paragraphs[conclusionIndex]);
    const following = paragraphs.slice(conclusionIndex + 1).map(cleanChoshenExcerpt).filter(Boolean);
    return [conclusionText, ...following].filter(Boolean).join(" ");
  }
  const afterAnswer = paragraphs.slice(paragraphs.findIndex((text) => /^תשובה\s*[:：]?/u.test(text)) + 1);
  const fallback = [...afterAnswer].reverse().find((text) => !/^סימן\s+/u.test(text) && text !== item?.title);
  return cleanChoshenExcerpt(fallback || "");
}

function buildChoshenOverview(item) {
  const questionText = trimChoshenExcerpt(getChoshenQuestion(item));
  const rulingText = trimChoshenExcerpt(getChoshenRuling(item));
  if (!questionText && !rulingText) return null;
  const overview = document.createElement("div");
  overview.className = "choshen-overview";
  if (questionText) {
    const question = document.createElement("div");
    question.className = "choshen-overview-card";
    const label = document.createElement("span");
    label.textContent = "השאלה לדיון";
    const p = document.createElement("p");
    p.textContent = questionText;
    question.append(label, p);
    overview.append(question);
  }
  if (rulingText) {
    const ruling = document.createElement("div");
    ruling.className = "choshen-overview-card choshen-ruling";
    const label = document.createElement("span");
    label.textContent = "תמצית ההכרעה";
    const p = document.createElement("p");
    p.textContent = rulingText;
    ruling.append(label, p);
    overview.append(ruling);
  }
  return overview;
}

function buildChoshenDivider(text, variant) {
  const divider = document.createElement("div");
  divider.className = `choshen-divider choshen-divider-${variant}`;
  const label = document.createElement("span");
  label.textContent = text;
  divider.append(label);
  return divider;
}

function renderShabbatQuestions() {
  const target = document.querySelector('[data-render="shabbat-qna"]');
  const items = window.shabbatQuestionsContent || [];
  if (!target || !items.length) return;
  const groups = items.reduce((result, item, index) => {
    const key = item.subtopic || "שבת";
    if (!result[key]) result[key] = [];
    result[key].push({ item, index });
    return result;
  }, {});

  target.innerHTML = Object.entries(groups).map(([subtopic, groupItems]) => `
    <section class="shabbat-subtopic">
      <h3>${subtopic}</h3>
      <div class="shabbat-subtopic-list">
        ${groupItems.map(({ item, index }) => `
          <article class="shabbat-item" data-shabbat-index="${index}">
            <button type="button" aria-expanded="false">
              <span>${item.heading || "שבת"}</span>
              <strong><em class="shabbat-question-number">${item.number || index + 1}</em><span class="shabbat-question-title">${item.title || ""}</span></strong>
            </button>
            <div class="shabbat-body" hidden></div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  target.querySelectorAll(".shabbat-item").forEach((node) => {
    const index = Number(node.dataset.shabbatIndex || 0);
    const body = node.querySelector(".shabbat-body");
    (items[index].paragraphs || []).forEach((paragraph) => {
      const p = document.createElement("p");
      if (paragraph.source) p.className = "shabbat-source-link";
      const sourceRuns = paragraph.runs || [{ text: paragraph.text || "", bold: false }];
      const runs = sourceRuns.reduce((merged, run) => {
        const previous = merged[merged.length - 1];
        if (previous && previous.bold === run.bold && previous.href === run.href) previous.text += run.text;
        else merged.push({ ...run });
        return merged;
      }, []);
      runs.forEach((run) => {
        const child = document.createElement(run.href ? "a" : run.bold ? "strong" : "span");
        if (run.href) {
          child.href = run.href;
          child.target = "_blank";
          child.rel = "noopener";
          if (run.bold) child.className = "strong-link";
        }
        child.textContent = run.text;
        p.append(child);
      });
      body.append(p);
    });
    node.querySelector("button")?.addEventListener("click", () => {
      const isOpen = body.hidden === false;
      body.hidden = isOpen;
      node.querySelector("button").setAttribute("aria-expanded", String(!isOpen));
    });
  });
}

renderShabbatQuestions();

function renderIssurHeterQuestions() {
  const target = document.querySelector('[data-render="issur-heter-qna"]');
  const items = window.issurHeterQuestionsContent || [];
  if (!target || !items.length) return;
  const groups = items.reduce((result, item, index) => {
    const key = item.subtopic || "איסור והיתר";
    if (!result[key]) result[key] = [];
    result[key].push({ item, index });
    return result;
  }, {});
  target.innerHTML = Object.entries(groups).map(([subtopic, groupItems]) => `
    <section class="issur-subtopic">
      <h3>${subtopic}</h3>
      <div class="issur-subtopic-list">
        ${subtopic.startsWith("נספח") ? `
          <div class="issur-letter-pages" aria-label="צילומי מכתבים מתוך הספר">
            ${(window.issurHeterLettersPages || []).filter((page) => Number(page.page) >= 375).map((page) => `
              <figure class="issur-letter-page">
                <figcaption>עמוד ${page.page || ""}</figcaption>
                <img src="${page.src || ""}" alt="צילום עמוד ${page.page || ""} מתוך נספח המכתבים" loading="lazy">
              </figure>
            `).join("")}
          </div>
        ` : groupItems.map(({ item, index }) => `
          <article class="issur-item" data-issur-index="${index}">
            <button type="button" aria-expanded="false">
              <span>${item.heading || "איסור והיתר"}</span>
              <strong>${item.title || ""}</strong>
            </button>
            <div class="issur-body" hidden></div>
          </article>
        `).join("")}
      </div>
    </section>
  `).join("");

  target.querySelectorAll(".issur-item").forEach((node) => {
    const index = Number(node.dataset.issurIndex || 0);
    const body = node.querySelector(".issur-body");
    (items[index].paragraphs || []).forEach((paragraph) => {
      const p = document.createElement("p");
      if (paragraph.source) p.className = "issur-source-link";
      const sourceRuns = paragraph.runs || [{ text: paragraph.text || "", bold: false }];
      const runs = sourceRuns.reduce((merged, run) => {
        const previous = merged[merged.length - 1];
        if (previous && previous.bold === run.bold && previous.href === run.href) previous.text += run.text;
        else merged.push({ ...run });
        return merged;
      }, []);
      runs.forEach((run) => {
        const child = document.createElement(run.href ? "a" : run.bold ? "strong" : "span");
        if (run.href) {
          child.href = run.href;
          child.target = "_blank";
          child.rel = "noopener";
          if (run.bold) child.className = "strong-link";
        }
        child.textContent = run.text;
        p.append(child);
      });
      body.append(p);
    });
    node.querySelector("button")?.addEventListener("click", () => {
      const isOpen = body.hidden === false;
      body.hidden = isOpen;
      node.querySelector("button").setAttribute("aria-expanded", String(!isOpen));
    });
  });
}

renderIssurHeterQuestions();

function appendWeeklyQnaParagraphs(container, text, item, namespace = "weekly") {
  String(text || "").split(/\n+/).filter(Boolean).forEach((line) => {
    const paragraph = document.createElement("p");
    const inlineParts = line.split(/(\[\[fn:\s*\d+\]\])/g);
    const hasInlineNotes = inlineParts.some((part) => /^\[\[fn:\s*\d+\]\]$/.test(part));
    if (hasInlineNotes) {
      inlineParts.forEach((part) => {
        const match = part.match(/^\[\[fn:\s*(\d+)\]\]$/);
        if (!match) {
          paragraph.append(document.createTextNode(part));
          return;
        }
        const number = match[1];
        const sup = document.createElement("sup");
        sup.className = "alonim-footnote-ref";
        const link = document.createElement("a");
        link.id = `${item.id}-${namespace}-ref-${number}`;
        link.href = `#${item.id}-${namespace}-note-${number}`;
        link.textContent = number;
        sup.append(link);
        paragraph.append(sup);
      });
      container.append(paragraph);
      return;
    }
    const note = (item.notes || []).find((entry) => entry.markerText && line.includes(entry.markerText));
    if (note) {
      const noteIndex = (item.notes || []).indexOf(note) + 1;
      const [before, after] = line.split(note.markerText);
      paragraph.append(document.createTextNode(before || ""));
      paragraph.append(document.createTextNode(note.markerText));
      const sup = document.createElement("sup");
      sup.className = "alonim-footnote-ref";
      const link = document.createElement("a");
      link.id = `${item.id}-${namespace}-ref-${noteIndex}`;
      link.href = `#${item.id}-${namespace}-note-${noteIndex}`;
      link.textContent = String(noteIndex);
      sup.append(link);
      paragraph.append(sup, document.createTextNode(after || ""));
    } else {
      paragraph.textContent = line;
    }
    container.append(paragraph);
  });
}

function appendWeeklyQnaNotes(container, item, namespace = "weekly") {
  if (!Array.isArray(item.notes) || !item.notes.length) return;
  const notes = document.createElement("aside");
  notes.className = "alonim-footnotes";
  notes.setAttribute("aria-label", item.notesTitle || "הערות");
  const notesTitle = document.createElement("h4");
  notesTitle.textContent = item.notesTitle || "הערות";
  const ol = document.createElement("ol");
  item.notes.forEach((note, index) => {
    const number = note.id || index + 1;
    const li = document.createElement("li");
    li.id = `${item.id}-${namespace}-note-${number}`;
    li.textContent = note.text || "";
    const back = document.createElement("a");
    back.href = `#${item.id}-${namespace}-ref-${number}`;
    back.setAttribute("aria-label", `חזרה להפניה ${number} בגוף התשובה`);
    back.textContent = " ↩";
    li.append(back);
    ol.append(li);
  });
  notes.append(notesTitle, ol);
  container.append(notes);
}

function renderWeeklyQna() {
  const target = document.querySelector('[data-render="weekly-qna"]');
  const range = document.querySelector("[data-weekly-qna-range]");
  const items = window.weeklyQnaCurrent || [];
  const week = window.weeklyQnaWeek;
  if (!target) return;

  if (range && week) {
    const format = (value) => new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long" })
      .format(new Date(`${value}T12:00:00`));
    range.textContent = `שאלות השבוע: ${format(week.start)} – ${format(week.end)}`;
  }

  target.replaceChildren();
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "weekly-qna-empty";
    const ornament = document.createElement("span");
    ornament.setAttribute("aria-hidden", "true");
    ornament.textContent = "✦";
    const title = document.createElement("strong");
    title.textContent = "השאלות החדשות יופיעו כאן";
    const text = document.createElement("p");
    text.textContent = "שאלות חדשות יוצגו כאן עד יום ראשון, ובמקביל יישמרו בשו״ת המקיף.";
    empty.append(ornament, title, text);
    target.append(empty);
    return;
  }

  items.forEach((item, index) => {
    const article = document.createElement("article");
    article.className = "weekly-qna-item alonim-item";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("aria-expanded", "false");
    const meta = document.createElement("span");
    meta.className = "alonim-question-number";
    meta.textContent = String(index + 1);
    const heading = document.createElement("span");
    heading.className = "weekly-qna-title-group";
    const title = document.createElement("strong");
    title.textContent = item.title || item.question || "שאלה";
    const published = document.createElement("time");
    published.className = "weekly-qna-published";
    published.dateTime = item.publishedAt;
    published.textContent = `פורסם: ${new Intl.DateTimeFormat("he-IL", {
      day: "numeric",
      month: "long",
      year: "numeric"
    }).format(new Date(`${item.publishedAt}T12:00:00`))}`;
    heading.append(title, published);
    button.append(meta, heading);

    const body = document.createElement("div");
    body.className = "alonim-body";
    body.hidden = true;
    const questionTitle = document.createElement("h4");
    questionTitle.textContent = "השאלה";
    body.append(questionTitle);
    appendWeeklyQnaParagraphs(body, item.question, item);
    const answerTitle = document.createElement("h4");
    answerTitle.textContent = "התשובה";
    body.append(answerTitle);
    appendWeeklyQnaParagraphs(body, item.answer, item);
    appendWeeklyQnaNotes(body, item);

    button.addEventListener("click", () => {
      const isOpen = body.hidden === false;
      body.hidden = isOpen;
      button.setAttribute("aria-expanded", String(!isOpen));
    });
    article.append(button, body);
    target.append(article);
  });
}

renderWeeklyQna();

function hydrateLiveWeeklyQna(items) {
  const liveItems = items.filter((item) => item.type === "weekly_qna").map((item) => ({
    id: item.id,
    publishedAt: String(item.publishedAt || item.createdAt || "").slice(0, 10),
    targetCategoryId: item.categoryId || "musar",
    title: item.title,
    question: item.question,
    answer: item.answer,
    notes: Array.isArray(item.metadata?.notes) ? item.metadata.notes : [],
    notesTitle: item.metadata?.notesTitle || "הערות",
    managedContent: true
  }));
  if (!liveItems.length) return;

  const merged = new Map();
  (window.weeklyQnaEntries || []).forEach((item) => merged.set(item.id, item));
  liveItems.forEach((item) => merged.set(item.id, item));
  window.weeklyQnaEntries = Array.from(merged.values());

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());
  const part = (type) => parts.find((item) => item.type === type)?.value || "";
  const todayKey = `${part("year")}-${part("month")}-${part("day")}`;
  const todayUtc = new Date(`${todayKey}T12:00:00Z`);
  const weekStartUtc = new Date(todayUtc);
  weekStartUtc.setUTCDate(todayUtc.getUTCDate() - todayUtc.getUTCDay());
  const weekEndUtc = new Date(weekStartUtc);
  weekEndUtc.setUTCDate(weekStartUtc.getUTCDate() + 6);
  const dateKey = (date) => date.toISOString().slice(0, 10);
  const weekStartKey = dateKey(weekStartUtc);
  const weekEndKey = dateKey(weekEndUtc);
  const categories = Array.isArray(window.alonimQnaCategories) ? window.alonimQnaCategories : [];
  const current = [];
  const scheduled = [];

  window.weeklyQnaEntries.forEach((entry, index) => {
    const publishedAt = String(entry.publishedAt || "").slice(0, 10);
    const normalized = {
      ...entry,
      id: entry.id || `weekly-${publishedAt || "undated"}-${index + 1}`,
      publishedAt,
      weeklyOrder: index
    };
    if (!publishedAt || publishedAt > todayKey) {
      scheduled.push(normalized);
      return;
    }

    const category = categories.find((item) => item.id === normalized.targetCategoryId)
      || categories.find((item) => item.id === "musar");
    if (category) {
      category.items = Array.isArray(category.items) ? category.items : [];
      const existingIndex = category.items.findIndex((item) => item.id === normalized.id);
      const archived = { ...normalized, category: category.name, archivedFromWeekly: true };
      if (existingIndex >= 0) category.items[existingIndex] = archived;
      else category.items.push(archived);
      category.count = category.items.length;
    }
    if (publishedAt >= weekStartKey) current.push(normalized);
  });

  current.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt) || b.weeklyOrder - a.weeklyOrder);
  window.weeklyQnaCurrent = current;
  window.weeklyQnaScheduled = scheduled;
  window.weeklyQnaWeek = { start: weekStartKey, end: weekEndKey };
  renderWeeklyQna();
  renderAlonimQna();
  initializeQnaPermalinks();
}

window.toratAviLiveContentReady.then(hydrateLiveWeeklyQna);

function initializeWeeklyQnaCountdown() {
  const countdown = document.querySelector("[data-weekly-countdown]");
  if (!countdown) return;

  const unitNames = ["days", "hours", "minutes", "seconds"];
  const units = Object.fromEntries(unitNames.map((name) => [
    name,
    countdown.querySelector(`[data-countdown-unit="${name}"]`)
  ]));
  const progress = countdown.querySelector("[data-countdown-progress]");
  const announcement = countdown.querySelector("[data-countdown-announcement]");
  const jerusalemFormatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    weekday: "short",
    hourCycle: "h23"
  });
  const weekdayNumber = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let lastAnnouncedMinute = "";
  let completed = false;

  const getJerusalemParts = (date) => {
    const values = {};
    jerusalemFormatter.formatToParts(date).forEach((part) => {
      if (part.type !== "literal") values[part.type] = part.value;
    });
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
      weekday: weekdayNumber[values.weekday]
    };
  };

  const jerusalemMidnightEpoch = (year, month, day) => {
    const desired = Date.UTC(year, month - 1, day, 0, 0, 0);
    let epoch = desired;
    for (let pass = 0; pass < 3; pass += 1) {
      const observed = getJerusalemParts(new Date(epoch));
      const observedAsUtc = Date.UTC(
        observed.year,
        observed.month - 1,
        observed.day,
        observed.hour,
        observed.minute,
        observed.second
      );
      epoch += desired - observedAsUtc;
    }
    return epoch;
  };

  const getResetWindow = () => {
    const now = new Date();
    const parts = getJerusalemParts(now);
    const localDate = new Date(Date.UTC(parts.year, parts.month - 1, parts.day));
    const daysToNextSunday = parts.weekday === 0 ? 7 : 7 - parts.weekday;
    const targetDate = new Date(localDate);
    targetDate.setUTCDate(localDate.getUTCDate() + daysToNextSunday);
    const previousDate = new Date(targetDate);
    previousDate.setUTCDate(targetDate.getUTCDate() - 7);
    return {
      now: now.getTime(),
      target: jerusalemMidnightEpoch(
        targetDate.getUTCFullYear(),
        targetDate.getUTCMonth() + 1,
        targetDate.getUTCDate()
      ),
      previous: jerusalemMidnightEpoch(
        previousDate.getUTCFullYear(),
        previousDate.getUTCMonth() + 1,
        previousDate.getUTCDate()
      )
    };
  };

  const setFlipValue = (name, value) => {
    const unit = units[name];
    const flip = unit?.querySelector(".weekly-countdown-flip");
    const text = unit?.querySelector("[data-countdown-value]");
    if (!unit || !flip || !text || unit.dataset.value === value) return;
    const isInitial = unit.dataset.value === undefined;
    unit.dataset.value = value;
    if (isInitial) {
      text.textContent = value;
      return;
    }
    flip.classList.remove("is-flipping");
    void flip.offsetWidth;
    flip.classList.add("is-flipping");
    window.setTimeout(() => { text.textContent = value; }, 260);
    window.setTimeout(() => flip.classList.remove("is-flipping"), 620);
  };

  const tick = () => {
    const windowTimes = getResetWindow();
    const remaining = Math.max(0, windowTimes.target - windowTimes.now);
    const totalSeconds = Math.floor(remaining / 1000);
    const values = {
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60
    };

    unitNames.forEach((name) => setFlipValue(name, String(values[name]).padStart(2, "0")));
    if (progress) {
      const duration = Math.max(1, windowTimes.target - windowTimes.previous);
      const elapsed = Math.min(duration, Math.max(0, windowTimes.now - windowTimes.previous));
      progress.style.width = `${(elapsed / duration) * 100}%`;
    }

    const minuteKey = `${values.days}-${values.hours}-${values.minutes}`;
    if (announcement && minuteKey !== lastAnnouncedMinute) {
      lastAnnouncedMinute = minuteKey;
      announcement.textContent = `${values.days} ימים, ${values.hours} שעות ו-${values.minutes} דקות עד להתחדשות המדור`;
    }

    if (remaining <= 1000 && !completed) {
      completed = true;
      window.setTimeout(() => window.location.reload(), 1200);
    }
  };

  tick();
  window.setInterval(tick, 1000);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) tick();
  });
}

initializeWeeklyQnaCountdown();

function renderAlonimQna() {
  const target = document.querySelector('[data-render="alonim-qna"]');
  const categories = window.alonimQnaCategories || [];
  if (!target || !categories.length) return;
  target.innerHTML = "";
  const layout = document.createElement("div");
  layout.className = "alonim-qna-layout";
  const filterBar = document.createElement("div");
  filterBar.className = "alonim-qna-filterbar";
  filterBar.setAttribute("aria-label", "בחירת נושא בשו״ת מקיף");
  const allButton = document.createElement("button");
  allButton.type = "button";
  allButton.className = "is-active";
  allButton.dataset.alonimFilter = "all";
  allButton.textContent = "כל הנושאים";
  filterBar.append(allButton);
  const content = document.createElement("div");
  content.className = "alonim-qna-content";
  let runningQuestionNumber = 0;
  categories.forEach((category) => {
    const section = document.createElement("section");
    section.className = "alonim-subtopic";
    section.dataset.alonimCategory = category.id || category.name || "";
    const filterButton = document.createElement("button");
    filterButton.type = "button";
    filterButton.dataset.alonimFilter = section.dataset.alonimCategory;
    filterButton.textContent = category.name || "שו״ת מקיף";
    filterBar.append(filterButton);
    const heading = document.createElement("h3");
    heading.textContent = category.name || "שו״ת מקיף";
    const list = document.createElement("div");
    list.className = "alonim-subtopic-list";
    (category.items || []).forEach((item) => {
      runningQuestionNumber += 1;
      const article = document.createElement("article");
      article.className = "alonim-item";
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      const meta = document.createElement("span");
      meta.className = "alonim-question-number";
      meta.textContent = String(runningQuestionNumber);
      const title = document.createElement("strong");
      title.textContent = item.title || item.question || "שאלה";
      button.append(meta, title);
      const body = document.createElement("div");
      body.className = "alonim-body";
      body.hidden = true;
      const questionTitle = document.createElement("h4");
      questionTitle.textContent = "השאלה";
      body.append(questionTitle);
      appendWeeklyQnaParagraphs(body, item.question, item, "archive");
      const answerTitle = document.createElement("h4");
      answerTitle.textContent = "התשובה";
      body.append(answerTitle);
      appendWeeklyQnaParagraphs(body, item.answer, item, "archive");
      appendWeeklyQnaNotes(body, item, "archive");
      button.addEventListener("click", () => {
        const isOpen = body.hidden === false;
        body.hidden = isOpen;
        button.setAttribute("aria-expanded", String(!isOpen));
      });
      article.append(button, body);
      list.append(article);
    });
    section.append(heading, list);
    content.append(section);
  });
  const filterButtons = Array.from(filterBar.querySelectorAll("button"));
  const sections = Array.from(content.querySelectorAll(".alonim-subtopic"));
  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.alonimFilter;
      filterButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      sections.forEach((section) => {
        section.classList.toggle("is-toc-hidden", filter !== "all" && section.dataset.alonimCategory !== filter);
      });
      target.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  });
  layout.append(filterBar, content);
  target.append(layout);
}

renderAlonimQna();

function initializeQnaPermalinks() {
  const qnaPage = document.querySelector(".qna-categories-section");
  if (!qnaPage) return;

  const itemSelector = ".faq-item, .choshen-item, .shabbat-item, .issur-item, .alonim-item, .weekly-qna-item";
  const topics = Array.from(qnaPage.querySelectorAll(".qna-topic"));

  topics.forEach((topic) => {
    const items = Array.from(topic.querySelectorAll(itemSelector));
    items.forEach((item, index) => {
      const questionNumber = index + 1;
      item.id = `qna-${topic.id}-${questionNumber}`;
      item.dataset.qnaTopic = topic.id;
      item.dataset.qnaQuestion = String(questionNumber);

      const itemButton = item.querySelector("button");
      if (itemButton && itemButton.dataset.qnaPermalinkBound !== "true") itemButton.addEventListener("click", () => {
        if (item.querySelector("button")?.getAttribute("aria-expanded") !== "true") return;
        const url = new URL(window.location.href);
        url.searchParams.delete("q");
        url.searchParams.delete("search");
        url.searchParams.set("topic", topic.id);
        url.searchParams.set("question", String(questionNumber));
        url.hash = item.id;
        history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
      });
      if (itemButton) itemButton.dataset.qnaPermalinkBound = "true";
    });
  });

  const params = new URLSearchParams(window.location.search);
  const requestedTopic = params.get("topic");
  const requestedQuestion = Number(params.get("question"));
  if (!requestedTopic || !Number.isInteger(requestedQuestion) || requestedQuestion < 1) return;

  const topic = document.getElementById(requestedTopic);
  const item = document.getElementById(`qna-${requestedTopic}-${requestedQuestion}`);
  if (!topic || !item) return;

  window.setActiveQnaTopicFromLink?.(requestedTopic, { clearSearch: false });
  item.hidden = false;
  item.closest(".shabbat-subtopic, .issur-subtopic, .alonim-subtopic")?.removeAttribute("hidden");

  const button = item.querySelector("button");
  if (button?.getAttribute("aria-expanded") !== "true") button?.click();

  const title = button?.querySelector(".shabbat-question-title")?.textContent?.trim() ||
    button?.querySelector("strong")?.textContent?.trim() ||
    button?.textContent?.trim();
  if (title) {
    document.title = `${title} | תורת אבי`;
    const description = document.querySelector('meta[name="description"]');
    if (description) description.content = `${title} - שאלה ותשובה מתוך מאגר בית הוראה תורת אבי.`;
  }

  requestAnimationFrame(() => item.scrollIntoView({ block: "start" }));
}

initializeQnaPermalinks();
window.applyQnaSearchFromUrl?.();

function createTextBlock(text) {
  const fragment = document.createDocumentFragment();
  String(text || "").split(/\n{2,}/).forEach((paragraph) => {
    const p = document.createElement("p");
    p.textContent = paragraph;
    fragment.appendChild(p);
  });
  return fragment;
}

function showWeeklyQuestionAlert() {
  const questions = Array.isArray(window.weeklyQnaCurrent) ? window.weeklyQnaCurrent : [];
  if (!questions.length || document.querySelector("[data-weekly-question-alert]")) return;
  const opinionModal = document.querySelector("[data-rabbi-opinion-modal]");
  if (opinionModal && opinionModal.dataset.opinionResolved !== "true") return;

  const latest = questions[0];
  const questionIdentity = [
    latest.id || "weekly",
    latest.publishedAt || "",
    latest.title || "",
    latest.question || ""
  ].join("|");
  let identityHash = 0;
  for (let index = 0; index < questionIdentity.length; index += 1) {
    identityHash = ((identityHash << 5) - identityHash + questionIdentity.charCodeAt(index)) | 0;
  }
  const questionKey = `${latest.id || "weekly"}-${Math.abs(identityHash)}`;
  const storageKey = "torat-avi-weekly-question-alert";
  try {
    if (window.localStorage.getItem(storageKey) === questionKey) return;
    window.localStorage.setItem(storageKey, questionKey);
  } catch (error) {
    // The alert still works when private browsing blocks local storage.
  }
  const alert = document.createElement("aside");
  alert.className = "weekly-question-alert";
  alert.dataset.weeklyQuestionAlert = "";
  alert.dataset.weeklyQuestionKey = questionKey;
  alert.setAttribute("aria-label", "שאלה חדשה באתר");
  alert.setAttribute("aria-live", "polite");

  const link = document.createElement("a");
  link.className = "weekly-question-alert-link";
  link.href = "qna.html?topic=weekly-qna&question=1";
  const ornament = document.createElement("span");
  ornament.className = "weekly-question-alert-ornament";
  ornament.setAttribute("aria-hidden", "true");
  ornament.textContent = "✦";
  const content = document.createElement("span");
  content.className = "weekly-question-alert-content";
  const eyebrow = document.createElement("small");
  eyebrow.textContent = "נכנסה שאלה חדשה לאתר";
  const title = document.createElement("strong");
  title.textContent = latest.title || latest.question || "לקריאת השאלה החדשה";
  const action = document.createElement("span");
  action.className = "weekly-question-alert-action";
  action.textContent = "לקריאה";
  content.append(eyebrow, title);
  link.append(ornament, content, action);

  const close = document.createElement("button");
  close.className = "weekly-question-alert-close";
  close.type = "button";
  close.setAttribute("aria-label", "סגירת ההתראה");
  close.textContent = "×";
  alert.append(link, close);
  document.body.append(alert);

  let removed = false;
  const dismiss = () => {
    if (removed) return;
    removed = true;
    alert.classList.add("is-leaving");
    window.setTimeout(() => alert.remove(), 900);
  };

  close.addEventListener("click", dismiss);
  window.setTimeout(dismiss, 9100);
}

function initializeWeeklyQuestionAlert() {
  const opinionModal = document.querySelector("[data-rabbi-opinion-modal]");
  if (opinionModal) {
    window.addEventListener("toratavi:rabbi-opinion-resolved", showWeeklyQuestionAlert);
    window.addEventListener("toratavi:rabbi-opinion-opened", () => {
      const alert = document.querySelector("[data-weekly-question-alert]");
      if (!alert) return;
      const questionKey = alert.dataset.weeklyQuestionKey || "";
      try {
        const storageKey = "torat-avi-weekly-question-alert";
        if (window.localStorage.getItem(storageKey) === questionKey) {
          window.localStorage.removeItem(storageKey);
        }
      } catch (error) {
        // Storage can be unavailable in private browsing.
      }
      alert.remove();
    });
  }

  window.toratAviLiveContentReady.then(() => {
    if (Array.isArray(window.weeklyQnaCurrent)) {
      showWeeklyQuestionAlert();
      return;
    }

    const loader = document.createElement("script");
    loader.src = "weekly-qna.js?v=20260624-weekly-qna-10";
    loader.addEventListener("load", showWeeklyQuestionAlert);
    document.head.append(loader);
  });
}

initializeWeeklyQuestionAlert();

function initializeWhatsAppShareButton() {
  const actions = document.querySelector(".header-quick-icons");
  if (!actions || actions.querySelector(".quick-whatsapp-share")) return;

  const share = document.createElement("a");
  share.className = "quick-whatsapp-share";
  share.target = "_blank";
  share.rel = "noopener";
  share.setAttribute("aria-label", "שיתוף העמוד ב־WhatsApp");
  share.title = "שיתוף ב־WhatsApp";
  const message = `${document.title}\n${window.location.href}`;
  share.href = `https://wa.me/?text=${encodeURIComponent(message)}`;

  const icon = document.createElement("img");
  icon.src = "assets/whatsapp-community-icon-transparent.png";
  icon.alt = "";
  icon.setAttribute("aria-hidden", "true");
  share.append(icon);
  actions.append(share);
}

initializeWhatsAppShareButton();

function renderLevadoQuestions() {
  const target = document.querySelector('[data-render="levado-qna"]');
  const items = window.emunaQuestions || window.nefeshGrowthQuestions || window.nefeshQuestions || window.childrenEducationQuestions || window.levadoQuestions || [];
  if (!target || !items.length) return;
  const search = document.getElementById("levadoSearch");
  const count = document.querySelector("[data-levado-count]");

  const render = () => {
    const query = (search?.value || "").trim().toLowerCase();
    const filtered = items.filter((item) => {
      const haystack = `${item.title} ${item.question} ${item.answer}`.toLowerCase();
      return !query || haystack.includes(query);
    });
    target.innerHTML = "";
    filtered.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "levado-item";

      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-expanded", "false");
      const number = document.createElement("span");
      number.textContent = String(index + 1).padStart(2, "0");
      const title = document.createElement("strong");
      title.textContent = item.title;
      button.append(number, title);

      const body = document.createElement("div");
      body.className = "levado-body";
      body.hidden = true;
      const questionTitle = document.createElement("h3");
      questionTitle.textContent = "השאלה";
      const question = document.createElement("div");
      question.className = "levado-text";
      question.appendChild(createTextBlock(item.question));
      const answerTitle = document.createElement("h3");
      answerTitle.textContent = "התשובה";
      const answer = document.createElement("div");
      answer.className = "levado-text";
      answer.appendChild(createTextBlock(item.answer));
      body.append(questionTitle, question, answerTitle, answer);

      button.addEventListener("click", () => {
        const isOpen = body.hidden === false;
        body.hidden = isOpen;
        article.classList.toggle("is-open", !isOpen);
        button.setAttribute("aria-expanded", String(!isOpen));
      });

      article.append(button, body);
      target.appendChild(article);
    });
    if (count) count.textContent = `${filtered.length} שאלות מוצגות`;
  };

  search?.addEventListener("input", render);
  render();
}

renderLevadoQuestions();

function appendPsakimInlineRichText(container, text, itemId) {
  String(text || "").split(/(\[\[fn:\s*\d+\]\]|\n)/g).forEach((part) => {
    if (!part) return;
    const ref = part.match(/^\[\[fn:\s*(\d+)\]\]$/);
    if (ref) {
      const sup = document.createElement("sup");
      sup.className = "psakim-footnote-ref";
      const link = document.createElement("a");
      link.id = `${itemId}-ref-${ref[1]}`;
      link.href = `#${itemId}-note-${ref[1]}`;
      link.textContent = ref[1];
      link.setAttribute("aria-label", `מעבר להערה ${ref[1]}`);
      sup.appendChild(link);
      container.appendChild(sup);
      return;
    }
    if (part === "\n") {
      container.appendChild(document.createElement("br"));
      return;
    }
    container.appendChild(document.createTextNode(part));
  });
}

function appendPsakimRichText(container, text, itemId) {
  const p = document.createElement("p");
  appendPsakimInlineRichText(p, text, itemId);
  container.appendChild(p);
}

function appendPsakimParagraphs(container, paragraphs, itemId) {
  (paragraphs || []).forEach((text) => appendPsakimRichText(container, text, itemId));
}

function renderPsakim() {
  const target = document.querySelector('[data-render="psakim"]');
  const items = window.psakimData || [];
  if (!target || !items.length) return;

  const search = document.getElementById("psakimSearch");
  const count = document.querySelector("[data-psakim-count]");
  const categoriesTarget = document.querySelector("[data-psakim-categories]");
  const categories = ["הכל", ...Array.from(new Set(items.map((item) => item.category)))];
  let activeCategory = "הכל";

  const categoryButtons = categories.map((category) => {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = category;
    button.className = "psakim-category";
    button.classList.toggle("is-active", category === activeCategory);
    button.addEventListener("click", () => {
      activeCategory = category;
      categoryButtons.forEach((item) => item.classList.toggle("is-active", item === button));
      render();
    });
    return button;
  });

  if (categoriesTarget) {
    categoriesTarget.innerHTML = "";
    categoryButtons.forEach((button) => categoriesTarget.appendChild(button));
  }

  const render = () => {
    const query = (search?.value || "").trim().toLowerCase();
    const filtered = items.filter((item) => {
      const haystack = [
        item.title,
        item.category,
        item.serial,
        item.summary,
        item.question,
        item.ruling,
        ...(item.sections || []).flatMap((section) => [section.heading, ...(section.paragraphs || [])]),
        ...(item.notes || []).map((note) => note.text),
      ].join(" ").toLowerCase();
      const matchesCategory = activeCategory === "הכל" || item.category === activeCategory;
      return matchesCategory && (!query || haystack.includes(query));
    });

    target.innerHTML = "";
    if (count) count.textContent = `${filtered.length} פסקי דין מוצגים`;

    if (!filtered.length) {
      const empty = document.createElement("div");
      empty.className = "psakim-no-results";
      empty.textContent = "לא נמצאו פסקי דין התואמים לחיפוש.";
      target.appendChild(empty);
      return;
    }

    filtered.forEach((item, index) => {
      const article = document.createElement("article");
      article.className = "psakim-item";

      const button = document.createElement("button");
      button.type = "button";
      button.className = "psakim-toggle";
      button.setAttribute("aria-expanded", "false");

      const number = document.createElement("span");
      number.className = "psakim-number";
      number.textContent = String(index + 1).padStart(2, "0");

      const head = document.createElement("span");
      head.className = "psakim-head";
      const meta = document.createElement("span");
      meta.className = "psakim-meta";
      meta.textContent = item.serial ? `${item.category} / מס' ${item.serial}` : item.category;
      const title = document.createElement("strong");
      title.textContent = item.title;
      const summary = document.createElement("em");
      summary.textContent = item.summary;
      head.append(meta, title, summary);

      const icon = document.createElement("span");
      icon.className = "psakim-open-icon";
      icon.setAttribute("aria-hidden", "true");

      button.append(number, head, icon);

      const body = document.createElement("div");
      body.className = "psakim-body";
      body.hidden = true;

      const overview = document.createElement("div");
      overview.className = "psakim-overview";
      if (item.question) {
        const question = document.createElement("div");
        question.className = "psakim-overview-card";
        question.innerHTML = "<span>השאלה לדיון</span>";
        const p = document.createElement("p");
        p.textContent = item.question;
        question.appendChild(p);
        overview.appendChild(question);
      }
      if (item.ruling) {
        const ruling = document.createElement("div");
        ruling.className = "psakim-overview-card psakim-ruling";
        ruling.innerHTML = "<span>תמצית ההכרעה</span>";
        const p = document.createElement("p");
        p.textContent = item.ruling;
        ruling.appendChild(p);
        overview.appendChild(ruling);
      }
      body.appendChild(overview);

      (item.sections || []).forEach((section) => {
        const block = document.createElement("section");
        block.className = "psakim-section-block";
        const h3 = document.createElement("h3");
        appendPsakimInlineRichText(h3, section.heading, item.id);
        const content = document.createElement("div");
        content.className = "psakim-text";
        appendPsakimParagraphs(content, section.paragraphs, item.id);
        block.append(h3, content);
        body.appendChild(block);
      });

      if ((item.notes || []).length) {
        const notes = document.createElement("section");
        notes.className = "psakim-notes";
        const notesTitle = document.createElement("h3");
        notesTitle.textContent = "הערות מקוריות";
        const notesList = document.createElement("ol");
        item.notes.forEach((note) => {
          const li = document.createElement("li");
          li.value = Number(note.id) || undefined;
          li.id = `${item.id}-note-${note.id}`;
          li.textContent = note.text;
          const back = document.createElement("a");
          back.className = "psakim-footnote-back";
          back.href = `#${item.id}-ref-${note.id}`;
          back.setAttribute("aria-label", `חזרה להפניה ${note.id} בגוף פסק הדין`);
          back.textContent = " ↩";
          li.appendChild(back);
          notesList.appendChild(li);
        });
        notes.append(notesTitle, notesList);
        body.appendChild(notes);
      }

      if (item.assetUrl) {
        const assetLink = document.createElement("a");
        assetLink.className = "button button-outline psakim-asset-link";
        assetLink.href = item.assetUrl;
        assetLink.target = "_blank";
        assetLink.rel = "noopener";
        assetLink.textContent = "פתיחת הקובץ המלא";
        body.appendChild(assetLink);
      }

      button.addEventListener("click", () => {
        const isOpen = body.hidden === false;
        body.hidden = isOpen;
        article.classList.toggle("is-open", !isOpen);
        button.setAttribute("aria-expanded", String(!isOpen));
      });

      article.append(button, body);
      target.appendChild(article);
    });
  };

  if (search) search.oninput = render;
  render();
}

renderPsakim();

function hydrateLivePsakim(items) {
  const liveItems = items.filter((item) => item.type === "ruling").map((item) => ({
    id: item.id,
    title: item.title,
    category: item.categoryId || "כללי",
    serial: item.metadata?.serial || "",
    summary: item.summary || "",
    question: item.question || "",
    ruling: item.answer || "",
    sections: item.body ? [{
      heading: item.metadata?.sectionHeading || "פסק הדין",
      paragraphs: item.body.split(/\n{2,}/).filter(Boolean)
    }] : [],
    notes: Array.isArray(item.metadata?.notes) ? item.metadata.notes : [],
    assetUrl: item.assetUrl || "",
    managedContent: true
  }));
  if (!liveItems.length) return;
  const merged = new Map();
  (window.psakimData || []).forEach((item) => merged.set(item.id, item));
  liveItems.forEach((item) => merged.set(item.id, item));
  window.psakimData = Array.from(merged.values());
  renderPsakim();
}

window.toratAviLiveContentReady.then(hydrateLivePsakim);

const levadoHelpModal = document.querySelector("[data-levado-help-modal]");
const levadoHelpOpen = document.querySelector("[data-levado-help-open]");
const levadoHelpClose = document.querySelector("[data-levado-help-close]");
if (levadoHelpModal && levadoHelpOpen && levadoHelpClose) {
  levadoHelpOpen.addEventListener("click", () => {
    levadoHelpModal.hidden = false;
    levadoHelpModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    levadoHelpClose.focus();
  });
  const closeLevadoHelp = () => {
    levadoHelpModal.hidden = true;
    levadoHelpModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    levadoHelpOpen.focus();
  };
  levadoHelpClose.addEventListener("click", closeLevadoHelp);
  levadoHelpModal.addEventListener("click", (event) => {
    if (event.target === levadoHelpModal) closeLevadoHelp();
  });
  levadoHelpModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeLevadoHelp();
  });
}

const siteSearchPages = [
  { title: "דף הבית", url: "index.html" },
  { title: "אודות", url: "about.html" },
  { title: "תרומה", url: "donate.html" },
  { title: "ספרי הרב", url: "books.html" },
  { title: "לבדו", url: "levado.html" },
  { title: "ניצוץ של קדושה", url: "spark.html" },
  { title: "שאלות ותשובות", url: "qna.html" },
  { title: "פסקי דין", url: "piskei-din.html" },
  { title: "שאל את הרב", url: "ask-rabbi.html" },
  { title: "מאמרים", url: "articles.html" },
  { title: "שבתות", url: "articles-shabbat.html" },
  { title: "חגים ומועדים", url: "articles-moadim.html" },
  { title: "תורת הנפש", url: "soul-torah.html" },
  { title: "צמיחה", url: "growth.html" },
  { title: "אמונה", url: "emuna.html" },
  { title: "עדכונים וקבצים", url: "updates.html" },
];

const siteSearchModal = document.querySelector("[data-site-search-modal]");
const siteSearchOpen = document.querySelector("[data-site-search-open]");
const siteSearchClose = document.querySelector("[data-site-search-close]");
const siteSearchInput = document.querySelector("[data-site-search-input]");
const siteSearchResults = document.querySelector("[data-site-search-results]");
let siteSearchIndex = [];

async function buildSiteSearchIndex() {
  if (siteSearchIndex.length) return siteSearchIndex;
  const parser = new DOMParser();
  const pages = await Promise.all(siteSearchPages.map(async (page) => {
    try {
      const response = await fetch(page.url);
      const html = await response.text();
      const doc = parser.parseFromString(html, "text/html");
      doc.querySelectorAll("script, style, nav, footer, header").forEach((node) => node.remove());
      return {
        ...page,
        text: doc.body.textContent.replace(/\s+/g, " ").trim(),
      };
    } catch {
      return { ...page, text: "" };
    }
  }));
  siteSearchIndex = pages;
  return siteSearchIndex;
}

function renderSiteSearchResults(query) {
  if (!siteSearchResults) return;
  const cleanQuery = query.trim().toLowerCase();
  siteSearchResults.innerHTML = "";
  if (!cleanQuery) {
    siteSearchResults.innerHTML = "<p>הקלידו מילה כדי להתחיל לחפש באתר.</p>";
    return;
  }
  const matches = siteSearchIndex
    .map((page) => {
      const text = `${page.title} ${page.text}`.toLowerCase();
      const index = text.indexOf(cleanQuery);
      return { ...page, index };
    })
    .filter((page) => page.index >= 0)
    .slice(0, 8);
  if (!matches.length) {
    siteSearchResults.innerHTML = "<p>לא נמצאו תוצאות מתאימות.</p>";
    return;
  }
  matches.forEach((match) => {
    const result = document.createElement("a");
    result.href = match.url;
    result.className = "site-search-result";
    const title = document.createElement("strong");
    title.textContent = match.title;
    const snippet = document.createElement("span");
    const source = match.text || match.title;
    const start = Math.max(0, source.toLowerCase().indexOf(cleanQuery) - 45);
    snippet.textContent = source.slice(start, start + 130);
    result.append(title, snippet);
    siteSearchResults.appendChild(result);
  });
}

if (siteSearchModal && siteSearchOpen && siteSearchClose && siteSearchInput) {
  siteSearchOpen.addEventListener("click", async () => {
    siteSearchModal.hidden = false;
    siteSearchModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    siteSearchInput.focus();
    await buildSiteSearchIndex();
    renderSiteSearchResults(siteSearchInput.value);
  });
  const closeSiteSearch = () => {
    siteSearchModal.hidden = true;
    siteSearchModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    siteSearchOpen.focus();
  };
  siteSearchClose.addEventListener("click", closeSiteSearch);
  siteSearchModal.addEventListener("click", (event) => {
    if (event.target === siteSearchModal) closeSiteSearch();
  });
  siteSearchModal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeSiteSearch();
  });
  siteSearchInput.addEventListener("input", () => renderSiteSearchResults(siteSearchInput.value));
}

const bookDetails = {
  "mamonot": {
    title: "שו״ת תורת אבי",
    subtitle: "דיני ממונות",
    image: "assets/store-book-torat-avi-mamonot-normalized.png",
    status: "בקרוב",
    paragraphs: [
      "בעולם שבו שאלות של כסף, התחייבויות, שכנים, עסקים ונזקים פוגשות אותנו בכל יום – הספר הזה מביא את הלכות חושן משפט בצורה בהירה, מעשית ומדויקת.",
      "להלכה למעשה.",
      "מענה למאות שאלות הכי אקטואליות בדיני ממונות, בשפה ברורה ובפסיקה נגישה, כדי לדעת כיצד לנהוג נכון על פי דרך התורה בכל תחומי החיים."
    ]
  },
  "issur-heter": {
    title: "שו״ת תורת אבי",
    subtitle: "איסור והיתר – חלק א׳",
    image: "assets/store-book-torat-avi-issur-heter-normalized.png",
    price: "₪52",
    paragraphs: [
      "בשר וחלב, פת ובישולי גויים, טבילת כלים, עניינים שונים ואקטואליים.",
      "משא ומתן בדברי הראשונים והאחרונים בשילוב פסקי דינים רבים לשאלות מעשיות."
    ]
  },
  "lech-amar-libi": {
    title: "לך אמר ליבי",
    subtitle: "נפש ואמונה",
    image: "assets/store-book-lech-amar-libi-normalized.png",
    status: "בקרוב",
    paragraphs: []
  },
  "neshama-avuda": {
    title: "נשמה אבודה",
    subtitle: "מסע לגילוי הנשמה",
    image: "assets/store-book-neshama-avuda-normalized.png",
    price: "₪26",
    note: "מהדורת כיס",
    paragraphs: [
      "מסע לגילוי הנשמה.",
      "מדריך מעשי לתורת הנפש."
    ]
  },
  "levado": {
    title: "לבדו",
    subtitle: "זוגיות ונפש באור פנימי",
    image: "assets/store-book-levado-normalized.png",
    price: "₪101",
    paragraphs: [
      "בנין הבית | איך אמור להיראות בית אמיתי?",
      "ביקורת בונה מחיצה | סוגי הביקורת, מקורם הפנימי והחיצוני.",
      "נתינה לוקחת | האם חשבת על זה שפעמים כשאתה \"נותן\" אתה בעצם \"לוקח!?\""
    ]
  },
  "zviyot": {
    title: "עניין של זוויות",
    subtitle: "קלפי טיפול זוגיים",
    image: "assets/store-book-inyan-shel-zviyot-normalized.png",
    price: "₪260",
    paragraphs: [
      "תמיד רציתם לדבר והרגשתם שאתם לא יודעים איך להתחיל? משהו חוסם לכם את הזרימה? גם אתם רוצים קשר עמוק יותר?",
      "בואו נניע ביחד את אותן \"הזוויות\", אותן שאנו אוהבים וגם אותן שאנו כואבים. ברגע שנכיר אותן ממילא נדע היכן לגעת והיכן לא. אם רק נקשיב האחד לשני, נכיל ונקבל, נוכל לשדרג את מערכת היחסים שלנו ולעלות אותה לרמות שלא הכרנו.",
      "מומלץ לזוגות ויועצים כאחד!"
    ]
  },
  "dor-hahastara": {
    title: "דור ההסתריה",
    subtitle: "כל היסטריה מקורה בהסתר – י־ה",
    image: "assets/store-book-dor-hahastara-normalized.png",
    status: "אזל המלאי",
    paragraphs: [
      "הספר מלווה את הקורא במסע פנימי אל תוך עצמו.",
      "הספר נכתב בשפה קלילה ועם זאת טומן בחובו מסרים אדירים ומהפכניים בנפש, ומכיל בתוכו המון שאלות ותרגילים מעשיים.",
      "הספר מסכם את תורת הנפש היהודית בצורה מונגשת לכל המעוניין."
    ]
  }
};

function initBookDetailsModal() {
  const bookTriggers = Array.from(document.querySelectorAll("[data-book-key]"));
  if (!bookTriggers.length) return;

  const modal = document.createElement("div");
  modal.className = "book-details-modal";
  modal.hidden = true;
  modal.setAttribute("aria-hidden", "true");
  modal.innerHTML = `
    <div class="book-details-dialog" role="dialog" aria-modal="true" aria-labelledby="bookDetailsTitle">
      <button class="book-details-close" type="button" aria-label="סגירת פרטי הספר">×</button>
      <div class="book-details-copy">
        <div class="book-details-heading">
          <span class="book-details-kicker"></span>
          <span class="book-details-status" hidden></span>
        </div>
        <h2 id="bookDetailsTitle"></h2>
        <div class="book-details-rule" aria-hidden="true"></div>
        <div class="book-details-text"></div>
        <div class="book-details-meta" hidden>
          <strong></strong>
          <span></span>
        </div>
      </div>
    </div>
  `;
  document.body.append(modal);

  const closeButton = modal.querySelector(".book-details-close");
  const status = modal.querySelector(".book-details-status");
  const kicker = modal.querySelector(".book-details-kicker");
  const title = modal.querySelector("#bookDetailsTitle");
  const text = modal.querySelector(".book-details-text");
  const meta = modal.querySelector(".book-details-meta");
  const metaStrong = meta.querySelector("strong");
  const metaNote = meta.querySelector("span");
  let returnFocus = null;

  const closeModal = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("modal-open");
    returnFocus?.focus();
  };

  const openModal = (trigger) => {
    const details = bookDetails[trigger.dataset.bookKey];
    if (!details) return;
    returnFocus = trigger.querySelector(".premium-book-visual") || trigger;
    kicker.textContent = details.subtitle;
    title.textContent = details.title;
    text.innerHTML = details.paragraphs.map((paragraph) => `<p>${paragraph}</p>`).join("");
    status.hidden = !details.status;
    status.textContent = details.status || "";
    meta.hidden = !(details.price || details.status);
    metaStrong.textContent = details.price || details.status || "";
    metaNote.textContent = details.note || "";
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    closeButton.focus();
  };

  bookTriggers.forEach((trigger) => {
    const details = bookDetails[trigger.dataset.bookKey];
    if (details?.status && trigger.classList.contains("about-book-item")) {
      const badge = document.createElement("span");
      badge.className = "about-book-status";
      badge.textContent = details.status;
      trigger.append(badge);
    }
    trigger.addEventListener("click", (event) => {
      if (event.target.closest("button, input, select, textarea, a")) return;
      openModal(trigger);
    });
    trigger.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      if (event.target.closest("button, input, select, textarea, a")) return;
      event.preventDefault();
      openModal(trigger);
    });
  });

  closeButton.addEventListener("click", closeModal);
  modal.addEventListener("click", (event) => {
    if (event.target === modal) closeModal();
  });
  modal.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
  });
}

initBookDetailsModal();

document.querySelectorAll("[data-qty]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest("[data-price], .book-card");
    if (!row || button.disabled || row.classList.contains("is-unavailable")) return;
    const output = row.querySelector("output");
    const input = row.querySelector("input[type='hidden']");
    const current = Number(output.value || output.textContent || 0);
    const next = Math.max(0, current + Number(button.dataset.qty));
    output.value = next;
    output.textContent = next;
    row.classList.add("is-pending-qty");
  });
});

document.querySelectorAll("[data-add-book]").forEach((button) => {
  button.addEventListener("click", () => {
    const row = button.closest("[data-price], .book-card");
    if (!row || button.disabled || row.classList.contains("is-unavailable")) return;
    const output = row.querySelector("output");
    const input = row.querySelector("input[type='hidden']");
    const qty = Math.max(0, Number(output?.textContent || output?.value || 0));
    if (input) input.value = qty;
    row.classList.toggle("is-in-cart", qty > 0);
    row.classList.remove("is-pending-qty");
    button.textContent = qty > 0 ? "עודכן" : "הוסף";
    window.setTimeout(() => {
      button.textContent = "הוסף";
    }, 1100);
    updateCartTotal();
  });
});

function updateCartTotal() {
  let total = 0;
  const lines = [];
  document.querySelectorAll("[data-price]").forEach((row) => {
    const price = Number(row.dataset.price || 0);
    const qty = Number(row.querySelector("input[type='hidden']")?.value || 0);
    const title = row.querySelector("h3")?.textContent?.trim() || "פריט";
    total += price * qty;
    if (qty > 0) lines.push({ title, qty, price });
  });
  const totalEl = document.querySelector("[data-cart-total]");
  if (totalEl) totalEl.textContent = `₪${total}`;
  const linesEl = document.querySelector("[data-cart-lines]");
  if (linesEl) {
    linesEl.innerHTML = lines.length
      ? lines.map((item) => `<div><span>${item.title}</span><strong>${item.qty} × ₪${item.price}</strong></div>`).join("")
      : "עדיין לא נבחרו ספרים";
  }
}

document.querySelectorAll("form[data-demo-form]").forEach((form) => {
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const intent = form.dataset.demoForm || "הטופס";
    alert(`${intent} מוכן לחיבור למייל/סליקה מאובטחת. בשלב הבא מחברים ספק תשלום וכתובת מייל אמיתית.`);
  });
});

function renderDynamicHome() {
  const content = getSiteContent();
  const announcementTarget = document.querySelector('[data-render="announcements"]');
  if (announcementTarget) {
    announcementTarget.innerHTML = (content.announcements || []).slice(0, 4).map((item) => `
      <a class="live-item" href="${item.link || '#'}">
        <span>${item.tag || "חדש"}</span>
        <strong>${item.title || ""}</strong>
        <small>${item.date || ""}</small>
        <p>${item.text || ""}</p>
      </a>
    `).join("");
  }

  const videoTarget = document.querySelector('[data-render="videos"]');
  if (videoTarget) {
    videoTarget.innerHTML = (content.videos || []).slice(0, 3).map((item) => `
      <a class="media-card reveal is-visible" href="${item.link || 'soul-torah.html'}" target="${item.link ? '_blank' : '_self'}" rel="noopener">
        <img src="${item.thumb || 'assets/media-torah.svg'}" alt="">
        <div>
          <span>${item.category || "שיעור"}</span>
          <h3>${item.title || ""}</h3>
          <p>${item.duration || ""} · לפתיחה</p>
        </div>
      </a>
    `).join("");
  }

  const questionTarget = document.querySelector('[data-render="questions"]');
  if (questionTarget) {
    questionTarget.innerHTML = (content.questions || []).slice(0, 3).map((item) => `
      <article class="question-card">
        <span>${item.topic || "שאלה"}</span>
        <h3>${item.question || ""}</h3>
        <p>${item.answer || ""}</p>
      </article>
    `).join("");
  }
}

renderDynamicHome();

window.toratAviLiveContentReady.then((items) => {
  const announcements = items.filter((item) => item.type === "announcement").map((item) => ({
    title: item.title,
    tag: item.categoryId || "חדש",
    date: item.publishedAt ? new Intl.DateTimeFormat("he-IL", { day: "numeric", month: "long", year: "numeric" })
      .format(new Date(item.publishedAt)) : "",
    text: item.summary || item.body || "",
    link: item.linkUrl || item.assetUrl || "#"
  }));
  if (!announcements.length) return;
  window.toratAviManagedAnnouncements = announcements;
  renderDynamicHome();
});

const dailySparks = [
  {
    "quote": "״כשהייתי צעיר לימים חשבתי לתקן את כל העולם והשתדלתי לעשות זאת. אולם ראיתי שלא עלתה בידי. חשבתי שאומנם את כל העולם אין ביכולתי לתקן אך אולי את בני עירי אוכל לתקן. אולם כשראיתי כי גם לזאת איני מסגל החלטתי לעבד על תיקון המידות שלי בלבד…״ (בשם רבי ישראל מסלנט זצוק\"ל)"
  },
  {
    "quote": "\"תמיד תוכלו לנצח את הקרבות של היום אם תילחמו אך ורק בקרבות של היום הקרב הופך לאינסופי ובלתי אפשרי רק אם מערבים בו את קרבות האתמול והמחר...\""
  },
  {
    "quote": "\"בסוף החיים שישאלו אתכם ״חמץ או מצה?״ חמץ- האם החמצת את החיים?! או מצה- האם מיצית את החיים?! המתנה הכי גדולה שיש לאדם זה הזמן.. הזמן טס ויום שעובר לא חוזר.. והשאלה, האם מיצינו או החמצנו?!\""
  },
  {
    "quote": "\"אורחים רבים הסבו בשולחן הסדר של רבי יוסף-חיים מבגדד, ה'בן איש חי', ובמהלך הסדר התעוררו ביניהם חילוקי דעות באשר למנהגים הנהוגים בלילה זה. חילוקי הדעות התפתחו לוויכוחים, ובהם נשזרו נימות זלזול של אחד בדעת חברו\".\nנענה ה'בן איש חי' ואמר: \"יש בליל הסדר ארבעה סימנים חשובים להתנהגות של האדם עם חברו – 'מגיד רחצה, מוציא מצה'. אכן, יהודי אחד צריך להיות 'מגיד' ולעורר את חברו לעשות 'רחצה' – לרחוץ את עצמו מפגמים ועוונות. אבל יש לעשות זאת באופן של 'מוציא מצה' – תוך כדי הוצאת וסילוק ה'מצה' והמריבה, הכעס והזלזול, כי רק כך יפעלו הדברים את פעולתם לטובה\"."
  },
  {
    "quote": "עני בא לפני ה\"ישמח ישראל\" והרבי ברכו, התלונן האיש: \"כבוד הרב, הרי האיש העשיר שהיה אצלך ממש לפניי, דיברת עימו שעה, מדוע ההפליה הזו?! וכי הוא יותר טוב ממני? ענה לו הרבי: \"אתה מבין מה מצוקתך ובמה עלי לברכך… אבל העשיר עלי לקלף שכבה אחר שכבה כדי להסביר לו עד כמה זקוק הוא לרחמים וחמלה לכן זה לוקח זמן…\""
  },
  {
    "quote": "\"כשם שהכוכבים אשר בשמים נראים לעינינו כנקודות זעירות בלבד, בשעה שהם עולמות עצומים, כך ישנם יהודים אשר בעולם הזה מראיהם עלוב ושפל אולם בשמים הם עצומים!\" (הבעש\"ט)"
  },
  {
    "quote": "\"עיקר עבודת האמונה היא: וידעת היום והשבות אל לבבך כי השם הוא האלקים בשמים ממעל וכו' \"אין עוד\" (רבי יחזקאל לוינשטיין זצוק\"ל)"
  },
  {
    "quote": "\"בשום פנים לא הייתי רוצה לעבוד אלקים כזה, שדרכיו יהיו מובנים על פי שכלו של ילוד אשה\" (רבי מנחם מנדל מקוצק)"
  },
  {
    "quote": "\"אדם מישראל - הרי הוא כדינר של זהב, גם אם לפעמים מעלה חלודה או מלוכלך ברפש, צריך לרחצו ולמרקו, ואז יחזור אליו אורו\" (רבי מרדכי מלקוביץ')."
  },
  {
    "quote": "\"אינני חושש שמא ישאלוני בעולם האמת למה לא הייתי משה רבנו; על כך אדע מה להשיב. אבל מה אשיב כשישאלוני למה לא היית זושא!\" (רבי זושא מאניפולי)."
  },
  {
    "quote": "\"אנו אלופים ב- למות יחד… הגיע הזמן שנלמד לחיות יחד\". (הרב ישראל מאיר לאו. אוד מוצל מאש)"
  },
  {
    "quote": "\"אנחה שיהודי נאנח ומשתתף בצער זולתו – בוקעת רקיעים. שמחתו של יהודי בשמחתו של הזולת פועלת אצל השם יתברך כתפילתו של הכהן הגדול בקודש הקודשים\" (הבעש\"ט)"
  },
  {
    "quote": "\"אדם יכול להאיר את החושך שבתוכו, ושמסביבו, וכל חושך הנמצא בחלקו בעולם, עד לחושך שבעולם כולו, על ידי שמדליק את הנר – \"נר מצוה ותורה אור\", כי \"נר ה' נשמת אדם\" (על פי מאמר הרבי י\"ג ניסן תשמ\"ה)."
  },
  {
    "quote": "\"אלוקים נכנס לחיינו כקריאה מן העתיד. הוא כמו מנופף לנו בידו מקצה אופק הזמן, מפציר בנו לצאת למסע ולבצע משימה שנולדנו כדי למלא. איננו נמצאים בעולם במקרה. אנחנו כאן כי ה' רצה שנהיה כאן, ומפני שיש משימה שנועדנו להגשים. לא קל לגלות מהי. אבל לכל אחד מאיתנו יש משהו שאלוקים קורא לו לעשות, עתיד שעדיין לא נוצר כי אם מחכה שניצור אותו\". (הרב זקס זצ\"ל)"
  },
  {
    "quote": "\"יהודים עברו ליד ביתו של רבי זושא מאניפולי ושמעו צעקות מתוך הבית: \"זושא, זושא, איפה זושא\"? נבהלו. מה קרה לצדיק? ורצו פנימה. ראו את רבי זושא מסתובב עם נר בידו ומחפש את זושא. הסביר: 'יום יבוא ואתבקש להשיב את נשמתי ליוצרה, ואז יעמדו חבריי סביב גופתי ויבכו: 'זושא, לאן הלכת'? אבל גופי ישכב לידם כמו קודם, ובכל זאת יחפשו את זושא. ובכן, את הזושא ההוא – שלא ימצאו אז - אותו אני מחפש...'."
  },
  {
    "quote": "\"בסדום טענו שהעניים 'אוכלי חינם' ונמנעו מגמילות חסדים. אך אוכלי החינם האמיתיים היו אנשי סדום, כי השפע העצום שלהם היה חסד משמים ונדרש מהם רק לחלוק עם אחרים. לכן האומר \"שלי שלי ושלך שלך\" זו מידת סדום, שהרי \"תן לו (לה') משלו, שאתה ושלך שלו\"."
  },
  {
    "quote": "\"אנחנו מכים על החטא בדרך כלל על חזהו של הזולת בואו נתחיל להכות על חטא על חזנו שלנו עצמו\" ר' ישראל מאיר לאו – בראיון ליוה\"כ"
  },
  {
    "quote": "\"שובה ישראל עד ה' אלהיך' צריך לשוב עד שיהיה ה' אלוהיך האלוהות שלך\" המגיד מקוז'ניץ"
  },
  {
    "quote": "״…כשרואים חפץ מונח בידו של אדם, עדיין אי אפשר להחליט אם החפץ מונח בידו ״סתם״, או ש״היד מחזקת בו בכח״ – רק כשאתה מנסה להוציא את החפץ מידו, אז אפשר להיווכח בכמות הכח המהדקת את החפץ אל היד!\" ״אפשר להיות בישיבה וללמוד בשקידה, ואעפ״כ אין להביא ראיה מזה על דבקותו של הלומד אל תורתו – ורק בשעה שמסתערים עליו כוחות להוציא את הגמרא מתוך ידו, אז מתגלה מדת ההידוק והקשר אשר בין הלומד ותורתו…״ (רבי יצחק הוטנר)"
  },
  {
    "quote": "\"עדיף לקשקש באמת, מאשר ללמוד תורה של שקר\""
  },
  {
    "quote": "\"הקב\"ה הבטיח לאברהם, שיבוא יום שבני-ישראל יתעלו מעומק השפל אל רום המעלה, ואז יאירו בעולם ככוכבי השמים\" (הדעה והדיבור)"
  },
  {
    "quote": "\"לכבוד יום הולדתה כתבה אישה מכתב אל הרבי ובו ציינה את מאמציה בשנה החולפת לחלוק את היופי של היהדות עם יהודים אשר אינם שומרים תורה ומצוות לעת עתה... לאחר ששיבח בחום את הישגיה כתב הרבי אך דעי שמי שקיבל כח להשפיע על 100 האנשים ונגע רק ב-99, טרם הוציא לפועל את מלוא היכולת שניתנה לו מן השמים... גם אם עשית הרבה. האם עשית כל שביכולתך?\""
  },
  {
    "quote": "\"בשנת 1969 קרא הרבי את תוכן נאומו של גורדון זקס, איש עסקים בכיר פוליטיקאי, שניתן בפני מועצת הפדרציות היהודיות. לאחר מכן הזמין את מר זקס לפגישה אישית. \"קראתי את הנאום שלך\", אמר הרבי למר זקס. \"ניכר ממנו בבירור שדאגת היטב למוח שלך. אני מביט בך, וללא ספק אתה מטפל היטב גם בגופך. מה אתה עושה לגבי הנשמה שלך?\" גם הנשמה זקוקה למזון כדי לצמוח....\""
  },
  {
    "quote": "\"על מה חולם צדיק? על \"סולם מוצב ארצה וראשו מגיע השמימה\" \"ארצה\" מבטא את הגשמיות והחומריות, ואילו \"השמיימה\" מבטא את הרוחניות. חלומו של הצדיק הוא לקשר ולחבר בין הרוחניות לגשמיות\"."
  },
  {
    "quote": "\"הרם את המילים שלך, לא את קולך. זכור כי הגשם הוא שמצמיח את הפרחים, לא הרעמים\"."
  },
  {
    "quote": "\"איזו תנועה נפשית מתאימה לנו? מתי לעוף על עצמנו, ומתי להתמלא בענווה? נפגשנו בניו יורק עם האדמו\"ר מסקוור, הרב דוד טברסקי. הנה רעיון קצר מתוך השיחה הזאת, על חלומו של יעקב אבינו בפרשה: \"צריך איזון עדין בחיים. הרי כתוב: *סולָּם מֻצָּב אַרְצָה וְרֹאשׁוֹ מַגִּיעַ הַשָּׁמָיְמָה*. כשהאדם מתגאה יותר מדיי, כשהוא חושב שראשו מגיע השמימה – צריך להזכיר לו שהוא סולם מוצב ארצה, שסופו להיקבר באדמה, שהוא מוגבל. ומנגד, כשהאדם מדוכא ועצוב, כשהוא מגיע עד עפר, ארצה, צריך להזכיר לו: נבראת בצלם אלוקים, אתה מיוחד ונעלה, תרים את הראש, אתה מגיע השמימה. אדם צריך לדעת להשתמש בשני הכוחות, בזמן המתאים\" (סיון רהב מאיר)"
  },
  {
    "quote": "\"עשרים ואחת שנים יגעתי על האמת: שבע שנים לידע אמת מהי, שבע שנים לגרש את השקר. ושבע שנים להכניס את האמת אל קרבי\". (רבי פנחס מקוריץ)"
  },
  {
    "quote": "\"וירא יעקב מאד ויצר לו ויחץ את העם\" (לב,ח) \"על מה היה יעקב ירא מאד? מדוע \"ויצר לו\"? אלא פרשו גדולי החסידות : על כי \"ויחץ את העם\", משום שהשתררה חציצה והתפלגות בקרב עמו, ולא מאונס. ידע יעקב כי כל עוד מלוכדים כולם יחדו, אין יד עשו יכולה לשלוט בהם, ואילו משנחלקו למחנות, יש מקום לחשוש מפניו\"."
  },
  {
    "quote": "\"וירא יעקב מאוד ויצר לו\" (לב, ח) \"יעקב נתקף בפחד מפני אחיו, אך מיד התחרט על כך וצר היה לו, הכיצד נתיירא הוא מפני משהו חוץ מה' יתברך \""
  },
  {
    "quote": "\"הגידה נא שמך ויאמר למה זה תשאל לשמי\" (לב, ל) ופירש רש\"י: מפרש שמשתנה שמו כל פעם לפי שליחותו. ובעלי המוסר מפרשים \"למה זה תשאל לשמי\" זה שמו ועצמותו של השטן שלא לתת להתבונן ולשאול את עצמו על מצבו הרוחני, וזה הכוונה \"למה זה תשאל\" - אין להתבונן כלל מה חובתו בעולמו\"."
  },
  {
    "quote": "\"אקדח יכול להרתיע מי שיש לו עולם אחד ואלים רבים, אבל מי שיש לו א-ל אחד ושני עולמות – אין ה'צעצוע' הזה מפחיד כלל\" (האדמו\"ר הזקן לחוקרי הג-פ-או)."
  },
  {
    "quote": "\"אין להתייאש משום יהודי: איזו נקודה כלשהי ביהודיות חייבת להיות גם אצל רשע. דלי הנופל לבאר עמוקה, אפשר להוציאו מן התהום, ובתנאי שהוא קשור לחבל, חבל עבה או חבל דק, ובלבד שיהיה חבל\" (רבי ישראל מרוז'ין)."
  },
  {
    "quote": "\"לכל יהודי יש חבל, דק או עבה. עלינו מוטלת החובה לחפש את החבל, ולעזור לו לעלות מהתהום אליו הוא נפל\"."
  },
  {
    "quote": "\"אני מרגיש טוב... כי... התפייסתי עם העבר שלי... החלטתי להתמקד בהווה שלי... ולגלות אופטימיות לגבי העתיד שלי\"."
  },
  {
    "quote": "\"ודע, שהאדם צריך לעבור על גשר צר מאד מאד, והכלל והעיקר שלא יתפחד כלל\". (ליקוטי מוהר\"ן תנינא מח)"
  },
  {
    "quote": "\"ואפלו בהסתרה שבתוך ההסתרה, בודאי גם שם נמצא השם יתברך\". (ליקוטי מוהר\"ן א', תורה נ\"ו)"
  },
  {
    "quote": "\"לפני עלות השחר גובר החושך ביותר, משום שאור השחר קרוב לבוא. כך גם החושך הגדול של גלות זו הכנה היא לאור הגדול של משיח; אור שהוא גדול עוד יותר מזה שהאיר בגילוי של מתן תורה. כך היא המידה: אחר מכה - רפואה, אחר צרה - ישועה ונחמה.\" (האדמו\"ר האמצעי)"
  },
  {
    "quote": "\"כשם שאדם הרואה הר מרחוק מבין כי עדיין הוא אינו שם, כך על האדם המבין דבר, יש לדעת כי עדיין אינו יודע. כדי להתקדם עליך לדעת היכן אתה נמצא\". (אין מקום רחוק, רבי נחמן מברסלב)"
  },
  {
    "quote": "\"כשמסיר האדם ממנו תועלת והנאה עצמית - אז יוכל להגיע אל האמת\" (רבי יעקב יוסף מפולנאה)"
  },
  {
    "quote": "\"לרופא ניתנה הרשות רק לרפא... אך לא להתייאש מחיי החולה\""
  },
  {
    "quote": "\"הקב\"ה הבטיח לאברהם, שיבוא יום שבני-ישראל יתעלו מעומק השפל אל רום המעלה, ואז יאירו בעולם ככוכבי השמים\". (הדעה והדיבור)"
  },
  {
    "quote": "\"תמיד תוכלו לנצח את הקרבות של היום אם תילחמו אך ורק בקרבות של היום הקרב הופך לאינסופי ובלתי אפשרי רק אם מערבים בו את קרבות האתמול והמחר...\""
  },
  {
    "quote": "\"ברכת כהנים נאמרת בלשון יחיד \"יברכך\" \"וישמרך\", משום שהברכה היחידה שבני ישראל זקוקים וצריכים לה היא האחדות... שיהיו כאיש אחד בלב אחד\" (עוללות אפרים)"
  },
  {
    "quote": "\"הרם את המילים שלך, לא את קולך. זכור כי הגשם הוא שמצמיח את הפרחים, לא הרעמים\""
  },
  {
    "quote": "\"העולם שלנו נמצא במבול: מבול של חדשות מבול של טלפוניםממבול של הודעות מבול של פרסומות מבול של טרדות השאלה היא, האם זה שהעולם נמצא במבול, אומרת בהכרח שגם אנו צריכים להיות בתוך המבול\"?"
  },
  {
    "quote": "\"אל תטעה בין שברון-לב לבין עצבות ודיכאון. דיכאון הוא כעס, תלונה נגד האל משום שלא נתן לך את מבוקשך. אך כשלבך שבור, דומה אתה לילד קטן הבוכה משום שאביו נמצא רחוק ממנו\" (רבי נחמן מברסלב)."
  },
  {
    "quote": "\"חסיד אחד התלונן בפני הרבי מקוצק, שהוא עוסק הרבה בתורה, מתאמץ להיות \"למדן\", אך המטרה רחוקה ממנו מרחק רב\". אמר לו הרבי: בכל התורה לא מצינו מצווה כזאת שאתה רוצה להיות למדן, ואם כתוב: \"למדו היטב\" (שמות א, יז), מפרש רש\"י על אתר: \"היטב, להיטיב\". כלומר, שהכוונה לא לדעת \"היטב\" למדנות, אלא לדעת \"היטב\" כיצד להיטיב – לעשות מעשים טובים."
  },
  {
    "quote": "\"כאשר יהודי חי לאורו של בטחון מסוג זה, הוא אינו נכנס לפאניקה גם בזמנים הקשים ביותר, הבטחון מסייע לו להשרות שלוה, שמחה ואמונה בביתו\""
  },
  {
    "quote": "\"כשם שקשה לרע לב לדעת את צרכי הזולת, כך קשה לטוב לב לדעת את צרכי עצמו\". (רבי צדוק הכהן מלובלין)"
  },
  {
    "quote": "גם הזהיר מורי ז\"ל לי ולכל החברים שהיינו עמו בחברה ההיא , שקודם תפילת שחרית , נקבל עלינו מצוות עשה של \"ואהבת לרעך כמוך \" , ויכווין לאהוב לכל אחד מישראל כנפשו , כי על ידי זה תעלה תפילתו כלולה מכל ישראל , ותוכל לעלות ולעשות תיקון למעלה . ובפרט אהבת החברים שלנו , צריך כל אחד ואחד ממנו לכלול עצמו כאילו הוא אבר אחד מן החברים האלו . ולמאוד הזהירני מורי ז\"ל בעניין זה , ואם איזה חבר ח\"ו שעומד בצרה , או יש לו איזה חולה בביתו , או בבניו , ישתתף בצערו , ויתפלל עליו , וכן בכל דבריו ישתתף לכל חבריו עמו . { הקדמה ל\"ח למהרח\"ו שער הגלגולים דף קלד עמ' א' }"
  },
  {
    "quote": "\"המהר\"ל מפראג ברא גולם והוא פלא גדול, אך פלא גדול יותר להפוך טבע חומר הגשמי של האדם וליצור ממנו אדם נעלה\". רבי ישראל סלנטר)"
  },
  {
    "quote": "\"בני אדם שנפשותיהם חולות, מתאווים ואוהבים הדעות הרעות, ושונאים הדרך הטובה ומתעצלים ללכת בה, והיא כבדה עליהן למאוד לפי חוליים... ומה היא תקנת חולי נפשות? ילכו אצל החכמים שהם רופאי הנפשות, וירפאו חוליים בדעות שמלמדין אותם עד שיחזירום לדרך הטובה\". (רמב\"ם)"
  },
  {
    "quote": "\"לא משנה מה נשמע, לא משנה מה יגידו, לא תחזיות החדשות, ולא קבינט המלחמה, עלינו מוטלת תמיד החובה לזכור ש... \"אין עוד מלבדו!\""
  },
  {
    "quote": "\"בעולם החשוך שלנו אנחנו כל היום משחקים מחבואים... בורא עולם מתחבא, והתפקיד שלנו לחפש אותו, לגלות אותו... ואפילו בהסתרה שבתוך ההסתרה בודאי גם שם נמצא השי\"ת\"."
  },
  {
    "quote": "\"ממקומך מלכנו תופיע, ותמלוך עלינו כי מחכים אנחנו לך... מתי תמלוך בציון בקרוב בימינו לעולם ועד תשכון. תתגדל ותתקדש בתוך ירושלים עירך לדור ודור ולנצח נצחים... ועינינו תראינה מלכותיך כדבר האמור בשירי עוזך ע\"י דוד משיח צדקך. (מתוך קדושת מוסף נוסח אשכנזי)"
  },
  {
    "quote": "\"ואם תחנה עליך מחנה, רק שלא ירא לבך... ואפילו אם תקום עליך מלחמה, זאת תהיה האמונה שלך, כל העולם כולו ארמונו של מלך! וכל אחד יודע שבתוך ארמון, רק רצון המלך נעשה... ברח לך אליו, יסתירך בסכה, יסתירך בסתר אהלו, תחזה בנעם פניו, ותבקר בהיכלו\". (ארמונו של מלך, ביני לנדאו)"
  },
  {
    "quote": "הרמב\"ם: \"מוטב לאדם להרבות במתנות לאביונים מלהרבות בסעודתו ובשלוח לרעיו, שאין שם שמחה גדולה ומפוארה אלא לשמח לב עניים ויתומים ואלמנות\""
  },
  {
    "quote": "\"במקום לקרוע את המלבושים ולזכות ברחמי בשר ודם, מוטב לקרוע את הלב ולזכות ברחמי שמים\" (רבי מנחם מנדל מוורקא)"
  },
  {
    "quote": "\"ענין הבטחון הוא האמון שאיו מקרה בעולם, וכל הגעשה תחת השמש הוא הכל בהכרזה מאתו יתברך\" (החזו\"א)"
  },
  {
    "quote": "\"כאשר תצא למלחמה ביצר הרע,מתוך ביטחון וידיעה ברורה שהקב״ה עומד לימינך לעזור לך, הרי כבר ביציאה אתה עומד ״על אויבך״-אתה מעליו וחזק ממנו״. ליקוטי שיחות"
  },
  {
    "quote": "\"אלוקים נכנס לחיינו כקריאה מן העתיד. הוא כמו מנופף לנו בידו מקצה אופק הזמן, מפציר בנו לצאת למסע ולבצע משימה שנולדנו כדי למלא. איננו נמצאים בעולם במקרה. אנחנו כאן כי ה' רצה שנהיה כאן, ומפני שיש משימה שנועדנו להגשים. לא קל לגלות מהי. אבל לכל אחד מאיתנו יש משהו שאלוקים קורא לו לעשות, עתיד שעדיין לא נוצר כי אם מחכה שניצור אותו\". (הרב זקס זצ\"ל)"
  },
  {
    "quote": "\"מעשה שהיה באדם שניגש לחזון איש ואמר לו שהוא התייאש ממצבו, אמר לו החזו\"א בדיני אבידה רק בעלים יכול להתייאש, אתה לא \"בעלים\" על המצב שלך, וממילא אין לך סמכות להתייאש!!\""
  },
  {
    "quote": "\"אמנם ברגעי הגלות האחרונים עלולים לצוץ קשיים לא מובנים, שיכולים לגרום לרפיון או לחולשה, אך עצם הידיעה שאנו נמצאים ברגעי הגלות האחרונים איננה צריכה לגרום לנו לרפיון או לחולשה בעבודת השליחות שלנו בהפצת תורה וחסידות – אלא להפך. ידיעה זו צריכה לגרום לנו לתוספת של חיות ומרץ בעבודת ה'. ובפרט עלינו להגביר את הציפיה לגאולה, התפילה והבקשה על הגאולה, שהן מפעולות האחרונות אשר יכולות לזרז ולמהר את השליחות שלנו בגלות, והביא להתגלות הגאולה בקרוב ממש\". (ע\"פ ספר השיחות תשמ\"ח, שיחת ש\"פ ויצא עמ' 521 ואילך)"
  },
  {
    "quote": "\"אדם כמו ציפור בכוחה של ציפור לדאות מעלה מעלה בתנאי שתניע כנפיה ללא הרף אם תפסיק את מעופה הרי היא צונחת ונופלת...\" {הרב קוק}"
  },
  {
    "quote": "\"אדם שהתמנה לרב במקום מסויים הגיע אל הרבי כשהוא מוטרד מהיקפו של תפקידו החדש. \"רבי\", שאל בפגישת 'היחידות', \"איך אני, אדם אחד, אמור להשפיע על 7,000 אנשים? ענה לו הרבי, עליך להיות מוטל להשפיע על שבעה אנשים. אלה ישפיעו על שבעה נוספים, אשר ישפיעו על שבעה נוספים, וכן הלאה. כך בסוף תשפיע על כולם\". הרבי לימד כלל מעודד מאוד... \"איכות מולידה כמות\"."
  },
  {
    "quote": "\"עדיף לחפש את הודאי, גם אם לא בטוח שנצליח להשיגו, מאשר להישאר במקום, שבאופן ודאי לא תושג בו האמת.\" (בעל הסולם)"
  },
  {
    "quote": "\"בני אדם שנפשותיהם חולות, מתאווים ואוהבים הדעות הרעות, ושונאים הדרך הטובה ומתעצלים ללכת בה, והיא כבדה עליהן למאוד לפי חוליים... ומה היא תקנת חולי נפשות? ילכו אצל החכמים שהם רופאי הנפשות, וירפאו חוליים בדעות שמלמדין אותם עד שיחזירום לדרך הטובה\". (רמב\"ם)"
  },
  {
    "quote": "\"זה מאוד קשה למצוא את האושר בפנים, אך בלתי אפשרי למצוא אותו בחוץ\""
  },
  {
    "quote": "\"לא יהיה בך אל זר\" (תהלים פא, י). אל יהא הקדוש ברוך הוא זר ונכרי בך - בלבך ובנפשך.\" (רבי מנחם מנדל מקוצק)"
  },
  {
    "quote": "\"ריבון העולמים אינני חושש מהגיהנום שלך, אינני מתאוה לגן העדן שלך, מותר אני על מלאכי עליון שלך, היודע אתה מה אני מבקש? אותך, אותך בלבד!\" (רבי שניאור זלמן מלאדי)"
  },
  {
    "quote": "\"הרי האדם, דבר אינו מניח בעולם שאינו מחפש אחריו. תר אחרי הרים וגבעות. חותר לדעת מה בים ומה מתחת לים, במדבריות ובישימון. אלא דבר אחד הוא הניח ואינו מחפש אחריו - האלוקות שבקרבו\" (רבי צדוק הכהן מלובלין)."
  },
  {
    "quote": "\"טעם האושר הוא לא להשיג את מה שאתה חפץ, אלא לאהוב את מה שכבר קבלת.\""
  },
  {
    "quote": "\"אהבת ישראל היא אהבת הבורא. כי כשאוהבים את האב - אוהבים את ילדיו\". (הבעש\"ט)"
  },
  {
    "quote": "\"מי יתן ויכולתי לאהוב את הצדיק הגדול שבישראל כשם שהשם יתברך אוהב את הרשע הגדול שבישראל (הבעש\"ט)"
  },
  {
    "quote": "\"הנרתיק שמונחות בו התפילין אם נפל לארץ אפילו בשוגג מרימים אותו מהר ומנשקים אותו... יהודי המניח תפילין לא כל שכן שקדוש הוא\". (רבי אברהם מרדכי מגור)"
  },
  {
    "quote": "\"בבית דין של מעלה לא ישאלו את האדם מדוע נכשל בחטא אלא ישאלו אותו מדוע לא שב בתשובה\" (רבי שמחה בונים מפשיסחא)"
  },
  {
    "quote": "\"כמה קל לאיש עני לבטוח בה', כי במי זולתו יוכל לבטוח? אך כמה קשה לאיש עשיר לבטוח בה', שהרי כל נכסיו קוראים אליו... בטח בנו!\" (רבי משה ליב מסאסוב)"
  },
  {
    "quote": "\"זהירים הם בני אדם שלא לבלוע נמלה חיה, מדוע אין הם זהירים שלא לבלוע אדם חי?\" (רבי ברוך ממזבוז)"
  },
  {
    "quote": "\"האר\"י הקדוש היה משבח רבות את מעלת השמחה לכבודה של תורה. הוא היה אומר: \"כל מי שרוקד ביום הזה בכל כוחו לכבודה של תורה, ומצחו נוטף זיעה, הקב\"ה לוקח את אותה זיעה ומוחה בה את עוונותיו\"."
  },
  {
    "quote": "\"תבנה מדורה עבור אדם, ויהיה לו חם ליום אחד, תדליק אש בליבו של אדם, ויהיה לו חם לכל החיים...\""
  },
  {
    "quote": "\"הכסף אומר: תרוויחו אותי ושכחו מהכל, הזמן אומר: לכו אחריי שכחו מהכל, העתיד אומר: תאבקו עבורי שכחו מהכל, ואלוקים פשוט אומר: רק תזכרו אותי, ואני אתן לכם את הכל\""
  },
  {
    "quote": "\"והנה ידוע כי כל קיום העולם ואפילו השמים היפים הוא רק בשביל ישראל היושבים בבתי מדרשות ועוסקים בתורה המה קברניטי הספינה מלחיה וחובליה. ובשביל זה עלינו לכבד מאד את לומדי התורה בבגדיהם הקרועים והמטולאים יען כי עליהם העולם עומד. וכמו שכתבו הספרים הקדושים שאלמלי היה העולם בטל מתורה אף רגע אחד מיד היתה מתבטלת כל הבריאה\" (ח\"ח על התורה עמ' פז)"
  },
  {
    "quote": "\"בשעה שאמרו ישראל \"נעשה ונשמע\" אמר הקב\"ה בשביל שושנה זו ינצל הפרדס. בזכות התורה ולומדיה ינצל העולם\". (שיר השירים רבה)"
  },
  {
    "quote": "\"חסיד שחזר מביקור בקהילה יהודית על סף התבוללות, הסביר לאנשי הקהילה כי חשיבותו של כל יהודי היא קריטית לכלל ישראל, כמו אות בספר התורה. אם חלילה אות אחת חסרה, הספר כולו חסר. כששמע זאת רבי יוסף יצחק שניאורסון (הריי\"צ), אמר לאותו חסיד: יהודי אינו כמו אות בספר התורה, שיכולה להמחק, אלא כמו אות החקוקה בלוחות הברית. גם כשהיא מכוסה בבוץ או באבק היא תמיד נשארת שלימה.\""
  },
  {
    "quote": "\"משה רבינו התקשה בבנייתה של מנורת הזהב של המשכן \"כֻּלָּהּ מִקְשָׁה אַחַת\" (שמות כה, לו), לכן, מספרים חז\"ל, הוא זרק אותה אל תוך האש, והזהב קיבל מאיליו את צורת המנורה הנדרשת. ממנו אנו לומדים לגבי בנית בית המקדש הפרטי שעל כל אחד ואחד לבנות בתוכו, שגם אם אין לנו מושג איך בסופו של דבר יצא מכך בית מקדש – עלינו להשתדל ולתת את כל מה שיש ביכולתינו לעשות, והקדוש ברוך הוא כבר יהפוך זאת לבית מקדש של ממש\". (ע\"פ לקוטי שיחות ח\"א)"
  },
  {
    "quote": "״וארשתיך לי לעולם וארשתיך לי בצדק ובמשפט ובחסד וברחמים\" ׳׳בכל התנאים ובכל המצבים תהיו מאורשים לי כעם, בין שתרצו בכך בין שלא. רק שבכם תלוי הדבר – אם ״בצדק ובמשפט״ – בדרכים קשות של משפט, עונש וייסורים, או ב״חסד וברחמים״ – שתהיו שבים אלי מרצונכם״ (מאוצר החסידות)."
  },
  {
    "quote": "\"תלמיד בא לפשיסחא לבית מדרשו של הצדיק רבי שמחה בונים. שאלו הרבי: \"לשם מה באת, מה אתה מחפש כאן\"? את השם יתברך\" – השיב התלמיד. אמר לו רבי שמחה בונים בלשון רכה: ״את השם יתברך יכול אדם למצוא בכל מקום – מלא כל הארץ כבודו. כאן בא האדם כדי לחפש את עצמו!״."
  }
];

function renderDailySpark() {
  const title = document.querySelector("[data-daily-spark-title]");
  const text = document.querySelector("[data-daily-spark-text]");
  if (!title || !text || !dailySparks.length) return;
  const fourHours = 4 * 60 * 60 * 1000;
  const sparkIndex = Math.floor(Date.now() / fourHours) % dailySparks.length;
  const spark = dailySparks[sparkIndex];
  title.textContent = spark.quote;
  title.classList.toggle("is-long-spark", spark.quote.length > 150);
  title.classList.toggle("is-very-long-spark", spark.quote.length > 320);
  text.textContent = spark.source ? spark.source : "ניצוץ להתבוננות";
}

renderDailySpark();
function renderSparkArchive() {
  const target = document.querySelector('[data-render="spark-archive"]');
  if (!target || !dailySparks.length) return;
  target.innerHTML = "";
  dailySparks.forEach((spark, index) => {
    const article = document.createElement("article");
    article.className = "spark-archive-item";

    const number = document.createElement("span");
    number.textContent = String(index + 1).padStart(2, "0");

    const quote = document.createElement("blockquote");
    quote.textContent = spark.quote;
    quote.classList.toggle("is-long-spark", spark.quote.length > 180);
    quote.classList.toggle("is-very-long-spark", spark.quote.length > 420);

    article.append(number, quote);
    if (spark.source) {
      const source = document.createElement("cite");
      source.textContent = spark.source;
      article.append(source);
    }
    target.append(article);
  });
}

renderSparkArchive();


const contentForm = document.getElementById("contentForm");
if (contentForm) {
  contentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(contentForm);
    const type = formData.get("type");
    const saved = getSiteContent();
    saved[type] = saved[type] || [];
    const tag = String(formData.get("tag") || "").trim();
    const title = String(formData.get("title") || "").trim();
    const text = String(formData.get("text") || "").trim();
    const link = String(formData.get("link") || "").trim();
    const meta = String(formData.get("meta") || "").trim();

    if (type === "questions") {
      saved.questions.unshift({ topic: tag || "שאלה", question: title, answer: text });
    } else if (type === "videos") {
      saved.videos.unshift({ category: tag || "מדיה", title, duration: meta || "חדש", thumb: "assets/media-torah.svg" });
    } else if (type === "sparks") {
      saved.sparks.unshift({ category: tag || "ניצוץ", title, text });
    } else {
      saved.announcements.unshift({ tag: tag || "חדש", title, text, date: meta || "עודכן עכשיו", link: link || "index.html" });
    }

    localStorage.setItem(storageKey, JSON.stringify(saved));
    contentForm.reset();
    alert("התוכן נוסף. חזרו לדף הבית כדי לראות אותו באזור החדש.");
  });
}

const resetContent = document.getElementById("resetContent");
if (resetContent) {
  resetContent.addEventListener("click", () => {
    localStorage.removeItem(storageKey);
    alert("התוכן אופס לתוכן הדוגמה.");
  });
}

const homepageBookFloat = document.querySelector(".home-books-feature .book-float-wrap");
if (homepageBookFloat) {
  const startedAt = performance.now();
  const floatBook = (now) => {
    const elapsed = (now - startedAt) / 1000;
    const y = Math.sin(elapsed * 1.65) * 22;
    const scale = 1 + Math.sin(elapsed * 1.65 + 0.7) * 0.012;
    homepageBookFloat.style.setProperty("transform", `translate3d(0, ${y}px, 0) scale(${scale})`, "important");
    requestAnimationFrame(floatBook);
  };
  requestAnimationFrame(floatBook);
}


function renderRotatingHomeQnaHighlights() {
  const cards = Array.from(document.querySelectorAll(".home-qna-card"));
  if (cards.length < 3) return;

  const banks = [
    {
      topic: "דיני שבת",
      hash: "shabbat",
      questions: [
        "הילדים הכניסו ציפור או בעל חיים קטן לחדר, אבל השאירו חלון או פתח פתוח. האם יש בזה צידה?",
        "בעל חיים נכנס לבית, ואני רוצה לסגור את הדלת בגלל קור או גשם. מה עושים?",
        "החתול או הכלב רגילים לבית. האם מותר לסגור אחריהם את הדלת בשבת?",
        "אני פותח כלוב כדי להכניס אוכל לבעל חיים. מותר לפתוח לרווחה ולסגור אחר כך?",
        "יש עכבר בבית. האם מותר להכניס לחדר חתול שירדוף אחריו?",
        "יש עכברים בבית. האם מותר להעמיד מלכודת בשבת?",
        "סגרתי קופסה או כוס וראיתי שיש בפנים זבוב. חייב לפתוח?",
        "נכנסה דבורה או צרעה לבית ויש ילדים קטנים. מה מותר לעשות?"
      ]
    },
    {
      topic: "דיני ממונות",
      hash: "choshen-mishpat",
      questions: [
        "מום במקח, על מי חובת ההשבה, על המוכר או על הקונה?",
        "האם כסף קונה?",
        "להחזיר למדף הקניות גלידה שאולי הפשירה",
        "בעל קצביה שמכר בשר שלא ברמת ההידור שביקש הלקוח",
        "הגבהה גורלית - כד יקר שנשבר בחנות",
        "פגמים שנמצאו ברכב לאחר העברת בעלות",
        "צביעת חדר האמבטיה כדי להסתיר רטיבות",
        "המנה השלישית הייתה מקולקלת וגרמה לאורחים להקיא, האם יש חיוב לשלם על המנות הראשונות?"
      ]
    },
    {
      topic: "איסור והיתר",
      hash: "issur-heter",
      questions: [
        "מדוע אסרה התורה אכילה, בישול והנאה בבשר וחלב?",
        "אדם שרף יחד בורקס בשרי ובורקס חלבי לפני שריפת חמץ, האם עבר על איסור בישול בשר וחלב?",
        "בשר וחלב שהתבשלו יחד, האם אפשר לתת את התבשיל לחתולי רחוב?",
        "קופסת גלידה חלבית שנוקתה היטב, האם מותר לחמם בה מאכל בשרי במיקרוגל?",
        "כלי בשרי בן יומו שהונח בתוכו חלב צונן ושהה מעת לעת, מה דין החלב?",
        "האם מותר לאכול דגים בחלב, ומה הדין לטגן דג בחמאה?",
        "האם מותר לקנות מפיצרייה פיצה עם טונה לאחר שכבר נעשתה?",
        "מה דין תבנית שאפו בה פיצה חלבית עם דגים?"
      ]
    }
  ];

  const fourHours = 4 * 60 * 60 * 1000;
  const slot = Math.floor(Date.now() / fourHours);

  cards.slice(0, 3).forEach((card, index) => {
    const bank = banks[index];
    const question = bank.questions[slot % bank.questions.length];
    const topic = card.querySelector("span");
    const title = card.querySelector("h3");
    const link = card.querySelector("a");
    if (topic) topic.textContent = bank.topic;
    if (title) title.textContent = question;
    if (link) link.href = "qna.html?q=" + encodeURIComponent(question) + "#" + bank.hash;
  });
}

renderRotatingHomeQnaHighlights();
setInterval(renderRotatingHomeQnaHighlights, 60 * 1000);

function initMoadimLibrary() {
  const search = document.getElementById("moadimSearch");
  const entries = Array.from(document.querySelectorAll(".moadim-entry"));
  const filters = Array.from(document.querySelectorAll("[data-moadim-filter]"));
  const tocLinks = Array.from(document.querySelectorAll("[data-moadim-target]"));
  const noResults = document.querySelector(".moadim-no-results");
  const count = document.querySelector(".moadim-count");
  if (!entries.length) return;

  let activeMonth = "הכל";
  const normalize = (value) => String(value || "").replace(/\s+/g, " ").trim().toLowerCase();

  entries.forEach((entry) => {
    const details = entry.querySelector("details");
    const action = entry.querySelector(".moadim-entry-action");
    if (!details || !action) return;
    const syncAction = () => {
      action.textContent = details.open ? "סגור" : "פתח";
    };
    details.addEventListener("toggle", syncAction);
    syncAction();
  });

  const update = () => {
    const query = normalize(search?.value);
    let visibleCount = 0;

    entries.forEach((entry) => {
      const monthMatches = activeMonth === "הכל" || entry.dataset.moadimMonth === activeMonth;
      const textMatches = !query || normalize(entry.textContent).includes(query);
      const visible = monthMatches && textMatches;
      entry.hidden = !visible;
      if (visible) visibleCount += 1;

      const details = entry.querySelector("details");
      if (details && query.length > 1) details.open = visible;
    });

    tocLinks.forEach((link) => {
      const target = document.getElementById(link.dataset.moadimTarget);
      link.hidden = !target || target.hidden;
    });

    if (noResults) noResults.hidden = visibleCount !== 0;
    if (count) {
      const monthText = activeMonth === "הכל" ? "" : ` · ${activeMonth}`;
      count.innerHTML = `<strong>${visibleCount}</strong> מאמרים מוצגים${monthText}`;
    }
  };

  filters.forEach((filter) => {
    filter.addEventListener("click", () => {
      activeMonth = filter.dataset.moadimFilter || "הכל";
      filters.forEach((item) => item.classList.toggle("is-active", item === filter));
      update();
    });
  });

  search?.addEventListener("input", update);

  tocLinks.forEach((link) => {
    link.addEventListener("click", () => {
      const target = document.getElementById(link.dataset.moadimTarget);
      target?.querySelector("details")?.setAttribute("open", "");
      tocLinks.forEach((item) => item.classList.toggle("is-current", item === link));
    });
  });

  update();
}

initMoadimLibrary();

function initAboutBooksCarousel() {
  const carousel = document.querySelector("[data-about-books-carousel]");
  if (!carousel) return;

  const track = carousel.querySelector("[data-books-track]");
  const items = Array.from(track?.querySelectorAll(".about-book-item") || []);
  const prev = carousel.querySelector("[data-books-prev]");
  const next = carousel.querySelector("[data-books-next]");
  const dotsWrap = carousel.querySelector("[data-books-dots]");
  if (!track || !items.length) return;

  let index = 0;
  let perView = 3;
  let maxIndex = 0;

  const getPerView = () => {
    if (window.matchMedia("(max-width: 620px)").matches) return 1;
    if (window.matchMedia("(max-width: 900px)").matches) return 2;
    return 3;
  };

  const getStep = () => {
    const first = items[0];
    const gap = parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || "0");
    return first.getBoundingClientRect().width + gap;
  };

  const buildDots = () => {
    if (!dotsWrap) return;
    dotsWrap.innerHTML = "";
    for (let i = 0; i <= maxIndex; i += 1) {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `מעבר לקבוצת ספרים ${i + 1}`);
      button.addEventListener("click", () => {
        index = i;
        update();
      });
      dotsWrap.appendChild(button);
    }
  };

  const update = () => {
    if (maxIndex > 0) {
      index = ((index % (maxIndex + 1)) + (maxIndex + 1)) % (maxIndex + 1);
    } else {
      index = 0;
    }
    track.style.transform = `translateX(${-index * getStep()}px)`;
    if (prev) prev.disabled = false;
    if (next) next.disabled = false;
    Array.from(dotsWrap?.children || []).forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  };

  const refresh = () => {
    perView = getPerView();
    maxIndex = Math.max(0, items.length - perView);
    if (maxIndex === 0) index = 0;
    buildDots();
    update();
  };

  next?.addEventListener("click", () => {
    index += 1;
    update();
  });

  prev?.addEventListener("click", () => {
    index -= 1;
    update();
  });

  window.addEventListener("resize", refresh);
  refresh();
}

initAboutBooksCarousel();

function initAddressNavigationChooser() {
  const address = "הרב מרדכי אליהו 34, קרית מלאכי";
  const addressQuery = "הרב מרדכי אליהו 34, קריית מלאכי";
  const googleUrl = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addressQuery)}`;
  const wazeUrl = `https://waze.com/ul?q=${encodeURIComponent(addressQuery)}&navigate=yes`;

  document.querySelectorAll("footer p").forEach((paragraph) => {
    const hasAddress = Array.from(paragraph.childNodes).some((node) =>
      node.nodeType === 3 && node.textContent.includes(address)
    );
    if (!hasAddress || paragraph.querySelector(".footer-map-links")) return;

    const links = document.createElement("span");
    links.className = "footer-map-links";
    links.innerHTML = `
      <a href="${googleUrl}" target="_blank" rel="noopener">Google Maps</a>
      <span aria-hidden="true">|</span>
      <a href="${wazeUrl}" target="_blank" rel="noopener">Waze</a>
    `;
    paragraph.append(document.createElement("br"), links);
  });
}

initAddressNavigationChooser();

function initCourtPrincipleCards() {
  const cards = Array.from(document.querySelectorAll("[data-court-card]"));
  if (!cards.length) return;

  cards.forEach((card) => {
    card.addEventListener("click", () => {
      const willOpen = !card.classList.contains("is-open");
      cards.forEach((otherCard) => {
        otherCard.classList.remove("is-open");
        otherCard.setAttribute("aria-expanded", "false");
      });
      if (willOpen) {
        card.classList.add("is-open");
        card.setAttribute("aria-expanded", "true");
      }
    });

    card.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      card.classList.remove("is-open");
      card.setAttribute("aria-expanded", "false");
      card.focus();
    });
  });
}

initCourtPrincipleCards();
