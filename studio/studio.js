(function () {
  const STUDIO_CONFIG = window.LUMOS_STUDIO_CONFIG || {};
  const AUTHOR_PASSWORD = STUDIO_CONFIG.password || "";
  const HAS_AUTHOR_PASSWORD = Boolean(AUTHOR_PASSWORD);
  const DRAFT_KEY = "lumos-admin-draft";
  const POST_INDEX_PATH = "data/posts.json";
  const $ = (id) => document.getElementById(id);
  const lock = $("lock");
  const workspace = $("workspace");
  const status = $("status");
  const statusBar = $("statusBar");
  let postIndex = [];
  let selectedUrl = "";
  let packageAssets = [];
  let packageMarkdown = null;

  function setStatus(message, type = "") {
    if (status) status.textContent = message;
    if (statusBar) {
      statusBar.textContent = message.split("\n")[0];
      statusBar.className = `status-bar ${type}`.trim();
    }
  }

  function requireAdminPassword() {
    return HAS_AUTHOR_PASSWORD;
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

  function field(id) {
    const element = $(id);
    return element ? element.value.trim() : "";
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function requirePublishSettings() {
    ["owner", "repo", "branch", "token"].forEach((id) => {
      if (!field(id)) throw new Error(`請填 ${id}。`);
    });
  }

  function hydratePortableSettings() {
    if ($("communityEndpoint") && STUDIO_CONFIG.communityEndpoint) $("communityEndpoint").value = STUDIO_CONFIG.communityEndpoint;
    if ($("communityAdminToken") && STUDIO_CONFIG.communityAdminToken) $("communityAdminToken").value = STUDIO_CONFIG.communityAdminToken;
    if (!HAS_AUTHOR_PASSWORD && $("lockMessage")) {
      $("lockMessage").textContent = "外出模式：可直接進入。真正發布或讀取私密資料時，請在裡面手動填 token。";
    }
  }

  function escapeHtml(value) {
    return String(value || "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function decodeHtml(value) {
    const textarea = document.createElement("textarea");
    textarea.innerHTML = value || "";
    return textarea.value;
  }

  function slugify(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\u4e00-\u9fff]+/g, "-")
      .replace(/^-+|-+$/g, "") || "untitled";
  }

  function normalizePath(path) {
    return String(path || "").replace(/^\/+/, "").replace(/\\/g, "/");
  }

  function ensureTrailingSlash(path) {
    return path.endsWith("/") ? path : `${path}/`;
  }

  function assetBaseForSlug(slug) {
    const custom = normalizePath(field("assetBase"));
    const base = ensureTrailingSlash(custom || `posts/${slug}/assets/`);
    const expected = `posts/${slug}/assets/`;
    if (base.includes("../") || base.includes("..\\")) {
      throw new Error("素材路徑不能包含 ..");
    }
    if (base !== expected) {
      throw new Error(`素材路徑請放在當篇文章底下：${expected}`);
    }
    return base;
  }

  function assetUrlFromPost(targetPath, slug) {
    const postPrefix = `posts/${slug}/`;
    return targetPath.startsWith(postPrefix) ? targetPath.slice(postPrefix.length) : `../../${targetPath}`;
  }

  function assetKind(fileName) {
    const ext = fileName.split(".").pop().toLowerCase();
    if (["jpg", "jpeg", "png", "gif", "webp", "svg"].includes(ext)) return "image";
    if (ext === "csv") return "csv";
    if (["md", "markdown"].includes(ext)) return "markdown";
    return "file";
  }

  function safeAssetName(name, usedNames) {
    const raw = String(name || "file").split(/[\\/]/).filter(Boolean).pop() || "file";
    const dot = raw.lastIndexOf(".");
    const base = slugify(dot > 0 ? raw.slice(0, dot) : raw);
    const ext = dot > 0 ? raw.slice(dot).toLowerCase().replace(/[^a-z0-9.]/g, "") : "";
    let safe = `${base}${ext}` || "file";
    let index = 2;
    while (usedNames.has(safe)) {
      safe = `${base}-${index}${ext}`;
      index += 1;
    }
    usedNames.add(safe);
    return safe;
  }

  function tagsFromInput() {
    return field("tags").split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  function contentMode() {
    const mode = field("contentMode");
    return mode === "html" ? "html" : "markdown";
  }

  function coverClass(category) {
    if (category.includes("文") || category.includes("詩") || category.includes("對聯")) return "literature";
    if (category.includes("程式") || category.toLowerCase().includes("code")) return "code";
    if (category.includes("作品") || category.toLowerCase().includes("project")) return "projects";
    if (category.includes("生活") || category.includes("紀錄")) return "life";
    return "essay";
  }

  function escapeAttr(value) {
    return escapeHtml(value).replaceAll("'", "&#39;");
  }

  function inlineMarkdown(text) {
    const placeholders = [];
    let output = escapeHtml(text || "");
    output = output.replace(/`([^`]+)`/g, (_, code) => {
      const key = `@@CODE${placeholders.length}@@`;
      placeholders.push(`<code>${escapeHtml(code)}</code>`);
      return key;
    });
    output = output
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_, alt, url) => `<figure><img src="${escapeAttr(url.trim())}" alt="${escapeAttr(alt)}"></figure>`)
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, url) => {
        const href = url.trim();
        const external = /^https?:\/\//i.test(href) ? ' target="_blank" rel="noopener"' : "";
        return `<a href="${escapeAttr(href)}"${external}>${label}</a>`;
      })
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/\*([^*]+)\*/g, "<em>$1</em>");
    placeholders.forEach((html, index) => {
      output = output.replaceAll(`@@CODE${index}@@`, html);
    });
    return output;
  }

  function renderMarkdown(markdown) {
    const source = String(markdown || "").replace(/\r\n/g, "\n").trim();
    if (!source) return "<p>還沒有內文。</p>";
    const blocks = source.split(/\n{2,}/);
    return blocks.map((block) => {
      const lines = block.split("\n");
      const first = lines[0] || "";
      const heading = first.match(/^(#{1,3})\s+(.+)$/);
      if (heading && lines.length === 1) {
        const level = heading[1].length + 1;
        return `<h${level}>${inlineMarkdown(heading[2])}</h${level}>`;
      }
      if (lines.every((line) => /^\s*[-*]\s+/.test(line))) {
        return `<ul>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>`).join("")}</ul>`;
      }
      if (lines.every((line) => /^\s*\d+\.\s+/.test(line))) {
        return `<ol>${lines.map((line) => `<li>${inlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>`).join("")}</ol>`;
      }
      if (lines.every((line) => /^\s*>\s?/.test(line))) {
        return `<blockquote>${lines.map((line) => inlineMarkdown(line.replace(/^\s*>\s?/, ""))).join("<br>")}</blockquote>`;
      }
      if (/^```/.test(first) && /^```/.test(lines[lines.length - 1] || "")) {
        const code = lines.slice(1, -1).join("\n");
        return `<pre><code>${escapeHtml(code)}</code></pre>`;
      }
      return `<p>${lines.map(inlineMarkdown).join("<br>")}</p>`;
    }).join("\n              ");
  }

  function renderContent(content, mode) {
    if (mode === "html") return String(content || "").trim() || "<p>還沒有內文。</p>";
    return renderMarkdown(content);
  }

  function plainTextFromContent(content, mode) {
    if (mode === "html") {
      const doc = new DOMParser().parseFromString(String(content || ""), "text/html");
      return doc.body.textContent || "";
    }
    return String(content || "")
      .replace(/```[\s\S]*?```/g, " ")
      .replace(/[#>*_`[\]()!-]/g, " ");
  }

  function packageReferenceMap(slug) {
    const map = new Map();
    packageAssets.forEach((asset) => {
      const url = assetUrlFromPost(asset.targetPath, slug);
      map.set(normalizePath(asset.originalPath).toLowerCase(), url);
      map.set(normalizePath(asset.originalName).toLowerCase(), url);
      map.set(asset.originalName.split(/[\\/]/).pop().toLowerCase(), url);
    });
    return map;
  }

  function rewriteAssetLinks(markdown, slug) {
    const refs = packageReferenceMap(slug);
    return String(markdown || "").replace(/(!?\[[^\]]*\]\()([^)]+)(\))/g, (match, prefix, url, suffix) => {
      const clean = normalizePath(url.trim().replace(/^\.?\//, ""));
      if (/^(https?:|data:|mailto:|#)/i.test(clean)) return match;
      return `${prefix}${refs.get(clean.toLowerCase()) || refs.get(clean.split("/").pop().toLowerCase()) || url}${suffix}`;
    });
  }

  function assetSnippet(slug) {
    if (!packageAssets.length) return "";
    return packageAssets.map((asset) => {
      const url = assetUrlFromPost(asset.targetPath, slug);
      if (asset.kind === "image") return `![${asset.label}](${url})`;
      if (asset.kind === "csv") return `[${asset.label} CSV](${url})`;
      return `[${asset.label}](${url})`;
    }).join("\n\n");
  }

  function assetSnippetHtml(slug) {
    if (!packageAssets.length) return "";
    return packageAssets.map((asset) => {
      const url = assetUrlFromPost(asset.targetPath, slug);
      if (asset.kind === "image") return `<figure><img src="${escapeAttr(url)}" alt="${escapeAttr(asset.label)}"></figure>`;
      if (asset.kind === "csv") return `<p><a href="${escapeAttr(url)}">${escapeHtml(asset.label)} CSV</a></p>`;
      return `<p><a href="${escapeAttr(url)}">${escapeHtml(asset.label)}</a></p>`;
    }).join("\n\n");
  }

  function hasPackageSelection() {
    return Boolean($("packageZip")?.files?.length || $("packageFiles")?.files?.length);
  }

  function renderAssetSummary() {
    const summary = $("assetSummary");
    if (!summary) return;
    if (!packageAssets.length && !packageMarkdown) {
      summary.textContent = "尚未整理素材。";
      return;
    }
    const lines = [];
    if (packageMarkdown) lines.push(`Markdown：${packageMarkdown.name}`);
    packageAssets.forEach((asset) => {
      lines.push(`${asset.kind.toUpperCase()}：${asset.originalName} -> ${asset.targetPath}`);
    });
    summary.textContent = lines.join("\n");
  }

  async function readFileBytes(file) {
    return new Uint8Array(await file.arrayBuffer());
  }

  async function scanPackageFiles() {
    const slug = slugify(field("slug") || field("title"));
    const base = assetBaseForSlug(slug);
    const usedNames = new Set();
    packageAssets = [];
    packageMarkdown = null;

    async function addAsset(originalPath, bytes, textReader) {
      const originalName = originalPath.split(/[\\/]/).filter(Boolean).pop() || originalPath;
      const kind = assetKind(originalName);
      if (kind === "markdown") {
        packageMarkdown = {
          name: originalName,
          content: textReader ? await textReader() : new TextDecoder().decode(bytes)
        };
        return;
      }
      const outputName = safeAssetName(originalName, usedNames);
      packageAssets.push({
        kind,
        originalName,
        originalPath,
        outputName,
        label: originalName.replace(/\.[^.]+$/, ""),
        targetPath: `${base}${outputName}`,
        bytes
      });
    }

    const zipFile = $("packageZip")?.files?.[0];
    const pickedFiles = Array.from($("packageFiles")?.files || []);
    if (zipFile) {
      if (!window.JSZip) throw new Error("ZIP 解析器尚未載入，請重新整理頁面。");
      const zip = await window.JSZip.loadAsync(zipFile);
      const entries = Object.values(zip.files).filter((entry) => !entry.dir && !/^__MACOSX\//.test(entry.name));
      for (const entry of entries) {
        const bytes = await entry.async("uint8array");
        await addAsset(entry.name, bytes, () => entry.async("text"));
      }
    }

    for (const file of pickedFiles) {
      const originalPath = file.webkitRelativePath || file.name;
      await addAsset(originalPath, await readFileBytes(file), () => file.text());
    }

    if (!packageAssets.length && !packageMarkdown) throw new Error("沒有找到可整理的 Markdown、圖片、CSV 或附件。");
    if ((!$("cover").value || $("cover").value === "images/covers/cover-essay.jpg") && packageAssets.some((asset) => asset.kind === "image")) {
      $("cover").value = packageAssets.find((asset) => asset.kind === "image").targetPath;
    }
    renderAssetSummary();
    return packageAssets;
  }

  function currentPost() {
    const title = field("title") || "未命名文章";
    const slug = slugify(field("slug") || title);
    const category = field("category") || "隨筆";
    const tags = tagsFromInput();
    const cover = normalizePath(field("cover") || "images/covers/cover-essay.jpg");
    const date = field("date") || today();
    const content = $("content").value || "";
    const mode = contentMode();
    const renderedContent = renderContent(content, mode);
    const excerpt = (field("excerpt") || plainTextFromContent(content, mode).replace(/\s+/g, " ").trim()).slice(0, 120);
    const tagHtml = tags.map((tag) => `<a href="../../tags/?tag=${encodeURIComponent(tag)}">${escapeHtml(tag)}</a>`).join("");
    const sourceJson = JSON.stringify({ mode, content }).replaceAll("<", "\\u003c");
    const computedCoverClass = coverClass(category);

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
        coverClass: computedCoverClass
      },
      html: `<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=2">
  <link rel="icon" type="image/ico" sizes="32x32" href="../../images/favicon.ico">
  <link rel="stylesheet" href="../../css/app.css?v=0.2.5">
  <link rel="stylesheet" href="../../css/lumos.css?v=1.6">
  <title>${escapeHtml(title)} | Lumos</title>
</head>
<body class="loaded post-page">
  <header class="post-full-hero" style="--post-cover:url('../../${escapeHtml(cover)}')" data-post-cover="${escapeAttr(cover)}" data-category="${escapeAttr(category)}" data-cover-class="${escapeAttr(computedCoverClass)}">
    <div class="hero-copy">
      <h1 class="title">${escapeHtml(title)}</h1>
      <div class="meta"><span class="item"><i class="ic i-calendar"></i> ${escapeHtml(date)}</span> <span class="item"><i class="ic i-flag"></i> ${escapeHtml(category)}</span></div>
      <div class="tag-list">${tagHtml}</div>
    </div>
    <div class="hero-waves">
      <svg class="waves" xmlns="http://www.w3.org/2000/svg" viewBox="0 24 150 28" preserveAspectRatio="none" shape-rendering="auto">
        <defs><path id="gentle-wave" d="M-160 44c30 0 58-18 88-18s58 18 88 18 58-18 88-18 58 18 88 18v44h-352z"/></defs>
        <g class="parallax"><use href="#gentle-wave" x="48" y="0"/><use href="#gentle-wave" x="48" y="3"/><use href="#gentle-wave" x="48" y="5"/><use href="#gentle-wave" x="48" y="7"/></g>
      </svg>
    </div>
  </header>
  <main>
    <div class="inner single-column">
      <div id="main">
        <article class="post block">
          <div class="body md" data-content-mode="${escapeAttr(mode)}">
              ${renderedContent}
          </div>
          <script type="application/json" class="lumos-source-content">${sourceJson}</script>
          <nav class="post-actions"><a class="btn" href="../../">回首頁</a><a class="btn ghost" href="../../archives/">全部文章</a></nav>
        </article>
      </div>
    </div>
  </main>
  <script src="../../js/site.js?v=1.6"></script>
</body>
</html>`
    };
  }

  function bytesToBase64(bytes) {
    let binary = "";
    bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
    return btoa(binary);
  }

  function textToBase64(text) {
    return bytesToBase64(new TextEncoder().encode(text));
  }

  function base64ToText(content) {
    return new TextDecoder().decode(Uint8Array.from(atob(String(content || "").replace(/\s/g, "")), (char) => char.charCodeAt(0)));
  }

  async function githubRequest(path, options = {}) {
    const owner = field("owner");
    const repo = field("repo");
    const token = field("token");
    if (!owner || !repo || !token) throw new Error("請先填 Owner、Repo 和 GitHub token。");
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

  async function loadBranchHead() {
    const branch = encodeURIComponent(field("branch") || "main");
    const response = await githubRequest(`git/ref/heads/${branch}`);
    if (!response.ok) throw new Error("讀不到目標 branch。");
    const ref = await response.json();
    const commitResponse = await githubRequest(`git/commits/${ref.object.sha}`);
    const commit = await commitResponse.json();
    return { commitSha: ref.object.sha, treeSha: commit.tree.sha };
  }

  async function commitFiles(files, message) {
    const branch = field("branch") || "main";
    const head = await loadBranchHead();
    const treeEntries = [];
    for (const file of files) {
      if (file.base64) {
        const blobResponse = await githubRequest("git/blobs", {
          method: "POST",
          body: JSON.stringify({ content: file.base64, encoding: "base64" })
        });
        const blob = await blobResponse.json();
        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          sha: blob.sha
        });
      } else {
        treeEntries.push({
          path: file.path,
          mode: "100644",
          type: "blob",
          content: file.content
        });
      }
    }
    const treeResponse = await githubRequest("git/trees", {
      method: "POST",
      body: JSON.stringify({
        base_tree: head.treeSha,
        tree: treeEntries
      })
    });
    const tree = await treeResponse.json();
    const commitResponse = await githubRequest("git/commits", {
      method: "POST",
      body: JSON.stringify({
        message,
        tree: tree.sha,
        parents: [head.commitSha]
      })
    });
    const commit = await commitResponse.json();
    await githubRequest(`git/refs/heads/${encodeURIComponent(branch)}`, {
      method: "PATCH",
      body: JSON.stringify({ sha: commit.sha })
    });
    return commit;
  }

  async function fetchRemoteText(path) {
    const branch = encodeURIComponent(field("branch") || "main");
    const response = await githubRequest(`contents/${path}?ref=${branch}`);
    if (response.status === 404) return null;
    const data = await response.json();
    return base64ToText(data.content);
  }

  async function loadPostIndex(source = "public") {
    if (source === "github" && field("token")) {
      const text = await fetchRemoteText(POST_INDEX_PATH);
      postIndex = text ? JSON.parse(text) : [];
    } else {
      const response = await fetch(`../${POST_INDEX_PATH}?v=${Date.now()}`, { cache: "no-store" });
      postIndex = response.ok ? await response.json() : [];
    }
    renderPostSelect();
    return postIndex;
  }

  function renderPostSelect() {
    const select = $("existingPost");
    if (!select) return;
    select.innerHTML = "<option value=\"\">新增文章</option>" + postIndex.map((post) => (
      `<option value="${escapeHtml(post.url)}">${escapeHtml(post.title)} / ${escapeHtml(post.category)}</option>`
    )).join("");
    select.value = selectedUrl;
  }

  async function fillFromPost(post) {
    selectedUrl = post ? post.url : "";
    $("existingPost").value = selectedUrl;
    if (!post) {
      $("title").value = "新的文章";
      $("slug").value = "my-new-post";
      $("category").value = "隨筆";
      $("tags").value = "隨筆,生活";
      $("date").value = today();
      $("cover").value = "images/covers/cover-essay.jpg";
      $("excerpt").value = "";
      $("contentMode").value = "markdown";
      $("content").value = "在這裡自由打字。空一行會變成下一段。";
      $("assetBase").value = "";
      packageAssets = [];
      packageMarkdown = null;
      renderAssetSummary();
      setStatus("已切換成新增文章模式。");
      return;
    }
    $("title").value = post.title || "";
    $("slug").value = slugify((post.url || "").replace(/^posts\//, "").replace(/\/$/, ""));
    $("category").value = post.category || "";
    $("tags").value = (post.tags || []).join(",");
    $("date").value = post.date || today();
    $("cover").value = post.cover || "";
    $("excerpt").value = post.excerpt || "";
    $("content").value = "載入文章內文中...";
    try {
      const response = await fetch(`../${post.url}index.html?v=${Date.now()}`, { cache: "no-store" });
      if (!response.ok) throw new Error("讀不到文章 HTML");
      const html = await response.text();
      const doc = new DOMParser().parseFromString(html, "text/html");
      const source = doc.querySelector(".lumos-source-content");
      if (source?.textContent) {
        const saved = JSON.parse(source.textContent);
        $("contentMode").value = saved.mode === "html" ? "html" : "markdown";
        $("content").value = saved.content || "";
      } else {
        $("contentMode").value = "markdown";
        const paragraphs = Array.from(doc.querySelectorAll(".body.md p")).map((p) => p.innerText.trim()).filter(Boolean);
        $("content").value = paragraphs.join("\n\n") || post.excerpt || "";
      }
      setStatus(`已載入：${post.title}`, "success");
    } catch (error) {
      $("content").value = post.excerpt || "";
      setStatus(`已載入索引資料，但內文讀取失敗：${error.message}`, "error");
    }
  }

  function mergePostIndex(postMeta, allowOverwrite) {
    const existing = postIndex.find((post) => post.url === postMeta.url);
    if (existing && !allowOverwrite) {
      throw new Error(`已有同 slug 的文章：${postMeta.url}。若要覆蓋，請先從「既有文章」選它，或勾選允許覆蓋。`);
    }
    const merged = postIndex.filter((post) => post.url !== postMeta.url);
    merged.unshift(postMeta);
    return merged;
  }

  function saveDraft() {
    const draft = {
      selectedUrl,
      title: field("title"),
      slug: field("slug"),
      category: field("category"),
      tags: field("tags"),
      date: field("date"),
      cover: field("cover"),
      excerpt: field("excerpt"),
      assetBase: field("assetBase"),
      contentMode: contentMode(),
      content: $("content").value
    };
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setStatus("草稿已存在這台電腦的瀏覽器。", "success");
  }

  function loadDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) {
      setStatus("目前沒有本機草稿。");
      return;
    }
    const draft = JSON.parse(raw);
    selectedUrl = draft.selectedUrl || "";
    ["title", "slug", "category", "tags", "date", "cover", "excerpt", "assetBase"].forEach((id) => {
      if ($(id)) $(id).value = draft[id] || "";
    });
    $("contentMode").value = draft.contentMode === "html" ? "html" : "markdown";
    $("content").value = draft.content || "";
    renderPostSelect();
    setStatus("已載入本機草稿。", "success");
  }

  async function publishPost(event) {
    const button = event.currentTarget;
    try {
      requirePublishSettings();
      setBusy(button, true, "發布中...");
      setStatus("讀取遠端索引，準備合併發布...");
      await loadPostIndex("github");
      if (hasPackageSelection()) {
        await scanPackageFiles();
      }
      const post = currentPost();
      const allowOverwrite = $("allowOverwrite").checked || selectedUrl === post.meta.url;
      const mergedIndex = mergePostIndex(post.meta, allowOverwrite);
      const files = [
        { path: post.path, content: post.html },
        { path: POST_INDEX_PATH, content: JSON.stringify(mergedIndex, null, 2) + "\n" }
      ];
      const imageFile = $("assetFile").files[0];
      const imagePath = normalizePath(field("assetPath"));
      if (imageFile && imagePath && imagePath === post.meta.cover) {
        const bytes = new Uint8Array(await imageFile.arrayBuffer());
        files.push({ path: imagePath, base64: bytesToBase64(bytes) });
      }
      packageAssets.forEach((asset) => {
        files.push({ path: asset.targetPath, base64: bytesToBase64(asset.bytes) });
      });
      setStatus(`建立單一 commit：${files.map((file) => file.path).join(" + ")}`);
      const commit = await commitFiles(files, `Publish ${post.meta.title}`);
      postIndex = mergedIndex;
      selectedUrl = post.meta.url;
      renderPostSelect();
      setStatus(`發布完成。\nCommit: ${commit.sha}\n文章、首頁索引、分類與標籤資料會一起更新。`, "success");
    } catch (error) {
      setStatus(`發布失敗：\n${error.message}`, "error");
    } finally {
      setBusy(button, false);
    }
  }

  async function publishAsset(event) {
    const button = event.currentTarget;
    try {
      requirePublishSettings();
      const file = $("assetFile").files[0];
      const assetPath = normalizePath(field("assetPath"));
      if (!file || !assetPath) throw new Error("請選圖片並填網站路徑。");
      setBusy(button, true, "上傳中...");
      setStatus(`建立圖片 commit：${assetPath}`);
      const bytes = new Uint8Array(await file.arrayBuffer());
      await commitFiles([{ path: assetPath, base64: bytesToBase64(bytes) }], `Upload ${assetPath}`);
      $("cover").value = assetPath;
      setStatus(`圖片已上傳並填入章首圖欄位：${assetPath}`, "success");
    } catch (error) {
      setStatus(`上傳失敗：\n${error.message}`, "error");
    } finally {
      setBusy(button, false);
    }
  }

  window.addEventListener("error", (event) => setStatus(`管理台腳本錯誤：${event.message}`, "error"));
  window.addEventListener("unhandledrejection", (event) => setStatus(`管理台非同步錯誤：${event.reason?.message || event.reason}`, "error"));

  hydratePortableSettings();

  $("unlock").addEventListener("click", async () => {
    if (requireAdminPassword() && $("password").value !== AUTHOR_PASSWORD) {
      $("lockMessage").textContent = "密碼不對。請確認本機設定檔。";
      return;
    }
    lock.classList.add("hidden");
    workspace.classList.remove("hidden");
    hydratePortableSettings();
    $("date").value = field("date") || today();
    setStatus("作者模式已開啟，正在讀取文章索引...");
    try {
      await loadPostIndex();
      setStatus("文章索引已載入。", "success");
    } catch (error) {
      setStatus(`作者模式已開啟，但讀取文章索引失敗：${error.message}`, "error");
    }
  });

  $("existingPost").addEventListener("change", () => {
    fillFromPost(postIndex.find((post) => post.url === $("existingPost").value));
  });
  $("newPost").addEventListener("click", () => fillFromPost(null));
  $("saveDraft").addEventListener("click", saveDraft);
  $("loadDraft").addEventListener("click", loadDraft);
  $("scanPackage").addEventListener("click", async (event) => {
    try {
      setBusy(event.currentTarget, true, "整理中...");
      await scanPackageFiles();
      setStatus(`素材整理完成：${packageAssets.length} 個附件${packageMarkdown ? "，找到 Markdown 主文" : ""}。`, "success");
    } catch (error) {
      setStatus(`素材整理失敗：\n${error.message}`, "error");
    } finally {
      setBusy(event.currentTarget, false);
    }
  });
  $("usePackageMarkdown").addEventListener("click", async (event) => {
    try {
      setBusy(event.currentTarget, true, "讀取中...");
      if (hasPackageSelection()) await scanPackageFiles();
      if (!packageMarkdown) throw new Error("素材包裡沒有 Markdown 檔。");
      const slug = slugify(field("slug") || field("title"));
      const markdown = rewriteAssetLinks(packageMarkdown.content, slug);
      const heading = markdown.match(/^#\s+(.+)$/m);
      if (heading && (!field("title") || field("title") === "新的文章")) $("title").value = heading[1].trim();
      $("contentMode").value = "markdown";
      $("content").value = markdown;
      setStatus(`已套用包內 Markdown：${packageMarkdown.name}`, "success");
    } catch (error) {
      setStatus(`套用 Markdown 失敗：\n${error.message}`, "error");
    } finally {
      setBusy(event.currentTarget, false);
    }
  });
  $("insertAssetSnippet").addEventListener("click", async (event) => {
    try {
      setBusy(event.currentTarget, true, "插入中...");
      if (hasPackageSelection()) await scanPackageFiles();
      if (!packageAssets.length) throw new Error("目前沒有可插入的素材。");
      const slug = slugify(field("slug") || field("title"));
      const snippet = contentMode() === "html" ? assetSnippetHtml(slug) : assetSnippet(slug);
      $("content").value = `${$("content").value.trim()}\n\n${snippet}`.trim();
      setStatus("素材連結已插入內文。", "success");
    } catch (error) {
      setStatus(`插入素材失敗：\n${error.message}`, "error");
    } finally {
      setBusy(event.currentTarget, false);
    }
  });
  $("previewPost").addEventListener("click", () => {
    const post = currentPost();
    $("preview").textContent = post.html;
    const frame = $("previewFrame");
    if (frame) frame.srcdoc = post.html;
    setStatus("已產生文章預覽。", "success");
  });
  $("publishPost").addEventListener("click", publishPost);
  $("publishAsset").addEventListener("click", publishAsset);
  $("assetFile").addEventListener("change", () => {
    const file = $("assetFile").files[0];
    if (!file) return;
    $("assetPath").value = `images/uploads/${slugify(file.name.replace(/\.[^.]+$/, ""))}.${file.name.split(".").pop().toLowerCase()}`;
    $("cover").value = $("assetPath").value;
  });

  function renderInboxItem(item, kind) {
    const title = kind === "wish" ? `許願 / ${item.createdAt || ""}` : `${item.postTitle || item.postSlug || "評論"} / ${item.createdAt || ""}`;
    const body = kind === "wish" ? [
      item.prompt,
      item.note ? `補充：${item.note}` : "",
      item.contact ? `聯絡：${item.contact}` : ""
    ].filter(Boolean).join("\n") : `${item.nickname || "匿名"}：${item.text || ""}`;
    return `<article class="inbox-card"><strong>${escapeHtml(title)}</strong><p>${escapeHtml(body).replaceAll("\n", "<br>")}</p></article>`;
  }

  async function refreshCommunityInbox() {
    const mode = $("communityMode");
    const wishInbox = $("wishInbox");
    const commentInbox = $("commentInbox");
    if (!window.LumosCommunity) {
      if (mode) mode.textContent = "未載入";
      return;
    }
    const token = field("communityAdminToken") || STUDIO_CONFIG.communityAdminToken || "";
    const config = window.LumosCommunity.config || {};
    const endpoint = field("communityEndpoint") || STUDIO_CONFIG.communityEndpoint || "";
    if (endpoint) {
      config.endpoint = endpoint;
      config.backend = "http";
    }
    if (mode) mode.textContent = config.backend === "http" && config.endpoint ? "遠端後端" : "本機測試";
    const wishes = await window.LumosCommunity.adminList("wishes", token);
    const comments = await window.LumosCommunity.adminList("comments", token);
    wishInbox.innerHTML = wishes.length ? wishes.map((item) => renderInboxItem(item, "wish")).join("") : "<div class=\"empty-note\">目前沒有許願。</div>";
    commentInbox.innerHTML = comments.length ? comments.map((item) => renderInboxItem(item, "comment")).join("") : "<div class=\"empty-note\">目前沒有評論。</div>";
  }

  $("refreshCommunity").addEventListener("click", async () => {
    try {
      await refreshCommunityInbox();
      setStatus("社群收件匣已更新。", "success");
    } catch (error) {
      setStatus(`收件匣讀取失敗：\n${error.message}`, "error");
    }
  });
})();







