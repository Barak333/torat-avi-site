(() => {
  const sources = [
    "assets/torat-avi-green-texture-clean.webp",
    "assets/site-emerald-banner-texture.webp",
    "assets/beit-midrash-hero.webp",
    "assets/home-banner-beit-midrash.webp",
    "assets/home-banner-rabbi-left.webp",
    "assets/chesed-nefesh-bg.webp",
    "assets/bat-melech.jpg",
    "assets/rabbis-book-hazon-ovadya.png"
  ];

  const warmImage = (source) => {
    const image = new Image();
    image.decoding = "async";
    image.src = source;

    if (typeof image.decode === "function") {
      image.decode().catch(() => {});
    }
  };

  const start = () => sources.forEach(warmImage);

  if ("requestIdleCallback" in window) {
    window.requestIdleCallback(start, { timeout: 900 });
  } else {
    window.setTimeout(start, 120);
  }
})();
