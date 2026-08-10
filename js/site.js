(function () {
  var root = document.documentElement;
  var themeButton = document.querySelector(".theme");
  var quickUp = document.querySelector("#quick .up");
  var quickDown = document.querySelector("#quick .down");
  var navToggle = document.querySelector("#nav .toggle");
  var sidebar = document.querySelector("#sidebar");
  var dimmer = document.querySelector(".dimmer");

  document.body.classList.add("loaded");

  document.querySelectorAll("[data-background-image]").forEach(function (el) {
    el.style.backgroundImage = "url('" + el.getAttribute("data-background-image") + "')";
    el.classList.add("lozaded");
  });

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var isDark = root.getAttribute("data-theme") === "dark";
      root.setAttribute("data-theme", isDark ? "" : "dark");
      themeButton.querySelector(".ic").className = isDark ? "ic i-sun" : "ic i-moon";
    });
  }

  if (quickUp) {
    quickUp.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  if (quickDown) {
    quickDown.addEventListener("click", function () {
      window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    });
  }

  function toggleSidebar() {
    if (!sidebar || !navToggle) return;
    sidebar.classList.toggle("on");
    navToggle.classList.toggle("close");
  }

  if (navToggle) navToggle.addEventListener("click", toggleSidebar);
  if (dimmer) dimmer.addEventListener("click", toggleSidebar);
})();
