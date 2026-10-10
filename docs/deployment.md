# GitHub Actions 部署

推送 `main` 後，Lexiro 會執行 typecheck、lint、unit tests 與 Next.js production build。驗證完成後：

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

GitHub Secret 名稱保留既有 `VITE_*`，workflow 注入成 Next.js 的 `NEXT_PUBLIC_*`；本機使用後者。Firebase Web 設定只供 Auth，D1 資料權限由 Worker 驗 ID token、限定 uid。前端及 Agent 不再需要 Firebase service-account JSON。

`vercel.json` 會把 Framework Preset 固定為 Next.js，並將 Output Directory 恢復為 framework 預設值。即使 Vercel Project Settings 還留著舊 Vite 專案的 `dist` override，repository 設定也會在 deployment 時覆蓋它。

Vercel build 與 deploy 必須留在同一個 job。Next.js 的 prebuilt deployment 仍會讀取同一工作區的 framework metadata；不要只把 `.vercel/output` 搬到另一個乾淨 job。

## 平台設定

Managed AI 另外需要在 GitHub `Production` Environment variables 設定 `NEXT_PUBLIC_AI_WORKER_URL`，值為已部署 Worker 的 HTTPS origin。這是公開網址，不是 API key；沒有設定時 AI 功能不可用，正式部署檢查也會停止發布。Worker 的 D1、Firebase project、允許 origin、管理員 email 與供應商 secret 由 private `lexiro-worker` 專案管理，不能放進前端環境變數。

1. Firebase Console 啟用 Google Authentication，並加入 Vercel production domain。
2. Google Cloud Console 的 OAuth Web client 包含 Vercel domain 的 Authorized JavaScript origin。
3. 從 `.vercel/project.json` 取得 orgId／projectId，設定 Vercel secrets。
4. 以 GitHub Actions 作為正式發布流程，避免重複 Git Integration 部署。

本機與 Vercel 都使用根路徑 `/`。Next.js App Router 會處理路由，不需要 SPA fallback rewrite。

公開介紹位於 `/`，工作區位於 `/app`。完整 D1 設定、200 筆與資料夾操作及發布順序見 [D1 雲端](d1-cloud.md)。Agent URL 為 GitHub Production variable `NEXT_PUBLIC_AGENT_WORKER_URL`，先發布 private Agent Worker，再發布前端。

## 前後端契約與發布確認

AI contract 目前為 5.0.0，private Worker 使用相同版本 tgz。修改模型、必要請求欄位或管理 expected 版本時，先發布接受新契約的 Worker，再發布前端。兩個 repo 各自 push main 會觸發各自部署，不是跨 repo 的原子發布。

教材 D1 使用 `library-migrations/0001_library.sql`；生成／計費 DB 維持 `0014_generation_leases.sql`。Worker 先發布五種學測題型的 contract 5.0.0／`single-pass-v3`，單次產生題目與解說，綜合測驗／文意選填 raw 必填完整 `usage` 定位空格，文意選填另必填本批來源 ref，原始錯項理由帶選項文字，共用題組先提供完整選項。詞彙每批四個來源，暖首批後最多四批並行，Worker actor 與預留使用同一共用上限。停用的 grammar 在預留前回 400，舊題目生成契約回 426；單字／詞義仍使用各自契約。前端部署後由使用者明確啟用 PWA 更新；不要為切換契約自動刷新或丟棄未完成寫入。既有已保存的題庫資料與練習 v5 不需遷移。

生成草稿可保留已完成成果與尚在期限內的 operation ID，重新開頁後接回原任務。契約、帳號或任務不一致及結果過期時，保留已完成成果並說明無法接續原因，由使用者明確選擇重生，不能自動另外發起付費生成。

發布完成以 Actions 的結果為準，並驗證登入、D1 同步／Agent、AI 串流與結算及 PWA 更新。文件-only commit 可用 `[skip ci]` 避免重複正式發布。
