# Lexiro Worker 檔案地圖

獨立 private 後端工作區。main push 由 GitHub Actions 驗證後自動套用 migrations 並部署；本地測試不代表正式生成、計費 CPU 或 Cron 已驗收。現行決策見 `docs/product-decisions.md`，部署與 secrets 見 `docs/deployment.md`。

| 路徑 | 責任 |
| --- | --- |
| `src/response-stream.ts` | 保留 Responses SSE 協定；公開的 `response` 物件以白名單重建（`id`、`model`、`status`、`usage`、`incomplete_details.reason`、中和過的 `error`），供應商日後新增的欄位一律不轉發。文字事件不解析 JSON，內部完成通知保留伺服器結算需要的原始回覆，並只為管理員附上已結算 credit 等值 |
| `src/usage-recovery.ts`、`tests-next/usage-recovery.test.ts` | 驗證完整 usage、補查 stored response、持久化待核對結算，並在帳戶請求與 Cron 有界重試。只保存計費識別，不保存 prompt、圖片或生成內容；有產出的待核對帳戶保留預留，取消／失敗立即釋放預留但繼續補記成本 |
| `src/auth.ts` | Google RS256 簽章、Firebase project/uid/時間驗證、Cache-Control 公鑰快取與 ADMIN_EMAILS 管理員判斷 |
| `src/agent/index.ts`、`wrangler.agent.toml` | 獨立無模型金鑰的 Agent Worker，MCP OAuth discovery／DCR／CIMD、Firebase owner 端點、單集 URL、連線撤銷、未認證端點限流、CORS 與過期資料 Cron；部署與生成 Worker 分開 |
| `src/agent/rate-limit.ts` | 未認證端點的 D1 固定視窗限流：`/authorize` 每 IP 每 60 秒 60 次、`/oauth/register` 10 次；key 為端點＋`CF-Connecting-IP`（缺標頭以 `unknown` 計），單一 upsert 原子遞增並以 `Retry-After` 回 429 `rate_limited`，D1 故障時 fail-open，`now` 由呼叫端注入 |
| `src/agent/oauth.ts`、`mcp.ts`、`instructions.ts` | S256 PKCE 登入授權、5 個精簡工具（read／create_set／write／validate／delete），action.type 分派寫入；read 一次按需讀多種資料，完整 questionPrompt 獨立取得，寫入保留 senseId、partial／atomic 與寬鬆品質門檻 |
| `src/agent/query.ts` | D1 索引查詢、單字／題目搜尋、題型／難度篩選、範圍與游標分頁、巢狀欄位投影及精簡回條 |
| `src/agent/edits.ts`、`resource-api.ts` | 單字／詞義／題目／子題 patch；單集 REST 路由及多資料 POST query，首次讀取只回摘要與操作指引 |
| `src/agent/access.ts`、`operations.ts`、`types.ts` | per-user／per-set bearer URL、兩小時預設期限、hashed token、版本與 operation ID envelope、資料 scope |
| `src/agent/library-repository.ts` | D1 教材 repository；本集 memberships/source 索引讀取、資料夾 CRUD、版本衝突與冪等回條 |
| `src/cloud/{api,repository,records}.ts` | Firebase Auth owner 同步 API、D1 change feed／blob CAS、JSON 批次交易與原生教材序列化；Agent 和瀏覽器使用同一資料庫 |
| `library-migrations/0001_library.sql` | 專用 CLOUD_DB schema v1：帳號版本、教材、來源索引、學習／偏好 blobs、操作回條；不遷移 Firestore |
| `library-migrations/0002_drop_learning_blobs.sql`、`0003_set_shares.sql` | 刪除學習進度／統計 blobs，blob 只留 preferences 與跨裝置 practice；單字集分享連結表（每集一條，撤銷即刪） |
| `src/cloud/shares.ts` | 登入後的分享連結：建立／列出／撤銷，任何登入者持連結讀取擁有者最新同步的單字集 |
| `src/rooms/protocol.ts`、`game-room.ts`、`api.ts` | 連線對戰：登入者建立 6 碼房間（最多 8 人），房主送出自己題庫的題目；GameRoom Durable Object 以 alarm 推進題目、伺服器判分（答案不送給玩家）、不等斷線者、重連直接回到目前題目；WebSocket 用一次性 ticket 授權 |
| `agent-migrations/0001_agent_access.sql`、`0002_rate_limits.sql` | Agent D1 schema v2：URL scope／到期／撤銷與一次性 OAuth 授權請求，以及未認證端點（`/authorize`、`/oauth/register`）以端點＋IP 固定 60 秒視窗的計數表 `agent_rate_limits`，過期列沿用 7 天 cutoff 由 Cron 清除；與計費 migrations 分開 |
| `vendor/lexiro-agent-contract-4.1.0.tgz` | 公開共用教材／資料夾／雲端 DTO、Agent 逐題驗證與部分成功，支援綜合測驗文法空格；每批 200 筆，不含模型金鑰或 private prompt |
| `wrangler.agent-local.toml`、`tests-next/agent-local-entry.ts`、`agent-migrations/fixtures/local-agent.sql` | 僅本機 D1、合成帳號及資料 repository；不出現在正式入口 |
| `tests-next/agent-d1.test.ts`、`scripts/agent-smoke.mjs` | 真 D1 batch／CAS／分頁／帳號隔離、200 筆與資料夾、前端同步互通及 HTTP OAuth／URL 驗證 |
| `docs/agent-access.md`、`docs/agent-local-results.md` | Agent 操作、正式配置維護與具體本機 Sub-agent 測試結果／未驗證界線 |
| `docs/agent-deployment.md` | 2026-10-10 Agent 變更、正式資源與 secrets、獨立部署 workflow、Vercel 免費網域及首次發布驗收回條 |
| `tests-next/auth.test.ts` | 錯誤簽章／claims、快取期限、並行讀取及已驗證管理員 email 的行為測試 |
| `src/billing.ts`、`src/credits.ts` | 任何登入者第一次請求就建立 accounts 列（`ensureAccount`），免費試用開啟時帶入新帳號預設點數與每期額度、關閉時為 0；D1 原子預留與實際扣款、供應商 usage 的整數 credit 換算、每來源冪等、cursor 擁有權與個別到期續期；換算基準只存在 private Worker。餘額大於 0 就能開始一批，預估超過餘額也照跑，結算以 0 為下限，帳戶不會變負數 |
| `migrations/0001_billing.sql`～`0015_charges_uid_index.sql` | 計費初始 schema、來源/session 重試限制、實際 credit 紀錄、方案預設、usage 狀態與索引、管理版本、一次操作各回合 usage／cursor（舊單回合資料一次轉成單一 part）、generation_leases 並行預留，以及 charges(uid, created_at) 計費查詢索引 |
| `src/index.ts`、`src/env.ts`、`wrangler.toml` | HTTP/CORS、驗證、計費與串流連接、Cron 和部署設定；`ALLOWED_ORIGIN` 是逗號分隔的完整清單，沒有內建的 localhost 例外。串流中斷時以 stored response 補回 token 用量。管理員不預扣、不上鎖、不算重試次數，但仍結算以記錄 cursor 與 token 用量 |
| `src/http.ts` | 有界讀取及伺服器計算的 fingerprint |
| `src/generation-room.ts` | 每帳號／session 的 SQLite Durable Object，固定 operation ID 去重、獨立背景生成、SSE 訂閱／回放、10 分鐘上限與 30 分鐘結果清除；斷線不取消上游、不重複預留或結算 |
| `src/generation-timing.ts` | 生成房間與 D1 維護共用的時序常數：10 分鐘生成上限 `GENERATION_TIMEOUT_MS` 與由此推導的 900 秒 stale-hold（加 300 秒邊際）；獨立小檔避免 `billing` 與 `generation-room` 循環引用 |
| `src/provider-websocket.ts` | 一條持續 WebSocket 的最多四個可重用 stream_id lanes，共用事件 parser、獨立上下文；上游終止才重用名稱，中止後的晚到文字及舊 socket 事件不混入新工作；斷線僅 GET 取回原 response，未啟用 HTTP 生成 fallback；閒置 60 秒關閉連線。另匯出 `awaitStoredResponse`：GET 輪詢 stored response 至離開 queued／in_progress，與 `generation-room` 的恢復路徑共用，僅由呼叫端決定無法取得時的錯誤 |
| `src/generation-leases.ts`、`migrations/0014_generation_leases.sql` | 每 attempt 一個並行預留名額，同一帳號／session 最多四個；結算或失敗只釋放自己的名額，其他預留仍保持鎖定；轉換既有 inflight reservation |
| `src/cache-probe-input.ts`、`scripts/probe-generation-cache.mjs` | 三個實際模型路由各一個暖快取與兩個並行小樣本，最多 128 輸出 tokens／次，讀取真實 cache read／write 用量及連線時間；首次部署以 [cache-probe] 啟用，之後按需手動重跑 |
| `docs/generation-performance.md` | Pi 機制的版本化研究、暖快取後有限並行、批次／費用邊界與正式 cache probe 維護方法 |
| `docs/luna-photo-evaluation.md` | 五張教材與兩個 Luna 的有界實測、子代理核對、待校對問題與 CLI 快取界線 |
| `docs/luna-question-quality-20261009.md` | 凍結 v12 與 v13–v19、low／medium／high、明示回饋及單來源補缺的有界校準，最後正式 Thinking medium 五型 fresh／一次 native recovery 與語意分開，保留未達成穩定品質的界線 |
| `docs/question-prompt-purpose.md` | v20–v25 命題目的、完整正反例、真實空格流程及 WordBank 來源 ref／usage 錨點 raw v3；凍結 A/B 候選及獨立語意覆核的實測界線 |
| `docs/luna-workload-results-20261009.md` | 70 次新 CLI 請求、273 子題與 943 理由的逐項覆核；4／8／16、4／1、low／medium 的配對、明確空格與 ref 改善，以及尚未達成穩定語意品質的界線 |
| `tests-next/generation-room.test.ts`、`tests-next/provider-websocket.test.ts` | 斷線續跑／去重／扣款、上游結果恢復，以及真正 workerd／SQLite DO／WebSocket 連線復用與回放 |
| `tests-next/room-fixture.ts` | 合成供應商與記憶體 actor storage 的本地測試 fixture |
| `scripts/probe-websocket.mjs` | 部署前使用 production key 驗證供應商 WebSocket handshake，無模型生成、不輸出金鑰 |
| `src/upstream-error.ts` | 上游 HTTP／串流錯誤的管理員診斷：只取錯誤欄位、階段、模型、狀態及 request ID，遮蔽供應商 key；一般帳號不接收診斷 |
| `src/admin-usage.ts`、`src/pagination.ts`、`tests-next/admin-report.test.ts` | 近 30 天報表（題型／檔位／模型分組，各次請求分別計算長上下文成本）、未知成本／歷史未核實扣款計數、版本化游標分頁及行為測試。usage 按時間／id 遞減，帳戶按 email／uid 遞增；`cursor`／`nextCursor` 取代 offset，沒有舊參數相容分支 |
| `src/admin.ts` | 帳號、點數、月額度、免費試用與新帳號方案預設管理端點；調整必須帶閱讀時的 `expected` 狀態，原子拒絕過期修改並直接回傳實際儲存結果。帳號由登入產生，沒有手動建立端點；`/admin/usage` 回傳最近紀錄、近 30 天每個模型的 token 與成本、每個帳號分模型的成本與已扣點數，以及每種工作分檔位的計費單位數與成本 |
| `src/generation.ts`、`src/settlement.ts` | 嚴格輸入、prompt 組裝、模型設定、每來源扣款識別與輸出結算。扣款識別含 session，重試上限不含 session。`words`／`senses` 共用固定提示、`WORD_CACHE_KEY` 與 0–3 義的 provider schema；一般模式恰好一義、補充不得超過 limit，仍由 parser／settlement 按模式驗證。補充以字計費，回傳零義仍算完成 |
| `src/organize.ts` | 文字／照片共用整理 prompt 與其快取版號 `ORGANIZE_CACHE_KEY`、每批 1–10 張 WebP 輸入檢查與逐張計費來源；圖片不落地。`text/plain` body 每行一張 base64，每張至多 1.5 MB、整批 body 至多 20,000,009 bytes；同批只發一次多圖片 Responses 請求，仍逐張預留與記錄來源完成。整理輸出每列固定為「英文 詞性 中文」，詞性來源沒標就補 |
| `src/prompts.ts`、`src/question-brief.ts`、`src/question-prompts.ts`、`src/schemas.ts` | Private 固定提示與 structured-output schema；共用命題目的／正反例／逐題檢查與題型規則分檔，reading 先 skill/evidence，挖空題先 usage 定位 actual answer；共享候選完整文字先定，再以 `{option,reason}` 解析 |
| `src/question-review.ts`、`src/question-review-validation.ts` | 獨立審題 schema／規則及核准前門檻；先修訂與逐項解說，最後判定未解決問題及 approved，檢查篇幅、跨度、選項與原文依據 |
| `src/reviewed-question-stream.ts` | 暫停使用的獨立審題流程，未匯入正式 Worker 入口 |
| `tests-next/question-generation.test.ts` | 題目單次生成、即時文字串流、native fetch receiver、管理員診斷及舊契約拒絕 |
| `tests-next/generation-item-repair.test.ts` | 文意選填按 raw item ref 綁定修復來源，拒絕缺失／未知 ref，不以 index 猜來源；其他題型的修復輸入保持原契約 |
| `src/usage-parts.ts`、`tests-next/question-review-validation.test.ts` | 各回合完整用量、各自計價後加總；核准稿機器門檻及輸出判定順序的必要反例檢查 |
| `tests-next/database.ts`、`tests-next/worker.test.ts` | 本地 D1 fixture 與 HTTP/CORS/管理/生成整合測試 |
| `tests-next/billing.test.ts` | 以 Miniflare 真正 D1/SQLite 驗證扣款、回滾、重試、並發、退款與續期 |
| `vendor/lexiro-ai-contract-5.0.0.tgz` | 來自 public frontend packages/ai-contract 的無祕密共用套件；高中題型、單次生成預估與 single-pass-v3 契約、usage 定位與四批並行共用上限、itemRepair、Sol 價格及 Pro/low 路由。JSON 必須帶模型與檔位，照片由 X-AI-Model／X-AI-Tier 選擇；已付費來源依實際模型及檔位區分 |
| `tests-next/response-stream.test.ts` | 文字保持不變、metadata 不外流、分塊、拒答、錯誤、取消與背壓行為 |
| `scripts/benchmark-stream.mjs` | 合成串流在本地 Node 的效能量測，不代表 Workers CPU 額度 |
| `scripts/evaluate-ai-prompts.mjs`、`scripts/validate-prompt-eval.mjs` | 真實 Luna/low 評測與既有回覆重新驗證；透過 `LEXIRO_FRONTEND_PATH`（預設同層 lexiro）使用目前前端解析器 |
| `scripts/evaluate-photo-workflow.mjs`、`scripts/photo-workflow/` | 評測入口與 config／modules／sources／cases／photos／repairs／transport／scheduler／runner／metrics／replay 責任檔；固定來源、凍結 backend、詞彙 1／4／8／16 小批次、整輪有界並行與暖首批、不可覆寫計畫與回覆、原生 PARTIAL 來源覆蓋及 saved-reply 重驗。文章／候選庫保持完整，傳輸失敗停止該模型新派送；CLI 指標不代表正式 API 用量或成本 |
| `docs/luna-workload-evaluation.md`、`scripts/photo-workflow/evaluation.test.mjs` | 固定 24 來源的 A/B 命令、整輪時間／來源／token 指標界線，以及真正有界排程、暖首批、傳輸停止與部分成果的必要行為測試 |
| `scripts/evaluate-question-review.mjs` | 對凍結初稿做 fresh medium CLI 盲審，保留每次請求、schema、回覆與回條；CLI 失敗即停止後續樣本，不以 parser 通過率冒充教育品質 |
| `tests-next/fixtures/prompt-eval/`、`docs/prompt-evaluation.md` | 從公開前端移入的歷史合成案例、片語實際用法案例與評測方法；`luna-quality-sources.json` 是現行 near-synonym／角色／多義風險的合成來源；`luna-workload-sources.json` 固定原 16 詞加 8 個正常變形／片語來源，供小批次與並行對照；歷史 medium artifacts 另存本地 ignored artifacts/historical-medium |
| `tests-next/schemas.test.ts`、`tests-next/prompt-prefix.test.ts` | strict schema、writer／reviewer 固定前綴與 schema／設定跨輸入一致性、最低 tokenizer 長度驗證，以及補充多義與單字共用同一前綴及快取鍵 |
| `tests-next/settlement.test.ts` | 補充多義的結算：空詞義仍算完成、回傳一個或兩個收費相同、超過上限或語言錯誤的字不列入已完成；文意選填完整且唯一 ref 覆蓋及修復身份、無效來源重試與真實用量一次結算 |
| `tests-next/organize.test.ts` | 整理固定價格／前綴、1／10 張的單一串流 envelope、張數／逐張 WebP 限制、逐張冪等與失敗／取消整批退款 |
| `package.json`、`tsconfig.json` | 獨立套件與檢查設定 |
| `.github/workflows/deploy.yml`、`docs/deployment.md` | main push 先完整驗證，再套用 D1 migrations、同步 secrets、部署 Worker 並做 CORS health check；以及正式設定與上線驗收清單 |
| `.github/workflows/deploy-agent.yml` | 獨立 Agent 正式發布：完整驗證、兩組專用 D1 migrations、Worker 部署與 OAuth discovery；不需要 Firebase secret 或模型金鑰 |
| `docs/backend-blueprint.html` | 完整原始藍圖，移除平台執行腳本與登入包裝後的本地版本 |
| `docs/product-decisions.md` | 使用者補充、矛盾處理與階段驗收；優先於原始藍圖 |
| `README.md`、`docs/architecture.md` | 本機入口、端點、D1／pending usage 生命週期及排程；現行配置與發布見 deployment |

