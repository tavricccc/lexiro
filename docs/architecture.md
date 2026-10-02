# 公開端點與資料生命週期

## HTTP

入口是 src/index.ts，Origin 完整清單來自 ALLOWED_ORIGIN。Firebase token 驗簽、project、UID、時間；管理員另驗 verified email 和 ADMIN_EMAILS。Worker 回應 no-store，App Check 不在這個 Worker 的驗證契約內。

| Method／path | 用途 |
| --- | --- |
| `GET /me` | 確保帳號存在、續期與有界 usage reconciliation，回餘額／方案／身份 |
| `POST /generate` | 嚴格 GenerationRequest，選定模型、來源和檔位 |
| `POST /organize` | 文字 JSON 或多圖片 text/plain，單批單次上游 request |
| `GET /admin/accounts`、`GET /admin/usage` | Cursor 分頁與近 30 天報表 |
| `PATCH /admin/accounts/{uid}` | Expected 版本的原子點數／額度／備註更新 |
| `GET /admin/settings`、`PATCH /admin/settings` | 新帳號初始方案與版本檢查 |
| `OPTIONS` | 允許 Origin 的 CORS preflight |

## 生成與計費

Prepare generation／images 驗輸入並產生每來源身份，D1 reserve 原子處理餘額、鎖與嘗試紀錄。Provider request 最多 110 秒；response-stream 白名單保留必要 metadata、輸出文字與 usage，不回顯 prompt／input／instructions。

Terminal 結算發生在終止事件交給前端之前。完整 usage 直接記成本與實扣；缺 usage 先補查 stored response，仍未知就記 pending。Pending 只存 response ID、來源與計費 metadata，不存圖片／prompt／輸出。取消、失敗與無法回報成本都保留明確狀態。

一般帳號開始時餘額大於零即可跑一批，實扣最低到零；負餘額表示執行中的預留。管理員不預留、不鎖、不計重試次數，仍記來源、cursor 和成本。成功來源同 session 在有效窗內重試不再扣款，新 session 重新計費；來源與重試身份包含模型。

## D1 與排程

Migrations 0001-0012 建立並演進帳號、設定、session／來源、usage、pending 與管理版本。帳號／設定 revision 每次相關異動遞增，資料回到原值仍不能讓舊 expected 請求通過。未知歷史成本與未核實實扣不猜測回填。

Wrangler Cron `0 0 * * *` 每日 UTC 00:00（臺灣 08:00）先 reconcile pending usage，再 scheduledMaintenance；帳號請求也可補查／觸發自己的到期續期。這是計費維護，不是教材同步或 FSRS 排程。

Pending 持續查不到時保留待核對，不自動免單或刪列解鎖。維運者依 response ID 向供應商確認，觀察 pending／unavailable／unverified 計數。方法見[部署維運](deployment.md)，完整責任見[structure](../structure.md)。
