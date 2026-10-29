# Lexiro 程式責任索引

Lexiro 的 Vite + React Router 介面、browser domain 與本機／D1 雲端同步都在此 repository。Firebase 只保留 Auth；同層 private `lexiro-worker` 提供 Agent 寫入與同步服務，不能移入公開前端。完整閱讀入口見 [docs/README.md](docs/README.md)。

## 目錄

| 路徑 | 責任 |
| --- | --- |
| `app/` | 入口 `main.tsx`、路由表 `routes.tsx`、/app 工作區、manifest、Service Worker |
| `components/` | Domain 畫面、React UI 與動態 |
| `lib/` | Client orchestration、Agent API、路由、更新、備份 |
| `stores/` | Library、cloud、UI、update state |
| `src/lib/` | 詞義、題目、儲存、同步、備份與 migration；與 `src/types/`、`src/constants/` 及 `lib/`、`components/practice` 的平台無關部分由 `../lexiro-app/scripts/sync-core.mjs` 鏡像到原生 App 的 `src/core`，改動要兩邊同步 |
| `src/types/`、`src/constants/` | Canonical domain 型別、版本與上限 |
| `packages/agent-contract/`、`packages/ai-contract/` | MCP 寫入契約與共用題型／字數格式 |
| `config/`、`src/generated/` | 動態 token 的來源／生成輸出 |
| `scripts/` | Motion generator 與 client boundary 檢查 |
| `tests-next/` | Vitest domain／元件行為檢查 |
| `public/` | Icons、HarmonyOS Sans TC、Open Doodles 等公開資產 |
| `docs/` | 操作、架構、資料、配置、部署、驗證與決策 |
| `tools/project-map/` | 離線 HTML 程式地圖的資料、驗證、樣式與互動 |

## 畫面與導覽

`app/app/` 為工作區，根路徑 `/` 轉址到 `/app`。舊 deep links 由 `lib/legacy-redirects.ts` 定義，`vercel.json` 以同一張表回 308；實際 page 清單見[路由](docs/routes-and-permissions.md)。

`components/ui/` 是 Field、SelectField、PageHeader、Loading／Empty／ErrorState、Markdown、Icons、List、LiquidTabs、StepActions 的共用定義。Feature 使用 Icons 語意表，不各自 import 圖示。`app/globals.css` 與 `app/styles/workspace.css` 承載 tokens／工作區；規則見 DESIGN 和 design-system。

`lib/navigation-memory.ts` 管 primary destinations、parent 與轉場方向；LiquidNav 使用已提交路由。PageHeader／BackControl 顯示頁面操作與返回，browse-routes 保存搜尋與返回目的地，SearchField 共用清除及輸入法安全操作。Desktop 是側欄／sticky header，mobile 是底部 capsule／固定操作；StepActions 以 portal 避開 transformed route 對 fixed footer 的限制。

## 教材與題目

Library store 透過 mutation queue 保存。LibraryRepository 是唯一 writer，內容 hash records → manifest → head；詳細模型、世代與版號見[資料與同步](docs/data-and-sync.md)。

`components/library/` 管 folder、set、word／example 編輯、metadata、移動與加字。`components/questions/` 管題目試做、單句／文章編輯與校對。Revision-scoped drafts 保留中斷編輯，word-edit 用最新 Library 套變更與 sense remaps；備份／分享由 library-import、share 和 full-backup 處理。

`library-set-migration.ts` 建立每集獨立內容、一次重綁舊來源。`set-share.ts` 為分享複製重建新集的父／子題來源。`source-scope.ts` 讓單句／文章編輯來源限制在一集；`clear-questions-control.tsx` 共用清空範圍、確認與保存回饋。保存例句不建立題目。

Question formats 共用 ai-contract 的學測題型表；question-quality 檢查題目情境／完整文章的字數與共用 options，question-teaching 核對中文解說、錯項 option／reason 的唯一對應，question-word-forms 檢查來源合法詞形，question-discourse 檢查完整非相鄰刪句，question-assembly 檢查確切 usage／answer span 與空格重疊，question-builders 負責選項排序與正解位置。共用選項先寫定，理由依選項文字保存，不依寫入順序配對。詞彙題的情境和干擾項由 Agent 或人工撰寫。題目呈現目標字／義、字數與共用選項答案配對供校對；準則見[高中題目品質](docs/question-quality.md)。

