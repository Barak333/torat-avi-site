(function () {
  "use strict";

  const PROMO_STATE_KEY = "toratAviVisitorPromosV2";

  function readPromoState() {
    try {
      return JSON.parse(sessionStorage.getItem(PROMO_STATE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function savePromoState(state) {
    try {
      sessionStorage.setItem(PROMO_STATE_KEY, JSON.stringify(state));
    } catch {
      // The visual recovery must still run when storage is unavailable.
    }
  }

  function clearStalePromo() {
    const modal = document.querySelector(".visitor-promo-modal");
    if (!modal) return;

    const wasOpen = !modal.hidden || modal.classList.contains("is-visible");
    if (wasOpen) {
      const state = readPromoState();
      const closedAt = Date.now();
      if (state.firstShownAt && !state.firstClosedAt) {
        state.firstClosedAt = closedAt;
        state.secondDueAt = closedAt + 45_000;
      } else if (state.secondShownAt && !state.secondClosedAt) {
        state.secondClosedAt = closedAt;
      }
      savePromoState(state);
    }

    modal.classList.remove("is-visible");
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("visitor-promo-open");

    // The popup makes the rest of the page inert while it is open. A suspended
    // tab can miss its delayed cleanup, so restore interaction deterministically.
    Array.from(document.body.children).forEach((element) => {
      if (element !== modal && element.inert) element.inert = false;
    });
  }

  function settleAfterResume() {
    // Browsers can replay a throttled animation frame or timer just after a
    // suspended page becomes visible. Clear once now and again across that
    // short restoration window so an old popup cannot put the blur back.
    clearStalePromo();
    [50, 180, 500, 1200, 2500].forEach((delay) => {
      window.setTimeout(clearStalePromo, delay);
    });
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) clearStalePromo();
    else window.requestAnimationFrame(settleAfterResume);
  });
  window.addEventListener("pagehide", clearStalePromo);
  window.addEventListener("pageshow", () => window.requestAnimationFrame(settleAfterResume));
})();
