# Lexiro Worker 檔案地圖

獨立 private 後端工作區，只保留 Agent Worker。main push 由 GitHub Actions 驗證後套用兩組 D1 migrations 並部署；本地測試不代表正式 Firebase、D1 累積用量或 Cloudflare CPU 已驗收。AI 生成 Worker 已封存於分支 `archive/managed-ai`。現行決策見 `docs/product-decisions.md`，部署與 secrets 見 `docs/agent-deployment.md`。

| 路徑 | 責任 |
| --- | --- |
| `src/auth.ts` | Google RS256 簽章、Firebase project/uid/時間驗證、Cache-Control 公鑰快取與 ADMIN_EMAILS 管理員判斷 |
| `src/app-check.ts` | 選用的 Firebase App Check 閘，`APP_CHECK_MODE` 預設 off 時跳過；驗 App Check JWKS 的 RS256 簽章與 iss／aud／exp／非空 sub，金鑰快取比照 `src/auth.ts`（含 5 分鐘下限）；monitor 只 warn 一行結構化訊息（不含 token）後放行，enforce 缺 `X-Firebase-AppCheck` 或驗證失敗回 401，缺 `FIREBASE_PROJECT_NUMBER` 時 enforce 回 500、monitor 放行並 warn |
| `src/agent/index.ts`、`wrangler.agent.toml` | 獨立無模型金鑰的 Agent Worker，MCP OAuth discovery／DCR／CIMD、Firebase owner 端點、單集 URL、連線撤銷、未認證端點限流、CORS 與過期資料 Cron；部署與教材 D1 分開。選用 App Check 只套用在瀏覽器 Firebase ID token 路徑，MCP bearer／link token／OAuth provider 端點不套用 |
| `src/agent/app-auth.ts`、`agent-migrations/0003_app_auth_codes.sql` | Web 登入後以一次性 PKCE code 把 Google ID token 交給原生 App；只存 code hash 與 challenge，60 秒到期、兌換即刪，Cron 清除未兌換列 |
| `src/agent/rate-limit.ts` | D1 固定視窗限流：未認證端點 `/authorize` 每 IP 每 60 秒 60 次、`/oauth/register` 10 次（key 為端點＋`CF-Connecting-IP`，缺標頭以 `unknown` 計）；已登入房間端點以 uid 計數（`room_create` 5 次、`room_ticket` 30 次），單一 upsert 原子遞增並以 `Retry-After` 回 429 `rate_limited`，D1 故障時 fail-open，`now` 由呼叫端注入 |
| `src/agent/guard.ts`、`src/agent/read-budget.ts`、`agent-migrations/0004_disabled_accounts.sql`、`0005_read_budget.sql` | 每個已登入請求（Firebase token、MCP grant、access link）經 `guarded`：先過 Workers Rate Limiting binding `USER_LIMITER`（uid 每 60 秒 60 次，近似、依機房計，不寫 D1），再一次查詢 `disabled_accounts`（403 `account_disabled`，只由 admin workflow 寫入）、`account_reads` 當日讀取列數（滿 20 萬回 429 `daily_read_limit`，`UNLIMITED_UIDS` 豁免）與 `service_flags` 的 `agent_paused`（只擋 MCP 與 access link，503）；請求以計量後的 D1 binding 執行，讀滿 10 列才記入 `account_reads`。`DELETE /account` 不計量 |
| `src/agent/account.ts` | `DELETE /account`：要求 10 分鐘內登入過（Firebase `auth_time`），刪除該 uid 的教材、blobs、操作回條、分享連結、access link、App 登入 code，並撤銷所有 MCP grant；可重複執行；保留 `disabled_accounts` |
| `src/agent/oauth.ts`、`mcp.ts`、`instructions.ts` | S256 PKCE 登入授權、5 個精簡工具（read／create_set／write／validate／delete），action.type 分派寫入；read 一次按需讀多種資料，完整 questionPrompt 獨立取得，寫入保留 senseId、partial／atomic 與寬鬆品質門檻 |
| `src/agent/query.ts` | D1 索引查詢、單字／題目搜尋、題型／難度篩選、範圍與游標分頁、巢狀欄位投影及精簡回條 |
| `src/agent/edits.ts`、`resource-api.ts` | 單字／詞義／題目／子題 patch；單集 REST 路由及多資料 POST query，首次讀取只回摘要與操作指引 |
| `src/agent/access.ts`、`operations.ts`、`types.ts` | per-user／per-set bearer URL、兩小時預設期限、hashed token、版本與 operation ID envelope、資料 scope |
| `src/agent/library-repository.ts` | D1 教材 repository；本集 memberships/source 索引讀取、資料夾 CRUD、版本衝突與冪等回條 |
| `src/cloud/{api,repository,records}.ts` | Firebase Auth owner 同步 API、D1 change feed／blob CAS、JSON 批次交易與原生教材序列化；Agent 和瀏覽器使用同一資料庫 |
| `library-migrations/0001_library.sql` | 專用 CLOUD_DB schema v1：帳號版本、教材、來源索引、學習／偏好 blobs、操作回條；不遷移 Firestore |
| `library-migrations/0002_drop_learning_blobs.sql`、`0003_set_shares.sql` | 刪除學習進度／統計 blobs，blob 只留 preferences 與跨裝置 practice；單字集分享連結表（每集一條，撤銷即刪） |
| `library-migrations/0004_cloud_operations_created_index.sql` | `cloud_operations.created_at` 索引，供 Cron 清除 30 天前操作回條 |
| `library-migrations/0005_account_quotas.sql` | `cloud_accounts` 加每日寫入計數（`quota_day`、`quota_writes`）與 `stored_bytes`；`CloudD1Repository.commit` 在同一個 CAS update 內檢查每帳號每日 3000 筆與 50 MB 上限（刪除不受容量限制），超過回 429 `daily_write_limit`（含 `Retry-After`）或 413 `storage_limit`；`UNLIMITED_UIDS` 豁免 |
| `src/cloud/shares.ts` | 登入後的分享連結：建立／列出／撤銷，任何登入者持連結讀取擁有者最新同步的單字集 |
| `src/rooms/protocol.ts`、`game-room.ts`、`api.ts` | 連線對戰：登入者建立 6 碼房間（最多 8 人），房主送出自己題庫的題目；GameRoom Durable Object 以 alarm 推進題目、伺服器判分（答案不送給玩家）、不等斷線者、重連直接回到目前題目；WebSocket 用一次性 ticket 授權 |
| `agent-migrations/0001_agent_access.sql`、`0002_rate_limits.sql` | Agent D1 schema：URL scope／到期／撤銷與一次性 OAuth 授權請求，以及未認證端點（`/authorize`、`/oauth/register`、`/app-auth/token`）以端點＋IP 固定 60 秒視窗的計數表 `agent_rate_limits`，過期列沿用 7 天 cutoff 由 Cron 清除；與教材 migrations 分開 |
| `vendor/lexiro-agent-contract-4.9.0.tgz` | 公開共用教材／資料夾／雲端 DTO、Agent 逐題驗證與部分成功，支援綜合測驗文法空格與詞義 description，寫入時保留單字集的字序；每批 200 筆，不含模型金鑰或 private prompt |
| `wrangler.agent-local.toml`、`tests-next/agent-local-entry.ts`、`agent-migrations/fixtures/local-agent.sql` | 僅本機 D1、合成帳號及資料 repository；不出現在正式入口 |
| `tests-next/agent-d1.test.ts`、`scripts/agent-smoke.mjs` | 真 D1 batch／CAS／分頁／帳號隔離、200 筆與資料夾、前端同步互通及 HTTP OAuth／URL 驗證 |
| `tests-next/agent-rate-limit.test.ts`、`tests-next/app-auth.test.ts` | 未認證端點限流邊界與 429 回條；App auth code 的 PKCE、單次兌換、到期與清除行為 |
| `tests-next/account-limits.test.ts` | 每日寫入與容量上限（含跨 UTC 日、豁免、超限時完全不寫入、刪除仍可）、guard 的限流／停用，以及刪除帳號（只刪自己、可重試、需近期登入） |
| `scripts/usage-check.mjs`、`.github/workflows/usage-watch.yml` | 每小時以 GraphQL Analytics 查當日（UTC）Workers、Durable Objects 請求與 D1 讀寫列數；任一超過免費日額度 70% 就讓排程失敗，由 GitHub 寄信；D1 讀取達 80% 時寫入 `agent_paused`，低於 80% 時清除；token 需 Account Analytics: Read |
| `.github/workflows/account-admin.yml` | 手動執行：`usage` 列出當日寫入最多的帳號與已停用帳號，`disable`／`enable` 增刪 `disabled_accounts`；uid 只接受英數字 |
| `docs/agent-access.md`、`docs/agent-local-results.md` | Agent 操作、正式配置維護與具體本機 Sub-agent 測試結果／未驗證界線 |
| `docs/agent-deployment.md` | 2026-10-10 Agent 變更、正式資源與 secrets、獨立部署 workflow、Vercel 免費網域及首次發布驗收回條 |
| `tests-next/auth.test.ts` | 錯誤簽章／claims、快取期限、並行讀取及已驗證管理員 email 的行為測試 |
| `tests-next/app-check.test.ts` | App Check off／monitor／enforce 邊界、簽章／iss／aud／exp／sub 拒絕、缺 project number 與 Agent Worker 的 CORS 預檢允許 `X-Firebase-AppCheck` |
| `src/http.ts` | 有界讀取及伺服器計算的 fingerprint |
| `src/question-brief.ts`、`src/question-prompts.ts` | MCP 命題用 brief 與內建 questionPrompt；共用命題目的／正反例／逐題檢查與題型規則分檔，reading 先 skill/evidence，挖空題先 usage 定位 actual answer；共享候選完整文字先定，再以 `{option,reason}` 解析 |
| `docs/question-prompt-purpose.md` | v20–v25 命題目的、完整正反例、真實空格流程及 WordBank 來源 ref／usage 錨點 raw v3；凍結 A/B 候選及獨立語意覆核的實測界線 |
| `tests-next/game-room.test.ts`、`tests-next/set-shares.test.ts` | 真正 workerd／SQLite DO 的房間流程、斷線與重連；分享連結建立／撤銷及跨帳號讀取 |
| `package.json`、`tsconfig.json` | 獨立套件與檢查設定 |
| `.github/workflows/deploy-agent.yml` | 獨立 Agent 正式發布：完整驗證、兩組專用 D1 migrations、Worker 部署與 OAuth discovery；不需要 Firebase secret 或模型金鑰 |
| `docs/backend-blueprint.html` | 完整原始藍圖，移除平台執行腳本與登入包裝後的本地版本 |
| `docs/product-decisions.md` | 使用者補充、矛盾處理與階段驗收；優先於原始藍圖 |
| `README.md`、`docs/architecture.md` | 本機入口、公開端點、MCP／同步／房間資料生命週期及排程；現行配置與發布見 agent-deployment |

