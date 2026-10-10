# Agent 變更紀錄與首次正式部署

2026-10-10。正式資源已配置，沿用既有 Firebase project `wordmem-497209` 與 service account。Agent Worker 使用 `https://lexiro-agent.tavric.workers.dev`；當次發布與正式驗證結果見文件末尾。

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

## 部署流程

`.github/workflows/deploy.yml` 使用預設 `wrangler.toml`，部署生成 Worker、計費 DB 與模型相關 secrets。Agent 使用獨立 `.github/workflows/deploy-agent.yml`：完整檢查後套用 Agent migration、同步 Firebase secret、發布 `wrangler.agent.toml`，再驗證 discovery 與未授權 MCP。相關程式／配置變更會自動觸發，也可手動執行。首次網址傳播可能短暫回 404，health／discovery 檢查最多重試六次。

前端 workflow 已傳入 GitHub `Production` variable `NEXT_PUBLIC_AGENT_WORKER_URL`，並在發布時同步同名 Vercel Production 變數，再 pull settings／build。日後改 Agent origin 時更新 GitHub variable 並重新發布。

## 1. 確認三個原點與 Firebase project

| 設定 | 填入的值 |
| --- | --- |
| Agent `APP_ORIGIN` | 實際固定正式前端，例如 `https://lexiro.vercel.app`；不含 `/app`、其他 path 或結尾 `/` |
| Agent `AGENT_PUBLIC_URL` | 首次部署要使用的固定 HTTPS Worker 原點，例如 `https://lexiro-agent.<你的Workers子網域>.workers.dev`；不含 `/mcp` 或結尾 `/` |
| 前端 `NEXT_PUBLIC_AGENT_WORKER_URL` | 與 `AGENT_PUBLIC_URL` 完全一致 |
| ChatGPT／Codex MCP 網址 | `AGENT_PUBLIC_URL` 加 `/mcp` |
| Agent `FIREBASE_PROJECT_ID` | 與前端 Firebase project、service account 的 `project_id` 相同 |

正式前端為 `https://lexiro.vercel.app`，Agent 為 `https://lexiro-agent.tavric.workers.dev`。`wrangler.agent.toml` 已填入 Firebase project、Agent DB `8d68c8b8-cb7c-4b04-8d07-40555bb34f72` 與 OAuth KV `8dbae4f064ff4a5f8f0c7037b6c57345`；既有部署不要重建資源。下面建立命令供新環境使用。

## 2. 建立專用資源與憑證

在已具備相應 Cloudflare 帳號權限的 PowerShell 7 中執行，工作目錄為 private `lexiro-worker`：

```powershell
npm ci
npx wrangler d1 create lexiro-agent-access
npx wrangler kv namespace create OAUTH_KV --config wrangler.agent.toml
```

把回傳 IDs 分別填入 `wrangler.agent.toml` 的 `AGENT_DB.database_id` 和 `OAUTH_KV.id`，同時填入上一節的 vars。兩個資源都供 Agent 使用；不要填原本計費 DB 的 ID，也不要把 local fixture 的假 ID 帶上正式環境。若使用 API token，需有建立／管理 Worker、D1 與 KV 的權限；原本只供生成 Worker 使用的 token 可能需補 KV 權限。

沿用同一個 Firebase project；service account 須有 Firestore 讀寫權限（例如 `roles/datastore.user`）。可重用現有帳號；新建較小權限的專用帳號是選項，並非必須。以完整 JSON 設定 Worker secret：

```powershell
npx wrangler secret put FIREBASE_SERVICE_ACCOUNT --config wrangler.agent.toml
```

依提示提交完整 JSON，不把內容寫進 TOML、公開 repo、前端環境變數或文件。本次已把前端 GitHub 的既有 `FIREBASE_SERVICE_ACCOUNT` 接到 Agent Worker，並設定 private backend `Production` 的同名 secret，供後續 workflow 使用。Agent Worker secrets 只有 Firebase 憑證，不需要 `OPENAI_API_KEY` 或 `ADMIN_EMAILS`。

若原始 JSON 只存在 GitHub secret，可使用前端手動 workflow `prepare-agent-credential.yml`：部署者產生一次性 RSA-3072 公鑰／私鑰，只把 DER 公鑰的 base64 作為 input；workflow 用 AES-256-GCM 加密 JSON，以 RSA-OAEP-SHA256 包裝 AES key。取回 artifact 後在本機記憶體解密，透過 stdin 交給 Wrangler／`gh secret set`；完成後刪除 artifact 和一次性私鑰。workflow 不輸出或保存明文 JSON，artifact 最長保留一天。

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

`agent-migrations/0001_agent_access.sql` 已在本次授權發布中套用到正式 `AGENT_DB`。`agent-migrations/fixtures/local-agent.sql` 和 `tests-next/agent-local-entry.ts` 只用於本機，不發布到正式服務。後續發布可直接執行：

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
```

確認 Wrangler 回傳的網址與 `AGENT_PUBLIC_URL` 一致，檢查 Agent secret、D1、KV、每小時 Cron 和正式入口。原本生成 Worker 若同時更新，仍依 [生成 Worker 部署文件](deployment.md) 發布；Agent 的專用部署不會代替它。

## 4. 設定並發布前端

在 frontend repo 的 GitHub `Production` Environment 新增 `NEXT_PUBLIC_AGENT_WORKER_URL` variable，並在 `.github/workflows/deploy.yml` job `env` 補上：

```yaml
NEXT_PUBLIC_AGENT_WORKER_URL: ${{ vars.NEXT_PUBLIC_AGENT_WORKER_URL }}
```

前端 workflow 已包含這一行，並自動以 `vercel env add --force` 同步 Vercel Production 的值。流程先做一般 build，再 pull 更新後的 Vercel production settings 並執行 Vercel build。`NEXT_PUBLIC_` 值在 build 時進入前端，改值後須重新 build／deploy。

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

## 2026-10-10 正式部署回條

- Backend 發布 commit：`95985cf`；[Agent deployment run](https://github.com/tavricccc/lexiro-worker/actions/runs/38057821258) 成功。typecheck／lint／build 與 192 個測試通過；Worker version `c47d7332-7587-4e19-989b-0d145054e9c7`，100% traffic。
- 首次正式 CRUD 發現 repository 把原生 `fetch` 作為物件 method 呼叫，Cloudflare 回 `Illegal invocation`。已改成呼叫 global fetch 的 wrapper，並新增接收物件的回歸測試；修正後重新發布及驗收。
- 用 service-account 簽署的 custom token 向真實 Firebase Authentication 換取 ID token，再完成正式 HTTPS 的 DCR／S256 PKCE、授權 approve、access token、MCP initialize／12 tools、refresh 和 grant revoke。這是 HTTP 協定驗證，未操作 Google 登入瀏覽器或 ChatGPT 的連線 UI。
- 38 個正式 HTTP 檢查通過：MCP 建集／加字、URL 兩小時 scope、命題 brief、自行撰寫的詞彙題上傳／修改／刪除、集更名、同 operation 重送、原生 Firestore records-v9 讀回、URL 撤銷 410、刪集、解除後 token 401。測試未呼叫模型 API。
- 合成 Firebase 使用者、Firestore 文件、失敗測試遺留 grants 均已清除／撤銷；加密憑證 artifact 已刪除，一次性私鑰在工作完成後移除。正式 Worker secret 清單只有 `FIREBASE_SERVICE_ACCOUNT`。
- Cron schedule 已發布；每小時真正執行結果、長時間／大集 CPU、Google 登入與 ChatGPT UI 連結仍需觀察／實際驗收，不能由本次 HTTP smoke 推定。
