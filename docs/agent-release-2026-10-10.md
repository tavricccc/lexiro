# Agent 功能變更與部署維護

2026-10-10。MCP OAuth 與單字集授權 URL 已完成；教材與同步已改用 D1，Firebase 只保留登入。Agent 入口為 `https://lexiro-agent.tavric.workers.dev`。正式 OAuth／D1 CRUD 已驗證；工程端未操作 ChatGPT 連線 UI。

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
| 寫入與同步 | 網站、MCP、授權 URL 共用 D1；版本衝突拒絕覆蓋，同一操作重送不重複新增，刪除來源會移除失效題目 |
| 資料夾與批次上限 | MCP 可新增、改名、移動與刪除空資料夾，建立集可指定資料夾；單次單字新增／刪除上限 200 筆，201 筆拒絕 |

初版前端 commits：`0533ec3`（共用 Agent 教材契約）、`4277f00`（URL 入口、OAuth 同意頁、連線管理與同步）。初版共用契約為 2.0.0，在安裝與 build 時產生 bundle，不需手動把 dist 放入版控；目前契約為 3.0.1。

上一輪本機驗證：前端 415 個、private backend 191 個測試，以及 typecheck、lint、build 通過。`gpt-6.1-sol low` Sub-agent 實際生成兩題後讀回、編輯與刪除，並驗證 OAuth 更新／解除、URL 到期／撤銷及跨帳號／跨集限制。這些結果不代表已驗收正式 Firebase、ChatGPT 或 Cloudflare CPU。

## 下一次部署

正式 AGENT_DB、CLOUD_DB 與 OAuth KV 已配置；Firebase Auth 沿用原專案，Agent 不再需要 service-account 憑證。後端變更發布獨立 Agent Worker；有前端 runtime 變更時再發布前端：

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
# 有前端 runtime 變更時，確認 Agent 成功後再發布前端
gh workflow run deploy.yml --repo tavricccc/lexiro --ref main
```

Agent workflow 會完整驗證、套用 `agent-migrations` 與 `library-migrations`、部署及檢查 discovery；不再同步 Firebase secret。Agent Worker 沒有模型 API key。前端 workflow 使用 GitHub `Production` variable `NEXT_PUBLIC_AGENT_WORKER_URL`，目前值為 `https://lexiro-agent.tavric.workers.dev`，並自動同步到 Vercel Production 後重新 build；不再發布 Firestore rules／indexes。

若只改前端，照既有 main 發布流程即可。若更換 Agent 網址，更新上述 variable 與 private Worker 的 `AGENT_PUBLIC_URL`，值不帶 `/mcp` 或結尾 `/`，再依序發布及重新連結 MCP。前端 domain 改動才需調整 `APP_ORIGIN` 與 Firebase Authorized domains；同一 Firebase 專案與登入設定繼續使用。

使用者依既有 PWA 更新流程明確啟用新版。依使用者決定，D1 從空白開始，不遷移舊資料；`d1-v1` 本機 namespace 防止舊快取自動上傳。134 筆教材匯入由原本的 Agent 處理。Cron 實際執行及長任務 CPU 需另觀察。維護細節見 [D1 雲端維護](d1-cloud.md) 與 private `lexiro-worker/docs/agent-deployment.md`；操作見 [Agent 使用說明](agent-access.md)。

## 免費 vercel.app 網域

