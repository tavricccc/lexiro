# GitHub Actions 部署

推送 `main` 後，Lexiro 會執行 typecheck、lint、unit tests 與 Next.js production build。驗證完成後：

1. 產生 Vercel prebuilt artifact。
2. 發布 Firestore Rules 與 indexes。
3. Rules 成功後把已驗證的 artifact 發布到 Vercel production。

Workflow 位於 `.github/workflows/deploy.yml`，所有 job 使用 GitHub 的 `Production` Environment。

## GitHub Secrets

在 `Settings > Environments > Production > Environment secrets` 設定：

| Secret | 必填 | 用途 |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 是 | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | 是 | Firebase project ID 與 Rules deploy |
| `VITE_FIREBASE_STORAGE_BUCKET` | 是 | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 是 | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | 是 | Firebase Web App ID |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | 建議 | reCAPTCHA Enterprise site key |
| `VITE_FIREBASE_APPCHECK_ENABLED` | 建議 | 設為 `true` 後啟用 App Check |
| `VITE_GOOGLE_CLIENT_ID` | 是 | Google OAuth Web client ID |
| `FIREBASE_SERVICE_ACCOUNT` | 是 | 部署 Firestore Rules 的 service-account JSON |
| `VERCEL_TOKEN` | 是 | Vercel CLI deploy token |
| `VERCEL_ORG_ID` | 是 | Vercel org/team ID |
| `VERCEL_PROJECT_ID` | 是 | Vercel Project ID，通常以 `prj_` 開頭 |

GitHub Secret 名稱暫時保留既有的 `VITE_*`，workflow 會把它們注入成 Next.js 使用的 `NEXT_PUBLIC_*` build variables；程式碼與本機 `.env.local` 不再支援 `VITE_*`。Firebase Web 設定會進入瀏覽器 bundle，真正的資料權限仍由 Authentication、App Check 與 Firestore Rules 控制。`FIREBASE_SERVICE_ACCOUNT` 不可提交到 repository。

`vercel.json` 會把 Framework Preset 固定為 Next.js，並將 Output Directory 恢復為 framework 預設值。即使 Vercel Project Settings 還留著舊 Vite 專案的 `dist` override，repository 設定也會在 deployment 時覆蓋它。

## 平台設定

1. Firebase Console 啟用 Google Authentication，並加入 Vercel production domain。
2. 若使用 App Check，先註冊 Web App、設定 reCAPTCHA Enterprise domain，再啟用 enforcement。
3. Google Cloud Console 的 OAuth Web client 必須包含 Vercel domain 的 Authorized JavaScript origin。
4. `FIREBASE_SERVICE_ACCOUNT` 必須具備發布 Firestore Rules 與 indexes 的權限。
5. 從 `.vercel/project.json` 取得 `orgId` 與 `projectId`，分別存入 `VERCEL_ORG_ID`、`VERCEL_PROJECT_ID`。
6. 關閉 Vercel Git Integration 的重複自動部署；production deployment 由 GitHub Actions 負責。

本機與 Vercel 都使用根路徑 `/`。Next.js App Router 會處理路由，不需要 SPA fallback rewrite。
