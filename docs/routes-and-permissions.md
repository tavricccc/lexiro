# 路由、帳號與權限

## Route map

`/app` 底下只有一個 catch-all 頁面（`app/app/[[...view]]/page.tsx`，什麼都不渲染）。所有畫面由 client 的 view host（`components/app-views.tsx`）依網址繪製；App 內的連結與 `router.push` 走 `history.pushState`（`lib/app-navigation.ts`、`components/ui/app-link.tsx`、`lib/use-app-router.ts`），換畫面不向伺服器要頁面。直接開網址或重新整理仍可進入任何畫面。新增畫面時把網址樣式加進 view host 的表，並在 project map 的 `routeSpecs` 補說明。

開 App 時先顯示啟動畫面，直到帳號與本機教材讀完；已設定雲端但未登入時會請使用者登入，或選「先不登入，只用這台裝置」（記在 localStorage，之後不再詢問；需要連線的功能仍各自要求登入）。

| 路由 | 用途 |
| --- | --- |
| `/` | 公開介紹與示範練習 |
| `/app` | 今天、每日任務、最近教材與未完成練習 |
| `/app/library` | 資料夾與單字集 |
| `/app/sets/new`、`/app/sets/new/organize` | 手動／AI 建立 |
| `/app/sets/[setId]` | 單字、題目與工具 |
| `/app/sets/[setId]/add`、`supplement`、`settings` | 加字、補充多義、集合資訊 |
| `/app/sets/[setId]/words/[wordKey]/edit` | 詞義與例句編輯 |
| `/app/shared/[shareId]` | 分享連結預覽，存入自己的題庫（需登入） |
| `/app/rooms` | 對戰：輸入房號加入、或開新房（需登入） |
| `/app/rooms/new` | 房主從自己的題庫選題開房（需登入） |
| `/app/rooms/[code]` | 即時對戰房間，伺服器計時，斷線重連直接回到目前題目（需登入） |
| `/app/questions`、`/app/questions/generate` | 題庫與生成 |
| `/app/questions/[questionId]/edit`、`/app/questions/reading/[questionId]/edit` | 題目／文章包編輯 |
| `/app/practice` | 設定、作答、重練與結果 |
| `/app/me`、`preferences`、`plan`、`data` | 帳號入口、偏好、方案、備份 |
| `/app/sync` | 登入與同步操作 |
| `/app/me/admin`、`accounts`、`accounts/[uid]`、`usage`、`settings` | 管理目錄、帳號、報表、預設 |
| `/~offline` | 無法載入時的重試與回到 App |

表中短名稱接在同列完整 parent route 後；是否真的有 page 以 `app/**/page.tsx` 為準。舊工作區 deep links 由 `next.config.ts` 導向 `/app`。列表搜尋與返回目的地由 `lib/browse-routes.ts` 維持，搜尋只替換當前 history。

單字集的 `tab` 與 `q` 分別保存分頁和集內搜尋；編輯連結的 `returnTo` 包含這兩項及上層詞庫位置。
替換搜尋網址會保留 Lexiro 的 history index 與其他自訂狀態，Next.js 自行補上路由狀態。

## 存取邊界

本機教材與練習不要求登入；所有連網功能（AI、雲端同步、分享連結、教材助手、連線對戰）都要登入，前端先擋，Worker 再驗 Firebase ID token。分享連結只要登入即可讀取擁有者最新同步的單字集，擁有者可隨時停止分享。Firestore 要求 Firebase UID 等於文件 owner；AI Worker 要求 Firebase ID token。App Check 的啟用由明確開關控制，屬 Firebase 資料存取的 attestation；目前 Worker 本身驗 ID token 與 Origin，不驗 App Check token。

Worker 管理員必須有已驗證 email 並列於 server `ADMIN_EMAILS`，一般帳號不能呼叫 `/admin/*`。前端管理入口只顯示已取得管理身份的畫面，實際拒絕由後端執行。

帳號與設定 PATCH 帶 `expected` 閱讀版本。Version 或欄位已變時回 `stale_account`／`stale_settings`，前端保留草稿並要求重新讀取；不能把舊表單直接套到新餘額。
