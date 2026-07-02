(function () {
  "use strict";

  const STORAGE_PREFIX = "redhub.checklist.";

  function pageKey() {
    const url = new URL(window.location.href);
    url.hash = "";
    url.search = "";

    return url.origin + url.pathname;
  }

  function normalizeText(text) {
    return text.trim().replace(/\s+/g, " ").slice(0, 120);
  }

  function checkboxLabel(checkbox) {
    const item = checkbox.closest("li") || checkbox.parentElement;

    if (!item) {
      return "";
    }

    return normalizeText(item.textContent || "");
  }

  function checkboxKey(checkbox, index) {
    const label = checkboxLabel(checkbox);

    return [
      STORAGE_PREFIX,
      pageKey(),
      ".",
      index,
      ".",
      label
    ].join("");
  }

  function contentCheckboxes() {
    return Array.from(
      document.querySelectorAll(
        ".md-content .md-typeset input[type='checkbox']"
      )
    );
  }

  function restoreCheckboxState(checkbox, key) {
    const saved = localStorage.getItem(key);

    if (saved === "1") {
      checkbox.checked = true;
    }

    if (saved === "0") {
      checkbox.checked = false;
    }
  }

  function saveCheckboxState(checkbox, key) {
    localStorage.setItem(key, checkbox.checked ? "1" : "0");
  }

  function makeCheckboxUsable(checkbox) {
    checkbox.disabled = false;
    checkbox.removeAttribute("disabled");
  }

  function bindCheckbox(checkbox, index) {
    if (checkbox.dataset.rhChecklistBound === "1") {
      return;
    }

    const key = checkboxKey(checkbox, index);

    checkbox.dataset.rhChecklistBound = "1";
    checkbox.dataset.rhChecklistKey = key;

    makeCheckboxUsable(checkbox);
    restoreCheckboxState(checkbox, key);

    checkbox.addEventListener("change", function () {
      saveCheckboxState(checkbox, key);
    });
  }

  function initChecklistState() {
    contentCheckboxes().forEach(function (checkbox, index) {
      bindCheckbox(checkbox, index);
    });
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(initChecklistState, 100);
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initChecklistState);
  } else {
    initChecklistState();
  }
})();