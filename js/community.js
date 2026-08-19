(function () {
  var currentScript = document.currentScript || document.querySelector("script[src$='community.js']");
  var siteRoot = new URL("../", currentScript ? currentScript.src : window.location.href);
  var CONFIG_PATH = "data/community-config.json";
  var COMMENTER_ID_KEY = "lumos-commenter-id";
  var COMMENTER_NAME_KEY = "lumos-commenter-name";
  var COMMENTER_PROFILE_KEY = "lumos-commenter-profile";
  var LOCAL_COMMENTS_KEY = "lumos-local-comments";
  var LOCAL_WISHES_KEY = "lumos-local-wishes";

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

  function readJson(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (error) {
      return [];
    }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function uuid() {
    if (crypto.randomUUID) return crypto.randomUUID();
    return "id-" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function sha256(value) {
    var bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
    return Array.from(new Uint8Array(bytes)).map(function (byte) {
      return byte.toString(16).padStart(2, "0");
    }).join("");
  }

  function getVisitorKey() {
    var key = localStorage.getItem(COMMENTER_ID_KEY);
    if (!key) {
      key = uuid();
      localStorage.setItem(COMMENTER_ID_KEY, key);
    }
    return key;
  }

  function getCommenterProfile() {
    var profile = {};
    try {
      profile = JSON.parse(localStorage.getItem(COMMENTER_PROFILE_KEY) || "{}");
    } catch (error) {
      profile = {};
    }
    if (!profile.visitorKey) profile.visitorKey = getVisitorKey();
    if (!profile.createdAt) profile.createdAt = new Date().toISOString();
    if (!profile.nickname && localStorage.getItem(COMMENTER_NAME_KEY)) {
      profile.nickname = localStorage.getItem(COMMENTER_NAME_KEY);
    }
    localStorage.setItem(COMMENTER_PROFILE_KEY, JSON.stringify(profile));
    return profile;
  }

  function saveCommenterProfile(profile) {
    localStorage.setItem(COMMENTER_ID_KEY, profile.visitorKey);
    localStorage.setItem(COMMENTER_NAME_KEY, profile.nickname);
    localStorage.setItem(COMMENTER_PROFILE_KEY, JSON.stringify(profile));
  }

  async function loadConfig() {
    var fallback = { backend: "local", siteId: "lumos", endpoint: "", notice: "" };
    try {
      var response = await fetch(siteUrl(CONFIG_PATH), { cache: "no-store" });
      if (!response.ok) return fallback;
      return Object.assign(fallback, await response.json());
    } catch (error) {
      return fallback;
    }
  }

  function endpoint(config, path) {
    return String(config.endpoint || "").replace(/\/+$/, "") + path;
  }

  async function requestJson(url, options) {
    var response = await fetch(url, options);
    if (!response.ok) throw new Error(await response.text() || response.statusText);
    if (response.status === 204) return null;
    return response.json();
  }

  async function getComments(config, postSlug) {
    if (config.backend !== "http" || !config.endpoint) {
      return readJson(LOCAL_COMMENTS_KEY).filter(function (comment) {
        return comment.postSlug === postSlug && comment.status !== "hidden";
      });
    }
    return requestJson(endpoint(config, "/comments?site=" + encodeURIComponent(config.siteId) + "&post=" + encodeURIComponent(postSlug)));
  }

  async function addComment(config, comment) {
    if (config.backend !== "http" || !config.endpoint) {
      var comments = readJson(LOCAL_COMMENTS_KEY);
      comments.unshift(comment);
      writeJson(LOCAL_COMMENTS_KEY, comments);
      return comment;
    }
    return requestJson(endpoint(config, "/comments"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ siteId: config.siteId }, comment))
    });
  }

  async function addWish(config, wish) {
    if (config.backend !== "http" || !config.endpoint) {
      var wishes = readJson(LOCAL_WISHES_KEY);
      wishes.unshift(wish);
      writeJson(LOCAL_WISHES_KEY, wishes);
      return wish;
    }
    return requestJson(endpoint(config, "/wishes"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ siteId: config.siteId }, wish))
    });
  }

  async function adminList(config, kind, token) {
    var localKey = kind === "wishes" ? LOCAL_WISHES_KEY : LOCAL_COMMENTS_KEY;
    if (config.backend !== "http" || !config.endpoint) return readJson(localKey);
    return requestJson(endpoint(config, "/admin/" + kind + "?site=" + encodeURIComponent(config.siteId)), {
      headers: { "Authorization": "Bearer " + token }
    });
  }

  function postSlugFromLocation() {
    var match = location.pathname.match(/\/posts\/([^/]+)\//);
    return match ? match[1] : "";
  }

  function postCategory() {
    var flag = document.querySelector(".post-hero .meta .item:nth-child(2), .post-header .meta .item:nth-child(2)");
    return flag ? flag.textContent.replace(/\s+/g, " ").trim() : "";
  }

  function renderComment(comment) {
    return "<article class=\"comment-card\">" +
      "<div class=\"comment-head\"><strong>" + escapeHtml(comment.nickname) + "</strong><time>" + escapeHtml(comment.createdAt || "") + "</time></div>" +
      "<p>" + escapeHtml(comment.text).replace(/\n/g, "<br>") + "</p>" +
      "</article>";
  }

  async function initComments(config) {
    var article = document.querySelector(".post.block:not(.archive-page)");
    if (!article || !/\/posts\//.test(location.pathname)) return;
    var slug = postSlugFromLocation();
    var existingActions = article.querySelector(".post-actions");
    var category = postCategory();
    if (existingActions && !existingActions.dataset.communityReady) {
      existingActions.dataset.communityReady = "true";
      if (category) existingActions.insertAdjacentHTML("beforeend", "<a class=\"btn ghost\" href=\"" + siteUrl("categories/?category=" + encodeURIComponent(category)) + "\">同分類</a>");
      existingActions.insertAdjacentHTML("beforeend", "<a class=\"btn ghost\" href=\"" + siteUrl("wish/") + "\">許願創作</a><a class=\"btn ghost\" href=\"#comments\">留言</a>");
    }
    article.insertAdjacentHTML("beforeend", "<section id=\"comments\" class=\"community-panel comments-panel\">" +
      "<div class=\"community-title\"><div><p class=\"eyebrow\">Comments</p><h2>公開評論</h2></div><span class=\"community-mode\"></span></div>" +
      "<form class=\"comment-form community-form\">" +
      "<div class=\"form-grid\"><label>暱稱<input name=\"nickname\" maxlength=\"24\" placeholder=\"第一次留言可自訂\"></label><label>文章<input value=\"" + escapeHtml(document.title.replace(/ \| Lumos$/, "")) + "\" disabled></label></div>" +
      "<label>留言<textarea name=\"text\" rows=\"4\" maxlength=\"800\" placeholder=\"留下公開評論。大家會看到暱稱和內容。\"></textarea></label>" +
      "<button type=\"submit\">送出評論</button><p class=\"community-hint\"></p>" +
      "</form><div class=\"comment-list\"></div></section>");

    var panel = article.querySelector(".comments-panel");
    var form = panel.querySelector(".comment-form");
    var list = panel.querySelector(".comment-list");
    var hint = panel.querySelector(".community-hint");
    var mode = panel.querySelector(".community-mode");
    var profile = getCommenterProfile();
    form.elements.nickname.value = profile.nickname || "";
    if (profile.nickname) {
      form.elements.nickname.readOnly = true;
      form.elements.nickname.title = "這個瀏覽器已綁定此暱稱";
    }
    mode.textContent = config.backend === "http" && config.endpoint ? "公開同步" : "本機測試";
    hint.textContent = profile.nickname ? "公開只會顯示暱稱和留言內容。" : "第一次留言會把暱稱記在這個瀏覽器。";

    async function refresh() {
      var comments = await getComments(config, slug);
      list.innerHTML = comments.length ? comments.map(renderComment).join("") : "<div class=\"empty-state\">還沒有評論，來坐第一張沙發。</div>";
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var nickname = form.elements.nickname.value.trim();
      var text = form.elements.text.value.trim();
      if (!nickname || !text) {
        hint.textContent = "請填暱稱和留言內容。";
        return;
      }
      var profile = getCommenterProfile();
      if (profile.nickname && profile.nickname !== nickname) {
        form.elements.nickname.value = profile.nickname;
        hint.textContent = "這個瀏覽器已經綁定暱稱：" + profile.nickname;
        return;
      }
      if (!profile.nickname) {
        profile.nickname = nickname;
        saveCommenterProfile(profile);
        form.elements.nickname.readOnly = true;
      }
      form.querySelector("button").disabled = true;
      try {
        var idHash = await sha256(profile.visitorKey);
        await addComment(config, {
          id: uuid(),
          postSlug: slug,
          postTitle: document.title.replace(/ \| Lumos$/, ""),
          nickname: profile.nickname,
          commenterHash: idHash,
          text: text,
          createdAt: new Date().toISOString().slice(0, 10)
        });
        form.elements.text.value = "";
        hint.textContent = "評論已送出。";
        await refresh();
      } catch (error) {
        hint.textContent = "送出失敗：" + error.message;
      } finally {
        form.querySelector("button").disabled = false;
      }
    });
    await refresh();
  }

  async function initWishPage(config) {
    var page = document.querySelector("[data-view='wish']");
    if (!page) return;
    var form = page.querySelector(".wish-form");
    var hint = page.querySelector(".community-hint");
    var mode = page.querySelector(".community-mode");
    mode.textContent = config.backend === "http" && config.endpoint ? "私密收件" : "本機測試";
    hint.textContent = config.notice || "許願內容不會顯示在前台。";
    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      var wish = {
        id: uuid(),
        prompt: form.elements.prompt.value.trim(),
        note: form.elements.note.value.trim(),
        contact: form.elements.contact.value.trim(),
        createdAt: new Date().toISOString()
      };
      if (!wish.prompt) {
        hint.textContent = "請先寫下想許的願。";
        return;
      }
      form.querySelector("button").disabled = true;
      try {
        await addWish(config, wish);
        form.reset();
        hint.textContent = "許願已送出，內容不會公開顯示。";
      } catch (error) {
        hint.textContent = "送出失敗：" + error.message;
      } finally {
        form.querySelector("button").disabled = false;
      }
    });
  }

  async function boot() {
    var config = await loadConfig();
    window.LumosCommunity = {
      config: config,
      getComments: function (postSlug) { return getComments(config, postSlug); },
      addComment: function (comment) { return addComment(config, comment); },
      addWish: function (wish) { return addWish(config, wish); },
      adminList: function (kind, token) { return adminList(config, kind, token); }
    };
    await initWishPage(config);
    await initComments(config);
  }

  boot().catch(function (error) {
    console.error("Lumos community failed:", error);
  });
})();







