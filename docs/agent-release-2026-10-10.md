# Agent 功能變更與下一次部署

2026-10-10。MCP OAuth 與單字集授權 URL 已完成本機實作；尚未部署或驗收正式 ChatGPT／Firestore 連線。

## 這次新增的功能

| 變更 | 使用方式與範圍 |
| --- | --- |
| 自己的 Agent 生成教材 | Agent 自己產生內容後上傳；Agent 服務驗證、儲存，不呼叫模型供應商 API、不扣 Lexiro 生成點數 |
| MCP OAuth | 登入 Lexiro 後，允許應用程式完整新增、編輯、刪除自己帳號的單字集、單字、詞義、例句與題目 |
| 單字集授權 URL | 限定一位使用者的一個集，包含刪除整集的權限；預設兩小時，介面可選 30 分鐘、兩小時或六小時，也可提前撤銷 |
| 新增集入口 | 在新增流程選「交給自己的 Agent」，或手動表單按「產生授權 URL」；先儲存集，再取得連結 |
| 既有集入口 | 集頁首按「產生授權 URL」，讓 Agent 接續新增、修改或刪除內容 |
| 連線管理 | 「我的 → Agent 連線」提供 MCP 網址、已授權應用程式、解除連線與 URL 撤銷 |
| 命題 instructions | 未提供時先詢問題型、難度、數量及新增／編輯需求；已提供的資訊不重問，支援五種學測題型及後續編輯 |
| 寫入與同步 | 沿用既有雲端教材；版本衝突會拒絕覆蓋，重送同一操作不重複新增，刪除來源會移除失效題目，保留其他集與整體學習歷史 |

前端 commits：`0533ec3`（共用 Agent 教材契約）、`4277f00`（URL 入口、OAuth 同意頁、連線管理與同步）。共用 `@lexiro/agent-contract` 1.0.0 在安裝與 build 時產生 bundle，不需手動把 dist 放入版控。

上一輪本機驗證：前端 415 個、private backend 191 個測試，以及 typecheck、lint、build 通過。`gpt-6.1-sol low` Sub-agent 實際生成兩題後讀回、編輯與刪除，並驗證 OAuth 更新／解除、URL 到期／撤銷及跨帳號／跨集限制。這些結果不代表已驗收正式 Firebase、ChatGPT 或 Cloudflare CPU。

## 下一次部署順序

1. 先在 private `lexiro-worker` 配置並部署獨立的 Agent Worker。它需要專用 D1、OAuth KV、Firebase service-account secret，以及正式前端原點；不能只部署原本的生成 Worker。
2. 取得 Agent 的固定 HTTPS 原點，把 `NEXT_PUBLIC_AGENT_WORKER_URL` 設成該原點，值不帶 `/mcp` 或結尾 `/`。
3. 在前端 GitHub `Production` Environment 新增同名 variable，並在 `.github/workflows/deploy.yml` 的 job `env` 補上以下一行。目前 workflow 尚未包含它：

   ```yaml
   NEXT_PUBLIC_AGENT_WORKER_URL: ${{ vars.NEXT_PUBLIC_AGENT_WORKER_URL }}
   ```

4. Vercel Project 的 Production Environment 也設定同名變數、同一個值。現有 workflow 先做一般 build，再 pull Vercel production settings、執行 Vercel prebuilt build；兩處設定一致才能讓驗證與發布使用同一個 Agent 服務。
5. 確認 Firebase Authentication 的 Authorized domains 包含實際正式前端 hostname。沿用現有 Firebase `authDomain`；不需要因為加入 MCP 就把它改成 `vercel.app`。
6. 在需要發布時 push 前端 main 或執行現有 workflow。它會驗證、部署 Firestore rules／indexes，再發布 Vercel 前端。使用者依既有 PWA 更新流程明確啟用新版。
7. 上線後，以測試帳號驗證新增空白集、既有集 URL、命題與編輯、到期／撤銷、OAuth 同意／解除，以及 ChatGPT 的 MCP 連線。正式測試資料不要使用重要的既有集。

後端逐步命令、設定值、migration 與驗收回條在 private `lexiro-worker/docs/agent-deployment.md`。既有功能的使用說明見 [Agent 操作](agent-access.md)。以上是下一次發布的待辦，本次只有補文件。

## 免費 vercel.app 網域

可以繼續使用固定的正式 `https://你的專案.vercel.app`，無須為這次功能另外購買網域。Vercel 提供專案網址與 SSL；OpenAI Docs 要求 MCP 服務使用可到達的 HTTPS 網址與正確 OAuth 設定。依這些要求與目前架構判斷，免費 hostname 本身不構成限制。[Vercel 網域](https://vercel.com/docs/domains/working-with-domains)、[SSL](https://vercel.com/docs/domains/working-with-ssl)、[OpenAI MCP](https://developers.openai.com/plugins/build/mcp-server)。

前端提供登入、OAuth 同意與教材介面；MCP、授權 URL、discovery 和 token endpoint 在獨立 Cloudflare Agent Worker。`APP_ORIGIN` 指向固定的正式前端原點，`NEXT_PUBLIC_AGENT_WORKER_URL` 指向固定 Agent 原點，ChatGPT 貼的是 Agent 原點加 `/mcp`。不要把每次部署不同的 Preview URL 用作正式 `APP_ORIGIN`；Vercel 區分單次部署網址和指向目前正式版的 Production URL。[Vercel 部署網址](https://vercel.com/docs/deployments/generated-urls)。

兩小時是 URL token 的有效期；Agent 期間分次向 Worker 讀寫，沒有一個需要 Vercel 持續執行兩小時的請求。若之後換前端網域，要更新 `APP_ORIGIN` 與 Firebase Authorized domains；若換 Agent 網域，則要更新 Agent 公開原點、前端變數並重新連結 MCP。
