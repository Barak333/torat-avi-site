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
      const viewHeight = map.viewBox?.baseVal?.height || 900;
      route.style.strokeDasharray = `${length}`;
      return { map, route, traveler, halo, waypoints, length, viewHeight };
    })
    .filter(Boolean);

  if (!section || !maps.length) return;

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const thresholds = [0.14, 0.35, 0.58, 0.79];
  let ticking = false;

  const locateByVerticalProgress = ({ route, length, viewHeight }, progress) => {
    const targetY = viewHeight * progress;
    let low = 0;
    let high = length;

    for (let index = 0; index < 9; index += 1) {
      const middle = (low + high) / 2;
      if (route.getPointAtLength(middle).y < targetY) low = middle;
      else high = middle;
    }

    const distance = (low + high) / 2;
    return { distance, point: route.getPointAtLength(distance) };
  };

  const draw = () => {
    const grid = section.querySelector(".home-journey-grid");
    const rect = grid?.getBoundingClientRect();
    if (!rect) {
      ticking = false;
      return;
    }

    const focusRatio = window.innerWidth <= 860 ? 0.7 : 0.66;
    const focusLine = window.innerHeight * focusRatio;
    const progress = Math.min(1, Math.max(0, (focusLine - rect.top) / rect.height));

    maps.forEach((mapData) => {
      const { route, traveler, halo, waypoints, length } = mapData;
      const { distance, point } = locateByVerticalProgress(mapData, progress);
      route.style.strokeDashoffset = `${length - distance}`;
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
