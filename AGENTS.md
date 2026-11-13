# Agent notes

Lexiro 是純前端 SPA：Vite 8、React 19、React Router 8（data router，畫面全是 lazy route）、Tailwind 4、TanStack Query。沒有 server rendering。後端是另一個 private repo `../lexiro-worker`。

- 結構：`src/app`（router、shell、導覽）、`src/data`（Worker API、Firebase Auth、query、學習紀錄佇列）、`src/domain`（無 UI 的純邏輯：出題、回合、房間題目、批次輸入解析）、`src/features/<區塊>`（各畫面）、`src/ui`（跨畫面的小元件）。
- UI 元件一律用 `packages/design-kit`（`design-kit`）；toast 從 `sonner` 匯入。主色是 pine green，顏色只用 design-kit 的 token class（`text-danger`、`text-positive`、`text-highlight`、`bg-accent-soft` …），不要寫死色碼。
- Worker 的請求只走 `src/data/api.ts` 的 `api()`，錯誤用 `errorMessage()` 顯示。`ApiError.offline` 代表沒連上。
- 資料格式在 `packages/contract`（`@lexiro/contract`，zod + 型別）。Worker 的 `src/contract` 是同一份的複本：改了這裡就複製過去（`cp packages/contract/src/*.ts ../lexiro-worker/src/contract/`），兩邊一起跑檢查。只保留最新 API，不做版本並存或舊資料相容。
- 離線是唯讀：教材從 query 的 IndexedDB 快取讀；練習答案由 `src/data/learning.ts` 在本機排隊，連線後分批送出。進行中的回合存在 localStorage `lexiro:round:<uid>`。
- 「我」是入口頁，帳號、偏好、資料、AI 助理、關於、管理各自是子頁面（`src/features/me`）。新設定放進對應子頁，不要堆回入口頁。
- 瀏覽器設定從 `NEXT_PUBLIC_*` 環境變數讀（`src/data/config.ts`）；`vercel.json` 負責 Firebase `/__/auth` proxy、舊網址轉址與 SPA fallback。
- 一個 sense 的 `description` 一行一點、不加符號；用 `descriptionPoints()` 讀。`meaning` 只放中文意思（會當選項）。單字集裡的字一律 A→Z 顯示。
- 朗讀不自動播放，只有按鈕會念。拉丁文字（單字、分數、代碼）用 `font-latin`。
- 推之前：`npm run typecheck`、`npm run lint`、`npm test`、`npm run build`。
- 測試斷言使用者或呼叫端看得到的行為（回傳資料、儲存狀態、顯示文字）。一個 `it` 一個行為；預期的拒絕要斷言錯誤，不寫裸 `toThrow()`。