一般公開串流保留 Responses 文字與必要 metadata。題目與解說單次生成，文字立即轉發供前端計數，正式入口暫停獨立模型審題。itemRepair 只要求一個子題並沿用既有文章。API key 始終只用於後端供應商請求標頭，上游錯誤文字僅向管理員提供遮蔽後的診斷。

前端以 o200k tokenizer 估計串流輸出 tokens，每 100ms 顯示該批次累計 tokens 除以耗時的平均 TPS，不包含推理 token。最終費用只使用供應商 usage。

`onTerminal` 在終止事件送給前端之前完成結算或持久化待核對項目，並寫入 cursor。用量齊全時立即釋放鎖，缺少 usage 的有產出項目則保留預留等待補查。取消也會發出一次內部終止通知。此處只保護協定層的上下文回顯，不改寫模型產生的內容。

帳戶的負餘額只表示生成中的預留。管理員可更新備註，但額度調整必須等結算完成，不能把預留餘額歸零。閱讀測驗完成 3–5 題都保留來源成功紀錄，同一 session 重試不再次扣款。`usage_log.credits` 是供應商成本，`assessed_points` 是套用餘額上限前的應收點數，`points` 是實際扣款；`debit_verified=0` 表示尚未核實的扣款，包括歷史紀錄與待核對項目。

