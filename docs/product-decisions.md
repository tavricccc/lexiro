# 後端實作決策

原始規格見 [backend-blueprint.html](backend-blueprint.html)，2026-09-12 從使用者指定的 Claude artifact 匯入；已移除平台執行腳本與登入相關包裝。下面是使用者後續指示，與原始規格衝突時以本檔為準。

## 已確認的補充

- Workers 免費 CPU 是盡量達成的目標，不能在實測前保證 10ms 內；沒有授權自動升級付費方案。
- 使用者只要求 UI 不顯示模型、reasoning 或 token 用量。這些資料可存在於程式碼及網路回應，不需要模型 ID 的 bundle 隱藏檢查。
- Prompt 與供應商 API key 仍在後端。串流保留 Responses 協定及生成文字，只處理上下文回顯和上游錯誤；不能用前端隱藏來保護 prompt。
- 餘額允許一定程度透支，使用者原話是「明顯透支很多再拒絕」。精確門檻尚未指定，不能把任意數字當成已確認。
- 新增的 Workers／後端放在 `tavricccc/lexiro-worker` private repository。既有 Firebase 使用者資料後端保留。
- 前後端按可驗證階段分段 commit，直接使用 main，不建 PR 或額外分支。GitHub repo 建立與初始推送已授權；正式 Worker 部署另行處理。
- 最新指示：**完整做完前只做本地 commit，不 push；沒有實際問題就持續實作，不停下來等下一次指令。** 先前三個後端 commit 已推送，這條規則適用後續全部前後端變更。
- 錯題 AI 解析保留，固定 Lite，每次 5 點；單次文字上限 5,000 字元。使用者已確認固定每次 5 點。

## 實作注意事項

- 原始扣款範例的 `INSERT OR IGNORE` 後不能無條件再扣餘額。只有新插入的來源可扣款，失敗必須整筆回滾，不能留下錯誤的冪等鍵。
- 原規格照片整理表格的 20 點與正文衝突；按多處正文及補貼規則使用 6 點，文字整理 5 點，兩者不隨檔位加倍。
- 藍圖要求兩個權限邊界：Firestore rules 管使用者資料，Worker 管額度、管理員及供應商憑證。
- 本地 Node 串流 benchmark 不包含 JWT、D1 或供應商。其 wall time 和 Windows process CPU 都不是 Cloudflare 的 CPU 計費數，不能作為免費層驗收。
- `MAX_OVERDRAFT_POINTS=300` 是目前可調整的實作暫定值，不是使用者指定的門檻。
- 共用的輸入型別、來源解析與計費算式放在前端 `packages/ai-contract`；private 後端保存版本化 tgz，以便獨立安裝。此套件不含 prompt 或憑證。

## 階段與驗收

1. Prompt 固定前綴與 Luna/low 實測，先與修改前版本比較。
2. Worker 身分驗證、D1 計費與結算、Responses 轉接、CORS 與 Cron。
3. 前端 managed 接入，刪除 BYO-key、舊協定、AI 設定同步與用量 UI。
4. 檢視頁與 AI 預覽共用的逐字編輯。
5. 文字／照片整理、確認畫面與多詞義生成。

每個階段提交前跑完整檢查；上述清單是範圍，不是完成宣告。現有檔案責任與實際狀態以 `structure.md` 為準。

## 2026-09-12 接手時的實際狀態

### 已完成並驗證：身分驗證與串流隱私模組

- 已完成 Firebase JWT 簽章、project／uid／時間欄位驗證、公鑰快取，以及經驗證 email 的管理員判斷。
- 已完成 Responses SSE 上下文回顯移除、錯誤中和、文字保持、UTF-8 分塊、取消與背壓處理。
- 此階段 typecheck、lint、37 個行為測試、build 已通過，對應提交 `0a9c95c` 與 `c8c052f`。這是上述模組的完成標記，不代表整個後端或部署完成。
- 原始完整藍圖已存入 private repo，對應提交 `66ad083`。

### 進行中：D1／HTTP 整合與前端 managed 切換

2026-09-12 本輪檢查：後端 typecheck、lint（0 warnings）、55 個測試及 build 全數通過；D1／HTTP 核心已本地提交 `c6aecc8`，未 push。整理端點、完整 UI 與正式環境仍未完成。

### 已完成本地驗證：managed 前端切換與逐字編輯

