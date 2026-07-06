(() => {
  const section = document.querySelector(".home-journey");
  const route = section?.querySelector(".journey-route-progress");
  const traveler = section?.querySelector(".journey-traveler");
  const halo = section?.querySelector(".journey-traveler-halo");

  if (!section || !route || !traveler || !halo || typeof route.getTotalLength !== "function") return;

  const routeLength = route.getTotalLength();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  let ticking = false;

  route.style.strokeDasharray = `${routeLength}`;

  const draw = () => {
    const rect = section.getBoundingClientRect();
    const start = window.innerHeight * 0.72;
    const finish = window.innerHeight * 0.28;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (rect.height + start - finish)));
    const point = route.getPointAtLength(routeLength * progress);

    route.style.strokeDashoffset = `${routeLength * (1 - progress)}`;
    traveler.setAttribute("cx", point.x);
    traveler.setAttribute("cy", point.y);
    halo.setAttribute("cx", point.x);
    halo.setAttribute("cy", point.y);
    section.style.setProperty("--journey-progress", progress.toFixed(3));
    ticking = false;
  };

  const requestDraw = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(draw);
  };

  if (reducedMotion.matches) {
    route.style.strokeDashoffset = "0";
    const point = route.getPointAtLength(routeLength);
    traveler.setAttribute("cx", point.x);
    traveler.setAttribute("cy", point.y);
    halo.setAttribute("cx", point.x);
    halo.setAttribute("cy", point.y);
    return;
  }

  window.addEventListener("scroll", requestDraw, { passive: true });
  window.addEventListener("resize", requestDraw, { passive: true });
  draw();
})();