## 持久化版本

Durable Object namespace `GENERATIONS` 使用 `generation-room-v1` SQLite migration；回放來源／輸出與結算 metadata 至任務開始後 30 分鐘，由 alarm 刪除。圖片、私有提示與憑證不保存於 actor storage。D1 版本 14 新增 generation_leases，租期 15 分鐘；同 session 最多四個預留。版本 15 為 charges(uid, created_at) 建立計費查詢索引。其他批次仍有預留時保留負值，最後一批結算才套用餘額零下限，避免提前歸零導致多退點數。

| 資料 | 版本 | Migration |
| --- | --- | --- |
| D1 計費 | 15 | `0001_billing.sql` 建立計費；`0002_attempt_limits.sql` 新增重試限制；`0003_actual_credits.sql` 新增 nullable 歷史相容 credit 與試用設定；`0004_plan_defaults.sql` 新增管理員可調的新帳號初始點數，不改既有餘額；`0005_usage_status.sql` 記錄每筆 usage 的結束狀態並加上 uid 索引；`0006_registered_accounts.sql` 移除與 `default_initial` 重複的 `trial_points`；`0007_usage_kind.sql` 記錄工作種類、檔位與計費單位數；`0008_cache_write_usage.sql` 分開記錄 GPT-5.6 cache write token，讓首次暖快取的 1.25 倍費率不會被低估；`0009_verified_debits.sql` 新增 `assessed_points` 與 `debit_verified`，新 usage 的 `points` 記錄實扣而非扣款前成本，歷史資料不臆測回填；`0010_pending_usage.sql` 新增 `usage_state` 與可恢復的 `pending_usage`，未知成本保留 NULL，不列為零成本完成；`0011_report_indexes.sql` 建立全站時間／id 與帳戶 email／uid 索引，支援報表時間範圍與游標分頁；`0012_admin_versions.sql` 新增帳號／設定遞增版本，資料恢復原值仍拒絕舊請求；`0013_usage_parts.sql` 加入逐回合 usage／cursor 並把舊單回合紀錄轉成一個 part，缺漏任一回合維持未知總成本；`0014_generation_leases.sql` 新增 generation_leases 並行預留名額；`0015_charges_uid_index.sql` 建立 charges(uid, created_at) 索引，計費查詢皆以 uid 過濾 |
