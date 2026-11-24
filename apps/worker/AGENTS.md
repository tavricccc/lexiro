# Lexiro Worker

先讀 `structure.md`。本目錄是 public monorepo `tavricccc/lexiro` 的後端；不要把 secret 或使用者資料寫入任何版控檔案或 workflow 輸出。

- 原始藍圖在 `docs/backend-blueprint.html`，使用者補充決策在 `docs/product-decisions.md`；與藍圖衝突時以補充決策為準。
- 教材與偏好存於專用 D1，由 Agent Worker 驗證 Firebase Auth 並限定 uid；前端同步與 MCP 共用 repository。管理員只由 `ADMIN_EMAILS` secret 與已驗證 email 決定。Firestore 已停用，不做舊資料遷移或 fallback。
- 使用者已同意以盡量符合免費 CPU 為目標，Worker 可過濾回傳元資料。Prompt 與 API key 仍放後端。不得把本地 benchmark 當成 Cloudflare CPU 用量。
- 不做 fallback、舊代碼相容或付費方案自動升級。前後端按可驗證階段分段 commit，直接在 main 上工作，不建 PR 或另開 branch。**完整實作完成前只 commit，不 push；沒有實際問題就持續工作。** 不自行部署正式 Worker。
- 本地開發只使用本地 D1，不使用 `--remote`。
- 新增、刪除或搬移檔案時更新 `structure.md`。持久化 schema 變動必須有 migration 與版號。
- 使用 FastCtx 讀取與搜尋本地檔案。型別嚴格，不用 any。測試斷言回傳資料、串流及儲存狀態，不比對原始碼字串。
- 每次實作後執行 `npm run typecheck`、`npm run lint`、`npm run test`、`npm run build`。
- Node 24 只在互動式 bash 載入：用 `bash -ic '<cmd>'` 執行。`git pull` 後先 `npm ci`。
- 資料格式在 `src/contract`，是前端 `../web/packages/contract` 的複本：兩邊要保持一致，改動先在前端改，再複製過來。只保留最新 API，不做版本並存。
- MCP 工具說明有長度上限（`agent-d1.test.ts` 檢查總長 < 9000 字元，因為每次連線都會送給模型）。改 `src/agent/mcp.ts` 的說明時保持精簡，加字就要刪等量的字。
- 給 agent 的資料格式寫在 `src/agent/mcp.ts` 與 `src/agent/instructions.ts`，兩處要一致：`meaningZh` 只放中文意思（會當成選項）；課本補充放 `description`，一點一行用 `\n` 分隔，行首不加符號或編號（App 與網頁會自己加 bullet）。
- 測試一個 `it` 只測一個行為，標題寫出那個行為；需要共同資料時寫 seed helper，不要把多個行為串在同一個測試裡。預期的拒絕要斷言錯誤代碼或訊息，不寫裸的 `toThrow()`，否則 revision 過期等不相干的錯誤也會讓測試通過（zod schema 錯誤除外）。
