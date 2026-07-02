(function () {
  "use strict";

  function initRunawayBat() {
    var search = document.querySelector(".md-search");
    var headerInner = document.querySelector(".md-header__inner");

    if (!search || !headerInner) {
      return;
    }

    var existing = document.getElementById("runaway-pixel-bat");
    if (existing) {
      existing.remove();
    }

    var minX = 240;
    var batCont = document.createElement("div");
    batCont.id = "runaway-pixel-bat";
    batCont.className = "go-right";
    batCont.style.position = "absolute";
    batCont.style.left = minX + "px";
    batCont.style.top = "2px";
    batCont.style.width = "70px";
    batCont.style.height = "50px";
    batCont.style.cursor = "default";
    batCont.style.zIndex = "9999";
    batCont.style.userSelect = "none";

    headerInner.appendChild(batCont);

    batCont.addEventListener("mouseenter", function () {
      var searchRect = search.getBoundingClientRect();
      var headerRect = headerInner.getBoundingClientRect();

      var maxX = searchRect.left - headerRect.left - 110;
      if (maxX <= minX) {
        maxX = minX + 100;
      }

      var randomX = Math.floor(Math.random() * (maxX - minX)) + minX;
      var randomY = Math.floor(Math.random() * 10) - 5;
      var currentX = batCont.offsetLeft;

      if (randomX < currentX) {
        batCont.classList.remove("go-right");
        batCont.classList.add("go-left");
      } else {
        batCont.classList.remove("go-left");
        batCont.classList.add("go-right");
      }

      batCont.style.left = randomX + "px";
      batCont.style.top = randomY + "px";
    });
  }

  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(initRunawayBat, 150);
    });
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initRunawayBat);
  } else {
    initRunawayBat();
  }
})();
