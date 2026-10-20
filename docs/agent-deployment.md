# D1 Agent 與同步部署

2026-10-10。Firebase 保留 Auth；教材與偏好改存 D1。前端和 Agent 共用資料及交易。使用者指定不遷移舊資料，新的 CLOUD_DB 從空白開始；不保留 Firestore fallback。單字匯入不屬於這次工程工作。

## 正式配置

| 設定 | 值／用途 |
| --- | --- |
| Agent Worker | `https://lexiro-agent.tavric.workers.dev` |
| MCP | `https://lexiro-agent.tavric.workers.dev/mcp` |
| APP_ORIGIN | `https://lexiro.vercel.app` |
| FIREBASE_PROJECT_ID | `wordmem-497209`；僅驗證 Firebase ID token |
| AGENT_DB | `lexiro-agent-access`／`8d68c8b8-cb7c-4b04-8d07-40555bb34f72`；授權與 URL |
| CLOUD_DB | `lexiro-library`／`95e08f1b-c448-40c5-bb65-ec99226e1ecf`；教材及同步 |
| OAUTH_KV | `8dbae4f064ff4a5f8f0c7037b6c57345`；OAuth |

Agent Worker 不需要 Google service-account secret 或模型 API key。

## 架構與限制

`library-migrations/0001_library.sql` 為 schema v1：cloud_accounts、cloud_records、cloud_memberships、cloud_question_sources、cloud_blobs、cloud_operations。原生教材 DTO 維持 v9，共用 package 3.0.1；本次命題提示恢復及綜合測驗寫入修正沒有 D1 schema 變動。

- 前端 `/sync/*` 只接受 Firebase ID token；uid 永遠由驗證結果取得。
- Agent 與 URL 共用 D1AgentLibrary；讀字／題目從本集來源索引開始，不掃全帳號 records。EXPLAIN 已確認索引路徑。
- JSON 批次＋CAS ticket＋operation 回條在同一 D1 batch。會員／題目來源只刪除真的移除項，不重建未變動資料；相同 records 不重寫。
- Blob revision 拒絕過期偏好。學習進度／統計已從 App 移除，`library-migrations/0002_drop_learning_blobs.sql` 刪除既有列。
- MCP 5 tools（read／create_set／write／validate／delete），write／delete 以 action.type 涵蓋詞義／子題 patch、資料夾 CRUD；validate 唯讀。只刪空資料夾、拒絕循環／同層同名／其他 uid 的分類。
- put_words／delete_words 每次最多 200；201 拒絕，題目仍按 brief 拆批。
- URL 只管理固定 uid＋setId，可讀分類目的地並移動本集，不能改整棵資料夾樹。
- 題目用 senseId 綁定，支援 partial／atomic 與逐題 Error／Warning；篇幅只是警告，解說選填。MCP／REST revision／operationId 選填，提供時保留舊版本與重送檢查；交易 CAS 仍有效。ID 衝突以本次候選 keys 批次查索引。
- URL 首頁及 set resource 只回摘要；words／questions 用 items 分頁。MCP read／POST query 一次最多10項查詢，支援搜尋、題型、範圍及欄位；完整 prompt 取一次，brief 只回小批來源 specification。

