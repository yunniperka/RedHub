(function () {
  "use strict";

  const STORAGE_PREFIX = "redhub.nav.page.collapsed.";
  const MANUAL_PAUSE_MS = 3500;

  const SAFE_ZONE_TOP_RATIO = 0.28;
  const SAFE_ZONE_BOTTOM_RATIO = 0.58;
  const TARGET_RATIO = 0.22;

  let followRaf = null;
  let lastActiveHref = null;
  let manualSidebarUntil = 0;
  let collapseObserver = null;
  let followObserver = null;

  function visible(el) {
    return !!(
      el &&
      (el.offsetWidth || el.offsetHeight || el.getClientRects().length)
    );
  }

  function primarySidebar() {
    return document.querySelector(".md-sidebar--primary");
  }

  function sidebarScrollwrap() {
    return document.querySelector(
      ".md-sidebar--primary .md-sidebar__scrollwrap"
    );
  }

  function directChild(item, selector) {
    try {
      return item.querySelector(":scope > " + selector);
    } catch (e) {
      return (
        Array.from(item.children).find(function (child) {
          return child.matches && child.matches(selector);
        }) || null
      );
    }
  }

  function markManualSidebarUse() {
    manualSidebarUntil = Date.now() + MANUAL_PAUSE_MS;
  }

  function sidebarIsManuallyControlled() {
    return Date.now() < manualSidebarUntil;
  }

  function activeTocLink() {
    const sidebar = primarySidebar();

    if (!sidebar) {
      return null;
    }

    const links = Array.from(
      sidebar.querySelectorAll(
        '.md-nav__link--active[href*="#"], .md-nav__link[aria-current="location"][href*="#"]'
      )
    ).filter(visible);

    return links.length ? links[links.length - 1] : null;
  }

  function followActiveToc(force) {
    followRaf = null;

    if (sidebarIsManuallyControlled()) {
      return;
    }

    const wrap = sidebarScrollwrap();
    const link = activeTocLink();

    if (!wrap || !link) {
      return;
    }

    const href = link.getAttribute("href") || "";
    const linkRect = link.getBoundingClientRect();
    const wrapRect = wrap.getBoundingClientRect();

    const wrapHeight = wrap.clientHeight;

    const safeTop = wrapRect.top + wrapHeight * SAFE_ZONE_TOP_RATIO;
    const safeBottom = wrapRect.top + wrapHeight * SAFE_ZONE_BOTTOM_RATIO;

    const linkMiddle = linkRect.top + linkRect.height / 2;

    const inSafeZone =
      linkMiddle >= safeTop &&
      linkMiddle <= safeBottom;

    const activeChanged = href !== lastActiveHref;
    lastActiveHref = href;

    if (!force && !activeChanged && inSafeZone) {
      return;
    }

    const targetMiddle = wrapRect.top + wrapHeight * TARGET_RATIO;

    const delta = linkMiddle - targetMiddle;

    if (Math.abs(delta) < 8) {
      return;
    }

    wrap.scrollTo({
      top: wrap.scrollTop + delta,
      behavior: "smooth"
    });
  }

  function scheduleFollow(force) {
    if (followRaf !== null) {
      return;
    }

    followRaf = requestAnimationFrame(function () {
      followActiveToc(!!force);
    });
  }

  function initSidebarFollow() {
    const sidebar = primarySidebar();
    const wrap = sidebarScrollwrap();

    if (!sidebar || !wrap) {
      return;
    }

    wrap.style.overflowY = "auto";
    wrap.style.overflowX = "hidden";
    wrap.style.overscrollBehavior = "contain";
    wrap.style.scrollBehavior = "smooth";
    wrap.style.paddingBottom = "4rem";

    ["wheel", "touchstart", "pointerdown", "mousedown"].forEach(function (eventName) {
      wrap.addEventListener(eventName, markManualSidebarUse, { passive: true });
    });

    if (followObserver) {
      followObserver.disconnect();
    }

    followObserver = new MutationObserver(function () {
      scheduleFollow(false);
    });

    followObserver.observe(sidebar, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"]
    });

    window.addEventListener(
      "scroll",
      function () {
        scheduleFollow(false);
      },
      { passive: true }
    );

    window.addEventListener(
      "resize",
      function () {
        scheduleFollow(true);
      },
      { passive: true }
    );

    window.addEventListener("hashchange", function () {
      setTimeout(function () {
        scheduleFollow(true);
      }, 50);

      setTimeout(function () {
        scheduleFollow(true);
      }, 250);
    });

    setTimeout(function () {
      scheduleFollow(true);
    }, 300);
  }

  function rootPrimaryList() {
    return document.querySelector(
      ".md-sidebar--primary .md-nav--primary > .md-nav__list"
    );
  }

  function depthFromRootList(item, rootList) {
    let depth = 0;
    let parent = item.parentElement;

    while (parent && parent !== rootList) {
      if (parent.classList && parent.classList.contains("md-nav__list")) {
        depth += 1;
      }

      parent = parent.parentElement;
    }

    return parent === rootList ? depth : -1;
  }

  function pageLevelItems() {
    const sidebar = primarySidebar();
    const rootList = rootPrimaryList();

    if (!sidebar || !rootList) {
      return [];
    }

    return Array.from(sidebar.querySelectorAll(".md-nav__item")).filter(function (item) {
      const depth = depthFromRootList(item, rootList);

      /*
        depth 0 = main groups, e.g. Web Security
        depth 1 = pages under those groups, e.g. Initial Reconnaissance / SQL Injection
      */
      if (depth !== 1) {
        return false;
      }

      const link = directChild(item, ".md-nav__link");
      const nested =
        directChild(item, ".md-nav") ||
        directChild(item, ".md-nav__list");

      return !!(link && nested);
    });
  }

  function storageKey(link, index) {
    const href = link ? link.getAttribute("href") : "";
    const text = link ? link.textContent.trim().replace(/\s+/g, " ") : "";

    return STORAGE_PREFIX + (href || text || String(index));
  }

  function setCollapsed(item, button, collapsed) {
    item.classList.toggle("rh-page-collapsed", collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute(
      "title",
      collapsed ? "Show page contents" : "Hide page contents"
    );
  }

  function removeOldMainSectionToggles() {
    document.querySelectorAll(".rh-section-toggle").forEach(function (button) {
      button.remove();
    });

    document
      .querySelectorAll(".rh-collapsible-section, .rh-section-collapsed")
      .forEach(function (item) {
        item.classList.remove(
          "rh-collapsible-section",
          "rh-section-collapsed"
        );
      });
  }

  function addPageToggle(item, index) {
    if (item.classList.contains("rh-collapsible-page")) {
      return;
    }

    const link = directChild(item, ".md-nav__link");
    const nested =
      directChild(item, ".md-nav") ||
      directChild(item, ".md-nav__list");

    if (!link || !nested) {
      return;
    }

    item.classList.add("rh-collapsible-page");

    const button = document.createElement("button");
    button.type = "button";
    button.className = "rh-page-toggle";
    button.setAttribute("aria-label", "Toggle page contents");

    item.insertBefore(button, link);

    const key = storageKey(link, index);
    const saved = localStorage.getItem(key);
    const collapsed = saved === "1";

    setCollapsed(item, button, collapsed);

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      const nextCollapsed = !item.classList.contains("rh-page-collapsed");

      localStorage.setItem(key, nextCollapsed ? "1" : "0");
      setCollapsed(item, button, nextCollapsed);

      markManualSidebarUse();
    });
  }

  function initPageCollapsibleNav() {
    const sidebar = primarySidebar();

    if (!sidebar) {
      return;
    }

    removeOldMainSectionToggles();

    pageLevelItems().forEach(addPageToggle);

    if (collapseObserver) {
      collapseObserver.disconnect();
    }

    collapseObserver = new MutationObserver(function () {
      removeOldMainSectionToggles();
      pageLevelItems().forEach(addPageToggle);
    });

    collapseObserver.observe(sidebar, {
      childList: true,
      subtree: true
    });
  }

  function init() {
    initSidebarFollow();
    initPageCollapsibleNav();

    console.info("RedHub sidebar tools loaded - early active follow enabled");
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(init, 150);
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();