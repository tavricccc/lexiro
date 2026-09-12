# Worker 設定與部署

目前只完成本地實作與測試，沒有建立正式 D1 或部署 Worker。`wrangler.toml` 的 Firebase project、production origin 與 database id 仍是明確 placeholder，必須換成實際值後才能部署。

一般設定：`FIREBASE_PROJECT_ID` 必須和前端 Firebase project 相同；`ALLOWED_ORIGIN` 為前端 HTTPS origin；`OPENAI_BASE_URL` 為供應商 Responses API 根網址；`MAX_OVERDRAFT_POINTS` 是可接受負餘額的絕對值，目前暫設 300，並非使用者指定。

Worker secrets：`OPENAI_API_KEY` 是供應商金鑰，`ADMIN_EMAILS` 是逗號或換行分隔的管理員 email。只接受已驗證 email 的 Firebase identity，沒有授權管理員的前端欄位或 API。不要把這些值寫入 repo。

部署時使用 Cloudflare 的 D1 建立 `lexiro-billing`，把 database id 填入 binding `DB`，按順序套用 `migrations/` 內 migration（目前 0001、0002），再發布 Worker。這些正式操作尚未執行；本地開發維持 `npm run dev`、`npm run db:migrate`，不使用 remote。

前端 GitHub Production Environment variable `NEXT_PUBLIC_AI_WORKER_URL` 指向 Worker 的 HTTPS origin。Firebase 使用者資料仍由原本 Firestore rules 管理，Worker 只負責 AI、額度與管理功能。

CI 只執行 typecheck、lint、test、build，不自動部署、不執行消耗帳號用量的 prompt 評測。新增 deployment 前需提供實際環境與 secrets。

上線驗收需檢查真實 Firebase token、正式 origin 的 CORS、實際 Responses 串流／照片、D1 扣款與失敗退費、每日 Cron，以及 Cloudflare 回報的 CPU。Node benchmark 與本地 Miniflare 都不能證明符合 Workers 免費 CPU 額度。
