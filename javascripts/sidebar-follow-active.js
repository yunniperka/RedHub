(function () {
  "use strict";

  const STORAGE_PREFIX = "redhub.nav.page.collapsed.";
  const GENERATED_NAV_CLASS = "rh-generated-nav";
  const GENERATED_HEADING_CLASS = "rh-generated-heading";
  const LOADED_CLASS = "rh-page-headings-loaded";
  const LOADING_CLASS = "rh-page-headings-loading";

  const MANUAL_PAUSE_MS = 3500;
  const SAFE_ZONE_TOP_RATIO = 0.28;
  const SAFE_ZONE_BOTTOM_RATIO = 0.58;
  const TARGET_RATIO = 0.22;

  const headingCache = new Map();

  let followRaf = null;
  let navRaf = null;
  let lastActiveHref = null;
  let manualSidebarUntil = 0;
  let navObserver = null;
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

  function rootPrimaryList() {
    return document.querySelector(
      ".md-sidebar--primary .md-nav--primary > .md-nav__list"
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

    setTimeout(function () {
      scheduleFollow(true);
    }, 300);
  }

  function observeNav() {
    const sidebar = primarySidebar();

    if (!sidebar || !navObserver) {
      return;
    }

    navObserver.disconnect();

    navObserver.observe(sidebar, {
      childList: true,
      subtree: true
    });
  }

  function mutateNav(callback) {
    if (navObserver) {
      navObserver.disconnect();
    }

    try {
      callback();
    } finally {
      observeNav();
    }
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

  function isRealPageLink(link) {
    const href = (link.getAttribute("href") || "").trim();

    if (!href || href === "#" || href.startsWith("#")) {
      return false;
    }

    if (href.includes("#")) {
      return false;
    }

    if (/^(javascript:|mailto:|tel:)/i.test(href)) {
      return false;
    }

    if (link.closest("." + GENERATED_NAV_CLASS)) {
      return false;
    }

    if (link.closest(".md-nav--secondary")) {
      return false;
    }

    return true;
  }

  function pageEntries() {
    const sidebar = primarySidebar();
    const rootList = rootPrimaryList();

    if (!sidebar || !rootList) {
      return [];
    }

    return Array.from(
      rootList.querySelectorAll(".md-nav__item")
    )
      .filter(function (item) {
        if (item.classList.contains(GENERATED_HEADING_CLASS)) {
          return false;
        }

        return depthFromRootList(item, rootList) === 1;
      })
      .map(function (item) {
        return {
          item: item,
          link: directChild(item, ".md-nav__link[href]")
        };
      })
      .filter(function (entry) {
        return entry.item && entry.link && isRealPageLink(entry.link);
      });
  }

  function pageUrl(link) {
    const url = new URL(link.getAttribute("href"), window.location.href);
    url.hash = "";
    return url;
  }

  function pageStorageKey(link) {
    return STORAGE_PREFIX + pageUrl(link).href;
  }

  function isActivePage(item, link) {
    return (
      item.classList.contains("md-nav__item--active") ||
      link.classList.contains("md-nav__link--active") ||
      link.getAttribute("aria-current") === "page"
    );
  }

  function nativeNestedNav(item) {
    return Array.from(item.children).find(function (child) {
      if (!child.matches) {
        return false;
      }

      if (child.matches(".md-nav") && !child.classList.contains(GENERATED_NAV_CLASS)) {
        return true;
      }

      return child.matches(".md-nav__list");
    }) || null;
  }

  function generatedNav(item) {
    return directChild(item, "." + GENERATED_NAV_CLASS);
  }

  function cleanHeadingText(heading) {
    return heading.textContent.trim().replace(/\s+/g, " ");
  }

  function extractHeadings(doc) {
    return Array.from(
      doc.querySelectorAll(
        ".md-content .md-typeset h2[id], .md-content .md-typeset h3[id]"
      )
    )
      .filter(function (heading) {
        return cleanHeadingText(heading).length > 0;
      })
      .map(function (heading) {
        return {
          id: heading.id,
          text: cleanHeadingText(heading),
          level: heading.tagName.toLowerCase()
        };
      });
  }

  function createGeneratedNav(link, headings) {
    const baseUrl = pageUrl(link);
    const nav = document.createElement("nav");
    const list = document.createElement("ul");

    nav.className = "md-nav " + GENERATED_NAV_CLASS;
    list.className = "md-nav__list";

    headings.forEach(function (heading) {
      const item = document.createElement("li");
      const anchor = document.createElement("a");
      const headingUrl = new URL(baseUrl.href);

      headingUrl.hash = heading.id;

      item.className =
        "md-nav__item " +
        GENERATED_HEADING_CLASS +
        " rh-heading-" +
        heading.level;

      anchor.className = "md-nav__link";
      anchor.href = headingUrl.href;
      anchor.textContent = heading.text;

      item.appendChild(anchor);
      list.appendChild(item);
    });

    nav.appendChild(list);

    return nav;
  }

  async function loadHeadings(item, link) {
    if (item.classList.contains(LOADED_CLASS)) {
      return;
    }

    if (item.classList.contains(LOADING_CLASS)) {
      return;
    }

    if (nativeNestedNav(item)) {
      item.classList.add(LOADED_CLASS);
      return;
    }

    if (generatedNav(item)) {
      item.classList.add(LOADED_CLASS);
      return;
    }

    const url = pageUrl(link);

    if (url.origin !== window.location.origin) {
      return;
    }

    item.classList.add(LOADING_CLASS);

    try {
      let headings;

      if (headingCache.has(url.href)) {
        headings = headingCache.get(url.href);
      } else {
        const response = await fetch(url.href, {
          credentials: "same-origin"
        });

        if (!response.ok) {
          throw new Error("HTTP " + response.status);
        }

        const html = await response.text();
        const doc = new DOMParser().parseFromString(html, "text/html");

        headings = extractHeadings(doc);
        headingCache.set(url.href, headings);
      }

      if (headings.length > 0 && !nativeNestedNav(item) && !generatedNav(item)) {
        mutateNav(function () {
          item.appendChild(createGeneratedNav(link, headings));
        });
      }

      item.classList.add(LOADED_CLASS);
    } catch (error) {
      console.warn("RedHub could not load page headings:", link.href, error);
    } finally {
      item.classList.remove(LOADING_CLASS);
    }
  }

  function setCollapsed(item, button, collapsed) {
    item.classList.toggle("rh-page-collapsed", collapsed);
    button.setAttribute("aria-expanded", collapsed ? "false" : "true");
    button.setAttribute("title", collapsed ? "Show page contents" : "Hide page contents");
  }

  function removeInvalidControls(validItems) {
    document.querySelectorAll(".rh-section-toggle").forEach(function (button) {
      button.remove();
    });

    document
      .querySelectorAll(".rh-collapsible-section, .rh-section-collapsed")
      .forEach(function (item) {
        item.classList.remove("rh-collapsible-section", "rh-section-collapsed");
      });

    document.querySelectorAll("." + GENERATED_NAV_CLASS + " .rh-page-toggle").forEach(function (button) {
      button.remove();
    });

    document.querySelectorAll("." + GENERATED_HEADING_CLASS).forEach(function (item) {
      const button = directChild(item, ".rh-page-toggle");

      if (button) {
        button.remove();
      }

      item.classList.remove(
        "rh-collapsible-page",
        "rh-page-collapsed",
        LOADED_CLASS,
        LOADING_CLASS
      );
    });

    document.querySelectorAll(".rh-collapsible-page").forEach(function (item) {
      if (validItems.has(item)) {
        return;
      }

      const button = directChild(item, ".rh-page-toggle");

      if (button) {
        button.remove();
      }

      item.classList.remove(
        "rh-collapsible-page",
        "rh-page-collapsed",
        LOADED_CLASS,
        LOADING_CLASS
      );
    });
  }

  function removeOldGeneratedNavs() {
    document.querySelectorAll("." + GENERATED_NAV_CLASS).forEach(function (nav) {
      nav.remove();
    });

    document.querySelectorAll("." + LOADED_CLASS).forEach(function (item) {
      item.classList.remove(LOADED_CLASS);
    });

    document.querySelectorAll("." + LOADING_CLASS).forEach(function (item) {
      item.classList.remove(LOADING_CLASS);
    });
  }

  function addPageToggle(entry) {
    const item = entry.item;
    const link = entry.link;

    item.classList.add("rh-collapsible-page");

    let button = directChild(item, ".rh-page-toggle");

    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.className = "rh-page-toggle";
      button.setAttribute("aria-label", "Toggle page contents");

      item.insertBefore(button, link);
    }

    const saved = localStorage.getItem(pageStorageKey(link));
    let collapsed;

    if (saved === "0" || saved === "1") {
      collapsed = saved === "1";
    } else {
      collapsed = !isActivePage(item, link);
    }

    setCollapsed(item, button, collapsed);

    if (!collapsed) {
      loadHeadings(item, link);
    }

    if (button.dataset.rhBound === "1") {
      return;
    }

    button.dataset.rhBound = "1";

    button.addEventListener("click", function (event) {
      event.preventDefault();
      event.stopPropagation();

      const nextCollapsed = !item.classList.contains("rh-page-collapsed");

      localStorage.setItem(pageStorageKey(link), nextCollapsed ? "1" : "0");
      setCollapsed(item, button, nextCollapsed);

      if (!nextCollapsed) {
        loadHeadings(item, link);
      }

      markManualSidebarUse();
    });
  }

  function refreshPageToggles() {
    navRaf = null;

    const entries = pageEntries();
    const validItems = new Set(entries.map(function (entry) {
      return entry.item;
    }));

    mutateNav(function () {
      removeInvalidControls(validItems);

      entries.forEach(function (entry) {
        addPageToggle(entry);
      });
    });

    console.info(
      "RedHub page toggles:",
      document.querySelectorAll(".rh-page-toggle").length
    );
  }

  function scheduleNavRefresh() {
    if (navRaf !== null) {
      return;
    }

    navRaf = requestAnimationFrame(refreshPageToggles);
  }

  function initPageCollapsibleNav() {
    const sidebar = primarySidebar();

    if (!sidebar) {
      return;
    }

    if (navObserver) {
      navObserver.disconnect();
    }

    navObserver = new MutationObserver(scheduleNavRefresh);

    mutateNav(function () {
      removeOldGeneratedNavs();
    });

    refreshPageToggles();
    observeNav();
  }

  function init() {
    initSidebarFollow();
    initPageCollapsibleNav();

    console.info("RedHub sidebar tools loaded");
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