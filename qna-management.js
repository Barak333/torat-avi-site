(() => {
  "use strict";

  const $ = (selector) => document.querySelector(selector);
  const loginPanel = $("#login-panel");
  const publisherPanel = $("#publisher-panel");
  const reviewPanel = $("#review-panel");
  const successPanel = $("#success-panel");
  const dropZone = $("#drop-zone");
  const fileInput = $("#docx-file");
  const fileSummary = $("#file-summary");
  const publishButton = $("#publish-button");
  const publishProgress = $("#publish-progress");
  let pendingQna = null;

  const setStatus = (element, message = "", type = "") => {
    element.textContent = message;
    element.className = `status${type ? ` ${type}` : ""}`;
  };

  const api = async (url, options = {}) => {
    const response = await fetch(url, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...(options.headers || {}) }
    });
    const data = await response.json().catch(() => ({ ok: false, message: "התקבלה תשובה לא תקינה מהשרת." }));
    if (!response.ok) {
      const error = new Error(data.message || "הפעולה נכשלה.");
      error.status = response.status;
      throw error;
    }
    return data;
  };

  const showPublisher = (email) => {
    loginPanel.hidden = true;
    publisherPanel.hidden = false;
    $("#session-email").textContent = email;
  };

  const checkSession = async () => {
    try {
      const session = await api("/api/qna-admin-auth");
      if (session.authenticated) showPublisher(session.email);
    } catch {
      setStatus($("#login-status"), "לא ניתן להתחבר כעת לשרת.", "error");
    }
  };

  $("#toggle-password").addEventListener("click", () => {
    const password = $("#login-password");
    const reveal = password.type === "password";
    password.type = reveal ? "text" : "password";
    $("#toggle-password").textContent = reveal ? "הסתרה" : "הצגה";
    $("#toggle-password").setAttribute("aria-label", reveal ? "הסתרת הסיסמה" : "הצגת הסיסמה");
  });

  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    button.disabled = true;
    setStatus($("#login-status"), "בודק את פרטי הכניסה...");
    try {
      const result = await api("/api/qna-admin-auth", {
        method: "POST",
        body: JSON.stringify({ email: $("#login-email").value, password: $("#login-password").value })
      });
      $("#login-password").value = "";
      showPublisher(result.email);
    } catch (error) {
      setStatus($("#login-status"), error.message, "error");
    } finally {
      button.disabled = false;
    }
  });

  $("#logout-button").addEventListener("click", async () => {
    await api("/api/qna-admin-auth", { method: "DELETE" }).catch(() => {});
    location.reload();
  });

  function findEndOfCentralDirectory(view) {
    for (let offset = view.byteLength - 22; offset >= Math.max(0, view.byteLength - 65557); offset -= 1) {
      if (view.getUint32(offset, true) === 0x06054b50) return offset;
    }
    return -1;
  }

  async function extractZipEntry(buffer, requestedName) {
    const view = new DataView(buffer);
    const eocd = findEndOfCentralDirectory(view);
    if (eocd < 0) throw new Error("קובץ ה-Word אינו תקין או שאינו מסוג DOCX.");
    const entryCount = view.getUint16(eocd + 10, true);
    let offset = view.getUint32(eocd + 16, true);
    const decoder = new TextDecoder("utf-8");

    for (let index = 0; index < entryCount; index += 1) {
      if (view.getUint32(offset, true) !== 0x02014b50) break;
      const method = view.getUint16(offset + 10, true);
      const compressedSize = view.getUint32(offset + 20, true);
      const nameLength = view.getUint16(offset + 28, true);
      const extraLength = view.getUint16(offset + 30, true);
      const commentLength = view.getUint16(offset + 32, true);
      const localOffset = view.getUint32(offset + 42, true);
      const name = decoder.decode(new Uint8Array(buffer, offset + 46, nameLength));

      if (name === requestedName) {
        if (view.getUint32(localOffset, true) !== 0x04034b50) throw new Error("מבנה קובץ ה-Word אינו תקין.");
        const localNameLength = view.getUint16(localOffset + 26, true);
        const localExtraLength = view.getUint16(localOffset + 28, true);
        const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
        const compressed = new Uint8Array(buffer.slice(dataOffset, dataOffset + compressedSize));
        if (method === 0) return compressed;
        if (method !== 8 || typeof DecompressionStream === "undefined") {
          throw new Error("הדפדפן אינו תומך בקריאת קובץ זה. מומלץ לפתוח את המערכת ב-Chrome או Edge מעודכן.");
        }
        const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
        return new Uint8Array(await new Response(stream).arrayBuffer());
      }
      offset += 46 + nameLength + extraLength + commentLength;
    }
    throw new Error("לא נמצא תוכן קריא במסמך ה-Word.");
  }

  function paragraphText(paragraph) {
    const pieces = [];
    const visit = (node) => {
      if (node.nodeType === Node.TEXT_NODE) return;
      const localName = node.localName;
      if (localName === "t") pieces.push(node.textContent || "");
      else if (localName === "tab") pieces.push("\t");
      else if (localName === "br" || localName === "cr") pieces.push("\n");
      else [...node.childNodes].forEach(visit);
    };
    visit(paragraph);
    return pieces.join("").replace(/\u00a0/gu, " ").trim();
  }

  function paragraphInfo(paragraph) {
    const text = paragraphText(paragraph);
    const styleNode = [...paragraph.getElementsByTagNameNS("*", "pStyle")][0];
    const style = styleNode?.getAttributeNS("http://schemas.openxmlformats.org/wordprocessingml/2006/main", "val")
      || styleNode?.getAttribute("w:val")
      || styleNode?.getAttribute("val")
      || "";
    const textRuns = [...paragraph.getElementsByTagNameNS("*", "r")];
    const boldRuns = textRuns.filter((run) => run.getElementsByTagNameNS("*", "b").length > 0).length;
    return { text, heading: /heading|title|כותרת/u.test(style.toLowerCase()), bold: textRuns.length > 0 && boldRuns >= Math.ceil(textRuns.length / 2) };
  }

  function readSections(paragraphs) {
    const lines = paragraphs.map((item) => item.text).filter(Boolean);
    const result = { title: "", category: "", question: [], answer: [] };
    let section = "";
    const patterns = [
      ["title", /^(?:כותרת|נושא)\s*[:：-]?\s*(.*)$/u],
      ["category", /^קטגוריה\s*[:：-]?\s*(.*)$/u],
      ["question", /^שאלה\s*[:：-]?\s*(.*)$/u],
      ["answer", /^תשובה\s*[:：-]?\s*(.*)$/u]
    ];

    for (const line of lines) {
      const match = patterns.map(([key, pattern]) => [key, line.match(pattern)]).find(([, value]) => value);
      if (match) {
        section = match[0];
        const value = match[1][1].trim();
        if (section === "title" || section === "category") result[section] = value;
        else if (value) result[section].push(value);
        continue;
      }
      if (section === "question" || section === "answer") result[section].push(line);
      else if (!result.title && line) result.title = line;
    }

    let question = result.question.join("\n\n").trim();
    let answer = result.answer.join("\n\n").trim();

    if (!question || !answer) {
      const answerIndex = lines.findIndex((line) => /^(?:תשובה|מענה|פסק|תשובת הרב)\s*[:：-]?/u.test(line));
      if (answerIndex >= 0) {
        const beforeAnswer = lines.slice(0, answerIndex);
        const answerOpening = lines[answerIndex].replace(/^(?:תשובה|מענה|פסק|תשובת הרב)\s*[:：-]?\s*/u, "");
        answer = [answerOpening, ...lines.slice(answerIndex + 1)].filter(Boolean).join("\n\n").trim();
        const questionIndex = beforeAnswer.findIndex((line) => /^(?:שאלה|השאלה)\s*[:：-]?/u.test(line));
        if (questionIndex >= 0) {
          const questionOpening = beforeAnswer[questionIndex].replace(/^(?:שאלה|השאלה)\s*[:：-]?\s*/u, "");
          question = [questionOpening, ...beforeAnswer.slice(questionIndex + 1)].filter(Boolean).join("\n\n").trim();
        } else {
          question = beforeAnswer.slice(result.title ? 1 : 0).join("\n\n").trim();
        }
      }
    }

    if (!result.title) {
      const styledTitle = paragraphs.find((item) => item.heading || (item.bold && item.text.length <= 240));
      result.title = styledTitle?.text || question.replace(/\s+/gu, " ").slice(0, 100);
    }

    return {
      title: result.title,
      category: result.category,
      question,
      answer
    };
  }

  function categoryId(value) {
    const text = String(value || "").replace(/\s+/gu, " ").trim();
    const categories = [
      [/ממונות|חושן|כספים|עבודה|שכנים|מחיר|הנחה|עמלה|מכירה|לקוח|הלוואה|ריבית|נזק/u, "mamonot"],
      [/שבת/u, "shabbat"],
      [/כשרות|איסור|היתר|בשר|חלב/u, "kashrut"],
      [/תפילה|ברכות|בית הכנסת/u, "tefila"],
      [/אבלות|אבל|ניחום/u, "avelut"],
      [/סוכות|מועדים|חג|יום טוב/u, "sukkot"],
      [/קבלה|סוד/u, "kabbalah"],
      [/מוסר|הנהגה|אמונה|נפש|מידות/u, "musar"]
    ];
    return categories.find(([pattern]) => pattern.test(text))?.[1] || "";
  }

  async function parseDocx(file) {
    if (!file.name.toLowerCase().endsWith(".docx")) throw new Error("יש לבחור קובץ Word מסוג DOCX.");
    if (file.size > 10 * 1024 * 1024) throw new Error("הקובץ גדול מ-10MB.");
    const xmlBytes = await extractZipEntry(await file.arrayBuffer(), "word/document.xml");
    const xml = new TextDecoder("utf-8").decode(xmlBytes);
    const documentXml = new DOMParser().parseFromString(xml, "application/xml");
    if (documentXml.querySelector("parsererror")) throw new Error("לא ניתן לקרוא את תוכן המסמך.");
    const paragraphs = [...documentXml.getElementsByTagNameNS("*", "p")].map(paragraphInfo).filter((item) => item.text);
    if (!paragraphs.length) throw new Error("המסמך ריק או אינו מכיל טקסט קריא.");
    const content = readSections(paragraphs);
    if (/^(?:שאלה|השאלה|תשובה|שו״ת|שו"ת)$/u.test(content.title.trim()) || content.title.trim().length < 4) {
      content.title = file.name.replace(/\.docx$/iu, "").replace(/\s*\(\d+\)\s*$/u, "").trim();
    }
    if (content.title.length < 4 || content.question.length < 8 || content.answer.length < 8) {
      throw new Error("לא הצלחתי לזהות במסמך שאלה ותשובה מלאות. יש לוודא שמופיעות בו הכותרות ‘שאלה’ ו-‘תשובה’ ולנסות שוב.");
    }
    return content;
  }

  async function handleFile(file) {
    setStatus($("#file-status"), "קורא את המסמך...");
    try {
      const content = await parseDocx(file);
      $("#file-name").textContent = file.name;
      $("#file-size").textContent = `${(file.size / 1024).toFixed(0)} KB`;
      dropZone.hidden = true;
      fileSummary.hidden = false;
      pendingQna = { title: content.title, question: content.question, answer: content.answer };
      $("#detected-title").textContent = content.title;
      $("#detected-summary").textContent = `זוהו ${content.question.length.toLocaleString("he-IL")} תווים בשאלה ו-${content.answer.length.toLocaleString("he-IL")} תווים בתשובה.`;
      $("#qna-title").value = content.title;
      $("#qna-question").value = content.question;
      $("#qna-answer").value = content.answer;
      $("#qna-category").value = categoryId(content.category || `${content.title} ${content.question}`);
      reviewPanel.hidden = false;
      successPanel.hidden = true;
      setStatus($("#file-status"), "המסמך נותח בהצלחה. נשאר לבחור קטגוריה ולפרסם.", "success");
      reviewPanel.scrollIntoView({ behavior: "smooth", block: "start" });
    } catch (error) {
      fileInput.value = "";
      setStatus($("#file-status"), error.message, "error");
    }
  }

  fileInput.addEventListener("change", () => fileInput.files[0] && handleFile(fileInput.files[0]));
  $("#replace-file").addEventListener("click", () => {
    fileInput.value = "";
    dropZone.hidden = false;
    fileSummary.hidden = true;
    reviewPanel.hidden = true;
    fileInput.click();
  });
  ["dragenter", "dragover"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.add("dragging");
  }));
  ["dragleave", "drop"].forEach((eventName) => dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    dropZone.classList.remove("dragging");
  }));
  dropZone.addEventListener("drop", (event) => event.dataTransfer.files[0] && handleFile(event.dataTransfer.files[0]));

  async function waitForLive(id) {
    const expected = `\"id\": \"${id}\"`;
    for (let attempt = 0; attempt < 36; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, attempt === 0 ? 3000 : 5000));
      try {
        const response = await fetch(`/weekly-qna.js?published=${encodeURIComponent(id)}&t=${Date.now()}`, { cache: "no-store" });
        if (response.ok && (await response.text()).includes(expected)) return true;
      } catch {}
      $("#progress-detail").textContent = "העדכון נשלח וממתין להשלמת הפרסום בענן...";
    }
    return false;
  }

  $("#publish-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    publishButton.disabled = true;
    publishProgress.hidden = false;
    setStatus($("#publish-status"));
    $("#progress-title").textContent = "מפרסם את השו״ת...";
    $("#progress-detail").textContent = "המערכת מעדכנת כעת את האתר.";
    if (!pendingQna) {
      setStatus($("#publish-status"), "יש להעלות תחילה מסמך Word תקין.", "error");
      publishButton.disabled = false;
      publishProgress.hidden = true;
      return;
    }
    const payload = {
      title: $("#qna-title").value,
      question: $("#qna-question").value,
      answer: $("#qna-answer").value,
      targetCategoryId: $("#qna-category").value
    };
    try {
      const result = await api("/api/qna-admin-publish", { method: "POST", body: JSON.stringify(payload) });
      $("#progress-title").textContent = "השו״ת נשלח לפרסום";
      const live = await waitForLive(result.id);
      reviewPanel.hidden = true;
      successPanel.hidden = false;
      $("#published-link").href = result.url;
      $("#success-title").textContent = live ? "השו״ת נמצא באתר" : "השו״ת נשלח לאתר";
      successPanel.querySelector("p:not(.eyebrow)").textContent = live
        ? "העדכון פורסם בהצלחה וזמין לגולשים בכתובת הקבועה שלו."
        : "הפרסום התקבל. אם הקישור עדיין אינו מציג את השו״ת, יש להמתין דקה ולרענן.";
      successPanel.scrollIntoView({ behavior: "smooth", block: "center" });
    } catch (error) {
      if (error.status === 401) {
        publisherPanel.hidden = true;
        loginPanel.hidden = false;
        setStatus($("#login-status"), "פג תוקף החיבור. יש להתחבר מחדש.", "error");
      } else {
        setStatus($("#publish-status"), error.message, "error");
      }
    } finally {
      publishButton.disabled = false;
      publishProgress.hidden = true;
    }
  });

  $("#publish-another").addEventListener("click", () => {
    $("#publish-form").reset();
    pendingQna = null;
    fileInput.value = "";
    fileSummary.hidden = true;
    dropZone.hidden = false;
    reviewPanel.hidden = true;
    successPanel.hidden = true;
    setStatus($("#file-status"));
    $(".upload-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  });

  checkSession();
})();
