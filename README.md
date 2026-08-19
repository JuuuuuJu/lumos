# Lumos GitHub Pages

這是 Lumos 個人網站的靜態 GitHub Pages 版本。

## 日常更新流程

1. 開啟管理頁。
2. 輸入作者密碼。
3. 填入 GitHub fine-grained token。
4. 選擇「新增文章」或從「既有文章」選一篇來編輯。
5. 預覽 HTML，確認後按「發布 / 更新文章」。

管理頁發布文章時會把文章檔案和 `data/posts.json` 合成同一個 commit。未選既有文章時，如果 slug 已經存在，會阻止覆蓋。

## 圖片

- 文章章首圖建議放在 `images/uploads/`。
- 網站固定區塊圖目前放在 `images/covers/`。
- 側欄頭像是 `images/lumos-mark.png`。

## 管理頁密碼

管理頁會讀取本機設定檔，這個檔案已被 `.gitignore` 排除，不要 commit。範例是 `local-config.example.js`。

## 許願池與評論

- 許願池在 `/wish/`，前台不會列出任何許願內容，形式和題目都由訪客自由填寫。
- 文章頁會自動顯示公開評論區。第一次留言會把暱稱綁定在該瀏覽器；公開畫面只顯示暱稱和留言內容。
- 預設是本機測試模式，只能在同一台瀏覽器看到測試資料。若要正式跨訪客同步，需要在 `data/community-config.json` 設定後端 endpoint。

## 前台資料

首頁、文章彙整、分類頁和標籤頁都讀取 `data/posts.json`。如果文章沒有出現在首頁，先檢查這個檔案是否有同步到 GitHub。