Agent Worker 只驗證 Firebase 身分並讀寫 D1，不呼叫模型 API。前端 `/sync`、MCP 與單集 URL 共用同一個 D1 教材 repository；Firebase token 驗證後 uid 一律取自驗證結果。MCP 只暴露 5 個工具，讀取以本集來源索引與游標分頁進行；寫入使用 revision／operationId 與 D1 批次 CAS 保護重送。

## 持久化版本

| 資料 | 版本 | Migration |
| --- | --- | --- |
| Agent 存取 | 3 | `0001_agent_access.sql` 建立 URL scope／到期／撤銷與 OAuth 授權請求；`0002_rate_limits.sql` 新增未認證端點固定視窗計數；`0003_app_auth_codes.sql` 新增一次性 App 登入 code，只存 hash／challenge 並於兌換時刪除 |
| 教材 D1 | 4 | `0001_library.sql` 建立帳號版本、教材、來源索引、blobs 與操作回條；`0002_drop_learning_blobs.sql` 移除學習進度／統計 blobs；`0003_set_shares.sql` 新增單字集分享連結；`0004_cloud_operations_created_index.sql` 為操作回條建立時間加索引，Cron 保留 30 天 |
| Durable Object | 1 | `game-room-v1` SQLite migration；房間狀態與目前題目由 alarm 推進，重連直接回到目前題目 |