## 下次發布

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
```

獨立 workflow 執行 typecheck／lint／test／build、兩組 D1 migrations、deploy、health／OAuth discovery／MCP 401 檢查。Cloudflare 初次網址傳播的有限重試保留；不呼叫模型。

有前端 runtime 變動時，後端成功後再依前端 repo 的發布流程發布。Frontend workflow 同步 NEXT_PUBLIC_AGENT_WORKER_URL 至 Vercel，再 build／deploy。已移除 Google service-account、Firestore rules／indexes 步驟。新版 namespace 為 d1-v1，PWA 需依既有流程由使用者啟用更新。

## 驗證與維護

本機 `npm run db:migrate:agent`、`npm run db:migrate:cloud`、`npm run dev:agent` 後執行 `npm run test:agent`；auth bypass 僅在 local-entry，不發布到正式入口。回條見 [本機測試](agent-local-results.md)。

正式 smoke 僅用可清除的合成 Firebase 使用者，驗證 200 筆、資料夾、sync／MCP／URL 共用 records、版本／重送／撤銷，再刪除合成資料。不可把 localhost latency 當正式 CPU 或 D1 rows 用量。D1 免費容量／配額見 [官方計價](https://developers.cloudflare.com/d1/platform/pricing/) 與 [限制](https://developers.cloudflare.com/d1/platform/limits/)。

原 Firestore 直接回 HTTP 429、RESOURCE_EXHAUSTED、Quota exceeded；其 Monitoring／Billing 讀取遭 403，沒有完整用量明細。舊 Agent 每次讀集會讀整個帳號題庫，是已確認的讀取放大缺陷；不能宣稱它是全部用量的唯一成因。

## 正式發布回條

Backend `1a6a82e` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38063285944) 與 frontend `0234252` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38063531929) 都成功。CI 各通過 193／400 個測試及 typecheck、lint、build。

正式 HTTPS 45 項檢查通過：真實 Firebase Auth、OAuth S256、17 tools、200 筆新增及讀回、201 筆拒絕且 revision 不變、資料夾 CRUD、URL 分類、網站 records 寫入後 MCP 讀回、進度／統計／偏好 CAS、回條重送、刪集 tombstone、refresh 與撤銷。沒有呼叫模型 API。合成 Firebase 帳號、CLOUD_DB 資料、AGENT_DB links、OAuth client 已清除。

Agent runtime 的 FIREBASE_SERVICE_ACCOUNT 與 private GitHub Production 對應副本已刪除；`wrangler secret list --config wrangler.agent.toml` 回空陣列。一次性診斷憑證 artifact 已刪除。前端正式 bundle 已含 D1 同步且未含 Firestore endpoint；OAuth／連線管理頁 HTTP 200。未驗收長任務 CPU 或正式 D1 累積用量。

## 2026-10-11 批次更新發布

後端 `dc86551` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38066261701) 與前端 `88bc186` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38066476190) 都成功。共用 package 3.0.0，資料 schema 不變；前後端本機共 597 個測試與 typecheck／lint／build 通過。本機 HTTP 已驗證18 tools、partial／atomic、唯讀驗證、警告可儲存、穩定來源／重送及原有 OAuth／URL 隔離，見 [本機回條](agent-local-results.md)。

正式 health／discovery／前端路由皆 200，未授權 MCP 401。本次沒有用正式帳號批次寫入；97／100 是原生本機 D1 證據，不是正式 CPU 或 rows 用量測量。沒有模型審題或生成 API 呼叫，沒有修改使用者教材。下次發布仍依前述 Agent→frontend 順序。

## 所有題型提示詞恢復

2026-10-11，`54fc8a3` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38068141765) 成功。MCP／單集 URL 的 rules／specification 重新直接使用內建 questionPrompt，五型品質指引完整恢復；Agent 通用 instructions 只補充使用者優先及寫入操作。內建提示內容未更動。沒有模型呼叫。

共用契約 3.0.1 支援原提示中的綜合測驗文法題，來源 continual 的句子可挖空 been；仍要求有效來源、唯一答案定位及正確選項。前後端 599 個本機測試、typecheck／lint／build 通過，五型回傳提示與內建輸出逐一完全相同，brief 不改資料庫 revision；partial／atomic 和 Warning 仍通過。本次僅 Agent 有執行程式變動，因此只發布 Agent Worker；公開前端更新套件及文件，不需 Vercel 發布。正式 health／OAuth discovery 200；未寫入使用者教材或測正式長任務 CPU。

## 按需查詢發布回條

2026-10-11，後端 `b728392`（實作 `0e5011e`）的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38072862060) 成功，遠端197個測試、typecheck／lint／build、既有D1 migrations與發布檢查通過。正式 health、authorization-server metadata、`/.well-known/oauth-protected-resource/mcp` 均200，未授權 MCP POST 為401。

本機195次HTTP與`gpt-6.1-sol low`子代理6次全200的完整流程見 [測試回條](agent-local-results.md)。公開前端 `5ffc3f0` 只有操作文件；本次未發布 Vercel，未使用正式帳號寫入新功能的教材或測量CPU。下一次只改Agent時仍執行 deploy-agent.yml，前端runtime變動才另發布前端。
