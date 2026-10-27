const CACHE_NAME = "mevakshei-panecha-pwa-v23-home-background-warmup";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./beit-din.html",
  "./soul-torah.html",
  "./growth.html",
  "./emuna.html",
  "./updates.html",
  "./updates.js",
  "./site.min.css?v=20261027-lazy-warmup-4",
  "./qna-performance.css?v=20261027-qna-scroll-5",
  "./qna-performance.js?v=20261027-qna-dom-1",
  "./home.min.css?v=20261018-scroll-stability-1",
  "./home-performance.css?v=20261027-paint-stability-1",
  "./home-journey.js?v=20261027-static-route-1",
  "./home-backgrounds.js?v=20261027-predecode-1",
  "./script.min.js?v=20261027-lazy-warmup-4",
  "./script.min.js?v=20261027-qna-idle-1",
  "./home-gate-intro.min.js?v=20261018-scroll-stability-1",
  "./beit-din.min.css?v=20261018-scroll-stability-1",
  "./beit-din-booking.js",
  "./nefesh-qna.min.js?v=20261018-scroll-stability-1",
  "./nefesh-growth-qna.min.js?v=20261018-scroll-stability-1",
  "./emuna-qna.min.js?v=20261018-scroll-stability-1",
  "./qna-permalinks.min.js?v=20261018-scroll-stability-1",
  "./rabbi-opinion.js",
  "./assets/mevakshei-panecha-app-192.png",
  "./assets/mevakshei-panecha-app-512.png",
  "./assets/mevakshei-panecha-nav-logo.webp?v=20260831-logo-1",
  "./assets/inner-judge-emblem-v2.webp?v=20261007-voice-logo-1",
  "./assets/whatsapp-community-icon.jpg",
  "./assets/whatsapp-community-icon-transparent.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/") || url.pathname.startsWith("/media/")) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.includes("/qna-management")) {
    event.respondWith(fetch(request, { cache: "no-store" }));
    return;
  }

  if (url.pathname.endsWith("/site.webmanifest") || url.pathname.includes("/assets/mevakshei-panecha-app-")) {
    event.respondWith(fetch(request, { cache: "reload" }));
    return;
  }

  if (
    url.pathname.endsWith("/qna.html") ||
    url.pathname.endsWith("/weekly-qna.js") ||
    url.pathname.endsWith("/weekly-qna-latest.js") ||
    url.pathname.endsWith("/qna-custom-categories.js") ||
    url.pathname.endsWith("/script.js") ||
    url.pathname.endsWith("/script.min.js")
  ) {
    event.respondWith(fetch(request));
    return;
  }

  if (url.pathname.endsWith("/public/uploads/beit-din/files.json")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match("./index.html")))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      const network = fetch(request).then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
        }
        return response;
      });
      return cached || network;
    })
  );
});































