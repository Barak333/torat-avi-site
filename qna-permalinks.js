(() => {
  const registry = Object.create(null);
  const claimedIds = new Map();
  const genericIds = /^(mamonot|sukkot|avelut|tefila|musar|kabbalah|shabbat|kashrut)-[0-9]+$/;

  const cleanText = (value) => String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  const slugify = (value) => {
    const slug = cleanText(value)
      .normalize("NFKD")
      .replace(/[\u0591-\u05c7]/g, "")
      .toLowerCase()
      .replace(/[״”“"׳'`]/g, "")
      .replace(/[^a-z0-9\u05d0-\u05ea]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "");
    if (slug.length <= 92) return slug;
    const shortened = slug.slice(0, 92);
    return shortened.slice(0, shortened.lastIndexOf("-") > 45 ? shortened.lastIndexOf("-") : 92)
      .replace(/-$/g, "");
  };

  const shortHash = (value) => {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(36).padStart(7, "0").slice(0, 7);
  };

  const paragraphText = (paragraph) => {
    if (typeof paragraph === "string") return cleanText(paragraph);
    return cleanText(paragraph?.text || (paragraph?.runs || []).map((run) => run.text || "").join(""));
  };

  const removeLabel = (value, label) => cleanText(value)
    .replace(new RegExp(`^${label}\\s*[:：]?\\s*`, "u"), "");

  const readEntryText = (item) => {
    if (item?.question || item?.answer) {
      return {
        question: cleanText(item.question || item.title),
        answer: cleanText(item.answer)
      };
    }

    const paragraphs = (item?.paragraphs || []).map(paragraphText).filter(Boolean);
    const questionStart = paragraphs.findIndex((text) => /^שאלה\s*[:：]?/u.test(text));
    const answerStart = paragraphs.findIndex((text) => /^תשובה\s*[:：]?/u.test(text));
    const questionEnd = answerStart > questionStart ? answerStart : paragraphs.length;
    const questionParts = questionStart >= 0
      ? paragraphs.slice(questionStart, questionEnd)
      : [];
    const answerParts = answerStart >= 0
      ? paragraphs.slice(answerStart)
      : paragraphs.filter((text) => text !== item?.heading && text !== item?.title);

    return {
      question: cleanText(questionParts.map((text, index) => index === 0 ? removeLabel(text, "שאלה") : text).join(" ") || item?.title),
      answer: cleanText(answerParts.map((text, index) => index === 0 ? removeLabel(text, "תשובה") : text).join(" "))
    };
  };

  const reserveId = (item, scope, title, question) => {
    const currentId = cleanText(item?.id);
    const identity = `${scope}|${title}|${question}`;
    const keepCurrentId = currentId && !genericIds.test(currentId);
    let candidate = keepCurrentId
      ? currentId
      : `${scope}-${slugify(title || question) || shortHash(identity)}`;
    const claimedIdentity = claimedIds.get(candidate);
    if (!keepCurrentId && claimedIdentity && claimedIdentity !== identity) {
      candidate = `${candidate}-${shortHash(identity)}`;
    }
    claimedIds.set(candidate, identity);
    return candidate;
  };

  const assignCollection = (items, options) => {
    if (!Array.isArray(items)) return;
    items.forEach((item) => {
      const title = cleanText(item?.title || item?.question || "שאלה");
      const { question, answer } = readEntryText(item);
      const permalinkId = reserveId(item, options.scope, title, question);
      item.permalinkId = permalinkId;
      const current = registry[permalinkId];
      const entry = {
        id: permalinkId,
        page: options.page,
        topic: options.topic || options.scope,
        category: cleanText(item?.subtopic || item?.category || options.category),
        title,
        question: question || title,
        answer,
        publishedAt: cleanText(item?.publishedAt)
      };
      if (!current || entry.answer.length > current.answer.length) registry[permalinkId] = entry;
    });
  };

  assignCollection(window.choshenMishpatContent, {
    scope: "mamonot",
    page: "qna.html",
    topic: "choshen-mishpat",
    category: "חושן משפט ודיני ממונות"
  });
  assignCollection(window.shabbatQuestionsContent, {
    scope: "shabbat",
    page: "qna.html",
    topic: "shabbat",
    category: "שבת"
  });
  assignCollection(window.issurHeterQuestionsContent, {
    scope: "kashrut",
    page: "qna.html",
    topic: "kashrut",
    category: "איסור והיתר וכשרות"
  });

  if (Array.isArray(window.alonimQnaCategories)) {
    window.alonimQnaCategories.forEach((category) => assignCollection(category.items, {
      scope: cleanText(category.id || "archive"),
      page: "qna.html",
      topic: "alonim-qna",
      category: category.name || "שו״ת מקיף"
    }));
  }

  assignCollection(window.weeklyQnaEntries, {
    scope: "weekly",
    page: "qna.html",
    topic: "weekly-qna",
    category: "השו״ת השבועי"
  });

  const pageKey = typeof document !== "undefined"
    ? document.currentScript?.dataset.page || ""
    : cleanText(window.qnaPermalinkPage);
  const pageCollections = {
    levado: [window.levadoQuestions, "levado", "levado.html", "לבדו"],
    nefesh: [window.nefeshQuestions, "nefesh", "soul-torah.html", "תורת הנפש"],
    growth: [window.nefeshGrowthQuestions, "growth", "growth.html", "צמיחה"],
    emuna: [window.emunaQuestions, "emuna", "emuna.html", "אמונה"],
    zugiyut: [window.levadoQuestions, "zugiyut", "zugiyut.html", "זוגיות"],
    children: [window.childrenEducationQuestions, "children", "children-education.html", "חינוך ילדים"]
  };
  const selected = pageCollections[pageKey];
  if (selected) {
    assignCollection(selected[0], {
      scope: selected[1],
      page: selected[2],
      topic: selected[1],
      category: selected[3]
    });
  }

  window.qnaPermalinkEntries = registry;
  window.qnaPermalinkHelpers = { slugify };
})();
