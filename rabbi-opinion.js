(() => {
  const modal = document.querySelector("[data-rabbi-opinion-modal]");
  if (!modal) return;

  const dialog = modal.querySelector(".rabbi-opinion-dialog");
  const dock = document.querySelector("[data-rabbi-opinion-dock]");
  const dockCard = dock?.querySelector(".rabbi-opinion-dock-card");
  const closeButtons = Array.from(modal.querySelectorAll("[data-rabbi-opinion-close]"));
  const countdown = modal.querySelector("[data-rabbi-opinion-countdown]");
  const readingTime = 5;
  let unlocked = false;
  let previousFocus = null;
  let countdownTimer = null;
  let closing = false;
  let lockedElements = [];

  const lockSite = () => {
    lockedElements = Array.from(document.body.children).filter((element) => element !== modal);
    lockedElements.forEach((element) => { element.inert = true; });
  };

  const unlockSite = () => {
    lockedElements.forEach((element) => { element.inert = false; });
    lockedElements = [];
  };

  const unlock = () => {
    unlocked = true;
    modal.classList.add("is-unlocked");
    closeButtons.forEach((button) => {
      button.disabled = false;
      button.setAttribute("aria-hidden", "false");
    });
  };

  const finishClose = () => {
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    modal.dataset.opinionResolved = "true";
    modal.classList.remove("is-visible", "is-docking");
    document.body.classList.remove("rabbi-opinion-open");
    document.documentElement.classList.remove("rabbi-opinion-pending");
    unlockSite();
    previousFocus?.focus?.();
    window.dispatchEvent(new CustomEvent("toratavi:rabbi-opinion-resolved"));
  };

  const close = async () => {
    if (!unlocked || closing) return;
    closing = true;

    if (!dialog || !dock || !dockCard || !dialog.animate) {
      dock?.removeAttribute("hidden");
      dock?.classList.add("is-settled");
      finishClose();
      return;
    }

    const source = dialog.getBoundingClientRect();
    dock.hidden = false;
    dock.classList.add("is-preparing");
    const target = dockCard.getBoundingClientRect();
    modal.classList.add("is-docking");

    try {
      await dialog.animate([
        {
          opacity: 1,
          transform: "translateY(0) scale(1)",
          clipPath: "inset(0 0 0 0 round 8px)"
        },
        {
          offset: .65,
          opacity: 1,
          transform: "translateY(8px) scaleX(.96)",
          clipPath: "inset(43% 0 43% 0 round 8px)"
        },
        {
          opacity: 0,
          transform: "translateY(12px) scaleX(.9)",
          clipPath: "inset(49.5% 0 49.5% 0 round 8px)"
        }
      ], {
        duration: 360,
        easing: "cubic-bezier(.3,0,.25,1)",
        fill: "forwards"
      }).finished;

      const line = document.createElement("div");
      line.className = "rabbi-opinion-flight-line";
      Object.assign(line.style, {
        left: `${source.left + source.width * .08}px`,
        top: `${source.top + source.height / 2}px`,
        width: `${source.width * .84}px`
      });
      document.body.appendChild(line);

      const sourceLineCenterX = source.left + source.width / 2;
      const sourceLineCenterY = source.top + source.height / 2;
      const targetCenterX = target.left + target.width / 2;
      const targetCenterY = target.top + target.height / 2;
      const travelX = targetCenterX - sourceLineCenterX;
      const travelY = targetCenterY - sourceLineCenterY;
      const scaleX = target.width / (source.width * .84);

      await line.animate([
        { opacity: 1, transform: "translate3d(0,0,0) scaleX(1)" },
        {
          offset: .82,
          opacity: 1,
          transform: `translate3d(${travelX}px,${travelY}px,0) scaleX(${scaleX})`
        },
        {
          opacity: 0,
          transform: `translate3d(${travelX}px,${travelY}px,0) scaleX(${scaleX})`
        }
      ], {
        duration: 560,
        easing: "cubic-bezier(.22,.72,.18,1)",
        fill: "forwards"
      }).finished;

      dock.classList.remove("is-preparing");
      dock.classList.add("is-settled");
      line.remove();
    } catch {
      // The final dock state below still completes the transition.
      dock.classList.remove("is-preparing");
      dock.classList.add("is-settled");
      document.querySelector(".rabbi-opinion-flight-line")?.remove();
    }

    finishClose();
  };

  const open = () => {
    if (!modal.hidden || modal.classList.contains("is-visible")) return;

    window.clearInterval(countdownTimer);
    closing = false;
    unlocked = false;
    modal.classList.remove("is-unlocked", "is-docking");
    closeButtons.forEach((button) => {
      button.disabled = true;
      button.setAttribute("aria-hidden", "true");
    });
    modal.dataset.opinionResolved = "false";
    window.dispatchEvent(new CustomEvent("toratavi:rabbi-opinion-opened"));
    previousFocus = document.activeElement;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("rabbi-opinion-open");
    lockSite();

    void modal.offsetWidth;
    modal.classList.add("is-visible", "is-reading");
    dialog?.focus({ preventScroll: true });

    let remaining = readingTime;
    if (countdown) countdown.textContent = String(remaining);
    countdownTimer = window.setInterval(() => {
      remaining -= 1;
      if (countdown) countdown.textContent = String(Math.max(remaining, 0));
      if (remaining <= 0) {
        window.clearInterval(countdownTimer);
        unlock();
      }
    }, 1000);
  };

  closeButtons.forEach((button) => button.addEventListener("click", close));

  document.addEventListener("keydown", (event) => {
    if (modal.hidden) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  const openAfterGate = () => {
    const gateIntro = document.querySelector("[data-home-gate-intro]");
    if (gateIntro && !gateIntro.classList.contains("is-hidden")) {
      window.addEventListener("toratavi:gate-intro-finished", open, { once: true });
      return;
    }
    open();
  };

  window.addEventListener("load", openAfterGate, { once: true });

  window.addEventListener("toratavi:returned-after-inactivity", () => {
    open();
  });
})();
