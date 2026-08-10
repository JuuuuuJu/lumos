(function () {
  const AUTHOR_PASSWORD = "lumos-author";

  const $ = (id) => document.getElementById(id);
  const lock = $("lock");
  const workspace = $("workspace");
  const status = $("status");
  const statusBar = $("statusBar");

  function setStatus(message, type = "") {
    if (status) status.textContent = message;
    if (statusBar) {
      statusBar.textContent = message.split("\n")[0];
      statusBar.className = `status-bar ${type}`.trim();
    }
  }

  function setBusy(button, busy, busyText) {
    if (!button) return;
    if (busy) {
      button.dataset.originalText = button.textContent;
      button.textContent = busyText;
      button.disabled = true;
    } else {
      button.textContent = button.dataset.originalText || button.textContent;
      button.disabled = false;
    }
  }

  window.addEventListener("error", (event) => {
    setStatus(`Studio 腳本錯誤：${event.message}`, "error");
  });

  window.addEventListener("unhandledrejection", (event) => {
    setStatus(`Studio 非同步錯誤：${event.reason?.message || event.reason}`, "error");
  });

  function requirePublishSettings() {
    const owner = $("owner").value.trim();
    const repo = $("repo").value.trim();
    const branch = $("branch").value.trim();
    const token = $("token").value.trim();
    if (!owner) throw new Error("請填 Owner，例如 JuuuuuJu。");
    if (!repo) throw new Error("請填 Repo，例如 lumos.github.io。");
    if (!branch) throw new Error("請填 Branch，例如 main。");
    if (!token) throw new Error("請貼上 GitHub fine-grained token。");
  }

  function escapeHtml(value) {
    return value
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function slugify(value) {
    return value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled";
  }

  function postHtml() {
    const title = $("title").value.trim() || "未命名文章";
    const slug = slugify($("slug").value || title);
    const category = $("category").value.trim() || "隨筆";
    const tags = $("tags").value.split(",").map((tag) => tag.trim()).filter(Boolean);
    const cover = $("cover").value.trim() || "images/covers/cover-essay.jpg";
    const date = new Date().toISOString().slice(0, 10);
    const body = $("content").value
      .split(/\n\s*\n/g)
      .map((paragraph) => `<p>${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`)
      .join("\n              ");
    const tagHtml = tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("");
    const excerpt = $("content").value.replace(/\s+/g, " ").trim().slice(0, 80);

    return {
      slug,
      path: `posts/${slug}/index.html`,
      meta: {
        title,
        url: `posts/${slug}/`,
        date,
        category,
        tags,
        excerpt,
        cover,
        coverLabel: tags[0] || category || "文章",
        coverClass: category.includes("文") ? "literature" : "essay"
      },
      html: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2">
  <link rel="icon" type="image/ico" sizes="32x32" href="../../images/favicon.ico">
  <link rel="stylesheet" href="../../css/app.css?v=0.2.5">
  <link rel="stylesheet" href="../../css/lumos.css">
  <title>${escapeHtml(title)} | Lumos</title>
</head>
<body class="loaded">
  <main>
    <div class="inner single-column">
      <div id="main">
        <article class="post block">
          <header class="post-hero" style="--post-cover:url('../../${escapeHtml(cover)}')">
            <div>
              <h1 class="title">${escapeHtml(title)}</h1>
              <div class="meta"><span class="item"><i class="ic i-calendar"></i> ${date}</span> <span class="item"><i class="ic i-flag"></i> ${escapeHtml(category)}</span></div>
            <div class="tag-list">${tagHtml}</div>
            </div>
          </header>
          <div class="body md">
              ${body}
          </div>
          <p><a class="btn" href="../../">回首頁</a></p>
        </article>
      </div>
    </div>
  </main>
</body>
</html>`
    };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  function textToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  async function githubRequest(path, options = {}) {
    const owner = $("owner").value.trim();
    const repo = $("repo").value.trim();
    const token = $("token").value.trim();
    if (!owner || !repo || !token) {
      throw new Error("請先填 Owner、Repo 和 GitHub token。");
    }
    const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/${path}`, {
      ...options,
      headers: {
        "Accept": "application/vnd.github+json",
        "Authorization": `Bearer ${token}`,
        "X-GitHub-Api-Version": "2022-11-28",
        ...(options.headers || {})
      }
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`${response.status} ${await response.text()}`);
    }
    return response;
  }

  async function publishContent(path, contentBase64, message) {
    const branch = $("branch").value.trim() || "main";
    let sha;
    const existing = await githubRequest(`contents/${path}?ref=${encodeURIComponent(branch)}`);
    if (existing.status === 200) {
      sha = (await existing.json()).sha;
    }
    const payload = {
      message,
      content: contentBase64,
      branch,
      ...(sha ? { sha } : {})
    };
    const result = await githubRequest(`contents/${path}`, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
    return result.json();
  }

  async function updatePostIndex(postMeta) {
    const branch = $("branch").value.trim() || "main";
    const response = await githubRequest(`contents/data/posts.json?ref=${encodeURIComponent(branch)}`);
    let posts = [];
    if (response.status === 200) {
      const data = await response.json();
      posts = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(data.content.replace(/\s/g, "")), (c) => c.charCodeAt(0))));
    }
    posts = posts.filter((post) => post.url !== postMeta.url);
    posts.unshift(postMeta);
    await publishContent("data/posts.json", textToBase64(JSON.stringify(posts, null, 2) + "\n"), `Update post index for ${postMeta.title}`);
  }

  $("unlock").addEventListener("click", () => {
    if ($("password").value === AUTHOR_PASSWORD) {
      lock.classList.add("hidden");
      workspace.classList.remove("hidden");
      setStatus("作者模式已開啟。");
    } else {
      $("lockMessage").textContent = "密碼不對。預設密碼可在 studio/studio.js 修改。";
    }
  });

  $("previewPost").addEventListener("click", () => {
    $("preview").textContent = postHtml().html;
    setStatus("已產生預覽 HTML。", "success");
  });

  $("publishPost").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      requirePublishSettings();
      const post = postHtml();
      setBusy(button, true, "發布中...");
      setStatus(`發布中：${post.path}`);
      await publishContent(post.path, textToBase64(post.html), `Publish ${post.slug}`);
      setStatus(`文章已發布，更新首頁索引中：data/posts.json`);
      await updatePostIndex(post.meta);
      setStatus(`發布完成：${post.path}\n首頁索引也已更新。GitHub Pages 稍等一下就會重新部署。`, "success");
    } catch (error) {
      setStatus(`發布失敗：\n${error.message}`, "error");
    } finally {
      setBusy(button, false);
    }
  });

  $("publishAsset").addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      requirePublishSettings();
      const file = $("assetFile").files[0];
      const assetPath = $("assetPath").value.trim();
      if (!file || !assetPath) throw new Error("請選圖片並填網站路徑。");
      setBusy(button, true, "上傳中...");
      setStatus(`上傳圖片中：${assetPath}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await publishContent(assetPath, bytesToBase64(bytes), `Upload ${assetPath}`);
      setStatus(`圖片已上傳：${assetPath}`, "success");
    } catch (error) {
      setStatus(`上傳失敗：\n${error.message}`, "error");
    } finally {
      setBusy(button, false);
    }
  });
})();