可以繼續使用固定的正式 `https://你的專案.vercel.app`，無須為這次功能另外購買網域。Vercel 提供專案網址與 SSL；OpenAI Docs 要求 MCP 服務使用可到達的 HTTPS 網址與正確 OAuth 設定。依這些要求與目前架構判斷，免費 hostname 本身不構成限制。[Vercel 網域](https://vercel.com/docs/domains/working-with-domains)、[SSL](https://vercel.com/docs/domains/working-with-ssl)、[OpenAI MCP](https://developers.openai.com/plugins/build/mcp-server)。

前端提供登入、OAuth 同意與教材介面；MCP、授權 URL、discovery 和 token endpoint 在獨立 Cloudflare Agent Worker。`APP_ORIGIN` 指向固定的正式前端原點，`NEXT_PUBLIC_AGENT_WORKER_URL` 指向固定 Agent 原點，ChatGPT 貼的是 Agent 原點加 `/mcp`。不要把每次部署不同的 Preview URL 用作正式 `APP_ORIGIN`；Vercel 區分單次部署網址和指向目前正式版的 Production URL。[Vercel 部署網址](https://vercel.com/docs/deployments/generated-urls)。

兩小時是 URL token 的有效期；Agent 期間分次向 Worker 讀寫，沒有一個需要 Vercel 持續執行兩小時的請求。若之後換前端網域，要更新 `APP_ORIGIN` 與 Firebase Authorized domains；若換 Agent 網域，則要更新 Agent 公開原點、前端變數並重新連結 MCP。

## 初版 Firestore 上線回條（已由 D1 版本取代）

- Frontend commit `7e7b505` 的 [正式 deployment workflow](https://github.com/tavricccc/lexiro/actions/runs/38058006644) 成功，包含 typecheck、lint、tests、build、Firebase rules／indexes 與 Vercel prebuilt 發布。
- 正式網站為 `https://lexiro.vercel.app`；`/agent/authorize` 與 `/app/me/agents` HTTP 200，發布後的 JS bundle 已包含正確 Agent 原點。
- Backend commit `95985cf` 的 [Agent deployment workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38057821258) 成功，192 個測試通過。首次正式測試發現的 Cloudflare 原生 fetch 接收物件問題已修正及重新發布。
- 正式 HTTPS 38 個檢查通過：真實 Firebase custom-token 換 ID token、Firestore 原生教材讀寫、MCP OAuth／12 tools、URL 命題 brief、題目新增／編輯／刪除、更名與重送、撤銷及解除後拒絕存取。測試沒有呼叫模型 API，合成帳號與教材已清除。
- ChatGPT UI 尚未手動連結；可使用 `https://lexiro-agent.tavric.workers.dev/mcp` 選 OAuth 連線。Cron 真正執行與長任務 CPU 尚待觀察。

## D1 正式上線回條

- Backend commit `1a6a82e` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38063285944) 成功，193 個測試、typecheck、lint、build、兩組 D1 migrations 與 discovery 通過。
- Frontend commit `0234252` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38063531929) 成功，400 個測試、typecheck、lint、build 與發布通過。正式 JS 已含 D1 同步程式，不含 Firestore endpoint；OAuth／連線管理頁 HTTP 200。
- 正式 HTTPS 45 項檢查通過：真實 Firebase Auth、OAuth S256、17 個 MCP 工具、一次寫入及讀回 200 筆、201 筆拒絕且不部分寫入、資料夾 CRUD、URL 分類、網站同步與 MCP 共用資料、進度／統計／偏好 CAS、重送、刪除 tombstone、refresh 與撤銷。
- 測試未呼叫模型 API。合成 Firebase 帳號、D1 資料、URL 與 OAuth client 已清除；未匯入或修改使用者的 134 筆教材。
- Agent Worker 的 Firebase service-account secret 與 private GitHub Production 對應副本已刪除；Worker secret list 為空。一次性診斷憑證 artifact 已刪除。

## 2026-10-11 Agent 批次寫入更新

共用契約 3.0.0 已發布，MCP 新增唯讀 validate_generated_questions，共 18 tools。來源改用每題 senseId，不要求順序或全來源覆蓋；partial 保存有效題並回逐題錯誤，atomic 有錯則不保存題目。篇幅只回 Warning，解說選填；不呼叫模型做難度、風格或語意相似度評鑑。MCP revision／operationId 選填，提供時保留版本與回條保護，D1 CAS 一直有效。

後端 `dc86551` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38066261701) 與前端 `88bc186` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38066476190) 都成功。本機合成 100 題確認 97 保存、3 錯誤；前後端 597 個測試、typecheck、lint、build 和本機 MCP HTTP 驗證通過。正式 discovery／前端路由驗證通過；未測正式 100 題寫入或 CPU，未修改使用者教材。完整規則與回條見 [批次寫入](agent-validation.md)。

## 2026-10-11 按需查詢更新

URL 首頁／get_set 改回摘要；列表回 items 分頁，brief 預設只回小批 specification，完整提示改從 prompt 取一次。Agent 應重新讀首頁或重新整理 MCP 工具定義。MCP read_batch 和 REST POST query 共用13種 resource，可一次搜尋多種資料、篩題型與難度、讀指定範圍／欄位；27個工具也支援單字、單一詞義、例句及子題 patch。保存結果預設精簡，診斷另按需分頁讀。

本機195次 HTTP 回歸通過；`gpt-6.1-sol low` 子代理依補齊的指引用6次 HTTP、全部200完成新增、一次取來源與完整提示、生成保存、細部編輯與一次精確讀回。合成200詞／199題的整集教材 JSON 約60,322 tokens，首頁約1,004、指定5詞與3題約746（o200k_base估算）。條件與範例見 [按需操作](agent-query.md)。

本次只有 Agent runtime 和文件變更，執行 deploy-agent.yml 即可；不需要新版資料 migration、共用套件或 Vercel 發布。完整五型原提示與內建生成共用，沒有修改使用者教材或呼叫模型 API。

發布回條：後端 `b728392`（實作 `0e5011e`）的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38072862060) 成功，遠端197個測試與全部發布檢查通過。正式 health／OAuth discovery 200、未授權 MCP POST 401。公開前端 `5ffc3f0` 僅更新文件，本次沒有 Vercel 發布；新功能的 authenticated 讀寫證據來自本機合成資料與子代理，未寫入正式使用者教材或測量正式CPU。
