# GitHub Actions 部署

推送 `main` 後，Lexiro 會執行 typecheck、lint、unit tests 與 Vite production build。驗證完成後：

1. 在同一個 runner 產生 Vercel prebuilt output。
2. 將 Agent origin 同步至 Vercel Production 環境。
3. 直接把該 runner 的 prebuilt output 發布到 Vercel production；不再部署 Firestore。

Workflow 位於 `.github/workflows/deploy.yml`，所有 job 使用 GitHub 的 `Production` Environment。

## GitHub Secrets

在 `Settings > Environments > Production > Environment secrets` 設定：

| Secret | 必填 | 用途 |
| --- | --- | --- |
| `VITE_FIREBASE_API_KEY` | 是 | Firebase Web App 設定 |
| `VITE_FIREBASE_AUTH_DOMAIN` | 是 | Firebase Auth domain |
| `VITE_FIREBASE_PROJECT_ID` | 是 | Firebase Auth project ID |
| `VITE_FIREBASE_STORAGE_BUCKET` | 是 | Firebase Storage bucket |
| `VITE_FIREBASE_MESSAGING_SENDER_ID` | 是 | Firebase messaging sender ID |
| `VITE_FIREBASE_APP_ID` | 是 | Firebase Web App ID |
| `VITE_GOOGLE_CLIENT_ID` | 是 | Google OAuth Web client ID |
| `VERCEL_TOKEN` | 是 | Vercel CLI deploy token |
| `VERCEL_ORG_ID` | 是 | Vercel org/team ID |
| `VERCEL_PROJECT_ID` | 是 | Vercel Project ID，通常以 `prj_` 開頭 |

GitHub Secret 名稱保留既有 `VITE_*`，workflow 注入成 `NEXT_PUBLIC_*`，由 `vite.config.ts` 寫進 bundle；本機使用後者。Firebase Web 設定只供 Auth，D1 資料權限由 Worker 驗 ID token、限定 uid。前端及 Agent 不再需要 Firebase service-account JSON。

`vercel.json` 把 Framework Preset 固定為 Vite、Output Directory 為 `dist`，會覆蓋 Vercel Project Settings 裡殘留的 Next.js 設定。

Vercel build 與 deploy 必須留在同一個 job。prebuilt deployment 會讀取同一工作區的 framework metadata；不要只把 `.vercel/output` 搬到另一個乾淨 job。

## 平台設定

Agent 連線與 D1 同步需要在 GitHub `Production` Environment variables 設定 `NEXT_PUBLIC_AGENT_WORKER_URL`，值為已部署 Agent Worker 的 HTTPS origin。這是公開網址，不是 API key；沒有設定時同步與 Agent 功能不可用。Worker 的 D1、Firebase project、KV 與允許 origin 由 private `lexiro-worker` 專案管理，不能放進前端環境變數。

1. Firebase Console 啟用 Google Authentication，並加入 Vercel production domain。
2. Google Cloud Console 的 OAuth Web client 包含 Vercel domain 的 Authorized JavaScript origin。
3. 從 `.vercel/project.json` 取得 orgId／projectId，設定 Vercel secrets。
4. 以 GitHub Actions 作為正式發布流程，避免重複 Git Integration 部署。

`vercel.json` 依序處理：舊網址 308 轉址（與 `lib/legacy-redirects.ts` 同一張表，測試會比對）、`/__/auth`、`/__/firebase` 轉發到 Firebase Auth domain（Firebase 同源登入靠它）、其餘路徑回 `index.html`（`/assets/` 除外，缺檔回 404）。rewrite 不能讀環境變數，所以 Firebase domain 直接寫在 `vercel.json`；改 Firebase 專案時要同步改這裡和 `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`。

根路徑 `/` 轉址到 `/app`。完整 D1 設定、200 筆與資料夾操作及發布順序見 [D1 雲端](d1-cloud.md)。Agent URL 為 GitHub Production variable `NEXT_PUBLIC_AGENT_WORKER_URL`，先發布 private Agent Worker，再發布前端。

## 共用契約與發布確認

Agent contract 目前為 4.8.0，private Worker 使用相同版本 tgz。修改共用題型、必要請求欄位或 expected 版本時，先發布接受新契約的 Worker，再發布前端。兩個 repo 各自 push main 會觸發各自部署，不是跨 repo 的原子發布。

教材 D1 使用 `lexiro-worker/library-migrations/`（0001–0004）；Agent 授權 DB 使用 `agent-migrations`。Agent workflow 先套 migration、部署並檢查 discovery，再發布前端。前端部署後由使用者明確啟用 PWA 更新；既有已保存的題庫資料與練習 v5 不需遷移。

教材、題目編輯草稿保留在本機，重新開頁後可接續；契約、帳號或版本不一致時保留原稿並說明原因，由使用者明確選擇重新開始。

發布完成以 Actions 的結果為準，並驗證登入、D1 同步、Agent 授權與寫入及 PWA 更新。文件-only commit 可用 `[skip ci]` 避免重複正式發布。
