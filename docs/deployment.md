# GitHub Actions 部署

lexiro 會在 `main` 分支 push 後自動執行 typecheck、lint、unit tests、Firestore Rules Emulator 測試與 production build。驗證成功後會同時：

1. 發布前端到 GitHub Pages。
2. 發布 `firestore.rules` 與 `firestore.indexes.json` 到 Firebase。

Workflow 位於 `.github/workflows/deploy.yml`。

## GitHub Secrets

在 GitHub repository 的 `Settings > Secrets and variables > Actions` 新增：

| Secret | 必填 | 用途 |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | 是 | Firebase Web App 設定；前端會使用 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 是 | 通常是 `your-project.firebaseapp.com` |
| `VITE_FIREBASE_PROJECT_ID` | 是 | Firebase project ID，也用於 Rules deploy |
| `VITE_FIREBASE_STORAGE_BUCKET` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_APP_ID` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_APPCHECK_SITE_KEY` | 建議 | reCAPTCHA Enterprise Site Key；未設定仍可部署，但不會啟用 App Check |
| `FIREBASE_SERVICE_ACCOUNT` | 是 | Firebase deploy 使用的 service-account JSON，不能提交到 repository |

`VITE_*` 變數會被編譯進瀏覽器，因此不是秘密；Firebase 的真正權限由 Authentication 與 Firestore Rules 保護。`FIREBASE_SERVICE_ACCOUNT` 才是敏感憑證，只能放在 GitHub Actions Secret。

## Firebase / GitHub 設定

1. Firebase Console 啟用 Google Authentication。
2. 將 GitHub Pages 網域加入 Firebase Authentication 的 Authorized domains，例如 `tavricccc.github.io`。
3. 若使用 App Check，建立 reCAPTCHA Enterprise provider，將 Site Key 放入 `VITE_FIREBASE_APPCHECK_SITE_KEY`，並把 GitHub Pages 網域加入允許清單。
4. 建立 Firebase service account JSON，放入 `FIREBASE_SERVICE_ACCOUNT`。它需要能部署 Firestore Rules 與 indexes。
5. Repository 的 `Settings > Pages > Build and deployment > Source` 選擇 `GitHub Actions`。
6. push 到 `main`，成功後網站會在 `https://tavricccc.github.io/lexiro/`。

本機開發通常只需要 `.env.local` 中的 Firebase Web App 變數；`VITE_BASE_PATH=/` 保持即可。GitHub Actions 會自動使用 `/lexiro/`，並處理 GitHub Pages 的 SPA fallback。
