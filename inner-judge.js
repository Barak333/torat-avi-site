(() => {
  const shell = document.querySelector("[data-inner-judge-questionnaire]");
  const form = shell?.querySelector("[data-ij-form]");
  if (!shell || !form) return;

  const steps = [...form.querySelectorAll("[data-ij-step]")];
  const indicators = [...shell.querySelectorAll("[data-ij-step-indicator]")];
  const next = form.querySelector("[data-ij-next]");
  const previous = form.querySelector("[data-ij-prev]");
  const progress = shell.querySelector("[data-ij-progress-bar]");
  const progressLabel = shell.querySelector("[data-ij-progress-label]");
  const storageKey = "toratAviInnerJudgeDraft";
  const caseKey = "toratAviInnerJudgeCase";
  const hebrewSteps = ["א", "ב", "ג"];
  const stageNames = ["מסירת פרטים", "שאלון הבירור", "חתימה והגשה"];
  let current = 1;

  function getCaseDetails() {
    try {
      const saved = JSON.parse(localStorage.getItem(caseKey) || "null");
      if (saved?.number && saved?.date) return saved;
    } catch (_) {}
    const now = new Date();
    const dayCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const details = { number: `${dayCode}-${String(Math.floor(1000 + Math.random() * 9000))}`, date: now.toLocaleDateString("he-IL") };
    localStorage.setItem(caseKey, JSON.stringify(details));
    return details;
  }

  const caseDetails = getCaseDetails();
  document.querySelectorAll("[data-ij-case-number]").forEach((node) => { node.textContent = caseDetails.number; });
  document.querySelectorAll("[data-ij-open-date]").forEach((node) => { node.textContent = caseDetails.date; });
  const signatureDate = form.querySelector("[data-ij-signature-date]");
  if (signatureDate) signatureDate.value = caseDetails.date;

  function saveDraft() {
    const values = {};
    new FormData(form).forEach((value, key) => { values[key] = value; });
    form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; });
    localStorage.setItem(storageKey, JSON.stringify(values));
  }

  function restoreDraft() {
    try {
      const values = JSON.parse(localStorage.getItem(storageKey) || "{}");
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
    } catch (_) {}
  }

  function showStep(number) {
    current = Math.max(1, Math.min(steps.length, number));
    steps.forEach((step) => {
      const active = Number(step.dataset.ijStep) === current;
      step.hidden = !active;
      step.classList.toggle("is-active", active);
    });
    indicators.forEach((item) => {
      const itemNumber = Number(item.dataset.ijStepIndicator);
      item.classList.toggle("is-active", itemNumber === current);
      item.classList.toggle("is-complete", itemNumber < current);
    });
    previous.hidden = current === 1;
    next.hidden = current === steps.length;
    progress.style.width = `${(current / steps.length) * 100}%`;
    progressLabel.textContent = `שלב ${hebrewSteps[current - 1]} מתוך ${hebrewSteps[steps.length - 1]}`;
    document.querySelectorAll("[data-ij-status-stage]").forEach((node) => { node.textContent = stageNames[current - 1]; });
    shell.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function validateCurrentStep() {
    const fields = [...steps[current - 1].querySelectorAll("input, select, textarea")];
    const invalid = fields.find((field) => !field.checkValidity());
    if (!invalid) return true;
    invalid.closest("details")?.setAttribute("open", "");
    invalid.reportValidity();
    invalid.focus({ preventScroll: true });
    invalid.scrollIntoView({ behavior: "smooth", block: "center" });
    return false;
  }

  next.addEventListener("click", () => {
    if (!validateCurrentStep()) return;
    saveDraft();
    showStep(current + 1);
  });
  previous.addEventListener("click", () => showStep(current - 1));
  form.addEventListener("input", saveDraft);
  form.addEventListener("change", saveDraft);
  form.addEventListener("submit", (event) => event.preventDefault());

  restoreDraft();
  showStep(1);
})();

(() => {
  const daf = document.querySelector("[data-ij-daf]");
  if (!daf) return;

  const passages = [...daf.querySelectorAll("[data-ij-passage]")];
  const notes = [...daf.querySelectorAll("[data-ij-daf-note]")];
  const conclusion = daf.querySelector("[data-ij-daf-conclusion]");
  const conclusions = {
    trigger: "העומס מסביר את נקודת הפתיחה - אך אינו גוזר את סוף המעשה.",
    reaction: "הכעס הוא גם מעשה שיש עליו אחריות וגם מנגנון שמבקש הבנה ותיקון.",
    return: "החרטה פותחת את שער התשובה - והעבודה המעשית הופכת אותה לבחירה חדשה."
  };

  function selectPassage(name, focus = false) {
    daf.dataset.activePassage = name;
    passages.forEach((passage) => {
      const active = passage.dataset.ijPassage === name;
      passage.classList.toggle("is-active", active);
      passage.setAttribute("aria-selected", String(active));
      passage.tabIndex = active ? 0 : -1;
      if (active && focus) passage.focus();
    });
    notes.forEach((note) => note.classList.toggle("is-active", note.dataset.ijDafNote === name));
    if (conclusion) conclusion.textContent = conclusions[name];
  }

  passages.forEach((passage, index) => {
    passage.addEventListener("click", () => selectPassage(passage.dataset.ijPassage));
    passage.addEventListener("keydown", (event) => {
      if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) return;
      event.preventDefault();
      const direction = ["ArrowLeft", "ArrowDown"].includes(event.key) ? 1 : -1;
      const nextIndex = (index + direction + passages.length) % passages.length;
      selectPassage(passages[nextIndex].dataset.ijPassage, true);
    });
  });

  selectPassage("trigger");
})();
