# 路由、帳號與權限

## Route map

| 路由 | 用途 |
| --- | --- |
| `/` | 公開介紹與示範練習 |
| `/app` | 今天、每日任務、最近教材與未完成練習 |
| `/app/library` | 資料夾與單字集 |
| `/app/sets/new`、`/app/sets/new/organize` | 手動／AI 建立 |
| `/app/sets/[setId]` | 單字、題目與工具 |
| `/app/sets/[setId]/add`、`supplement`、`settings` | 加字、補充多義、集合資訊 |
| `/app/sets/[setId]/words/[wordKey]/edit` | 詞義與例句編輯 |
| `/app/questions`、`/app/questions/generate` | 題庫與生成 |
| `/app/questions/[questionId]/edit`、`/app/questions/reading/[questionId]/edit` | 題目／文章包編輯 |
| `/app/practice` | 設定、作答、重練與結果 |
| `/app/progress`、`coverage`、`history`、`questions` | 進度概覽、掌握、活動、題型 |
| `/app/me`、`preferences`、`plan`、`data` | 帳號入口、偏好、方案、備份 |
| `/app/sync` | 登入與同步操作 |
| `/app/me/admin`、`accounts`、`accounts/[uid]`、`usage`、`settings` | 管理目錄、帳號、報表、預設 |
| `/~offline` | 無法載入時的重試與回到 App |

表中短名稱接在同列完整 parent route 後；是否真的有 page 以 `app/**/page.tsx` 為準。舊工作區 deep links 由 `next.config.ts` 導向 `/app`。列表搜尋與返回目的地由 `lib/browse-routes.ts` 維持，搜尋只替換當前 history。

## 存取邊界

本機教材與練習不要求登入。Firestore 要求 Firebase UID 等於文件 owner；AI Worker 要求 Firebase ID token。App Check 的啟用由明確開關控制，屬 Firebase 資料存取的 attestation；目前 Worker 本身驗 ID token 與 Origin，不驗 App Check token。

Worker 管理員必須有已驗證 email 並列於 server `ADMIN_EMAILS`，一般帳號不能呼叫 `/admin/*`。前端管理入口只顯示已取得管理身份的畫面，實際拒絕由後端執行。

帳號與設定 PATCH 帶 `expected` 閱讀版本。Version 或欄位已變時回 `stale_account`／`stale_settings`，前端保留草稿並要求重新讀取；不能把舊表單直接套到新餘額。
