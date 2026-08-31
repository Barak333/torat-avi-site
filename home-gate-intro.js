(function () {
  var overlay = document.querySelector("[data-home-gate-intro]");
  if (!overlay) return;

  var forcePreview = /(?:[?&])gateIntro=1(?:&|$)/.test(window.location.search);
  var previewStage = new URLSearchParams(window.location.search).get("gateStage");
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var arrivedFromInsideSite = false;

  try {
    arrivedFromInsideSite = Boolean(document.referrer) && new URL(document.referrer).origin === window.location.origin;
  } catch (error) {
    arrivedFromInsideSite = false;
  }

  function hideImmediately() {
    overlay.classList.add("is-hidden");
    overlay.remove();
    window.dispatchEvent(new CustomEvent("toratavi:gate-intro-finished"));
  }

  if (reducedMotion || (!forcePreview && arrivedFromInsideSite)) {
    hideImmediately();
    return;
  }

  document.documentElement.classList.add("gate-intro-active");
  document.body.classList.add("gate-intro-active");

  overlay.classList.add("is-ready");

  if (forcePreview && previewStage === "closed") return;
  if (forcePreview && previewStage === "open") {
    overlay.classList.add("is-opening");
    return;
  }
  if (forcePreview && previewStage === "handoff") {
    overlay.classList.add("is-opening", "is-dolly", "is-handoff");
    return;
  }

  var timers = [];
  var minimumTimePassed = false;
  var pageReady = document.readyState === "complete";
  var exitStarted = false;

  function later(ms, fn) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
  }

  function finish() {
    overlay.classList.add("is-revealing");
    window.dispatchEvent(new CustomEvent("toratavi:gate-intro-finished"));
    later(260, function () {
      timers.forEach(window.clearTimeout);
      document.documentElement.classList.remove("gate-intro-active");
      document.body.classList.remove("gate-intro-active");
      overlay.remove();
    });
  }

  function beginExitWhenReady() {
    if (exitStarted || !minimumTimePassed || !pageReady) return;
    exitStarted = true;
    overlay.classList.add("is-dolly", "is-handoff");
    later(520, finish);
  }

  if (!pageReady) {
    window.addEventListener("load", function () {
      pageReady = true;
      beginExitWhenReady();
    }, { once: true });
  }

  later(1300, function () {
    overlay.classList.add("is-opening");
  });

  later(4400, function () {
    minimumTimePassed = true;
    beginExitWhenReady();
  });

  later(6500, function () {
    minimumTimePassed = true;
    pageReady = true;
    beginExitWhenReady();
  });
})();
