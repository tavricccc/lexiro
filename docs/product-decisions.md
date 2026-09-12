# 後端實作決策

原始規格見 [backend-blueprint.html](backend-blueprint.html)，2026-09-12 從使用者指定的 Claude artifact 匯入；已移除平台執行腳本與登入相關包裝。下面是使用者後續指示，與原始規格衝突時以本檔為準。

## 已確認的補充

- Workers 免費 CPU 是盡量達成的目標，不能在實測前保證 10ms 內；沒有授權自動升級付費方案。
- 使用者只要求 UI 不顯示模型、reasoning 或 token 用量。這些資料可存在於程式碼及網路回應，不需要模型 ID 的 bundle 隱藏檢查。
- Prompt 與供應商 API key 仍在後端。串流保留 Responses 協定及生成文字，只處理上下文回顯和上游錯誤；不能用前端隱藏來保護 prompt。
- 餘額允許一定程度透支，使用者原話是「明顯透支很多再拒絕」。精確門檻尚未指定，不能把任意數字當成已確認。
- 新增的 Workers／後端放在 `tavricccc/lexiro-worker` private repository。既有 Firebase 使用者資料後端保留。
- 前後端按可驗證階段分段 commit，直接使用 main，不建 PR 或額外分支。GitHub repo 建立與初始推送已授權；正式 Worker 部署另行處理。

## 實作注意事項

- 原始扣款範例的 `INSERT OR IGNORE` 後不能無條件再扣餘額。只有新插入的來源可扣款，失敗必須整筆回滾，不能留下錯誤的冪等鍵。
- 原規格照片整理表格的 20 點與正文衝突；按多處正文及補貼規則使用 6 點，文字整理 5 點，兩者不隨檔位加倍。
- 藍圖要求兩個權限邊界：Firestore rules 管使用者資料，Worker 管額度、管理員及供應商憑證。
- 本地 Node 串流 benchmark 不包含 JWT、D1 或供應商。其 wall time 和 Windows process CPU 都不是 Cloudflare 的 CPU 計費數，不能作為免費層驗收。

## 階段與驗收

1. Prompt 固定前綴與 Luna/low 實測，先與修改前版本比較。
2. Worker 身分驗證、D1 計費與結算、Responses 轉接、CORS 與 Cron。
3. 前端 managed 接入，刪除 BYO-key、舊協定、AI 設定同步與用量 UI。
4. 檢視頁與 AI 預覽共用的逐字編輯。
5. 文字／照片整理、確認畫面與多詞義生成。

每個階段提交前跑完整檢查；上述清單是範圍，不是完成宣告。現有檔案責任與實際狀態以 `structure.md` 為準。
