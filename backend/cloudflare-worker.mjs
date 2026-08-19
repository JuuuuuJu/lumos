const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type,Authorization"
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function key(...parts) {
  return parts.map((part) => encodeURIComponent(String(part || ""))).join(":");
}

async function readList(env, storageKey) {
  return JSON.parse(await env.LUMOS_KV.get(storageKey) || "[]");
}

async function writeList(env, storageKey, items) {
  await env.LUMOS_KV.put(storageKey, JSON.stringify(items.slice(0, 500)));
}

function sanitizeComment(comment) {
  return {
    id: comment.id,
    postSlug: comment.postSlug,
    postTitle: comment.postTitle,
    nickname: comment.nickname,
    text: comment.text,
    createdAt: comment.createdAt,
    status: comment.status || "visible"
  };
}

async function nicknameForUser(env, site, commenterHash, requestedNickname) {
  if (!commenterHash) return requestedNickname;
  const profileKey = key("users", site, commenterHash);
  const existing = await env.LUMOS_KV.get(profileKey);
  if (existing) return JSON.parse(existing).nickname;
  const nickname = String(requestedNickname || "匿名").slice(0, 32);
  await env.LUMOS_KV.put(profileKey, JSON.stringify({
    commenterHash,
    nickname,
    createdAt: new Date().toISOString()
  }));
  return nickname;
}

function requireAdmin(request, env) {
  const token = request.headers.get("Authorization") || "";
  return env.ADMIN_TOKEN && token === `Bearer ${env.ADMIN_TOKEN}`;
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
    const url = new URL(request.url);
    const site = url.searchParams.get("site") || "lumos";

    try {
      if (request.method === "GET" && url.pathname === "/comments") {
        const post = url.searchParams.get("post") || "";
        const comments = await readList(env, key("comments", site, post));
        return json(comments.filter((item) => item.status !== "hidden").map(sanitizeComment));
      }

      if (request.method === "POST" && url.pathname === "/comments") {
        const body = await request.json();
        if (!body.postSlug || !body.nickname || !body.text) return json({ error: "Missing fields" }, 400);
        const siteId = body.siteId || site;
        const storageKey = key("comments", siteId, body.postSlug);
        const comments = await readList(env, storageKey);
        const nickname = await nicknameForUser(env, siteId, String(body.commenterHash || "").slice(0, 128), body.nickname);
        comments.unshift({
          id: body.id || crypto.randomUUID(),
          postSlug: String(body.postSlug).slice(0, 120),
          postTitle: String(body.postTitle || "").slice(0, 160),
          nickname,
          commenterHash: String(body.commenterHash || "").slice(0, 128),
          text: String(body.text).slice(0, 1200),
          createdAt: body.createdAt || new Date().toISOString(),
          status: "visible"
        });
        await writeList(env, storageKey, comments);
        return json(sanitizeComment(comments[0]), 201);
      }

      if (request.method === "POST" && url.pathname === "/wishes") {
        const body = await request.json();
        if (!body.prompt) return json({ error: "Missing prompt" }, 400);
        const storageKey = key("wishes", body.siteId || site);
        const wishes = await readList(env, storageKey);
        wishes.unshift({
          id: body.id || crypto.randomUUID(),
          prompt: String(body.prompt).slice(0, 1600),
          note: String(body.note || "").slice(0, 240),
          contact: String(body.contact || "").slice(0, 180),
          createdAt: body.createdAt || new Date().toISOString(),
          status: "new"
        });
        await writeList(env, storageKey, wishes);
        return json({ ok: true }, 201);
      }

      if (request.method === "GET" && url.pathname === "/admin/wishes") {
        if (!requireAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
        return json(await readList(env, key("wishes", site)));
      }

      if (request.method === "GET" && url.pathname === "/admin/comments") {
        if (!requireAdmin(request, env)) return json({ error: "Unauthorized" }, 401);
        const all = await env.LUMOS_KV.list({ prefix: key("comments", site, "") });
        const groups = await Promise.all(all.keys.map((item) => readList(env, item.name)));
        return json(groups.flat());
      }

      return json({ error: "Not found" }, 404);
    } catch (error) {
      return json({ error: error.message }, 500);
    }
  }
};

