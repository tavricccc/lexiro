# Agent MCP、OAuth 與單字集授權 URL

Agent 自己生成教材，Lexiro 只驗證、讀寫原本的 Firestore 資料。`wrangler.agent.toml` 是獨立 Worker，沒有模型供應商 API key、計費 DB 或生成 Durable Object binding。原本付費生成服務保持獨立。

本次變更、正式發布回條與後續維護見 [Agent 部署](agent-deployment.md)，包含獨立 workflow、Firebase 憑證、Vercel 網域與驗收範圍。

## 授權範圍

| 入口 | 身分 | 範圍 | 有效時間 |
| --- | --- | --- | --- |
| `/mcp` | OAuth 2.1、S256 PKCE、Firebase 登入授權 | 登入者自己的所有單字集，可從零新增集 | Access token 1 小時；refresh grant 最多 30 天，可解除 |
| `/access/{id}?token=…` | 256-bit 隨機 bearer token，D1 只存 SHA-256 | 一位使用者的一個既有集，包括空白集 | 預設 2 小時；API 5 分鐘至 24 小時；UI 30 分鐘／2 小時／6 小時，可提前撤銷 |

兩種入口均能新增、編輯、刪除單字、詞義、例句、正式題目／文章題組，以及刪除整集。URL 不能切換 setId，MCP 不能操作其他使用者、點數或帳號設定。連結是可重複使用的授權，不會首次讀取後失效。

Agent instructions 要求：先讀取範圍與目前資料；未提供時先問題型、難度、數量及新增／編輯，已提供的資訊不要重問。題型是詞彙、綜合測驗、文意選填、篇章結構、閱讀。命題 brief 重用正式命題規則與 JSON Schema；儲存重用前端同一套來源、挖空、篇幅與題目解析器。驗證通過不是教育品質保證，Agent 仍須依實際空格與上下文檢查唯一解。

## 寫入與同步

每次修改帶剛讀取的 `expectedRevision` 和新的 UUID `operationId`。Firestore transaction 一起提交 records-v9、meta/library-v9 和 agent-operations 回條。斷線後重送原 envelope／operationId 會取得同一回條；不同內容重用 operationId 回 409。版本衝突回 409 `stale_set`，先重讀再依原意合併。400 `invalid_content` 帶具體錯誤，可修稿後使用新 operationId。

來源詞義改名時重綁有效題目與該詞義學習資料；來源刪除時移除失效題目與來源進度，保留其他單字集及整體歷史。前端收到 agent meta marker 後同時讀回教材與進度，不需保持頁面開啟才能寫入。尚未完成 v9 同步／遷移的單字集不能產生 URL，先在 Lexiro 同步。

## 本機驗證

在 PowerShell 7、private backend 目錄執行：

```powershell
npm ci
npm run db:migrate:agent
npx wrangler d1 execute AGENT_DB --local --config wrangler.agent-local.toml --file agent-migrations/fixtures/local-agent.sql
npm run dev:agent
```

另一個 PowerShell 7 終端：

```powershell
npm run test:agent
```

測試入口只在 `wrangler.agent-local.toml`，使用本機 D1 與合成使用者，不包含正式 Firebase 驗證的 bypass。測試腳本會重新 seed 本機 fixture，限本機使用。`src/agent/index.ts` 才是正式入口。真實 HTTP、DCR、PKCE、token 更新、MCP 工具與 URL CRUD 的結果見 [agent-local-results.md](agent-local-results.md)。Firestore production repository 另以合成 REST transport 驗證 transaction、原生記錄、scope、回條與刪除保留範圍；這不代表已連正式 Firestore。

## 正式設定與後續發布

`wrangler.agent.toml` 已填入正式 D1／KV、`wordmem-497209` 與固定 Agent 原點 `https://lexiro-agent.tavric.workers.dev`。沿用現有 Firebase project 和 service account；既有部署不需重新建立 Firebase 或 Agent 資源。

Firebase JSON 已設定為 Worker secret 與 private backend GitHub `Production` 的 `FIREBASE_SERVICE_ACCOUNT`。該身分由 IAM 控制，後端按請求限制使用者／單字集；Firestore Web rules 不會代替 service-account 的 scope 檢查。不要把金鑰存入版控，也不要把模型 API key 複製到此 Worker。

Agent 使用獨立 `deploy-agent.yml`，相關 main 變更會自動觸發，亦可手動發布。前端 workflow 已把 GitHub `NEXT_PUBLIC_AGENT_WORKER_URL` 同步到 Vercel Production，再重新 build。

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
```

正式 migration、Worker 發布與 HTTPS OAuth／CRUD 已於 2026-10-10 執行；具體結果與尚待 ChatGPT UI 驗收的部分見部署回條。每小時 Cron 清除過期授權請求、過期／撤銷七天以上的 URL 記錄，並分頁清理 OAuth KV。Firestore 操作回條保留，以便長時間後仍辨識重送操作。

## 使用

ChatGPT／Codex 加入遠端 MCP：貼 `https://lexiro-agent.tavric.workers.dev/mcp`，選 OAuth，在 Lexiro 登入並同意完整教材管理權限。服務提供 protected-resource／authorization-server discovery、DCR 和 CIMD。正式 HTTP 協定已驗證，ChatGPT 的連線 UI 尚未操作。

URL：Lexiro 新增集選「交給自己的 Agent」，或既有集按「產生授權 URL」，複製給支援 HTTP GET／PATCH 的 Agent。一般 ChatGPT 對話只讀一個網頁不會因此得到 HTTP 寫入工具，ChatGPT 應透過 MCP 操作；Codex／CLI Agent 可直接讀 URL 再依 instructions 寫入。不要把 token 記入公開檔案、截圖或操作報告。撤銷及 OAuth 解除入口在「我的 → Agent 連線」。

URL 也可用 header token，避免把秘密再放入後續操作網址：

```http
GET /access/{id}
Authorization: Bearer <token>
Accept: application/json

PATCH /access/{id}
Authorization: Bearer <token>
Content-Type: application/json

{"expectedRevision":"<GET 的 revision>","operationId":"<新的 UUID>","action":{"type":"rename_set","setName":"校外教學單字"}}
```

生成題目先 `GET /access/{id}/brief?kind=vocabulary&difficulty=2`，帶同一 token；依 brief 的 `sources`、`outputSchema`、`rules` 生成 raw JSON，再提交 `generated_questions` 的 kind、difficulty、senseIds 與 output。後續編輯讀回正式題目，保留 id，用 `put_questions` 提交完整物件。

較大的單字集按 `recommendedMaxSources` 分批；URL brief 可重複带 `senseId` query 參數只選這批來源，MCP `get_generation_brief` 使用 `senseIds`。每次提交同一批 senseIds，沿用 brief 的來源 ref，完成一批後重讀最新 revision 再處理下一批。本機前端用 `http://localhost:3601`，Agent 公開原點用 `http://127.0.0.1:8791`，避免 OAuth audience 與瀏覽器 CORS 原點不一致。
