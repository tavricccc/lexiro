# Lexiro Worker

先讀 `structure.md`。本目錄是獨立的 private 後端 repository `tavricccc/lexiro-worker`；不要將它放進 public Lexiro repo，也不要把 secret 寫入任何版控檔案。

- 原始藍圖在 `docs/backend-blueprint.html`，使用者補充決策在 `docs/product-decisions.md`；與藍圖衝突時以補充決策為準。
- 教材與偏好存於專用 D1，由 Agent Worker 驗證 Firebase Auth 並限定 uid；前端同步與 MCP 共用 repository。管理員只由 `ADMIN_EMAILS` secret 與已驗證 email 決定。Firestore 已停用，不做舊資料遷移或 fallback。
- 使用者已同意以盡量符合免費 CPU 為目標，Worker 可過濾回傳元資料。Prompt 與 API key 仍放後端。不得把本地 benchmark 當成 Cloudflare CPU 用量。
- 不做 fallback、舊代碼相容或付費方案自動升級。前後端按可驗證階段分段 commit，直接在 main 上工作，不建 PR 或另開 branch。**完整實作完成前只 commit，不 push；沒有實際問題就持續工作。** 不自行部署正式 Worker。
- 本地開發只使用本地 D1，不使用 `--remote`。
- 新增、刪除或搬移檔案時更新 `structure.md`。持久化 schema 變動必須有 migration 與版號。
- 使用 FastCtx 讀取與搜尋本地檔案。型別嚴格，不用 any。測試斷言回傳資料、串流及儲存狀態，不比對原始碼字串。
- 每次實作後執行 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。
