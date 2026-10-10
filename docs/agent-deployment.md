# D1 Agent 與同步部署

2026-10-10。Firebase 保留 Auth；教材、學習紀錄與偏好改存 D1。前端和 Agent 共用資料及交易。使用者指定不遷移舊資料，新的 CLOUD_DB 從空白開始；不保留 Firestore fallback。單字匯入不屬於這次工程工作。

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

Agent Worker 不需要 Google service-account secret 或模型 API key。生成／計費 Worker 仍獨立使用原本 DB 與模型設定；這次不改既有點數或方案。

## 架構與限制

`library-migrations/0001_library.sql` 為 schema v1：cloud_accounts、cloud_records、cloud_memberships、cloud_question_sources、cloud_blobs、cloud_operations。原生教材 DTO 維持 v9，共用 package 2.0.0。

- 前端 `/sync/*` 只接受 Firebase ID token；uid 永遠由驗證結果取得。
- Agent 與 URL 共用 D1AgentLibrary；讀字／題目從本集來源索引開始，不掃全帳號 records。EXPLAIN 已確認索引路徑。
- JSON 批次＋CAS ticket＋operation 回條在同一 D1 batch。會員／題目來源只刪除真的移除項，不重建未變動資料；相同 records 不重寫。
- Blob revision 拒絕過期進度／統計／偏好；來源刪除／重綁與進度調整一起提交。
- MCP 17 tools，包含資料夾 CRUD、move_set 與 create_set.folderId。只刪空資料夾、拒絕循環／同層同名／其他 uid 的分類。
- put_words／delete_words 每次最多 200；201 拒絕，題目仍按 brief 拆批。
- URL 只管理固定 uid＋setId，可讀分類目的地並移動本集，不能改整棵資料夾樹。

## 下次發布

```powershell
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
```

獨立 workflow 執行 typecheck／lint／test／build、兩組 D1 migrations、deploy、health／OAuth discovery／MCP 401 檢查。Cloudflare 初次網址傳播的有限重試保留；不呼叫模型、不複製生成 Worker 的 keys。

後端成功後發布前端：

```powershell
gh workflow run deploy.yml --repo tavricccc/lexiro --ref main
```

Frontend workflow 同步 NEXT_PUBLIC_AGENT_WORKER_URL 至 Vercel，再 build／deploy。已移除 Google service-account、Firestore rules／indexes 步驟。新版 namespace 為 d1-v1，PWA 需依既有流程由使用者啟用更新。

## 驗證與維護

本機 `npm run db:migrate:agent`、`npm run db:migrate:cloud`、`npm run dev:agent` 後執行 `npm run test:agent`；auth bypass 僅在 local-entry，不發布到正式入口。回條見 [本機測試](agent-local-results.md)。

正式 smoke 僅用可清除的合成 Firebase 使用者，驗證 200 筆、資料夾、sync／MCP／URL 共用 records、版本／重送／撤銷，再刪除合成資料。不可把 localhost latency 當正式 CPU 或 D1 rows 用量。D1 免費容量／配額見 [官方計價](https://developers.cloudflare.com/d1/platform/pricing/) 與 [限制](https://developers.cloudflare.com/d1/platform/limits/)。

原 Firestore 直接回 HTTP 429、RESOURCE_EXHAUSTED、Quota exceeded；其 Monitoring／Billing 讀取遭 403，沒有完整用量明細。舊 Agent 每次讀集會讀整個帳號題庫，是已確認的讀取放大缺陷；不能宣稱它是全部用量的唯一成因。
