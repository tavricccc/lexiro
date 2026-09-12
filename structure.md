# Lexiro Worker 檔案地圖

獨立後端工作區。串流隱私邊界、Firebase JWT、HTTP handler、D1 計費、文字／照片整理與管理 API 已完成本地實作和測試；正式設定、部署及生產驗收尚未執行。接手狀態與規格差異見 `docs/product-decisions.md`。

| 路徑 | 責任 |
| --- | --- |
| `src/response-stream.ts` | 保留 Responses SSE 協定，只移除上下文回顯並中和錯誤；文字事件不解析 JSON，內部完成通知保留伺服器結算需要的原始回覆 |
| `src/auth.ts` | Google RS256 簽章、Firebase project/uid/時間驗證、Cache-Control 公鑰快取與 ADMIN_EMAILS 管理員判斷 |
| `tests-next/auth.test.ts` | 錯誤簽章／claims、快取期限、並行讀取及已驗證管理員 email 的行為測試 |
| `src/billing.ts`、`src/credits.ts` | D1 原子預留與實際扣款、供應商 usage 的整數 credit 換算、每來源冪等、cursor 擁有權與個別到期續期；換算基準只存在 private Worker |
| `migrations/0001_billing.sql`～`0004_plan_defaults.sql` | 計費初始 schema、來源/session 重試限制、實際 credit 紀錄，以及可調試用／新帳號方案預設 |
| `src/index.ts`、`src/env.ts`、`wrangler.toml` | HTTP/CORS、驗證、計費與串流連接、Cron 和部署設定；管理員不預扣、不上鎖、不算重試次數，但仍結算以記錄 cursor 與 token 用量 |
| `src/http.ts` | 有界讀取及伺服器計算的 fingerprint |
| `src/admin.ts` | 帳號、點數、月額度、免費試用與新帳號方案預設管理端點；`/admin/usage` 回傳最近紀錄及近 30 天的 token、成本與實際 credit 等值 |
| `src/generation.ts`、`src/settlement.ts` | 嚴格輸入、prompt 組裝、模型設定、每來源扣款識別與輸出結算 |
| `src/organize.ts` | 文字／照片共用整理 prompt、WebP 輸入檢查與照片計費來源；圖片不落地 |
| `src/prompts.ts`、`src/question-prompts.ts`、`src/schemas.ts` | 已實測固定提示與供應商 structured-output schema，只放 private repo |
| `tests-next/database.ts`、`tests-next/worker.test.ts` | 本地 D1 fixture 與 HTTP/CORS/管理/生成整合測試 |
| `tests-next/billing.test.ts` | 以 Miniflare 真正 D1/SQLite 驗證扣款、回滾、重試、並發、退款與續期 |
| `vendor/lexiro-ai-contract-1.0.1.tgz` | 來自 public frontend packages/ai-contract 的版本化無祕密共用套件，讓 private repo 可獨立安裝 |
| `tests-next/response-stream.test.ts` | 文字保持不變、metadata 不外流、分塊、拒答、錯誤、取消與背壓行為 |
| `scripts/benchmark-stream.mjs` | 合成串流在本地 Node 的效能量測，不代表 Workers CPU 額度 |
| `scripts/evaluate-ai-prompts.mjs`、`scripts/validate-prompt-eval.mjs` | 真實 Luna/low 評測與既有回覆重新驗證；透過 `LEXIRO_FRONTEND_PATH`（預設同層 lexiro）使用目前前端解析器 |
| `tests-next/fixtures/prompt-eval/`、`docs/prompt-evaluation.md` | 從公開前端移入的歷史合成案例與評測方法；歷史 medium artifacts 另存本地 ignored artifacts/historical-medium |
| `tests-next/schemas.test.ts`、`tests-next/prompt-prefix.test.ts` | strict schema 與固定前綴跨輸入一致性、最低 tokenizer 長度驗證 |
| `tests-next/organize.test.ts` | 整理固定價格／前綴、WebP 輸入拒絕與串流圖片 envelope |
| `package.json`、`tsconfig.json` | 獨立套件與檢查設定 |
| `.github/workflows/verify.yml`、`docs/deployment.md` | 只驗證的 CI，以及正式部署設定與尚未執行的驗收 |
| `docs/backend-blueprint.html` | 完整原始藍圖，移除平台執行腳本與登入包裝後的本地版本 |
| `docs/product-decisions.md` | 使用者補充、矛盾處理與階段驗收；優先於原始藍圖 |

公開串流保留 `response.created`、`response.in_progress`、`response.completed`、`response.incomplete`、`response.failed` 及文字增量／完成事件。只有 Response 元資料事件解析 JSON 並刪掉 `instructions`、`input`、`prompt`。模型、用量與 schema 可存在於網路回應，使用者只要求介面不顯示；不為了隱藏程式碼或這些欄位增添复杂度。API key 始終只用於後端供應商請求標頭。上游錯誤文字不直接回傳。

`onTerminal` 在終止事件送給前端之前完成結算與 cursor 寫入，避免前端看到完成立刻送下一段時碰上尚未釋放的鎖。取消也會發出一次內部終止通知。此處只保護協定層的上下文回顯，不改寫模型產生的內容。

## 持久化版本

| 資料 | 版本 | Migration |
| --- | --- | --- |
| D1 計費 | 4 | `0001_billing.sql` 建立計費；`0002_attempt_limits.sql` 新增重試限制；`0003_actual_credits.sql` 新增 nullable 歷史相容 credit 與試用設定；`0004_plan_defaults.sql` 新增管理員可調的新帳號初始點數，不改既有餘額 |
