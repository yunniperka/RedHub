(function () {
  "use strict";

  const BUTTON_ID = "rh-page-up";
  const SHOW_AFTER_PX = 350;

  function pageUpButton() {
    return document.getElementById(BUTTON_ID);
  }

  function createPageUpButton() {
    let button = pageUpButton();

    if (button) {
      return button;
    }

    button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.setAttribute("aria-label", "Back to top");
    button.setAttribute("title", "Back to top");
    button.innerHTML = "↑";

    button.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: "smooth"
      });
    });

    document.body.appendChild(button);

    return button;
  }

  function updatePageUpButton() {
    const button = pageUpButton();

    if (!button) {
      return;
    }

    button.classList.toggle("rh-page-up-visible", window.scrollY > SHOW_AFTER_PX);
  }

  function initPageUpButton() {
    createPageUpButton();
    updatePageUpButton();

    window.removeEventListener("scroll", updatePageUpButton);
    window.addEventListener("scroll", updatePageUpButton, { passive: true });
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(initPageUpButton, 100);
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initPageUpButton);
  } else {
    initPageUpButton();
  }
})();