# Community Backend

GitHub Pages 是靜態網站，不能安全保存私密許願或跨訪客同步評論。這個資料夾提供一個 Cloudflare Worker module 範本 `cloudflare-worker.mjs`，讓前台可以使用真正的後端。

## API

- `GET /comments?site=lumos&post=slug`：公開取得某篇文章的評論，不回傳訪客 ID。
- `POST /comments`：新增公開評論。後端會用 `commenterHash` 綁定第一次使用的暱稱。
- `POST /wishes`：新增私密許願，前台不提供列表。
- `GET /admin/wishes?site=lumos`：管理頁讀取許願，需要 `Authorization: Bearer <ADMIN_TOKEN>`。
- `GET /admin/comments?site=lumos`：管理頁讀取評論，需要 `Authorization: Bearer <ADMIN_TOKEN>`。

## 前台切換

部署 Worker 後，把 `data/community-config.json` 改成：

```json
{
  "backend": "http",
  "siteId": "lumos",
  "endpoint": "https://你的-worker.你的帳號.workers.dev",
  "notice": ""
}
```

管理頁的 admin token 放在本機設定檔的 `communityAdminToken`，不要 commit。

