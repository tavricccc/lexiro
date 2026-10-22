# 路由、帳號與權限

## Route map

路由由 React Router 處理，總表在 `app/routes.tsx`；`/app` 底下的畫面表在 `components/app-views.tsx`，每個畫面是一個 lazy route，第一次造訪（或在導覽列 hover）時才下載該畫面的程式。App 內的連結與 `router.push` 經 `components/ui/app-link.tsx`、`lib/use-app-router.ts` 走 client 導覽。直接開網址或重新整理仍可進入任何畫面。新增畫面時把網址樣式加進畫面表，並在 project map 的 `routeSpecs` 補說明。

開 App 時先顯示啟動畫面，直到帳號與本機教材讀完；已設定雲端但未登入時會請使用者登入，或選「先不登入，只用這台裝置」（記在 localStorage，之後不再詢問；需要連線的功能仍各自要求登入）。

| 路由 | 用途 |
| --- | --- |
| `/` | 轉址到 `/app` |
| `/app` | 今天、每日任務、最近教材與未完成練習 |
| `/app/library` | 資料夾與單字集 |
| `/app/sets/new` | 手動建立 |
| `/app/sets/[setId]` | 單字、題目與工具 |
| `/app/sets/[setId]/add`、`settings` | 加字、集合資訊 |
| `/app/sets/[setId]/words/[wordKey]/edit` | 詞義與例句編輯 |
| `/app/shared/[shareId]` | 分享連結預覽，存入自己的題庫（需登入） |
| `/app/rooms` | 對戰：輸入房號加入、或開新房（需登入） |
| `/app/rooms/new` | 房主從自己的題庫選題開房（需登入） |
| `/app/rooms/[code]` | 即時對戰房間，伺服器計時，斷線重連直接回到目前題目（需登入） |
| `/app/questions` | 題庫 |
| `/app/questions/[questionId]/edit`、`/app/questions/reading/[questionId]/edit` | 題目／文章包編輯 |
| `/app/practice` | 設定、作答、重練與結果 |
| `/app/me`、`preferences`、`data` | 帳號入口、外觀偏好、備份 |
| `/app/me/agents` | Agent 連線與授權管理 |
| `/app/sync` | 登入與同步操作 |
| `/~offline` | 無法載入時的重試與回到 App |

表中短名稱接在同列完整 parent route 後；是否真的有畫面以 `app/routes.tsx` 與 `components/app-views.tsx` 為準。舊工作區 deep links 由 `lib/legacy-redirects.ts` 導向 `/app`（伺服器端由 `vercel.json` 回 308）。列表搜尋與返回目的地由 `lib/browse-routes.ts` 維持，搜尋只替換當前 history。

單字集的 `tab` 與 `q` 分別保存分頁和集內搜尋；編輯連結的 `returnTo` 包含這兩項及上層詞庫位置。
替換搜尋網址會保留 Lexiro 的 history index 與其他自訂狀態。

## 存取邊界

本機教材與練習不要求登入；所有連網功能（雲端同步、分享連結、Agent 授權與寫入、連線對戰）都要登入，前端先擋，Worker 再驗 Firebase ID token。分享連結只要登入即可讀取擁有者最新同步的單字集，擁有者可隨時停止分享。Agent 授權只能存取授權帳號自己的教材。App Check 為選用、預設關閉：設定 `NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY` 後前端才初始化，並在 Worker 請求帶上 `X-Firebase-AppCheck`；未設定時請求與過去完全相同。Worker 目前驗 ID token 與 Origin，是否驗 App Check token 由後端 enforce 決定；建議先在 Firebase console 以 monitor 觀察，確認正常再切為 enforce。

Agent Worker 驗證授權 token 與 Firebase ID token，uid 永遠由驗證結果取得；一般帳號只能操作自己的資料，不能跨帳號讀寫。
