# Worker 設定與部署

正式 D1 已建立為 `lexiro-billing`（APAC）。未套用的 migration 由部署流程自動套用，不需要手動跑 `--remote`。

一般設定：`FIREBASE_PROJECT_ID` 必須和前端 Firebase project 相同；`ALLOWED_ORIGIN` 為允許呼叫的 origin 完整清單，逗號分隔，正式環境只放前端 HTTPS origin，開發用的 localhost 只寫在本機 `.dev.vars`；`OPENAI_BASE_URL` 為供應商 Responses API 根網址。餘額不會透支，不需要額外設定。

Worker secrets：`OPENAI_API_KEY` 是供應商金鑰，`ADMIN_EMAILS` 是逗號或換行分隔的管理員 email。只接受已驗證 email 的 Firebase identity，沒有授權管理員的前端欄位或 API。不要把這些值寫入 repo。

部署由 `.github/workflows/deploy.yml` 負責：main push 或手動執行會先完成完整驗證（typecheck、lint、test、build），再套用未完成的 D1 migrations、同步 Worker secrets、`wrangler deploy`，最後以 production origin 做 OPTIONS/CORS health check。推上 main 就是部署，沒有另外的手動步驟。本機開發維持 `npm run dev`、`npm run db:migrate`，不使用 remote。

前端 GitHub Production Environment variable `NEXT_PUBLIC_AI_WORKER_URL` 指向 Worker 的 HTTPS origin。Firebase 使用者資料仍由原本 Firestore rules 管理，Worker 只負責 AI、額度與管理功能。

GitHub `Production` Environment 必須設定 secrets `FIREBASE_PROJECT_ID`、`CLOUDFLARE_API_TOKEN`、`OPENAI_API_KEY`、`ADMIN_EMAILS`。Cloudflare token 限定為 Tavric account，權限需包含 Workers Scripts:Edit 與 D1:Edit。Workflow 仍不執行消耗帳號用量的 prompt 評測。

## v0.2.0 升級

- 部署流程會依序套用 `0009_verified_debits.sql`、`0010_pending_usage.sql`、`0011_report_indexes.sql`。本地測試仍只用 `npm run db:migrate`，不要另外手動操作 remote。
- 前端需同步採用 `@lexiro/ai-contract` 1.6.0 與游標管理頁：請求使用 `cursor`，回應使用 `nextCursor`；舊 `offset` 回 400，沒有相容分支。升級後重新載入管理頁。
- 舊 usage 保留原值並標成未核實，不臆測實扣，也不自動修正既有餘額。管理頁的已扣點數只合計新版本可核實的紀錄。
- `pending_usage` 只含 response id、來源識別與計費 metadata，不保存 prompt 或輸出。Cron 每次最多補查 5 筆，帳戶請求最多 1 筆；每次供應商查詢上限 10 秒。取消／失敗不鎖住點數；有產出的待核對項目保留預留，直到取得有效 usage。
- 監控報表的待核對筆數。持續無法取得 usage 時，需向供應商查明，不要刪除 pending 列、改帳戶負餘額或冒填零成本。此版本沒有自動估價／免單與人工核銷端點。

上線驗收需檢查真實 Firebase token、正式 origin 的 CORS、實際 Responses 串流／照片、D1 扣款與失敗退費、每日 Cron，以及 Cloudflare 回報的 CPU。Node benchmark 與本地 Miniflare 都不能證明符合 Workers 免費 CPU 額度。
