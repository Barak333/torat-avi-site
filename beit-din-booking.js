(() => {
  const modal = document.querySelector("[data-court-booking-modal]");
  const openButton = document.querySelector("[data-court-booking-open]");
  const form = document.querySelector("[data-court-booking-form]");
  const dateInput = document.querySelector("[data-court-booking-date]");
  const timeInput = document.querySelector("[data-court-booking-time]");
  const calendarTitle = document.querySelector("[data-court-calendar-title]");
  const calendarDays = document.querySelector("[data-court-calendar-days]");
  const previousMonthButton = document.querySelector("[data-court-calendar-prev]");
  const nextMonthButton = document.querySelector("[data-court-calendar-next]");
  const timeSlots = document.querySelector("[data-court-time-slots]");
  const selection = document.querySelector("[data-court-booking-selection]");
  const pickerError = document.querySelector("[data-court-booking-error]");

  if (!modal || !openButton || !form || !dateInput || !timeInput || !calendarTitle || !calendarDays || !timeSlots) return;

  const closeButtons = modal.querySelectorAll("[data-court-booking-close]");
  const firstField = form.elements.namedItem("fullName");
  let lastFocusedElement = null;

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let visibleMonth = new Date(today.getFullYear(), today.getMonth(), 1);
  let selectedDate = null;
  let selectedTime = "";

  const toLocalIsoDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  const formatSelectedDate = (date) => new Intl.DateTimeFormat("he-IL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);

  const updateSelection = () => {
    if (selectedDate && selectedTime) {
      selection.textContent = `${formatSelectedDate(selectedDate)} בשעה ${selectedTime}`;
      pickerError.hidden = true;
    } else if (selectedDate) {
      selection.textContent = `${formatSelectedDate(selectedDate)} — כעת בחרו שעה`;
    } else {
      selection.textContent = "בחרו יום ושעה לקיום הדיון";
    }
  };

  const renderCalendar = () => {
    const year = visibleMonth.getFullYear();
    const month = visibleMonth.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    calendarTitle.textContent = new Intl.DateTimeFormat("he-IL", {
      month: "long",
      year: "numeric"
    }).format(visibleMonth);
    calendarDays.replaceChildren();

    for (let index = 0; index < firstWeekday; index += 1) {
      const empty = document.createElement("span");
      empty.className = "court-calendar-empty";
      calendarDays.append(empty);
    }

    for (let day = 1; day <= daysInMonth; day += 1) {
      const date = new Date(year, month, day);
      const button = document.createElement("button");
      button.type = "button";
      button.className = "court-calendar-day";
      button.textContent = String(day);
      button.setAttribute("aria-label", formatSelectedDate(date));

      if (date.getTime() === today.getTime()) button.classList.add("is-today");
      if (date < today) button.disabled = true;
      if (selectedDate && date.getTime() === selectedDate.getTime()) {
        button.classList.add("is-selected");
        button.setAttribute("aria-pressed", "true");
      }

      button.addEventListener("click", () => {
        if (!selectedDate || date.getTime() !== selectedDate.getTime()) {
          selectedTime = "";
          timeInput.value = "";
        }
        selectedDate = date;
        dateInput.value = toLocalIsoDate(date);
        renderCalendar();
        renderTimeSlots();
        updateSelection();
      });
      calendarDays.append(button);
    }

    previousMonthButton.disabled = year === today.getFullYear() && month === today.getMonth();
  };

  const renderTimeSlots = () => {
    const fragment = document.createDocumentFragment();
    for (let minutes = 9 * 60; minutes <= 21 * 60; minutes += 30) {
      const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
      const mins = String(minutes % 60).padStart(2, "0");
      const time = `${hours}:${mins}`;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "court-time-slot";
      button.textContent = time;
      button.setAttribute("aria-label", `בחירת שעה ${time}`);
      if (selectedDate && selectedDate.getTime() === today.getTime()) {
        const slotTime = new Date(selectedDate);
        slotTime.setHours(Math.floor(minutes / 60), minutes % 60, 0, 0);
        if (slotTime <= new Date()) button.disabled = true;
      }
      if (time === selectedTime) button.classList.add("is-selected");
      button.addEventListener("click", () => {
        selectedTime = time;
        timeInput.value = time;
        timeSlots.querySelectorAll(".court-time-slot").forEach((slot) => slot.classList.remove("is-selected"));
        button.classList.add("is-selected");
        pickerError.hidden = true;
        updateSelection();
      });
      fragment.append(button);
    }
    timeSlots.replaceChildren(fragment);
  };

  previousMonthButton.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1);
    renderCalendar();
  });

  nextMonthButton.addEventListener("click", () => {
    visibleMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
    renderCalendar();
  });

  renderCalendar();
  renderTimeSlots();

  const openModal = () => {
    lastFocusedElement = document.activeElement;
    modal.hidden = false;
    document.body.classList.add("court-booking-open");
    window.requestAnimationFrame(() => firstField.focus());
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

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (!form.reportValidity()) return;
    if (!dateInput.value || !timeInput.value) {
      pickerError.hidden = false;
      return;
    }

    const data = new FormData(form);
    const requestedDate = new Date(`${data.get("date")}T12:00:00`);
    const formattedDate = new Intl.DateTimeFormat("he-IL", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }).format(requestedDate);

    const message = [
      "בקשה לקביעת דין תורה - בית הדין תורת אבי",
      "",
      `שם מלא: ${data.get("fullName")}`,
      `טלפון: ${data.get("phone")}`,
      `תאריך מבוקש: ${formattedDate}`,
      `שעה מבוקשת: ${data.get("time")}`,
      "",
      "ידוע לי כי המועד ייקבע סופית לאחר אישור בית הדין."
    ].join("\n");

    window.location.href = `https://wa.me/972532273277?text=${encodeURIComponent(message)}`;
  });
})();