QuestionWorkspace 管桌機雙欄／手機分頁，QuestionPager 一次切換一題或空格。ReadingForm 保留 canonical 題型與共用 bank，並遷移舊編輯草稿；OptionReasons 同步選項文字與理由，DistractorReasonsEditor 供單題及子題校對。

QuestionMetadata 在手機收合標題與難度；錯誤展開後聚焦，桌機直接顯示。題型與格式表只保留學測五種選擇題；question-ownership 的 isExamQuestion 統一題庫與計數範圍。舊 grammar record 只作歷史資料／備份。

## 練習與學習

Practice setup／queue 統一英選中與五種學測題型。Meaning questions 本機建立四選項；question-card 判分，session actions 只在本輪判分，persistence 保存 v5 題序／答案／原選項。practice-session 一次移除舊拼字／文法 entry 並重排；Keyboard hook 隔離組字、編輯和忙碌狀態。退役的 review-card 及其拼字測試已移除。

Meaning questions 的可接受答案依本集 wordKey 取得；同拼字在其他集的合法詞義只用於排除歧義錯項，不合併成本集內容。

`practice-scope-migration.ts` 從最新 Library 反算舊 entry／sense 身份，一次遷移練習草稿並保存當次呈現選項；缺來源或寫入失敗時保留原稿供明確重新開始。Queue 套用已存選項，不因新 ID 重新抽順序。

QuestionCard 協調文章分頁、定位、一鍵返回與同篇閱讀位置；QuestionOptions／QuestionFeedback 分別管選取及本小題解說。practice-content 的 usedBlankForOption 讓共用已用答案在點擊及快捷鍵共用相同判斷。Session actions 選答即揭答，不寫入長期紀錄。

App 不保存學習進度；詳見[練習](docs/practice.md)。

## 同步與帳號

`stores/cloud-store.ts` 協調 Firebase Auth、`d1-v1:` namespace、sync debounce、retry 與 account handoff。`src/lib/cloud-client.ts` 以 ID token 呼叫 Agent Worker；`cloud-sync.ts` 按 D1 seq／recordId 拉增量、分批 push，visible／online 每 30 秒只查一筆狀態。Cloud records 合併 server-order records 並保留 dirty；journal 只清已送 version。Cloud account／preferences 以 blob revision 防止覆蓋並行修改。

新 D1 雲端從空白資料開始，不遷移 Firestore 或舊帳號快取。Firestore SDK／rules／indexes／service-account 部署流程已移除；本機仍以 IndexedDB 保存離線編輯及 journal。

Mutation queue 和 account-data queue 保護保存／備份／切換；延遲回應不能跨帳號套用。`components/me/` 管帳號、資料備份與外觀設定；ConfirmDialog 統一鎖定、失敗與重試，backup-actions 協調兩段匯入。同步文案由 sync-status 統一，pending 不顯示已同步。

## 更新、驗證和交付

`app/sw.ts`、service-worker-cache 管 App cache 與私人資料 NetworkOnly；app-update-monitor、app-update、app-update-store 管保存／SKIP_WAITING／controller 接管／重啟。Offline retry 重試原 URL，重新連線不自動刷新。

`.github/workflows/deploy.yml` 先 typecheck／lint／test／build，再同 runner build Vercel prebuilt 並發布 Vercel（`vercel.json` 負責 Firebase `/__/` 轉發、舊網址轉址與 SPA fallback）；不再部署 Firestore。`scripts/check-client-boundary.mjs` 掃 hashed private prompt 指紋，沒有 prompt 本文。D1 後端先以獨立 Agent workflow 套 migration／發布，維護見 [D1 雲端](docs/d1-cloud.md)。

`packages/agent-contract/src/generation.ts` 提供 Agent 專用生成格式與穩定 senseId 綁定；`validation.ts` 負責逐題 Error／Warning、partial／atomic 與可重送的題目識別。共用挖空器 `src/lib/question-assembly.ts` 供 Agent 寫入組題，不套篇幅／教學品質門檻。MCP 使用說明見 [批次寫入](docs/agent-validation.md)。

`docs/agent-query.md` 記錄 Agent Worker 的按需查詢與細部編輯：MCP read、搜尋、題型／範圍／欄位與小批來源。這些執行程式位於同層 private Worker，公開前端保存操作文件。


新增／搬移責任時更新本檔，版號只在[資料與同步](docs/data-and-sync.md)維護，避免複製出互相矛盾的 schema 表。
