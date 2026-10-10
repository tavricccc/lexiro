# Agent 功能變更與部署維護

2026-10-10。MCP OAuth 與單字集授權 URL 已完成；正式服務使用既有 Firebase project，Agent 入口為 `https://lexiro-agent.tavric.workers.dev`。HTTP OAuth／Firestore CRUD 已驗證，ChatGPT 的連線 UI 尚未操作。

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

## 下一次部署

正式 D1、OAuth KV 與 Firebase 憑證已配置；之後不需重建 Firebase，也不需重新建立 Agent 資源。後端變更先發布獨立 Agent Worker，再發布前端：

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
# 確認 Agent workflow 成功，再發布前端
gh workflow run deploy.yml --repo tavricccc/lexiro --ref main
```

Agent workflow 會完整驗證、套用專用 migration、同步 Firebase secret、部署及檢查 discovery；模型 API key 不會接到 Agent Worker。前端 workflow 使用 GitHub `Production` variable `NEXT_PUBLIC_AGENT_WORKER_URL`，目前值為 `https://lexiro-agent.tavric.workers.dev`，並自動同步到 Vercel Production 後重新 build。

若只改前端，照既有 main 發布流程即可。若更換 Agent 網址，更新上述 variable 與 private Worker 的 `AGENT_PUBLIC_URL`，值不帶 `/mcp` 或結尾 `/`，再依序發布及重新連結 MCP。前端 domain 改動才需調整 `APP_ORIGIN` 與 Firebase Authorized domains；同一 Firebase 專案與登入設定繼續使用。

使用者依既有 PWA 更新流程明確啟用新版。上線 smoke 使用可清除的測試帳號及單字集；ChatGPT UI 連結、Cron 實際執行及大集 CPU 需另驗收。後端配置、首次發布及維護細節在 private `lexiro-worker/docs/agent-deployment.md`；操作見 [Agent 使用說明](agent-access.md)。

## 免費 vercel.app 網域

可以繼續使用固定的正式 `https://你的專案.vercel.app`，無須為這次功能另外購買網域。Vercel 提供專案網址與 SSL；OpenAI Docs 要求 MCP 服務使用可到達的 HTTPS 網址與正確 OAuth 設定。依這些要求與目前架構判斷，免費 hostname 本身不構成限制。[Vercel 網域](https://vercel.com/docs/domains/working-with-domains)、[SSL](https://vercel.com/docs/domains/working-with-ssl)、[OpenAI MCP](https://developers.openai.com/plugins/build/mcp-server)。

前端提供登入、OAuth 同意與教材介面；MCP、授權 URL、discovery 和 token endpoint 在獨立 Cloudflare Agent Worker。`APP_ORIGIN` 指向固定的正式前端原點，`NEXT_PUBLIC_AGENT_WORKER_URL` 指向固定 Agent 原點，ChatGPT 貼的是 Agent 原點加 `/mcp`。不要把每次部署不同的 Preview URL 用作正式 `APP_ORIGIN`；Vercel 區分單次部署網址和指向目前正式版的 Production URL。[Vercel 部署網址](https://vercel.com/docs/deployments/generated-urls)。

兩小時是 URL token 的有效期；Agent 期間分次向 Worker 讀寫，沒有一個需要 Vercel 持續執行兩小時的請求。若之後換前端網域，要更新 `APP_ORIGIN` 與 Firebase Authorized domains；若換 Agent 網域，則要更新 Agent 公開原點、前端變數並重新連結 MCP。

## 2026-10-10 上線回條

- Frontend commit `7e7b505` 的 [正式 deployment workflow](https://github.com/tavricccc/lexiro/actions/runs/38058006644) 成功，包含 typecheck、lint、tests、build、Firebase rules／indexes 與 Vercel prebuilt 發布。
- 正式網站為 `https://lexiro.vercel.app`；`/agent/authorize` 與 `/app/me/agents` HTTP 200，發布後的 JS bundle 已包含正確 Agent 原點。
- Backend commit `95985cf` 的 [Agent deployment workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38057821258) 成功，192 個測試通過。首次正式測試發現的 Cloudflare 原生 fetch 接收物件問題已修正及重新發布。
- 正式 HTTPS 38 個檢查通過：真實 Firebase custom-token 換 ID token、Firestore 原生教材讀寫、MCP OAuth／12 tools、URL 命題 brief、題目新增／編輯／刪除、更名與重送、撤銷及解除後拒絕存取。測試沒有呼叫模型 API，合成帳號與教材已清除。
- ChatGPT UI 尚未手動連結；可使用 `https://lexiro-agent.tavric.workers.dev/mcp` 選 OAuth 連線。Cron 真正執行與長任務 CPU 尚待觀察。
