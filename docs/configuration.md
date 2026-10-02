# 設定參考

本機用 `.env.local`，欄位見 `.env.example`。`NEXT_PUBLIC_*` 會進 browser bundle，不能放 provider key 或 service-account JSON。

| 名稱 | 用途 |
| --- | --- |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API key |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Google 登入 domain |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase project |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | Firebase Web 設定；教材保存使用 Firestore |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | Firebase Web 設定 |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App |
| `NEXT_PUBLIC_GOOGLE_CLIENT_ID` | Google OAuth Web client |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` | reCAPTCHA Enterprise site key |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_ENABLED` | `true` 才啟用 attestation |
| `NEXT_PUBLIC_FIREBASE_APPCHECK_DEBUG_TOKEN` | 只供 development，先在 Firebase 註冊 |
| `NEXT_PUBLIC_FIREBASE_EMULATOR_ENABLED` | Development 連本機 emulator |
| `NEXT_PUBLIC_FIREBASE_EMULATOR_HOST` | 預設 127.0.0.1 |
| `NEXT_PUBLIC_AI_WORKER_URL` | Worker origin；本機例子 localhost:8787 |

`isFirebaseConfigured` 要求 API key、auth domain、project ID、app ID 與 Google client ID 都存在。純本機模式不填這組值；example 中的 `your-*` 是欄位示例，不能當成可使用的設定。

App Check 只有 site key 不會啟用；要明確設 enabled=true，或在 development 提供 debug token。Emulator mode 不啟用 App Check。程式依據是 `src/lib/firebase-config.ts`。

GitHub `Production` Environment 目前保留 VITE_* secret 名稱，由 workflow 注入成 NEXT_PUBLIC_*；本機程式不接受 VITE_*。Worker URL 是 Environment variable。完整對應、Vercel credential 及 Firebase service account 見[部署](deployment.md)。

Private Worker 的 `.dev.vars` 保存 FIREBASE_PROJECT_ID、ALLOWED_ORIGIN、OPENAI_BASE_URL、OPENAI_API_KEY、ADMIN_EMAILS。前端與 Worker 的 Firebase project 必須相同，允許 origin 要包含實際前端的 scheme／host／port。未登入、錯 project 或不允許 origin 都會被拒絕。

學習目標、AI 模型是帳號偏好，存在 IndexedDB／Firestore；試用與新帳號額度是 D1 管理設定。設定表述與版號分別見[資料與同步](data-and-sync.md)及[AI API](ai-api.md)。
