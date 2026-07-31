# GitHub Actions 部署

lexiro 會在 `main` 分支 push 後自動執行 typecheck、lint、unit tests、Firestore Rules Emulator 測試與 production build。驗證成功後會同時：

1. 在 GitHub Actions 內執行 `vercel build`，產生 prebuilt output。
2. 將 prebuilt output 發布到 Vercel；Vercel 不會重新執行 build。
3. 發布 `firestore.rules` 與 `firestore.indexes.json` 到 Firebase。

Workflow 位於 `.github/workflows/deploy.yml`。

## GitHub Secrets

整份 workflow 的所有 job 都使用 `Production` Environment。
請到 `Settings > Environments > Production > Environment secrets` 新增以下項目；Environment 名稱必須完全一致。

也可以放在 repository secrets，但同名的 `Production` Environment secret 會優先使用。

需要新增：

| Secret | 必填 | 用途 |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | 是 | Firebase Web App 設定；前端會使用 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 是 | 通常是 `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | 是 | Firebase project ID，也用於 Rules deploy |
| `VITE_FIREBASE_STORAGE_BUCKET` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_APP_ID` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | 建議 | reCAPTCHA Enterprise Site Key；未設定仍可部署，但不會啟用 App Check |
| `VITE_GOOGLE_CLIENT_ID` | 是 | Google Identity Services Web OAuth Client ID |
| `FIREBASE_SERVICE_ACCOUNT` | 是 | Firebase deploy 使用的 service-account JSON，不能提交到 repository |
| `VERCEL_TOKEN` | 是 | Vercel CLI deploy token |
| `VERCEL_PROJECT_ID` | 是 | Vercel Project Settings > General 的 Project ID |

`VITE_*` 變數會被編譯進瀏覽器，因此不是秘密；Firebase 的真正權限由 Authentication 與 Firestore Rules 保護。`FIREBASE_SERVICE_ACCOUNT` 才是敏感憑證，只能放在 GitHub Actions Secret。

## Firebase / GitHub 設定

1. Firebase Console 啟用 Google Authentication。
2. 將 Vercel 網域加入 Firebase Authentication 的 Authorized domains，例如 `lexiro.vercel.app`。
3. 若使用 App Check，建立 reCAPTCHA Enterprise provider，將 Site Key 放入 `VITE_FIREBASE_APPCHECK_SITE_KEY`，並把 Vercel 網域加入允許清單。
4. 在 Google Cloud Console 建立 Web OAuth Client ID，將 Vercel 網域加入 Authorized JavaScript origins，並把 Client ID 放入 `VITE_GOOGLE_CLIENT_ID`。
5. 建立 Firebase service account JSON，放入 `FIREBASE_SERVICE_ACCOUNT`。它需要能部署 Firestore Rules 與 indexes。
6. 在 Vercel 建立專案，取得 `VERCEL_PROJECT_ID`，並建立有該專案部署權限的 `VERCEL_TOKEN`。
7. 關閉 Vercel Git Integration 的自動部署，避免同一次 push 觸發第二次 build；部署入口只保留 GitHub Actions。
8. 將以上 secrets 全部放在 `Settings > Environments > Production > Environment secrets`。
9. push 到 `main`，成功後網站會在 Vercel production domain。

本機開發與 Vercel 都使用根路徑 `/`，不需要設定 `VITE_BASE_PATH`。`vercel.json` 會處理 Vue Router history mode 的 SPA fallback。
