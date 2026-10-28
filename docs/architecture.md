# 公開端點與資料生命週期

## HTTP

入口是 src/agent/index.ts。只有 `APP_ORIGIN` 會取得 CORS 允許標頭，其他 Origin 直接 403；Worker 回應一律 no-store。Firebase ID token 驗簽、project、UID、時間；管理員另驗 verified email 和 ADMIN_EMAILS。App Check 是選用閘（src/app-check.ts）：`APP_CHECK_MODE` 預設或無法辨識時為 off、完全跳過且行為不變；monitor 只記錄一行結構化訊息（不含 token）後放行；enforce 在缺少 `X-Firebase-AppCheck` 或驗證失敗時回 401。驗證為真正的 RS256 解簽，並檢查 App Check 的 iss、aud、exp 與非空 sub。Agent Worker 只在瀏覽器 Firebase ID token 路徑套用，MCP bearer、link token 與 OAuth provider 端點不套用。

| Method／path | 用途 |
| --- | --- |
| `GET /health` | 服務版本與健康檢查 |
| `GET /authorize`、`POST /oauth/token`、`POST /oauth/register` | MCP OAuth 授權、token 與動態客戶端註冊；`/authorize` 與 `/oauth/register` 有 IP 限流 |
| `POST /app-auth/codes`、`POST /app-auth/token` | Web 登入後以一次性 PKCE code 把 Google ID token 交給原生 App |
| `/sync/*` | Firebase Auth owner 的教材同步 API，uid 取自驗證結果 |
| `/shares`、`/shares/*` | 登入者建立／列出／撤銷單字集分享連結，持連結者讀取最新同步內容 |
| `/rooms`、`/rooms/*` | 建立／加入房間與一次性 WebSocket ticket |
| `/links`、`/links/{id}` | 建立、列出與撤銷限定 uid＋setId 的單集 URL |
| `GET /oauth/request/{id}`、`POST /oauth/approve/{id}` | MCP 授權同意流程 |
| `GET /connections`、`DELETE /connections/{id}` | 列出與撤銷 OAuth 授權 |
| `/access/{id}/*` | 持 link token 讀寫單集、查詢與分類移動，不套用 Firebase token |
| `/mcp` | OAuth 保護的 MCP 端點，需 `sets:read`／`sets:write` scope |
| `OPTIONS` | 允許 Origin 的 CORS preflight |

## MCP 與 D1

MCP 提供 5 個工具：read、create_set、write、validate、delete；write／delete 以 `action.type` 指定詞義、題目、子題或資料夾操作。read 一次按需讀多種 resource，完整 questionPrompt 獨立取得；brief 只回小批來源 specification。教材與偏好存於專用 CLOUD_DB，前端同步、MCP 與單集 URL 共用同一 repository；JSON 批次、CAS ticket 與 operation 回條在同一個 D1 batch 完成。

單集 URL 預設兩小時，只管理固定 uid＋setId；bearer token 只存 hash，撤銷即失效。MCP 與 REST 的 expectedRevision／operationId 選填，提供時保留版本衝突與重送檢查，省略仍受 D1 交易 CAS 保護。題目以 senseId 綁定來源，支援 partial／atomic 與逐題 Error／Warning；篇幅只是警告。

## 連線對戰

登入者建立 6 碼房間（最多 8 人），房主送出自己題庫的題目。GameRoom Durable Object 以 alarm 推進題目並在伺服器判分，答案不送給玩家、不等斷線者，重連直接回到目前題目。WebSocket 先以一次性 ticket 授權，避免長期憑證出現在查詢字串。

## D1 與排程

Agent D1 使用 `agent-migrations` 至版本 3：URL scope／到期／撤銷、OAuth 授權請求、未認證端點限流與一次性 App 登入 code。教材 D1 使用 `library-migrations` 至版本 4：帳號版本、教材、來源索引、偏好 blobs、操作回條（`created_at` 索引）與分享連結。Durable Object `ROOMS` 使用 `game-room-v1` SQLite migration。

Wrangler Cron 每小時執行一次，清除過期授權請求、已到期／撤銷的 link、7 天前的限流列與未兌換的 App auth code，30 天前的教材操作回條，並分批清除過期 OAuth 資料。這是存取資料維護，不是教材同步或 FSRS 排程。

完整責任見[structure](../structure.md)，部署與維護見[Agent 部署](agent-deployment.md)。
