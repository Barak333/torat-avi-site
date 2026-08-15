(() => {
  const modal = document.querySelector("[data-court-booking-modal]");
  const openButton = document.querySelector("[data-court-booking-open]");
  const form = document.querySelector("[data-court-booking-form]");
  const messageField = form?.elements.namedItem("message");

  if (!modal || !openButton || !form || !messageField) return;

  const closeButtons = modal.querySelectorAll("[data-court-booking-close]");
  let lastFocusedElement = null;

  const openModal = () => {
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("court-booking-open");
    window.requestAnimationFrame(() => messageField.focus());
  };

  const closeModal = () => {
    modal.hidden = true;
    document.body.classList.remove("court-booking-open");
    if (lastFocusedElement) lastFocusedElement.focus();
  };

  openButton.addEventListener("click", openModal);
  closeButtons.forEach((button) => button.addEventListener("click", closeModal));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !modal.hidden) closeModal();
  });

  messageField.addEventListener("input", () => messageField.setCustomValidity(""));

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const requestText = String(messageField.value || "").trim();
    if (!requestText) {
      messageField.setCustomValidity("יש לכתוב יום, שעה ופרטים לחזרה.");
    }
    if (!form.reportValidity()) return;

    const message = [
      "בקשה לקביעת דין תורה - בית הדין תורת אבי",
      "",
      requestText,
      "",
      "ידוע לי כי המועד ייקבע סופית לאחר אישור בית הדין."
    ].join("\n");

    window.location.href = `https://wa.me/972535215541?text=${encodeURIComponent(message)}`;
  });
})();
