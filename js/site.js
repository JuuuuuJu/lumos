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

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function renderPostList(posts) {
    var postList = document.getElementById("postList");
    if (!postList || !Array.isArray(posts) || !posts.length) return;
    postList.innerHTML = posts.map(function (post) {
      var tags = (post.tags || []).map(function (tag) {
        return "<span>" + escapeHtml(tag) + "</span>";
      }).join("");
      var coverStyle = post.cover ? " style=\"background-image:linear-gradient(rgba(0,0,0,.24),rgba(0,0,0,.24)),url('" + escapeHtml(post.cover) + "')\"" : "";
      return "<article class=\"item show\">" +
        "<div class=\"cover\"><a href=\"" + escapeHtml(post.url) + "\"><span class=\"post-cover " + escapeHtml(post.coverClass || "") + "\"" + coverStyle + ">" + escapeHtml(post.coverLabel || post.category || "文章") + "</span></a></div>" +
        "<div class=\"info\">" +
        "<div class=\"meta\"><span class=\"item\"><span class=\"icon\"><i class=\"ic i-calendar\"></i></span><time datetime=\"" + escapeHtml(post.date) + "\">" + escapeHtml(post.date) + "</time></span><span class=\"item\"><span class=\"icon\"><i class=\"ic i-flag\"></i></span><span>" + escapeHtml(post.category) + "</span></span></div>" +
        "<h3><a href=\"" + escapeHtml(post.url) + "\">" + escapeHtml(post.title) + "</a></h3>" +
        "<div class=\"excerpt\">" + escapeHtml(post.excerpt) + "</div>" +
        "<div class=\"tag-list\">" + tags + "</div>" +
        "<a href=\"" + escapeHtml(post.url) + "\" class=\"btn\">more...</a>" +
        "</div>" +
        "</article>";
    }).join("");
  }

  fetch("data/posts.json", { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("posts.json not found");
      return response.json();
    })
    .then(renderPostList)
    .catch(function () {});

  if (navToggle) navToggle.addEventListener("click", toggleSidebar);
  if (dimmer) dimmer.addEventListener("click", toggleSidebar);
})();
