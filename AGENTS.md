# Lexiro Worker

先讀 `structure.md`。本目錄是獨立的 private 後端 repository `tavricccc/lexiro-worker`；不要將它放進 public Lexiro repo，也不要把 secret 寫入任何版控檔案。

- 原始藍圖與使用者補充決策在上一層的 `lexiro-backend-blueprint-2026-09-12.html`、`lexiro-backend-decisions-2026-09-12.md`。
- Firestore rules 管使用者資料；Worker 管身分驗證、管理員、額度與供應商憑證。管理員只由 `ADMIN_EMAILS` secret 與已驗證 email 決定。
- 使用者已同意以盡量符合免費 CPU 為目標，Worker 可過濾回傳元資料。文字輸出保持原內容，移除 Response 的上下文回顯。模型／reasoning／token 只要求介面不顯示，可以存在於程式碼與網路回應，不需做模型 ID bundle 隱藏守門。Prompt 與 API key 仍放後端。不得把本地 benchmark 當成 Cloudflare CPU 用量。
- 不做 fallback、舊代碼相容或付費方案自動升級。使用者要求前後端按可驗證階段分段 commit；直接在 main 上工作，不自行建 PR 或另開 branch。推送或部署依使用者當次授權執行；建立本 private repo 與初始推送已在本次明確授權，這不等於授權部署正式 Worker。
- 本地開發只使用本地 D1 與合成供應商，不使用 `--remote`。
- 跨使用者的 prompt cache key 只跟固定提示版本有關，不帶 uid。
- 新增、刪除或搬移檔案時更新 `structure.md`。持久化 schema 變動必須有 migration 與版號。
- 使用 FastCtx 讀取與搜尋本地檔案。型別嚴格，不用 any。測試斷言回傳資料、串流及儲存狀態，不比對原始碼字串。
- 每次實作後執行 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。
