(() => {
  const storageKey = "toratAviInnerJudgeSuccess";
  const params = new URLSearchParams(window.location.search);
  let details = {};
  try {
    details = JSON.parse(sessionStorage.getItem(storageKey) || "{}");
  } catch (_) {}

  const caseNumber = details.caseNumber || params.get("case");
  const submittedAt = details.submittedAt;
  const email = details.email;

  const caseNode = document.querySelector("[data-ij-success-case]");
  const dateNode = document.querySelector("[data-ij-success-date]");
  const emailNode = document.querySelector("[data-ij-success-email]");
  const emailRow = document.querySelector("[data-ij-success-email-row]");

  if (caseNumber && caseNode) caseNode.textContent = caseNumber;
  if (submittedAt && dateNode) dateNode.textContent = submittedAt;
  if (email && emailNode && emailRow) {
    emailNode.textContent = email;
    emailRow.hidden = false;
  }
})();
