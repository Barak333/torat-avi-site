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
  const submitButton = form.querySelector("[data-ij-submit]");
  const submitMessage = form.querySelector("[data-ij-submit-message]");
  const clearDraftButton = shell.querySelector("[data-ij-clear-draft]");
  const storageKey = "toratAviInnerJudgeDraft";
  const caseKey = "toratAviInnerJudgeCase";
  const successKey = "toratAviInnerJudgeSuccess";
  const draftMaxAgeMs = 7 * 24 * 60 * 60 * 1000;
  const hebrewSteps = ["א", "ב", "ג"];
  const stageNames = ["פרטים אישיים", "שאלון העומק", "אישור ושליחה"];
  let current = 1;
  let deliveryReady = false;

  function createSubmissionToken() {
    if (window.crypto?.randomUUID) return window.crypto.randomUUID();
    const randomPart = Math.random().toString(36).slice(2);
    return `${Date.now().toString(36)}-${randomPart}`;
  }

  function getCaseDetails() {
    try {
      const saved = JSON.parse(localStorage.getItem(caseKey) || "null");
      if (saved?.number && saved?.date) {
        if (!saved.token) {
          saved.token = createSubmissionToken();
          localStorage.setItem(caseKey, JSON.stringify(saved));
        }
        return saved;
      }
    } catch (_) {}
    const now = new Date();
    const dayCode = `${String(now.getFullYear()).slice(-2)}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const randomCode = window.crypto?.getRandomValues
      ? window.crypto.getRandomValues(new Uint32Array(1))[0].toString(36).toUpperCase().padStart(7, "0").slice(-7)
      : Math.random().toString(36).slice(2, 9).toUpperCase().padEnd(7, "0");
    const details = {
      number: `${dayCode}-${randomCode}`,
      date: now.toLocaleDateString("he-IL"),
      token: createSubmissionToken()
    };
    localStorage.setItem(caseKey, JSON.stringify(details));
    return details;
  }

  const caseDetails = getCaseDetails();
  document.querySelectorAll("[data-ij-case-number]").forEach((node) => { node.textContent = caseDetails.number; });
  document.querySelectorAll("[data-ij-open-date]").forEach((node) => { node.textContent = caseDetails.date; });
  const signatureDate = form.querySelector("[data-ij-signature-date]");
  if (signatureDate) signatureDate.value = caseDetails.date;

  function saveDraft() {
    try {
      const values = {};
      new FormData(form).forEach((value, key) => { values[key] = value; });
      form.querySelectorAll('input[type="checkbox"]').forEach((input) => { values[input.name] = input.checked; });
      localStorage.setItem(storageKey, JSON.stringify({ savedAt: Date.now(), values }));
    } catch (_) {
      // The questionnaire remains usable when local storage is unavailable.
    }
  }

  function restoreDraft() {
    try {
      const savedDraft = JSON.parse(localStorage.getItem(storageKey) || "null");
      if (!savedDraft?.savedAt || !savedDraft?.values || Date.now() - savedDraft.savedAt > draftMaxAgeMs) {
        localStorage.removeItem(storageKey);
        return;
      }
      const values = savedDraft.values;
      Object.entries(values).forEach(([name, value]) => {
        const field = form.elements.namedItem(name);
        if (!field) return;
        if (field.type === "checkbox") field.checked = Boolean(value);
        else field.value = value;
      });
    } catch (_) {}
  }

  if (clearDraftButton) {
    clearDraftButton.addEventListener("click", () => {
      if (!window.confirm("למחוק מהמכשיר את כל התשובות שנשמרו בטיוטה?")) return;
      try {
        localStorage.removeItem(storageKey);
        localStorage.removeItem(caseKey);
      } catch (_) {}
      form.reset();
      if (signatureDate) signatureDate.value = new Date().toLocaleDateString("he-IL");
      showStep(1);
      clearDraftButton.textContent = "הטיוטה נמחקה מהמכשיר";
      clearDraftButton.disabled = true;
    });
  }

  function showStep(number, shouldScroll = true) {
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
    if (shouldScroll) shell.scrollIntoView({ behavior: "smooth", block: "start" });
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
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!validateCurrentStep() || !submitButton || !deliveryReady) return;

    submitButton.disabled = true;
    submitButton.classList.add("is-sending");
    submitButton.textContent = "השאלון נשלח כעת...";
    if (submitMessage) {
      submitMessage.className = "ij-submit-message";
      submitMessage.textContent = "נא להמתין, אנו מעבירים את תשובותיכם לעיונו של הרב.";
    }

    const values = Object.fromEntries(new FormData(form).entries());
    values.privacyConsent = form.elements.namedItem("privacyConsent")?.checked === true;
    values.caseNumber = caseDetails.number;
    values.openDate = caseDetails.date;
    values.submissionToken = caseDetails.token;

    try {
      const response = await fetch("/api/inner-judge-submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values)
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok || !result.ok) throw new Error(result.message || "לא ניתן היה להשלים את השליחה.");

      sessionStorage.setItem(successKey, JSON.stringify({
        caseNumber: result.caseNumber || caseDetails.number,
        submittedAt: result.submittedAt || new Date().toLocaleDateString("he-IL"),
        email: values.email,
        fullName: values.fullName
      }));
      localStorage.removeItem(storageKey);
      localStorage.removeItem(caseKey);
      window.location.assign(`inner-judge-success.html?case=${encodeURIComponent(result.caseNumber || caseDetails.number)}`);
    } catch (error) {
      submitButton.disabled = false;
      submitButton.classList.remove("is-sending");
      submitButton.textContent = "שליחת השאלון לעיון הרב";
      if (submitMessage) {
        submitMessage.className = "ij-submit-message is-error";
        submitMessage.textContent = error.message || "אירעה תקלה בשליחה. התשובות נשמרו במכשיר ואפשר לנסות שוב.";
      }
    }
  });

  async function checkDeliveryStatus() {
    if (!submitButton) return;
    try {
      const response = await fetch("/api/inner-judge-submit", { headers: { Accept: "application/json" } });
      const result = await response.json();
      deliveryReady = response.ok && result.configured === true;
    } catch (_) {
      deliveryReady = false;
    }
    submitButton.disabled = !deliveryReady;
    submitButton.textContent = deliveryReady ? "שליחת השאלון לעיון הרב" : "מערכת השליחה תיפתח לאחר חיבור הדואר";
    if (!deliveryReady && submitMessage) {
      submitMessage.textContent = "אפשר למלא את השאלון ולשמור טיוטה במכשיר, אך השליחה עדיין אינה פעילה.";
    }
  }

  restoreDraft();
  showStep(1, false);
  checkDeliveryStatus();
})();
