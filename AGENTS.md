# Lexiro monorepo

- `apps/web`：網頁（Vite SPA，部署到 Vercel）。
- `apps/app`：iOS App（Expo，EAS Update 與未簽章 .ipa）。
- `apps/worker`：後端（Cloudflare Workers）。

改哪個就先讀該目錄的 `AGENTS.md`；指令都在該目錄內執行，各有自己的 `package-lock.json`，沒有 npm workspaces。

- 這個 repo 是 public，Actions 紀錄也公開：不要把 secret 或使用者資料寫進版控檔案或印到 workflow 輸出。
- 資料格式的來源是 `apps/web/packages/contract`。改了之後執行 `node apps/worker/scripts/sync-contract.mjs` 與 `node apps/app/scripts/sync-core.mjs`，同一個 commit 提交。
- `.github/workflows` 依路徑觸發；新的 workflow 要設 `working-directory` 與 `paths`。
