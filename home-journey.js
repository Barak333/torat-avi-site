(() => {
  const section = document.querySelector(".home-journey");
  if (!section) return;

  const steps = Array.from(section.querySelectorAll(".home-journey-step"));
  const destination = section.querySelector(".home-journey-destination");
  const maps = Array.from(section.querySelectorAll(".home-journey-map"));

  maps.forEach((map) => {
    const route = map.querySelector("[data-journey-route]");
    const traveler = map.querySelector("[data-journey-traveler]");
    const halo = map.querySelector("[data-journey-halo]");
    if (!route || typeof route.getTotalLength !== "function") return;

    const length = route.getTotalLength();
    const endPoint = route.getPointAtLength(length);
    route.style.strokeDasharray = `${length}`;
    route.style.strokeDashoffset = "0";

    [traveler, halo].forEach((marker) => {
      if (!marker) return;
      marker.setAttribute("cx", endPoint.x);
      marker.setAttribute("cy", endPoint.y);
    });

    map.querySelectorAll(".journey-map-waypoints circle").forEach((waypoint) => {
      waypoint.classList.add("is-reached");
    });
  });

  steps.forEach((step) => step.classList.add("is-journey-reached"));
  destination?.classList.add("is-journey-reached");
  section.style.setProperty("--journey-progress", "1");
})();
