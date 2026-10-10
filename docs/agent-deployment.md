# Agent 變更紀錄與首次正式部署

2026-10-10。實作已 commit，本機驗證完成；Agent 的正式 D1、KV、service account 和 HTTPS 服務尚未配置或部署。本文件記錄下一次發布的操作，不是正式環境已完成的回條。

## 這次變更

| 項目 | 內容 |
| --- | --- |
| 獨立服務 | `src/agent/index.ts`／`wrangler.agent.toml` 提供無模型金鑰的 Agent Worker，和既有生成／計費 Worker 分開 |
| MCP 與 OAuth | Streamable HTTP `/mcp`、S256 PKCE、DCR／CIMD、OAuth discovery、access token 更新及解除連線；完整教材 CRUD 限自己的帳號 |
| 單集 URL | `/access/{id}` 只授權 uid＋setId，隨機 bearer token 只以 SHA-256 存入 D1；預設兩小時，API 期限範圍五分鐘至 24 小時，可撤銷 |
| 教材寫入 | 共用前端 `@lexiro/agent-contract` 1.0.0；Firestore REST transaction 同時提交原生 records-v9、meta marker、來源進度調整和操作回條 |
| 重送與衝突 | `expectedRevision` 防止覆蓋其他修改；`operationId` 保留冪等回條；invalid content 回 400 並附具體錯誤 |
| 命題 | instructions 要求缺少題型先問；brief 提供正式規則與 output schema，URL／MCP 都可選取來源分批生成，支援後續編輯與刪除 |
| 持久化 | Agent D1 schema v1：`agent-migrations/0001_agent_access.sql`；OAuth 使用專用 KV，Firestore 教材維持 v9，未新增計費 migration |
| 清理 | 每小時 UTC 第 17 分 Cron 清除過期授權請求、過期／撤銷七天以上 URL 記錄，以及分頁清理 OAuth KV |
| 工具與驗證 | 新增本機 D1 fixture、HTTP smoke、production repository 合成 REST 測試；Wrangler 更新至 4.149.0、Miniflare 更新至 5.20261006.1-alpha，既有測試配置一併遷移 |

Backend commits：`60a53e2`、`7fd6aaf`。配套 frontend commits：`0533ec3`、`4277f00`。上一輪 frontend 415／backend 191 個測試與四個 gate 通過；具體 HTTP 和 Sub-agent 回條見 [本機測試結果](agent-local-results.md)。正式 Firebase 登入、Firestore、ChatGPT 連線、Cron 與 Cloudflare CPU 仍待驗收。

## 目前部署流程缺少什麼

`.github/workflows/deploy.yml` 使用預設 `wrangler.toml`，只部署生成 Worker、計費 DB 與模型相關 secrets。它不會建立 Agent DB／KV、設定 Agent 的 Firebase secret、套用 agent-migrations 或部署 `wrangler.agent.toml`。首次 Agent 發布需走下面的專用命令；日後若要自動部署，再建立獨立的 Agent job／workflow。

前端 workflow 尚未傳入 `NEXT_PUBLIC_AGENT_WORKER_URL`，部署前需補 GitHub Production variable 及 job env，Vercel Production 設相同值。僅新增 GitHub variable 不會自動成為 job 的環境變數。

## 1. 確認三個原點與 Firebase project

| 設定 | 填入的值 |
| --- | --- |
| Agent `APP_ORIGIN` | 實際固定正式前端，例如 `https://lexiro.vercel.app`；不含 `/app`、其他 path 或結尾 `/` |
| Agent `AGENT_PUBLIC_URL` | 首次部署要使用的固定 HTTPS Worker 原點，例如 `https://lexiro-agent.<你的Workers子網域>.workers.dev`；不含 `/mcp` 或結尾 `/` |
| 前端 `NEXT_PUBLIC_AGENT_WORKER_URL` | 與 `AGENT_PUBLIC_URL` 完全一致 |
| ChatGPT／Codex MCP 網址 | `AGENT_PUBLIC_URL` 加 `/mcp` |
| Agent `FIREBASE_PROJECT_ID` | 與前端 Firebase project、service account 的 `project_id` 相同 |

