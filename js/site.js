(function () {
  var root = document.documentElement;
  var currentScript = document.currentScript || document.querySelector("script[src$='site.js']");
  var siteRoot = new URL("../", currentScript ? currentScript.src : window.location.href);
  var themeButton = document.querySelector(".theme");
  var quickUp = document.querySelector("#quick .up");
  var quickDown = document.querySelector("#quick .down");
  var navToggle = document.querySelector("#nav .toggle");
  var sidebar = document.querySelector("#sidebar");
  var dimmer = document.querySelector(".dimmer");
  var categoryPaths = {
    "程式筆記": "categories/code/",
    "Code Notes": "categories/code/",
    "文學": "categories/literature/",
    "隨筆": "categories/essay/",
    "作品集": "categories/projects/",
    "Projects": "categories/projects/",
    "生活紀錄": "categories/journal/",
    "Journal": "categories/journal/"
  };

  document.body.classList.add("loaded");

  document.querySelectorAll("[data-background-image]").forEach(function (el) {
    el.style.backgroundImage = "url('" + el.getAttribute("data-background-image") + "')";
    el.classList.add("lozaded");
  });

  function siteUrl(path) {
    return new URL(String(path || "").replace(/^\/+/, ""), siteRoot).href;
  }

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function unique(values) {
    return Array.from(new Set(values.filter(Boolean)));
  }

  function categoryUrl(category) {
    return siteUrl(categoryPaths[category] || ("categories/?category=" + encodeURIComponent(category)));
  }

  function tagUrl(tag) {
    return siteUrl("tags/?tag=" + encodeURIComponent(tag));
  }

  function fallbackCoverFor(category, coverClass) {
    var key = String(coverClass || category || "").toLowerCase();
    if (key.indexOf("code") !== -1 || key.indexOf("程式") !== -1) return "images/covers/cover-code.jpg";
    if (key.indexOf("project") !== -1 || key.indexOf("作品") !== -1) return "images/covers/cover-projects.jpg";
    if (key.indexOf("life") !== -1 || key.indexOf("journal") !== -1 || key.indexOf("生活") !== -1 || key.indexOf("紀錄") !== -1) return "images/covers/cover-journal.jpg";
    if (key.indexOf("literature") !== -1 || key.indexOf("文") !== -1 || key.indexOf("詩") !== -1 || key.indexOf("對聯") !== -1) return "images/covers/cover-literature.jpg";
    return "images/covers/cover-essay.jpg";
  }

  function initPostHeroFallback() {
    var hero = document.querySelector(".post-full-hero[data-post-cover]");
    if (!hero) return;
    var cover = hero.getAttribute("data-post-cover");
    var fallback = fallbackCoverFor(hero.getAttribute("data-category"), hero.getAttribute("data-cover-class"));
    hero.style.setProperty("--post-fallback-cover", "url('" + siteUrl(fallback) + "')");
    if (!cover) {
      hero.classList.add("is-fallback");
      return;
    }
    var img = new Image();
    img.onload = function () {
      hero.classList.remove("is-fallback");
    };
    img.onerror = function () {
      hero.classList.add("is-fallback");
    };
    img.src = siteUrl(cover);
  }

  function tagList(tags) {
    return (tags || []).map(function (tag) {
      return "<a href=\"" + tagUrl(tag) + "\">" + escapeHtml(tag) + "</a>";
    }).join("");
  }

  function coverStyle(post) {
    if (!post.cover) return "";
    return " style=\"background-image:linear-gradient(rgba(0,0,0,.08),rgba(0,0,0,.08)),url('" + siteUrl(post.cover) + "')\"";
  }

  function postCard(post) {
    return "<article class=\"item show archive-card\">" +
      "<div class=\"cover\"><a href=\"" + siteUrl(post.url) + "\"><span class=\"post-cover " + escapeHtml(post.coverClass || "") + "\"" + coverStyle(post) + ">" + escapeHtml(post.coverLabel || post.category || "文章") + "</span></a></div>" +
      "<div class=\"info\">" +
      "<div class=\"meta\"><span class=\"item\"><span class=\"icon\"><i class=\"ic i-calendar\"></i></span><time datetime=\"" + escapeHtml(post.date) + "\">" + escapeHtml(post.date) + "</time></span><a class=\"item\" href=\"" + categoryUrl(post.category) + "\"><span class=\"icon\"><i class=\"ic i-flag\"></i></span><span>" + escapeHtml(post.category) + "</span></a></div>" +
      "<h3><a href=\"" + siteUrl(post.url) + "\">" + escapeHtml(post.title) + "</a></h3>" +
      "<div class=\"excerpt\">" + escapeHtml(post.excerpt) + "</div>" +
      "<div class=\"tag-list\">" + tagList(post.tags) + "</div>" +
      "<a href=\"" + siteUrl(post.url) + "\" class=\"read-more\">more...</a>" +
      "</div>" +
      "</article>";
  }

  function renderPostList(posts, target) {
    var postList = target || document.getElementById("postList");
    if (!postList || !Array.isArray(posts)) return;
    if (!posts.length) {
      postList.innerHTML = "<div class=\"empty-state\">這裡還沒有文章。</div>";
      return;
    }
    postList.innerHTML = posts.map(postCard).join("");
  }

  function renderArchive(posts, container) {
    var search = container.querySelector("[data-archive-search]");
    var list = container.querySelector("[data-archive-list]");
    var title = container.dataset.title || "文章列表";
    var view = container.dataset.view;
    var selectedCategory = container.dataset.category || "";
    var urlParams = new URLSearchParams(window.location.search);
    var selectedTag = container.dataset.tag || urlParams.get("tag") || "";
    var queryCategory = urlParams.get("category");
    if (queryCategory) selectedCategory = queryCategory;

    function matches(post, keyword) {
      var text = [post.title, post.category, post.excerpt].concat(post.tags || []).join(" ").toLowerCase();
      return text.indexOf(keyword.toLowerCase()) !== -1;
    }

    function applyFilter() {
      var keyword = search ? search.value.trim() : "";
      var filtered = posts.slice();
      if (view === "category" && selectedCategory) {
        filtered = filtered.filter(function (post) { return post.category === selectedCategory; });
      }
      if (view === "tag" && selectedTag) {
        filtered = filtered.filter(function (post) { return (post.tags || []).indexOf(selectedTag) !== -1; });
      }
      if (keyword) filtered = filtered.filter(function (post) { return matches(post, keyword); });
      renderPostList(filtered, list);
      var count = container.querySelector("[data-result-count]");
      if (count) count.textContent = filtered.length + " 篇";
    }

    var titleEl = container.querySelector("[data-page-title]");
    if (titleEl) titleEl.textContent = selectedTag || selectedCategory || title;
    if (search) search.addEventListener("input", applyFilter);
    applyFilter();
  }

  function renderTags(posts, container) {
    var urlParams = new URLSearchParams(window.location.search);
    var selected = urlParams.get("tag") || "";
    var tags = unique(posts.flatMap(function (post) { return post.tags || []; })).sort();
    var cloud = container.querySelector("[data-tag-cloud]");
    var list = container.querySelector("[data-archive-list]");
    var title = container.querySelector("[data-page-title]");
    if (title) title.textContent = selected ? ("標籤：" + selected) : "全部標籤";
    if (cloud) {
      cloud.innerHTML = tags.map(function (tag) {
        var count = posts.filter(function (post) { return (post.tags || []).indexOf(tag) !== -1; }).length;
        return "<a class=\"" + (tag === selected ? "active" : "") + "\" href=\"" + tagUrl(tag) + "\">" + escapeHtml(tag) + "<span>" + count + "</span></a>";
      }).join("");
    }
    renderPostList(selected ? posts.filter(function (post) {
      return (post.tags || []).indexOf(selected) !== -1;
    }) : posts, list);
  }

  function updateCounts(posts) {
    var categories = unique(posts.map(function (post) { return post.category; }));
    var tags = unique(posts.flatMap(function (post) { return post.tags || []; }));
    var postCount = document.querySelector(".state .posts .count");
    var categoryCount = document.querySelector(".state .categories .count");
    var tagCount = document.querySelector(".state .tags .count");
    if (postCount) postCount.textContent = posts.length;
    if (categoryCount) categoryCount.textContent = categories.length;
    if (tagCount) tagCount.textContent = tags.length;
  }

  function updateSectionCards(posts) {
    document.querySelectorAll("[data-card-category]").forEach(function (card) {
      var category = card.getAttribute("data-card-category");
      var latest = posts.filter(function (post) { return post.category === category; }).slice(0, 3);
      var list = card.querySelector("[data-card-posts]");
      var count = card.querySelector("[data-card-count]");
      if (count) count.textContent = latest.length ? latest.length + " 篇文章" : "準備放內容";
      if (list) {
        list.innerHTML = latest.length ? latest.map(function (post) {
          return "<li><a href=\"" + siteUrl(post.url) + "\">" + escapeHtml(post.title) + "</a></li>";
        }).join("") : "<li>內容規劃中</li>";
      }
    });
  }

  function bootPosts(posts) {
    updateCounts(posts);
    updateSectionCards(posts);

    var homeList = document.getElementById("postList");
    if (homeList) renderPostList(posts, homeList);

    var archive = document.querySelector("[data-view='archive'], [data-view='category'], [data-view='tag']");
    if (archive) renderArchive(posts, archive);

    var tags = document.querySelector("[data-view='tags']");
    if (tags) renderTags(posts, tags);
  }

  fetch(siteUrl("data/posts.json"), { cache: "no-store" })
    .then(function (response) {
      if (!response.ok) throw new Error("posts.json not found");
      return response.json();
    })
    .then(bootPosts)
    .catch(function (error) {
      var postList = document.getElementById("postList") || document.querySelector("[data-archive-list]");
      if (postList) postList.innerHTML = "<div class=\"empty-state\">讀取文章資料失敗：" + escapeHtml(error.message) + "</div>";
    });

  initPostHeroFallback();

  if (/\/posts\/[^/]+\//.test(window.location.pathname) || document.querySelector("[data-view='wish']")) {
    var communityScript = document.createElement("script");
    communityScript.src = siteUrl("js/community.js?v=1.6");
    communityScript.defer = true;
    document.body.appendChild(communityScript);
  }

  if (themeButton) {
    themeButton.addEventListener("click", function () {
      var isDark = root.getAttribute("data-theme") === "dark";
      root.setAttribute("data-theme", isDark ? "" : "dark");
      themeButton.querySelector(".ic").className = isDark ? "ic i-sun" : "ic i-moon";
    });
  }

  if (quickUp) quickUp.addEventListener("click", function () { window.scrollTo({ top: 0, behavior: "smooth" }); });
  if (quickDown) quickDown.addEventListener("click", function () { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); });

  function toggleSidebar() {
    if (!sidebar || !navToggle) return;
    sidebar.classList.toggle("on");
    navToggle.classList.toggle("close");
  }

  if (navToggle) navToggle.addEventListener("click", toggleSidebar);
  if (dimmer) dimmer.addEventListener("click", toggleSidebar);

  function initZrnFireworks() {
    var animeRef = window.anime;
    if (!animeRef || document.querySelector(".lumos-fireworks-canvas")) return;
    var canvas = document.createElement("canvas");
    canvas.className = "lumos-fireworks-canvas";
    canvas.style.cssText = "position:fixed;top:0;left:0;pointer-events:none;z-index:9999999";
    document.body.appendChild(canvas);
    var context = canvas.getContext("2d");
    var particleCount = 30;
    var mouseX = 0;
    var mouseY = 0;
    var colors = [
      "rgba(135,206,250,.9)",
      "rgba(240,255,255,.9)",
      "rgba(187,222,214,.9)",
      "rgba(138,198,209,.9)"
    ];

    function resizeCanvas() {
      canvas.width = 2 * window.innerWidth;
      canvas.height = 2 * window.innerHeight;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      context.setTransform(2, 0, 0, 2, 0, 0);
    }

    function setClickPosition(event) {
      mouseX = event.clientX || event.touches && event.touches[0].clientX;
      mouseY = event.clientY || event.touches && event.touches[0].clientY;
    }

    function endPosition(particle) {
      var angle = animeRef.random(0, 360) * Math.PI / 180;
      var distance = animeRef.random(50, 180);
      var signedDistance = [-1, 1][animeRef.random(0, 1)] * distance;
      return {
        x: particle.x + signedDistance * Math.cos(angle),
        y: particle.y + signedDistance * Math.sin(angle)
      };
    }

    function createCircle(x, y) {
      var circle = {};
      circle.x = x;
      circle.y = y;
      circle.color = colors[animeRef.random(0, colors.length - 1)];
      circle.radius = animeRef.random(16, 32);
      circle.endPos = endPosition(circle);
      circle.draw = function () {
        context.beginPath();
        context.arc(circle.x, circle.y, circle.radius, 0, 2 * Math.PI, true);
        context.fillStyle = circle.color;
        context.fill();
      };
      return circle;
    }

    function createRing(x, y) {
      var ring = {};
      ring.x = x;
      ring.y = y;
      ring.color = "#FFF";
      ring.radius = .1;
      ring.alpha = .5;
      ring.lineWidth = 6;
      ring.draw = function () {
        context.globalAlpha = ring.alpha;
        context.beginPath();
        context.arc(ring.x, ring.y, ring.radius, 0, 2 * Math.PI, true);
        context.lineWidth = ring.lineWidth;
        context.strokeStyle = ring.color;
        context.stroke();
        context.globalAlpha = 1;
      };
      return ring;
    }

    function drawParticles(animation) {
      for (var i = 0; i < animation.animatables.length; i += 1) {
        animation.animatables[i].target.draw();
      }
    }

    function animateFireworks(x, y) {
      var ring = createRing(x, y);
      var particles = [];
      for (var i = 0; i < particleCount; i += 1) particles.push(createCircle(x, y));
      animeRef.timeline().add({
        targets: particles,
        x: function (particle) { return particle.endPos.x; },
        y: function (particle) { return particle.endPos.y; },
        radius: .1,
        duration: animeRef.random(1200, 1800),
        easing: "easeOutExpo",
        update: drawParticles
      }).add({
        targets: ring,
        radius: animeRef.random(80, 160),
        lineWidth: 0,
        alpha: { value: 0, easing: "linear", duration: animeRef.random(600, 800) },
        duration: animeRef.random(1200, 1800),
        easing: "easeOutExpo",
        update: drawParticles
      }, 0);
    }

    var cleaner = animeRef({
      duration: Infinity,
      update: function () {
        context.clearRect(0, 0, canvas.width, canvas.height);
      }
    });

    document.addEventListener("click", function (event) {
      cleaner.play();
      setClickPosition(event);
      animateFireworks(mouseX, mouseY);
    }, false);
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas, false);
  }

  function loadAnimeThenFireworks() {
    if (window.anime) {
      initZrnFireworks();
      return;
    }
    var script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/animejs@3.2.0/lib/anime.min.js";
    script.onload = initZrnFireworks;
    document.head.appendChild(script);
  }

  loadAnimeThenFireworks();
})();







