# Lexiro 程式責任索引

Lexiro 的 Next.js 介面、browser domain 與本機／Firestore 保存都在此 repository。AI server 是同層獨立 private `lexiro-worker`，不能移入公開前端。完整閱讀入口見 [docs/README.md](docs/README.md)。

## 目錄

| 路徑 | 責任 |
| --- | --- |
| `app/` | App Router、公開首頁、/app 工作區、manifest、Service Worker |
| `components/` | Domain 畫面、React UI、AI 流程與動態 |
| `lib/` | Client orchestration、managed API、路由、更新、備份 |
| `stores/` | Library、learning、cloud、AI preference、UI、update state |
| `src/lib/` | 詞義、題目、FSRS、儲存、同步、備份與 migration |
| `src/types/`、`src/constants/` | Canonical domain 型別、版本與上限 |
| `packages/ai-contract/` | 公開來源 parser、API 型別、模型與價格算術 |
| `config/`、`src/generated/` | 動態 token 的來源／生成輸出 |
| `scripts/` | Motion generator 與 client prompt boundary |
| `tests-next/` | Vitest domain／元件行為檢查 |
| `public/` | Icons、HarmonyOS Sans TC、Open Doodles 等公開資產 |
| `docs/` | 操作、架構、資料、AI、配置、部署、驗證與決策 |
| `tools/project-map/` | 離線 HTML 程式地圖的資料、驗證、樣式與互動 |

## 畫面與導覽

`app/page.tsx` 是公開介紹，`app/app/` 為工作區。`next.config.ts` 處理舊 deep links；實際 page 清單見[路由](docs/routes-and-permissions.md)。

`components/ui/` 是 Field、SelectField、PageHeader、Loading／Empty／ErrorState、Markdown、Icons、List、LiquidTabs、StepActions 的共用定義。Feature 使用 Icons 語意表，不各自 import 圖示。`app/globals.css` 與 `app/styles/workspace.css` 承載 tokens／工作區；規則見 DESIGN 和 design-system。

`lib/navigation-memory.ts` 管 primary destinations、parent 與轉場方向；LiquidNav 使用已提交路由。PageHeader／BackControl 顯示頁面操作與返回，browse-routes 保存搜尋與返回目的地，SearchField 共用清除及輸入法安全操作。Desktop 是側欄／sticky header，mobile 是底部 capsule／固定操作；StepActions 以 portal 避開 transformed route 對 fixed footer 的限制。

## 教材與題目

Library store 透過 mutation queue 保存。LibraryRepository 是唯一 writer，內容 hash records → manifest → head；詳細模型、世代與版號見[資料與同步](docs/data-and-sync.md)。

`components/library/` 管 folder、set、word／example 編輯、metadata、移動、加字與補充。`components/questions/` 管題庫、單句／文章編輯和生成。Revision-scoped drafts 保留中斷編輯，word-edit 用最新 Library 套變更與 sense remaps；備份／分享由 library-import、share、full-backup 和 learning-backup 處理。

Question formats 重用 AI contract 的學測題型表；question-quality 檢查新生成情境／完整文章的字數，question-assembly 檢查確切 usage／answer span，question-builders 負責選項排序與正解位置。詞彙題的情境和干擾項統一由 Worker 生成。Generated results 呈現目標字／義、字數與共用選項答案配對供校對；準則見[高中題目品質](docs/question-quality.md)。

QuestionWorkspace 管桌機雙欄／手機分頁，QuestionPager 一次切換一題或空格。ReadingForm 保留 canonical 題型與共用 bank，並遷移舊編輯草稿；OptionReasons 同步選項文字與理由，DistractorReasonsEditor 供單題及子題校對。生成結果保留可選取／排除名單，加入時只保存選取項目。

QuestionMetadata 在手機收合標題與難度；錯誤展開後聚焦，桌機直接顯示。生成型別與格式表只保留學測五種選擇題；question-ownership 的 isExamQuestion 統一題庫與計數範圍。舊 grammar record 只作歷史資料／備份。

## 練習與學習

Practice setup／queue 統一英選中與五種學測題型。Meaning questions 本機建立四選項；question-card 判分，session actions 保存成績及必要 FSRS rating，persistence 保存 v5 題序／答案／原選項。practice-session 一次移除舊拼字／文法 entry 並重排；Keyboard hook 隔離組字、編輯和忙碌狀態。退役的 review-card 及其拼字測試已移除。

QuestionCard 協調文章分頁、定位、一鍵返回與同篇閱讀位置；QuestionOptions／QuestionFeedback 分別管選取及本小題解說。practice-content 的 usedBlankForOption 讓共用已用答案在點擊及快捷鍵共用相同判斷。Session actions 等學習紀錄成功才揭答，pendingChoice 只表示暫時選取。

Learning store、learning-persistence 和 fsrs 保存 card／stats，進度頁從 library-metrics 與 learning-defaults 計算掌握、每日活動和連續學習。資料先保存才前進，失敗可重試；詳見[練習](docs/practice.md)。

## 同步與帳號

`stores/cloud-store.ts` 協調 Firebase session、namespace 載入、sync debounce、retry 與 account handoff。`src/lib/cloud-sync.ts` 按 writtenAt／documentId 拉增量並分批 push，cloud-records 合併 server-order records 並保留 dirty；sync-journal 只清已送的 version。Cloud account 合併 learning／stats，cloud-preferences 讀寫 owner-only AI 偏好。

Mutation queue 和 account-data queue 保護保存／備份／切換；延遲回應不能跨帳號套用。`components/me/use-autosave.ts` 與 preference-drafts 管實際修改欄位及待存設定，preference-recovery 提供恢復選擇。同步文案由 sync-status 統一，pending 不顯示已同步。

## AI 和管理

AI task builders、runner、session 只組來源資料、拆批、解析及接續。Managed client 管 token refresh、帳號邊界、串流、usage；generation controls 與 resumable drafts 分開生成及校對畫面。Photo organizer 先確認選圖，WebP 編碼後每十張單次上傳並依序處理。

AI preference store 在開始 session 時固定模型，contract 3.0.0 與 Worker tgz 共同規範請求、估算、題型／篇幅和管理 expected 版本。Prompt、schemas、prefix tests 與付費 evaluator 只存在 private Worker。

Me 的 plan／data／preferences 與 admin nested routes 各自管理任務。ConfirmDialog 統一鎖定、失敗與重試；backup-actions 協調兩段匯入，admin-account-adjustment 只送變更並確認餘額，admin pagination 用 cursor history。

## 更新、驗證和交付

`app/sw.ts`、service-worker-cache 管 App cache 與私人資料 NetworkOnly；app-update-monitor、app-update、app-update-store 管保存／SKIP_WAITING／controller 接管／重啟。Offline retry 重試原 URL，重新連線不自動刷新。

`.github/workflows/deploy.yml` 先 typecheck／lint／test／build，再同 runner build Vercel prebuilt、部署 Rules／indexes、發布 Vercel。`scripts/check-client-boundary.mjs` 掃 hashed private prompt 指紋，沒有 prompt 本文。命令與證據範圍見[測試](docs/testing.md)與[部署](docs/deployment.md)。

新增／搬移責任時更新本檔，版號只在[資料與同步](docs/data-and-sync.md)維護，避免複製出互相矛盾的 schema 表。
