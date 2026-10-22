# 設定參考

本機用 `.env.local`，欄位見 `.env.example`。`NEXT_PUBLIC_*` 由 `vite.config.ts` 在 build 時寫進 browser bundle（程式仍以 `process.env.NEXT_PUBLIC_*` 讀取），不能放 service-account JSON 或任何私密憑證。

| 名稱 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Google 登入 domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | 保留 Firebase Web 設定；教材保存使用 D1 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web 設定 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Web client |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | 選用 App Check（reCAPTCHA Enterprise）site key；留空即關閉 |
| `NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED` | Development 連本機 emulator |
| `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` | 預設 127.0.0.1 |
| `NEXT_PUBLIC_AGENT_WORKER_URL` | D1 同步與 MCP／URL Worker origin；本機 127.0.0.1:8791 |

`isFirebaseConfigured` 要求 API key、auth domain、project ID、app ID 與 Google client ID 都存在。純本機模式不填這組值；example 中的 `your-*` 是欄位示例，不能當成可使用的設定。

Firebase 只初始化 Auth。App Check 為選用且預設關閉：未設 `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` 時前端不載入 `firebase/app-check`，Worker 請求也不帶 App Check 標頭，行為與過去完全相同；設定後前端才動態初始化（reCAPTCHA Enterprise provider），並在所有帶 Firebase ID token 的 Worker 請求加上 `X-Firebase-AppCheck`。上線流程先在 Firebase console 以 monitor 觀察流量，確認正常再切換為 enforce；App Check 失敗一律不阻擋原本流程，實際放行與否由各 Worker 後端決定。Firestore SDK 初始化及 service-account 部署已移除。Agent Worker 透過 Firebase 公鑰驗 ID token，資料寫入自己的 D1。

GitHub Production 保留 VITE_* secret 名稱並注入 NEXT_PUBLIC_*。Worker URLs 為 Environment variables；Vercel credentials 見[部署](deployment.md)，D1 bindings 見 [D1 雲端](d1-cloud.md)。

Private Agent Worker 的 `.dev.vars` 保存 FIREBASE_PROJECT_ID、ALLOWED_ORIGIN、APP_ORIGIN、AGENT_PUBLIC_URL；D1／KV bindings 見 [D1 雲端](d1-cloud.md)。前端與 Worker 的 Firebase project 必須相同，允許 origin 要包含實際前端的 scheme／host／port。未登入、錯 project 或不允許 origin 都會被拒絕。

教材、偏好與練習草稿保存在 IndexedDB／D1。版號見[資料與同步](data-and-sync.md)。
