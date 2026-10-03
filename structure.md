# Lexiro Worker 檔案地圖

獨立 private 後端工作區。main push 由 GitHub Actions 驗證後自動套用 migrations 並部署；本地測試不代表正式生成、計費 CPU 或 Cron 已驗收。現行決策見 `docs/product-decisions.md`，部署與 secrets 見 `docs/deployment.md`。

| 路徑 | 責任 |
| --- | --- |
| `src/response-stream.ts` | 保留 Responses SSE 協定；公開的 `response` 物件以白名單重建（`id`、`model`、`status`、`usage`、`incomplete_details.reason`、中和過的 `error`），供應商日後新增的欄位一律不轉發。文字事件不解析 JSON，內部完成通知保留伺服器結算需要的原始回覆，並只為管理員附上已結算 credit 等值 |
| `src/usage-recovery.ts`、`tests-next/usage-recovery.test.ts` | 驗證完整 usage、補查 stored response、持久化待核對結算，並在帳戶請求與 Cron 有界重試。只保存計費識別，不保存 prompt、圖片或生成內容；有產出的待核對帳戶保留預留，取消／失敗立即釋放預留但繼續補記成本 |
| `src/auth.ts` | Google RS256 簽章、Firebase project/uid/時間驗證、Cache-Control 公鑰快取與 ADMIN_EMAILS 管理員判斷 |
| `tests-next/auth.test.ts` | 錯誤簽章／claims、快取期限、並行讀取及已驗證管理員 email 的行為測試 |
| `src/billing.ts`、`src/credits.ts` | 任何登入者第一次請求就建立 accounts 列（`ensureAccount`），免費試用開啟時帶入新帳號預設點數與每期額度、關閉時為 0；D1 原子預留與實際扣款、供應商 usage 的整數 credit 換算、每來源冪等、cursor 擁有權與個別到期續期；換算基準只存在 private Worker。餘額大於 0 就能開始一批，預估超過餘額也照跑，結算以 0 為下限，帳戶不會變負數 |
| `migrations/0001_billing.sql`～`0013_usage_parts.sql` | 計費初始 schema、來源/session 重試限制、實際 credit 紀錄、方案預設、usage 狀態與索引、管理版本，以及一次操作各回合 usage／cursor；舊單回合資料一次轉成單一 part |
| `src/index.ts`、`src/env.ts`、`wrangler.toml` | HTTP/CORS、驗證、計費與串流連接、Cron 和部署設定；`ALLOWED_ORIGIN` 是逗號分隔的完整清單，沒有內建的 localhost 例外。串流中斷時以 stored response 補回 token 用量。管理員不預扣、不上鎖、不算重試次數，但仍結算以記錄 cursor 與 token 用量 |
| `src/http.ts` | 有界讀取及伺服器計算的 fingerprint |
| `src/admin-usage.ts`、`src/pagination.ts`、`tests-next/admin-report.test.ts` | 近 30 天報表（題型／檔位／模型分組，各次請求分別計算長上下文成本）、未知成本／歷史未核實扣款計數、版本化游標分頁及行為測試。usage 按時間／id 遞減，帳戶按 email／uid 遞增；`cursor`／`nextCursor` 取代 offset，沒有舊參數相容分支 |
| `src/admin.ts` | 帳號、點數、月額度、免費試用與新帳號方案預設管理端點；調整必須帶閱讀時的 `expected` 狀態，原子拒絕過期修改並直接回傳實際儲存結果。帳號由登入產生，沒有手動建立端點；`/admin/usage` 回傳最近紀錄、近 30 天每個模型的 token 與成本、每個帳號分模型的成本與已扣點數，以及每種工作分檔位的計費單位數與成本 |
| `src/generation.ts`、`src/settlement.ts` | 嚴格輸入、prompt 組裝、模型設定、每來源扣款識別與輸出結算。扣款識別含 session 讓新一輪要付費，重試上限的識別不含 session，client 換 uuid 不能重置上限。`cacheKey` 跟著用到的那段 prompt 走而不是 job kind：`senses`（補充多義）逐字沿用 `generateWordSet`，因此與 `words` 共用 `WORD_CACHE_KEY`，由建立單字集的流量把前綴暖著。補充以「字」為計費單位，回傳 0 個詞義照樣算完成 |
| `src/organize.ts` | 文字／照片共用整理 prompt 與其快取版號 `ORGANIZE_CACHE_KEY`、每批 1–10 張 WebP 輸入檢查與逐張計費來源；圖片不落地。`text/plain` body 每行一張 base64，每張至多 1.5 MB、整批 body 至多 20,000,009 bytes；同批只發一次多圖片 Responses 請求，仍逐張預留與記錄來源完成。整理輸出每列固定為「英文 詞性 中文」，詞性來源沒標就補 |
| `src/prompts.ts`、`src/question-prompts.ts`、`src/schemas.ts` | 固定提示與供應商 structured-output schema，只放 private repo；採樣與限制見 prompt 評測紀錄 |
| `src/question-review.ts`、`src/question-review-validation.ts` | 獨立審題 schema／規則及核准前門檻；先修訂與逐項解說，最後判定未解決問題及 approved，檢查篇幅、跨度、選項與原文依據 |
| `src/reviewed-question-stream.ts`、`tests-next/reviewed-questions.test.ts` | 題目同預留出稿→fresh reviewer，共用 110 秒，僅交付核准稿；進度 SSE、品質拒絕／退款、取消、兩回合結算與舊客戶端契約檢查 |
| `src/usage-parts.ts`、`tests-next/question-review-validation.test.ts` | 各回合完整用量、各自計價後加總；核准稿機器門檻及輸出判定順序的必要反例檢查 |
| `tests-next/database.ts`、`tests-next/worker.test.ts` | 本地 D1 fixture 與 HTTP/CORS/管理/生成整合測試 |
| `tests-next/billing.test.ts` | 以 Miniflare 真正 D1/SQLite 驗證扣款、回滾、重試、並發、退款與續期 |
| `vendor/lexiro-ai-contract-3.0.0.tgz` | 來自 public frontend packages/ai-contract 的無祕密共用套件；高中題型、難度篇幅、兩回合預估、逐 response 成本及 reviewed-v1 契約。JSON 必須帶模型，題目另帶 X-Question-Contract，照片由 X-AI-Model 選擇；已付費來源依模型區分 |
| `tests-next/response-stream.test.ts` | 文字保持不變、metadata 不外流、分塊、拒答、錯誤、取消與背壓行為 |
| `scripts/benchmark-stream.mjs` | 合成串流在本地 Node 的效能量測，不代表 Workers CPU 額度 |
| `scripts/evaluate-ai-prompts.mjs`、`scripts/validate-prompt-eval.mjs` | 真實 Luna/low 評測與既有回覆重新驗證；透過 `LEXIRO_FRONTEND_PATH`（預設同層 lexiro）使用目前前端解析器 |
| `scripts/evaluate-question-review.mjs` | 對凍結初稿做 fresh medium CLI 盲審，保留每次請求、schema、回覆與回條；CLI 失敗即停止後續樣本，不以 parser 通過率冒充教育品質 |
| `tests-next/fixtures/prompt-eval/`、`docs/prompt-evaluation.md` | 從公開前端移入的歷史合成案例、片語實際用法案例與評測方法；歷史 medium artifacts 另存本地 ignored artifacts/historical-medium |
| `tests-next/schemas.test.ts`、`tests-next/prompt-prefix.test.ts` | strict schema、writer／reviewer 固定前綴與 schema／設定跨輸入一致性、最低 tokenizer 長度驗證，以及補充多義與單字共用同一前綴及快取鍵 |
| `tests-next/settlement.test.ts` | 補充多義的結算：空詞義仍算完成、回傳一個或兩個收費相同、超過上限或語言錯誤的字不列入已完成 |
| `tests-next/organize.test.ts` | 整理固定價格／前綴、1／10 張的單一串流 envelope、張數／逐張 WebP 限制、逐張冪等與失敗／取消整批退款 |
| `package.json`、`tsconfig.json` | 獨立套件與檢查設定 |
| `.github/workflows/deploy.yml`、`docs/deployment.md` | main push 先完整驗證，再套用 D1 migrations、同步 secrets、部署 Worker 並做 CORS health check；以及正式設定與上線驗收清單 |
| `docs/backend-blueprint.html` | 完整原始藍圖，移除平台執行腳本與登入包裝後的本地版本 |
| `docs/product-decisions.md` | 使用者補充、矛盾處理與階段驗收；優先於原始藍圖 |
| `README.md`、`docs/architecture.md` | 本機入口、端點、D1／pending usage 生命週期及排程；現行配置與發布見 deployment |

