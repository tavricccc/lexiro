# 公開端點與資料生命週期

## HTTP

入口是 src/index.ts，Origin 完整清單來自 ALLOWED_ORIGIN。Firebase token 驗簽、project、UID、時間；管理員另驗 verified email 和 ADMIN_EMAILS。Worker 回應 no-store，App Check 不在這個 Worker 的驗證契約內。

| Method／path | 用途 |
| --- | --- |
| `GET /me` | 確保帳號存在、續期與有界 usage reconciliation，回餘額／方案／身份 |
| `POST /generate` | 嚴格 GenerationRequest，選定模型、來源和檔位 |
| `POST /organize` | 文字 JSON 或多圖片 text/plain，單批單次上游 request |
| `GET /generation/{session}/{id}` | 經驗證 uid 的原任務 SSE 訂閱／回放，不重新生成 |
| `GET /admin/accounts`、`GET /admin/usage` | Cursor 分頁與近 30 天報表 |
| `PATCH /admin/accounts/{uid}` | Expected 版本的原子點數／額度／備註更新 |
| `GET /admin/settings`、`PATCH /admin/settings` | 新帳號初始方案與版本檢查 |
| `OPTIONS` | 允許 Origin 的 CORS preflight |

## 生成與計費

Prepare generation／images 驗輸入並產生每來源身份。每次生成帶 X-Generation-Id；GenerationRoom 按 uid／session 路由、比對請求 fingerprint，同一 ID 僅 D1 reserve 一次。重連 GET 回放同一任務，不再發出模型生成請求。每批最多 10 分鐘，D1 租期 15 分鐘。手機 SSE 訂閱與上游 WebSocket 工作互相獨立，訂閱中斷不取消本批。response-stream 白名單保留必要 metadata、輸出文字與 usage，不回顯 prompt／input／instructions。

題目必須帶 `X-Question-Contract: single-pass-v1`，不符在預留前回 426。題目與解說單次生成，獨立模型審題暫停；前端仍做格式、篇幅與證據驗證。有效題目保留，錯誤子題獨立重生，文章不整批重送。

現行題型只有 vocabulary、cloze、wordBank、discourse、reading；停用 grammar 在預留前回 400。每批不帶 previous_response_id，固定規則與 schema 在前綴、來源及難度在尾端；WebSocket 復用不表示模型上下文串接。Prompt cache key 不含 uid／session／job，沿用本輪之前的提示版號，避免不必要冷啟動。是否命中由 provider usage 證明。

上游 WebSocket 中斷後，已知 response ID 只用 GET 取回原 response；queued／in_progress 有界等待至批次 deadline，不新建一份生成。無法恢復則管理員看到 transport、close code／reason、job／response ID、耗時与逾時上限；一般帳號只看到可理解的錯誤。部署前握手探測不生成 token，失敗就不发布。

SQLite Durable Object 暫存來源、輸出與結算 metadata 至任務開始後 30 分鐘，用 alarm 刪除；圖片、私有提示與憑證不落入 actor storage。重連回放不再扣款，瀏覽器只累計最後完整回覆的用量。生成草稿保存各 lane 的 pending operation ID；重新整理後驗證帳號、契約與期限，再接回原工作，無法接續時仍保留已完成成果。

Terminal 結算發生在終止事件交給前端之前。完整 usage 直接記成本與實扣；缺 usage 先補查 stored response，仍未知就記 pending。Pending 只存 response ID、來源與計費 metadata，不存圖片／prompt／輸出。取消、失敗與無法回報成本都保留明確狀態。

題目各回合用量存於 `usage_parts`，每個 response 先計價再合計，不能把總 input 套長上下文門檻。整批只結算一次；任一回合缺用量就保存所有 parts，逐一補查該回合 cursor。未知總成本保持 NULL，已失敗／取消／拒絕的操作退款，但仍補記實際供應商成本。

一般帳號開始時餘額大於零即可跑一批，實扣最低到零；負餘額表示執行中的預留。管理員不預留、不鎖、不計重試次數，仍記來源、cursor 和成本。成功來源同 session 在有效窗內重試不再扣款，新 session 重新計費；來源與重試身份包含模型。

## D1 與排程

Migrations 0001-0014 建立並演進帳號、設定、session／來源、usage、pending、管理版本與獨立 generation leases。0013 將舊單回合紀錄及 pending 轉成單一 part，保留原值及 response ID；0014 轉換既有 inflight reservation。每個 attempt 持有自己的名額；目前前端、actor 與 D1 共用上限四個，同 session 並行、其他 session 互斥。調整上限沒有改資料 schema。帳號／設定 revision 每次相關異動遞增，資料回到原值仍不能讓舊 expected 請求通過。未知歷史成本與未核實實扣不猜測回填。

Wrangler Cron `0 0 * * *` 每日 UTC 00:00（臺灣 08:00）先 reconcile pending usage，再 scheduledMaintenance；帳號請求也可補查／觸發自己的到期續期。這是計費維護，不是教材同步或 FSRS 排程。

Pending 持續查不到時保留待核對，不自動免單或刪列解鎖。維運者依 response ID 向供應商確認，觀察 pending／unavailable／unverified 計數。方法見[部署維運](deployment.md)，完整責任見[structure](../structure.md)。
