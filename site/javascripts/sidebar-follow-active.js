(function () {
  "use strict";

  /*
    RedHub sidebar tools:
    1) Follow the active integrated ToC item, but pause when the user manually scrolls the left sidebar.
    2) Add collapse arrows to page-level items, e.g. Initial Reconnaissance / SQL Injection.
  */

  const STORAGE_PREFIX = "redhub.nav.page.collapsed.";
  const MANUAL_PAUSE_MS = 5000;

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
      return Array.from(item.children).find(function (child) {
        return child.matches && child.matches(selector);
      }) || null;
    }
  }

  function markManualSidebarUse() {
    manualSidebarUntil = Date.now() + MANUAL_PAUSE_MS;
  }

  function sidebarIsManuallyControlled() {
    return Date.now() < manualSidebarUntil;
  }

  /* -------------------------------------------------------------------------
     Active ToC follow
     ------------------------------------------------------------------------- */

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

    /*
      Critical behavior:
      If the user is scrolling the left sidebar, do not yank it back to the
      active heading. Main content and scrollspy state remain unchanged.
    */
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

    /*
      Tuned values:
      - Higher top threshold makes the sidebar start correcting earlier.
      - Higher bottom threshold prevents the active item from disappearing
        near the bottom edge before auto-scroll starts.
    */
    const visibleTop = Math.max(wrapRect.top, 0) + 150;
    const visibleBottom = Math.min(wrapRect.bottom, window.innerHeight) - 160;

    const inView =
      linkRect.top >= visibleTop &&
      linkRect.bottom <= visibleBottom;

    if (!force && href === lastActiveHref && inView) {
      return;
    }

    lastActiveHref = href;

    if (!force && inView) {
      return;
    }

    /*
      0.25 means the active item is kept around 25% from the top of the
      sidebar viewport instead of the previous 35%, so the highlight remains
      visible earlier/higher.
    */
    const delta =
      linkRect.top -
      wrapRect.top -
      wrap.clientHeight * 0.25 +
      linkRect.height / 2;

    wrap.scrollBy({
      top: delta,
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

    /*
      Manual sidebar interaction pause.
      This prevents the sidebar from jumping back up while the user scrolls it
      by wheel, touchpad, dragging scrollbar, mouse, or touch.
    */
    ["wheel", "touchstart", "pointerdown", "mousedown", "scroll"].forEach(function (eventName) {
      wrap.addEventListener(eventName, markManualSidebarUse, { passive: true });
    });

    if (followObserver) {
      followObserver.disconnect();
    }

    followObserver = new MutationObserver(function () {
      scheduleFollow(true);
    });

    followObserver.observe(sidebar, {
      subtree: true,
      attributes: true,
      attributeFilter: ["class", "aria-current"]
    });

    window.addEventListener("scroll", function () {
      scheduleFollow(false);
    }, { passive: true });

    window.addEventListener("resize", function () {
      scheduleFollow(true);
    }, { passive: true });

    window.addEventListener("hashchange", function () {
      setTimeout(function () {
        scheduleFollow(true);
      }, 50);

      setTimeout(function () {
        scheduleFollow(true);
      }, 250);
    });

    /*
      No setInterval here. Polling was the reason the sidebar kept fighting
      manual scrolling and moving back to the active item.
    */
    setTimeout(function () {
      scheduleFollow(true);
    }, 300);
  }

  /* -------------------------------------------------------------------------
     Page-level collapsible navigation
     ------------------------------------------------------------------------- */

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
      const nested = directChild(item, ".md-nav") || directChild(item, ".md-nav__list");

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
    button.setAttribute("title", collapsed ? "Show page contents" : "Hide page contents");
  }

  function removeOldMainSectionToggles() {
    document.querySelectorAll(".rh-section-toggle").forEach(function (button) {
      button.remove();
    });

    document.querySelectorAll(".rh-collapsible-section, .rh-section-collapsed").forEach(function (item) {
      item.classList.remove("rh-collapsible-section", "rh-section-collapsed");
    });
  }

  function addPageToggle(item, index) {
    if (item.classList.contains("rh-collapsible-page")) {
      return;
    }

    const link = directChild(item, ".md-nav__link");
    const nested = directChild(item, ".md-nav") || directChild(item, ".md-nav__list");

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

    console.info("RedHub sidebar tools loaded - manual sidebar scroll preserved");
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