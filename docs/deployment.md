# Worker 設定與部署

正式 D1 已建立為 `lexiro-billing`（APAC），`0001_billing.sql` 與 `0002_attempt_limits.sql` 已套用。Worker 的 Firebase project 與供應商／管理員 secret 仍未設定，因此尚未部署 Worker。

一般設定：`FIREBASE_PROJECT_ID` 必須和前端 Firebase project 相同；`ALLOWED_ORIGIN` 為允許呼叫的 origin 完整清單，逗號分隔，正式環境只放前端 HTTPS origin，開發用的 localhost 只寫在本機 `.dev.vars`；`OPENAI_BASE_URL` 為供應商 Responses API 根網址。餘額不會透支，不需要額外設定。

Worker secrets：`OPENAI_API_KEY` 是供應商金鑰，`ADMIN_EMAILS` 是逗號或換行分隔的管理員 email。只接受已驗證 email 的 Firebase identity，沒有授權管理員的前端欄位或 API。不要把這些值寫入 repo。

部署由 `.github/workflows/verify.yml` 負責：main push 或手動執行會先完成完整驗證，再套用未完成的 D1 migrations、同步 Worker secrets、部署並以 production origin 做 OPTIONS/CORS health check。本機開發維持 `npm run dev`、`npm run db:migrate`，不使用 remote。

前端 GitHub Production Environment variable `NEXT_PUBLIC_AI_WORKER_URL` 指向 Worker 的 HTTPS origin。Firebase 使用者資料仍由原本 Firestore rules 管理，Worker 只負責 AI、額度與管理功能。

GitHub `Production` Environment 必須設定 secrets `FIREBASE_PROJECT_ID`、`CLOUDFLARE_API_TOKEN`、`OPENAI_API_KEY`、`ADMIN_EMAILS`。Cloudflare token 限定為 Tavric account，權限需包含 Workers Scripts:Edit 與 D1:Edit。Workflow 仍不執行消耗帳號用量的 prompt 評測。

上線驗收需檢查真實 Firebase token、正式 origin 的 CORS、實際 Responses 串流／照片、D1 扣款與失敗退費、每日 Cron，以及 Cloudflare 回報的 CPU。Node benchmark 與本地 Miniflare 都不能證明符合 Workers 免費 CPU 額度。
