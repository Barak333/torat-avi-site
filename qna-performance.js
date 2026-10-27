(() => {
  const page = document.querySelector(".qna-categories-section");
  const search = document.getElementById("qnaSearch");
  if (!page || !search) return;

  const topics = Array.from(page.querySelectorAll(".qna-topic"));
  const storedTopics = new Map();
  let syncFrame = 0;

  const restoreTopic = (topic) => {
    const fragment = storedTopics.get(topic);
    if (!fragment) return;
    topic.append(fragment);
    storedTopics.delete(topic);
    topic.removeAttribute("data-qna-parked");
  };

  const parkTopic = (topic) => {
    if (storedTopics.has(topic)) return;
    const fragment = document.createDocumentFragment();
    fragment.append(...topic.childNodes);
    storedTopics.set(topic, fragment);
    topic.setAttribute("data-qna-parked", "true");
  };

  const syncTopics = () => {
    syncFrame = 0;
    const isSearching = search.value.trim().length > 0 || document.activeElement === search;
    topics.forEach((topic) => {
      if (isSearching || !topic.hidden) restoreTopic(topic);
      else parkTopic(topic);
    });
  };

  const scheduleSync = () => {
    if (syncFrame) return;
    syncFrame = requestAnimationFrame(syncTopics);
  };

  search.addEventListener("pointerdown", () => {
    topics.forEach(restoreTopic);
  }, { passive: true });
  search.addEventListener("focus", () => {
    topics.forEach(restoreTopic);
  });
  search.addEventListener("input", scheduleSync);
  search.addEventListener("blur", scheduleSync);

  page.querySelectorAll(".qna-category-tabs a").forEach((tab) => {
    tab.addEventListener("click", scheduleSync);
  });

  const topicStateObserver = new MutationObserver(scheduleSync);
  topics.forEach((topic) => {
    topicStateObserver.observe(topic, { attributes: true, attributeFilter: ["hidden"] });
  });

  Promise.resolve(window.toratAviLiveContentReady)
    .catch(() => {})
    .finally(() => requestAnimationFrame(syncTopics));
})();
