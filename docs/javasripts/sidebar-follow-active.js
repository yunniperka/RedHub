(function () {
  let observer = null;
  let controller = null;
  let scheduled = false;

  function isVisible(element) {
    return !!(
      element &&
      (element.offsetWidth ||
        element.offsetHeight ||
        element.getClientRects().length)
    );
  }

  function getActiveTocLink() {
    const selectors = [
      '.md-sidebar--primary .md-nav__link[aria-current="location"][href*="#"]',
      '.md-sidebar--primary .md-nav__link--active[href*="#"]',
      '.md-sidebar--primary .md-nav__list .md-nav__list .md-nav__link[aria-current="location"]',
      '.md-sidebar--primary .md-nav__list .md-nav__list .md-nav__link--active'
    ];

    for (const selector of selectors) {
      const links = Array.from(document.querySelectorAll(selector)).filter(isVisible);

      if (links.length) {
        return links[links.length - 1];
      }
    }

    return null;
  }

  function getHeaderBottom() {
    const header = document.querySelector(".md-header");

    if (!header) {
      return 0;
    }

    return Math.max(0, header.getBoundingClientRect().bottom);
  }

  function scrollSidebarToActiveLink() {
    scheduled = false;

    const scrollwrap = document.querySelector(
      ".md-sidebar--primary .md-sidebar__scrollwrap"
    );

    const active = getActiveTocLink();

    if (!scrollwrap || !active) {
      return;
    }

    const containerRect = scrollwrap.getBoundingClientRect();
    const activeRect = active.getBoundingClientRect();

    /*
      Important:
      Use the visible browser viewport, not only the sidebar container.
      This fixes the case where the sidebar itself extends below the screen.
    */
    const visibleTop = Math.max(containerRect.top, getHeaderBottom(), 0);
    const visibleBottom = Math.min(containerRect.bottom, window.innerHeight);
    const visibleHeight = visibleBottom - visibleTop;

    if (visibleHeight <= 0) {
      return;
    }

    const safeMargin = Math.min(72, visibleHeight * 0.20);

    const isAbove = activeRect.top < visibleTop + safeMargin;
    const isBelow = activeRect.bottom > visibleBottom - safeMargin;

    if (!isAbove && !isBelow) {
      return;
    }

    const activeOffsetInsideScroll =
      scrollwrap.scrollTop + activeRect.top - containerRect.top;

    const visibleOffsetInsideScroll =
      visibleTop - containerRect.top;

    /*
      Keep active item around upper-middle of the visible sidebar,
      not at the very bottom.
    */
    const targetTop =
      activeOffsetInsideScroll -
      visibleOffsetInsideScroll -
      visibleHeight * 0.38 +
      activeRect.height / 2;

    scrollwrap.scrollTop = Math.max(0, targetTop);
  }

  function scheduleScroll() {
    if (scheduled) {
      return;
    }

    scheduled = true;
    window.requestAnimationFrame(scrollSidebarToActiveLink);
  }

  function setupSidebarFollow() {
    if (observer) {
      observer.disconnect();
      observer = null;
    }

    if (controller) {
      controller.abort();
      controller = null;
    }

    const sidebar = document.querySelector(".md-sidebar--primary");

    if (!sidebar) {
      return;
    }

    controller = new AbortController();

    observer = new MutationObserver(scheduleScroll);

    observer.observe(sidebar, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"]
    });

    window.addEventListener("scroll", scheduleScroll, {
      passive: true,
      signal: controller.signal
    });

    window.addEventListener("resize", scheduleScroll, {
      passive: true,
      signal: controller.signal
    });

    window.addEventListener("hashchange", scheduleScroll, {
      signal: controller.signal
    });

    scheduleScroll();
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setupSidebarFollow();
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupSidebarFollow);
  } else {
    setupSidebarFollow();
  }
})();