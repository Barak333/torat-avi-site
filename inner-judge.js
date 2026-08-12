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
  const hebrewSteps = ["א", "ב", "ג", "ד", "ה"];
  const stageNames = ["מסירת פרטים", "תיאור המציאות", "שמיעת העדויות", "טענת הלב", "חתימה והגשה"];
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
    progressLabel.textContent = `סדר ${hebrewSteps[current - 1]} מתוך ה`;
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