目前設定檔中的 `https://lexiro.vercel.app` 是待核對的前端值；Agent 子網域、D1／KV ID 和 Firebase project 仍有 placeholder。部署前逐項替換，使用同一個 canonical Agent origin 做 discovery、OAuth 和 MCP 測試。

## 2. 建立專用資源與憑證

在已具備相應 Cloudflare 帳號權限的 PowerShell 7 中執行，工作目錄為 private `lexiro-worker`：

```powershell
npm ci
npx wrangler d1 create lexiro-agent-access
npx wrangler kv namespace create OAUTH_KV --config wrangler.agent.toml
```

把回傳 IDs 分別填入 `wrangler.agent.toml` 的 `AGENT_DB.database_id` 和 `OAUTH_KV.id`，同時填入上一節的 vars。兩個資源都供 Agent 使用；不要填原本計費 DB 的 ID，也不要把 local fixture 的假 ID 帶上正式環境。若使用 API token，需有建立／管理 Worker、D1 與 KV 的權限；原本只供生成 Worker 使用的 token 可能需補 KV 權限。

在相同 Google Cloud／Firebase project 建立專用 service account，授予 Firestore 讀寫所需的 `roles/datastore.user`，取得 JSON 金鑰，透過 Worker secret 提交：

```powershell
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --config wrangler.agent.toml
```

依提示提交完整 JSON，不把內容寫進 TOML、公開 repo、前端環境變數或文件。前端既有的 GitHub `FIREBASE_SERVICE_ACCOUNT` 用於發布 rules／indexes，不等於 Agent secret 已設定；Agent 建議使用獨立、較小權限的身分。此 Worker 不需要 `OPENAI_API_KEY` 或 `ADMIN_EMAILS`。

Service account 透過 IAM 存取 Firestore，教材 scope 由 Agent Worker 按 uid／setId 檢查。不要為了 Agent 放寬 Firestore Web rules；它使用原本 v9 教材格式。

## 3. 先發布 Agent Worker

在確定要發布、設定已填妥且 secrets 提交完成後執行：

```powershell
npm run typecheck
npm run lint
npm run test
npm run build
npx wrangler d1 migrations apply AGENT_DB --remote --config wrangler.agent.toml
npx wrangler deploy --config wrangler.agent.toml
```

本次新增的 migration 是 `agent-migrations/0001_agent_access.sql`，只套到 `AGENT_DB`。`agent-migrations/fixtures/local-agent.sql` 和 `tests-next/agent-local-entry.ts` 只用於本機，不發布到正式服務。上述 remote／deploy 命令留給下一次已授權發布，本次未執行。

確認 Wrangler 回傳的網址與 `AGENT_PUBLIC_URL` 一致，檢查 Agent secret、D1、KV、每小時 Cron 和正式入口。原本生成 Worker 若同時更新，仍依 [生成 Worker 部署文件](deployment.md) 發布；Agent 的專用部署不會代替它。

## 4. 設定並發布前端

在 frontend repo 的 GitHub `Production` Environment 新增 `NEXT_PUBLIC_AGENT_WORKER_URL` variable，並在 `.github/workflows/deploy.yml` job `env` 補上：

```yaml
NEXT_PUBLIC_AGENT_WORKER_URL: ${{ vars.NEXT_PUBLIC_AGENT_WORKER_URL }}
```

Vercel Project 的 Production Environment 也設定同名變數、同一個 Agent 原點。現有流程先做一般 build，再 pull Vercel production settings 並執行 Vercel build；兩處保持一致。`NEXT_PUBLIC_` 值在 build 時進入前端，改值後須重新 build／deploy。

