# Worker 設定與部署

正式 D1 已建立為 `lexiro-billing`（APAC）。未套用的 migration 由部署流程自動套用，不需要手動跑 `--remote`。

一般設定：`FIREBASE_PROJECT_ID` 必須和前端 Firebase project 相同；`ALLOWED_ORIGIN` 為允許呼叫的 origin 完整清單，逗號分隔，正式環境只放前端 HTTPS origin，開發用的 localhost 只寫在本機 `.dev.vars`；`OPENAI_BASE_URL` 為供應商 Responses API 根網址。餘額不會透支，不需要額外設定。

Worker secrets：`OPENAI_API_KEY` 是供應商金鑰，`ADMIN_EMAILS` 是逗號或換行分隔的管理員 email。只接受已驗證 email 的 Firebase identity，沒有授權管理員的前端欄位或 API。不要把這些值寫入 repo。

部署由 `.github/workflows/deploy.yml` 負責：main push 或手動執行會先完成完整驗證（typecheck、lint、test、build），production WebSocket handshake 成功後再套用未完成的 D1 migrations、同步 Worker secrets、`wrangler deploy`，最後以 production origin 做 OPTIONS/CORS health check。推上 main 就是部署，沒有另外的手動步驟。本機開發維持 `npm run dev`、`npm run db:migrate`，不使用 remote。

前端 GitHub Production Environment variable `NEXT_PUBLIC_AI_WORKER_URL` 指向 Worker 的 HTTPS origin。Firebase 使用者資料仍由原本 Firestore rules 管理，Worker 只負責 AI、額度與管理功能。

GitHub `Production` Environment 必須設定 secrets `FIREBASE_PROJECT_ID`、`CLOUDFLARE_API_TOKEN`、`OPENAI_API_KEY`、`ADMIN_EMAILS`。Cloudflare token 限定為 Tavric account，權限需包含 Workers Scripts:Edit 與 D1:Edit。Workflow 仍不執行消耗帳號用量的 prompt 評測。

## 照片批次介面（現行共用合約 3.2.0）

`POST /organize` 的 `text/plain` body 以換行分隔 1-10 張 WebP base64，`X-Session-Id` 識別同批 session，`X-AI-Model` 必須是共用合約接受的 Luna 模型；`X-AI-Tier` 選擇 lite／thinking／pro，Pro 統一使用 gpt-6.1-sol／low。每張最多 1.5 MB／長邊 1800，整批 body 上限 20,000,009 bytes。Worker 在預留前驗證每張圖片，一次上游請求含整批 input_image；預留依 `rate('organizeImage', tier, model)`，實扣按回報 usage。成功保留各來源身份，失敗或取消釋放預留。照片格式本身不新增 D1 migration。

先發布 Worker，再發布使用批次上傳的前端；發布後重新載入頁面。批次共用既有整理輸出長度與生成來源數限制，不代表可無限制輸入文字。CPU 與真實多圖辨識品質仍需正式量測，本地驗證只使用合成圖片與 provider。

## 持久化與共用契約

- `GENERATIONS` 綁定 GenerationRoom，`generation-room-v1` 使用 SQLite Durable Object。部署前 handshake probe 不產生模型輸出；不支援時停止部署，不自動改用 HTTP 生成。
- 生成 POST 必須帶 X-Generation-Id；GET /generation/{session}/{id} 依已驗證 uid 路由至同一 actor，跨帳號無法取得結果。每批 10 分鐘上限；來源、輸出及结算 metadata 在 30 分鐘內可回放，alarm 到期刪除。D1 lease 為 15 分鐘；沒有新 D1 schema migration。
- WebSocket 可共用連線，但每批不帶 previous_response_id；prompt、schema 與快取版號不變。WS 閒置 15 秒關閉。瀏覽器斷線不取消本批；本頁續跑接原 job，重新整理僅保留原本流程草稿已完成成果。

- 部署依序套用未完成 migrations，目前到 `0013_usage_parts.sql`，轉換既有 usage／pending 的單回合紀錄。本地測試只用 `npm run db:migrate`。
- 前端與 Worker 使用 `@lexiro/ai-contract` 3.2.0。題目帶 `X-Question-Contract: single-pass-v1`，舊版在預留前回 426。游標請求使用 cursor、回應 nextCursor，舊 offset 回 400。JSON 生成帶 model，管理 PATCH 帶 expected 版本；沒有舊格式相容分支。
- 舊 usage 保留原值並標成未核實；缺少 input／output 的歷史零成本列另標為 `unavailable`，不列入已知成本。不臆測實扣，也不自動修正既有餘額。管理頁的已扣點數只合計新版本可核實的紀錄。
- `pending_usage` 只含 response id、來源識別與計費 metadata，不保存 prompt 或輸出。Cron 每次最多補查 5 筆，帳戶請求最多 1 筆；每次供應商查詢上限 10 秒。取消／失敗不鎖住點數；有產出的待核對項目保留預留，直到取得有效 usage。
- 監控報表的待核對筆數。持續無法取得 usage 時，需向供應商查明，不要刪除 pending 列、改帳戶負餘額或冒填零成本。此版本沒有自動估價／免單與人工核銷端點。

上線驗收需檢查真實 Firebase token、正式 origin 的 CORS、實際 Responses 串流／照片、D1 扣款與失敗退費、每日 Cron，以及 Cloudflare 回報的 CPU。Node benchmark 與本地 Miniflare 都不能證明符合 Workers 免費 CPU 額度。

Cron 為每日 UTC 00:00（臺灣 08:00），先補查 pending usage 再執行計費維護；帳號請求也會做有界補查。它不處理教材同步或 FSRS。

更新 public contract 後，在前端 `packages/ai-contract` 執行 npm pack，將版本化 tgz 放入本 repo 的 vendor，更新 package.json／lockfile，再跑四個 gate。契約欄位改變時先發布 Worker 再發布前端。完整 HTTP／結算時序見[架構](architecture.md)。

本輪不新增 D1 migration，先部署 Worker 的單次生成與 itemRepair，再部署新前端。grammar 請求在預留前回 400，缺少 single-pass-v1 的題目請求回 426；使用者明確啟用 PWA 更新後取得新介面，不能為發布自動清空草稿或刷新。單字、補充、整理與解說快取鍵不變；題目 writer 使用 `lexiro-questions-20261005-v9`，單題重生使用 `lexiro-question-item-20261005-v1`。独立審題流程暫停，不打包到正式入口。