- 前端 typecheck、lint（0 warnings）、146 個測試、production build、diff whitespace 檢查全數通過。涵蓋 token 刷新／帳號隔離、serial runner、backup/journal migration、例句刪除、單字 remap 與共用編輯器行為。尚未做真實部署或瀏覽器端到端驗收。
- 舊 provider、設定同步、手動 prompt、用量元件與對應文案已刪除。private prompt、schema、評測腳本與案例移到後端；歷史 artifacts 移到後端本地 ignored 目錄。
- 下一段為文字／照片整理確認、多義輸出、管理員 UI。前述完成標記不包含這些尚未實作的功能。

文件隨每個實作段落更新；完成標記須附驗證範圍，不能只因程式碼已寫就標為完成。臨時中止時保留工作樹並從本節續做。

- 最近變更：已移除 AI 設定的同步讀寫、舊 provider／transport／用量與設定元件；完整備份 v2 與 journal v3 migration 已寫，方案點數畫面與固定 5 點錯題解析已接 managed client。正在更新測試並清理公開 prompt／評測檔案，此前端段落尚未通過完整驗證。
- 本輪驗證更新：前端 managed 切換已通過 typecheck、lint、143 tests、production build；最後的 migration 持久化錯誤處理整理後須補跑檢查才提交。private 評測搬移後後端 70 tests 與其餘三項檢查通過；15 份已存 Luna/low 回覆用目前解析器重驗全部通過，沒有新增模型呼叫。
- 逐字編輯進度：共用 `word-editor.tsx` 已接 set view 與 AI preview；`word-edit.ts` 在保存時讀最新 Library、只替換目標字並計算 remaps。set-tools 保留名稱／資料夾修改與手動／AI 加字。SetEditor 已改為只新建，既有 edit URL 導回 view。`saveSet` 例句寫入改成採用提交內容，修正刪掉例句仍因舊 union 邏輯復活的問題。本段尚待行為測試及完整四項檢查。

- 規格優先順序：使用者最新指示 → 本檔補充決策 → `backend-blueprint.html` 原始藍圖。原始藍圖不覆寫，所有差異記在本檔。
- 前端工作區：`C:/Users/tavri/Documents/projects/lexiro`；後端工作區：`C:/Users/tavri/Documents/projects/lexiro-worker`，兩者 main，保留現有未提交變更，不重置。
- 已推送的後端提交只有 `0a9c95c`、`66ad083`、`c8c052f`，均早於「完整做完前不 push」指示。D1／HTTP 的 `c6aecc8` 只在本地，不要誤認遠端已有 D1 或 managed 前端。
- Prompt 階段已完成 Luna/low 實測：原基準 13/14，修改後加詞性邊界案例共 15/15；只是當時單義版本的測試，不能代替後續多義與照片驗收。原始回覆保存於 repo 外 `C:/Users/tavri/Documents/projects/lexiro-prompt-eval-private`。
- 後端已有 D1 migration、原子扣款／退款、來源冪等、cursor 歸屬、HTTP/CORS、管理 API、續期 Cron 與 Responses 轉接。已分別通過 37 個 auth/stream、10 個 D1、8 個 HTTP 整合測試；最新修改後仍須重跑完整四項檢查。
- 前端 managed client、session/runner/task 與檔位／點數控制已改寫，但切換尚未收尾。舊 AI 設定、同步、備份與錯題解析仍有舊型別引用，當前工作樹不能視為可編譯的交付版本。
- 下一步先完成 managed 切換：清除 BYO-key／舊供應商／手動 prompt／用量流程，改寫方案畫面及錯題解析，補 AI 設定移除所需的本地 journal 與完整備份 migration；移走公開 repo 的 private prompt 和評測材料，更新測試與檔案地圖。
- 之後完成共用逐字編輯器（檢視頁與 AI 預覽、逐則例句、以最新狀態保存與 sense remap）、文字／WebP 照片整理及確認流程、多義生成與實測、管理員 UI。
- `organizeText` 後端目前仍未實作，照片端點也未完成；不能以現有 HTTP 測試通過宣稱整份藍圖完成。
- `wrangler.toml` 的 Firebase project、正式 origin、D1 id 仍是 placeholder，沒有部署。最終需要真實環境設定與 Cloudflare CPU 實測；不可把本地 benchmark 當免費額度保證。
- 每個可驗證階段通過 typecheck、lint、test、build 後只做本地 commit。完整完成前禁止 push，不建立 PR 或 branch。
