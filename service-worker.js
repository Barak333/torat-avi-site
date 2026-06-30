const CACHE_NAME = "torat-avi-pwa-v124";
const CORE_ASSETS = [
  "./",
  "./index.html",
  "./beit-din.html",
  "./soul-torah.html",
  "./growth.html",
  "./emuna.html",
  "./updates.html",
  "./updates.js",
  "./styles.css",
  "./beit-din.css",
  "./beit-din-booking.js",
  "./weekly-qna.js",
  "./premium-buttons.css",
  "./nefesh-qna.js",
  "./nefesh-growth-qna.js",
  "./emuna-qna.js",
  "./rabbi-opinion.css",
  "./rabbi-opinion.js",
  "./script.js",
  "./site.webmanifest",
  "./assets/favicon-192.png",
  "./assets/favicon-512.png",
  "./assets/torat-avi-logo-transparent.png",
  "./assets/torat-avi-logo-footer-white.png",
  "./assets/site-emerald-banner-texture.webp",
  "./assets/psakim-hero-premium-bg.jpg",
  "./assets/court-gavel.png",
  "./assets/directory-soul-premium.webp",
  "./assets/directory-books-premium.webp",
  "./assets/directory-qna-premium.webp",
  "./assets/directory-ask-rabbi-premium.webp",
  "./assets/whatsapp-community-icon.jpg",
  "./assets/whatsapp-community-icon-transparent.png"
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