一般公開串流保留 Responses 文字與必要 metadata。題目先用 `lexiro.question.progress` 傳出稿／審題進度，核准後才送 response.created／output_text.delta／completed，不轉發初稿或審題診斷。對外 usageParts 不含 cursor；內部保存各回合 cursor 供 reconciliation。API key 始終只用於後端供應商請求標頭，上游錯誤文字不直接回傳。

`onTerminal` 在終止事件送給前端之前完成結算或持久化待核對項目，並寫入 cursor。用量齊全時立即釋放鎖，缺少 usage 的有產出項目則保留預留等待補查。取消也會發出一次內部終止通知。此處只保護協定層的上下文回顯，不改寫模型產生的內容。

帳戶的負餘額只表示生成中的預留。管理員可更新備註，但額度調整必須等結算完成，不能把預留餘額歸零。閱讀測驗完成 3–5 題都保留來源成功紀錄，同一 session 重試不再次扣款。`usage_log.credits` 是供應商成本，`assessed_points` 是套用餘額上限前的應收點數，`points` 是實際扣款；`debit_verified=0` 表示尚未核實的扣款，包括歷史紀錄與待核對項目。

## 持久化版本

| 資料 | 版本 | Migration |
| --- | --- | --- |
| D1 計費 | 13 | `0001_billing.sql` 建立計費；`0002_attempt_limits.sql` 新增重試限制；`0003_actual_credits.sql` 新增 nullable 歷史相容 credit 與試用設定；`0004_plan_defaults.sql` 新增管理員可調的新帳號初始點數，不改既有餘額；`0005_usage_status.sql` 記錄每筆 usage 的結束狀態並加上 uid 索引；`0006_registered_accounts.sql` 移除與 `default_initial` 重複的 `trial_points`；`0007_usage_kind.sql` 記錄工作種類、檔位與計費單位數；`0008_cache_write_usage.sql` 分開記錄 GPT-5.6 cache write token，讓首次暖快取的 1.25 倍費率不會被低估；`0009_verified_debits.sql` 新增 `assessed_points` 與 `debit_verified`，新 usage 的 `points` 記錄實扣而非扣款前成本，歷史資料不臆測回填；`0010_pending_usage.sql` 新增 `usage_state` 與可恢復的 `pending_usage`，未知成本保留 NULL，不列為零成本完成；`0011_report_indexes.sql` 建立全站時間／id 與帳戶 email／uid 索引，支援報表時間範圍與游標分頁；`0012_admin_versions.sql` 新增帳號／設定遞增版本，資料恢復原值仍拒絕舊請求；`0013_usage_parts.sql` 加入逐回合 usage／cursor 並把舊單回合紀錄轉成一個 part，缺漏任一回合維持未知總成本 |
