(function () {
  var overlay = document.querySelector("[data-home-gate-intro]");
  if (!overlay) return;

  var key = "homeGateIntroPlayed";
  var forcePreview = /(?:[?&])gateIntro=1(?:&|$)/.test(window.location.search);
  var reducedMotion = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var storage = null;

  try {
    storage = window.sessionStorage;
  } catch (error) {
    storage = null;
  }

  function hideImmediately() {
    overlay.classList.add("is-hidden");
    overlay.remove();
  }

  if (reducedMotion || (!forcePreview && storage && storage.getItem(key) === "1")) {
    hideImmediately();
    return;
  }

  document.documentElement.classList.add("gate-intro-active");
  document.body.classList.add("gate-intro-active");

  var timers = [];
  function later(ms, fn) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
  }

  function finish() {
    if (!forcePreview && storage) {
      try {
        storage.setItem(key, "1");
      } catch (error) {
        storage = null;
      }
    }
    overlay.classList.add("is-revealing");
    later(560, function () {
      timers.forEach(window.clearTimeout);
      document.documentElement.classList.remove("gate-intro-active");
      document.body.classList.remove("gate-intro-active");
      overlay.remove();
    });
  }

  window.requestAnimationFrame(function () {
    overlay.classList.add("is-ready");
    later(180, function () {
      overlay.classList.add("is-opening");
    });
    later(1280, function () {
      overlay.classList.add("is-dolly");
    });
    later(2380, finish);
  });
})();
