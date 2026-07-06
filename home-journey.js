(() => {
  const section = document.querySelector(".home-journey");
  const steps = [...(section?.querySelectorAll(".home-journey-step") || [])];
  const destination = section?.querySelector(".home-journey-destination");
  const maps = [...(section?.querySelectorAll(".home-journey-map") || [])]
    .map((map) => {
      const route = map.querySelector("[data-journey-route]");
      const traveler = map.querySelector("[data-journey-traveler]");
      const halo = map.querySelector("[data-journey-halo]");
      const waypoints = [...map.querySelectorAll(".journey-map-waypoints circle")];

      if (!route || !traveler || !halo || typeof route.getTotalLength !== "function") return null;

      const length = route.getTotalLength();
      route.style.strokeDasharray = `${length}`;
      return { route, traveler, halo, waypoints, length };
    })
    .filter(Boolean);

  if (!section || !maps.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const thresholds = [0.14, 0.35, 0.58, 0.79];
  let ticking = false;

  const draw = () => {
    const rect = section.getBoundingClientRect();
    const start = window.innerHeight * 0.72;
    const finish = window.innerHeight * 0.28;
    const progress = Math.min(1, Math.max(0, (start - rect.top) / (rect.height + start - finish)));

    maps.forEach(({ route, traveler, halo, waypoints, length }) => {
      const point = route.getPointAtLength(length * progress);
      route.style.strokeDashoffset = `${length * (1 - progress)}`;
      traveler.setAttribute("cx", point.x);
      traveler.setAttribute("cy", point.y);
      halo.setAttribute("cx", point.x);
      halo.setAttribute("cy", point.y);
      waypoints.forEach((waypoint, index) => {
        waypoint.classList.toggle("is-reached", progress >= thresholds[index]);
      });
    });

    steps.forEach((step, index) => {
      step.classList.toggle("is-journey-reached", progress >= thresholds[index]);
    });
    destination?.classList.toggle("is-journey-reached", progress >= 0.93);
    section.style.setProperty("--journey-progress", progress.toFixed(3));
    ticking = false;
  };

  const requestDraw = () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(draw);
  };

  if (reducedMotion.matches) {
    maps.forEach(({ route, traveler, halo, waypoints, length }) => {
      route.style.strokeDashoffset = "0";
      const point = route.getPointAtLength(length);
      traveler.setAttribute("cx", point.x);
      traveler.setAttribute("cy", point.y);
      halo.setAttribute("cx", point.x);
      halo.setAttribute("cy", point.y);
      waypoints.forEach((waypoint) => waypoint.classList.add("is-reached"));
    });
    steps.forEach((step) => step.classList.add("is-journey-reached"));
    destination?.classList.add("is-journey-reached");
    return;
  }

  window.addEventListener("scroll", requestDraw, { passive: true });
  window.addEventListener("resize", requestDraw, { passive: true });
  draw();
})();