Firebase Authentication → Settings → Authorized domains 應包含正式前端 hostname，例如 `lexiro.vercel.app`，此處只填 hostname。沿用原本 Firebase `authDomain`／Google provider；前端的 `/agent/authorize` 是 MCP 同意頁，不是 Google 的 `__/auth/handler`。[Firebase Google 登入](https://firebase.google.com/docs/auth/web/google-signin)、[網域驗證 FAQ](https://firebase.google.com/docs/auth/faq-and-troubleshooting)。

Agent 已部署並通過基本檢查後，再發布 frontend main 或執行現有 deployment workflow。它會驗證、部署既有 Firestore rules／indexes，再發布 Vercel prebuilt output；使用者明確啟用 PWA 更新後取得新介面。

## 5. 正式驗收

以下是無使用者資料的初步檢查，先把 `$agentOrigin` 改成已部署的實際網址：

```powershell
$agentOrigin = 'https://lexiro-agent.<你的Workers子網域>.workers.dev'
Invoke-RestMethod -Uri "$agentOrigin/health"
Invoke-RestMethod -Uri "$agentOrigin/.well-known/oauth-authorization-server"
Invoke-RestMethod -Uri "$agentOrigin/.well-known/oauth-protected-resource/mcp"
curl.exe --silent --show-error --include "$agentOrigin/mcp"
```

應看到 health 200、OAuth metadata 200、resource 精確等於 `$agentOrigin/mcp`，未登入的 MCP 回 401 並帶 `WWW-Authenticate` discovery challenge。這個服務的 resource 帶 `/mcp`，因此 protected-resource metadata 路徑也帶 `/mcp`，不要只測根目錄的 well-known。

以獨立測試帳號、可刪除的測試單字集驗收：

- 前端登入及雲端同步成功；新增空白集 URL、既有集 URL 都能產生與複製，scope 符合當前帳號／集。
- Agent 讀 instructions、詢問缺少的題型資訊，自行新增單字與題目，再讀回、編輯、刪除；前端同步後能看見實際結果。
- 大集以選取的 senseIds 分批命題；驗證錯誤可修稿，版本衝突拒絕覆蓋，同 operationId 重送不多建內容。
- 撤銷、到期、其他使用者及其他集的存取均被拒絕；刪除來源不影響其他集，原本整體學習歷史保留。
- ChatGPT／Codex 使用 Agent `/mcp` 完成 OAuth，能讀取 12 個工具與執行 CRUD；解除後原 access token、更新後 token 都失效。
- 檢查每小時清理 Cron 的正式執行紀錄及 Cloudflare CPU／錯誤，不以本機測試冒充正式效能結果。

`npm run test:agent` 會 seed 本機合成資料，只對 `wrangler.agent-local.toml` 的 localhost 執行，不能拿來當正式 smoke。正式回條記錄 status、測試資料名稱與結果即可，不保存 token、金鑰或重要教材內容。

## 免費 vercel.app 與日後換網域

按目前分開部署的架構，可以沿用免費的固定正式 `vercel.app` 網域。Vercel 提供專案網址及 SSL；OpenAI Docs 的連線條件是 HTTPS、可到達的服務與正確 OAuth metadata，無須因為加入這次功能就購買網域。這是依規格與部署架構作出的判斷，正式連線仍須按上面步驟驗收。[Vercel 網域](https://vercel.com/docs/domains/working-with-domains)、[SSL](https://vercel.com/docs/domains/working-with-ssl)、[OpenAI OAuth](https://developers.openai.com/plugins/build/auth)。

前端使用 Production URL，避免每次改動會不同的單次部署／Preview URL；它會影響 `APP_ORIGIN` 的 CORS 與授權頁返回位址匹配。[Vercel 部署網址](https://vercel.com/docs/deployments/generated-urls)。MCP、OAuth discovery、token 與授權 URL 在 Agent Worker；兩小時是 bearer URL 的有效期，Agent 分次讀寫，不依賴 Vercel 長請求。

若更換前端域名，更新 `APP_ORIGIN`、Firebase Authorized domains，再驗證登入與 CORS。若更換 Agent 域名，更新 `AGENT_PUBLIC_URL`、前端公開變數並重新連結 MCP；先前發出的舊 hostname URL 不會自動換址。
