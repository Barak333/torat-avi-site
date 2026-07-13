(function () {
  var overlay = document.querySelector("[data-home-gate-intro]");
  if (!overlay) return;

  var forcePreview = /(?:[?&])gateIntro=1(?:&|$)/.test(window.location.search);
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
    later(260, function () {
      timers.forEach(window.clearTimeout);
      document.documentElement.classList.remove("gate-intro-active");
      document.body.classList.remove("gate-intro-active");
      overlay.remove();
      window.dispatchEvent(new CustomEvent("toratavi:gate-intro-finished"));
    });
  }

  function beginExitWhenReady() {
    if (exitStarted || !minimumTimePassed || !pageReady) return;
    exitStarted = true;
    overlay.classList.add("is-dolly");
    later(680, finish);
  }

  if (!pageReady) {
    window.addEventListener("load", function () {
      pageReady = true;
      beginExitWhenReady();
    }, { once: true });
  }

  later(620, function () {
    overlay.classList.add("is-opening");
  });

  later(2900, function () {
    minimumTimePassed = true;
    beginExitWhenReady();
  });

  later(6500, function () {
    minimumTimePassed = true;
    pageReady = true;
    beginExitWhenReady();
  });
})();
