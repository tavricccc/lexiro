# Agent 題目批次寫入

2026-10-11。共用契約 3.0.0；MCP 有 18 個工具。內建 AI 的生成與計費流程維持原設定，Agent 寫入使用獨立規則。

## 使用者要求優先

Agent 可以只替指定單字出題、調整順序、同字出多題，不必覆蓋整個來源清單。`get_generation_brief` 是格式參考，無須先呼叫才能寫入。解說、逐錯項理由、閱讀 skill／evidence 選填；JSON 欄位順序不限。

來源用每題 `senseId` 綁定。這是詞義的穩定 ID，重排或拆批仍有效；也支援當次 brief 的 `ref`，但同時提供時以 `senseId` 為準。只指定一個來源時可省略每題 ID。未知來源、來源與答案單字不符、答案無法唯一定位、錯誤的選項與空格結構會拒絕該題。

`usage` 在答案只有一處時可省略，重複時用原文片段指出要挖空的位置。一般選擇題仍需四個完整選項；文意選填／篇章結構仍使用十／五個共用選項，這是網站作答格式。

## Error 與 Warning

Error 拒絕該題；篇幅偏短／偏長與完全相同內容是 Warning，允許儲存。警告提供實際字數與建議範圍，不要求使用者接受建議。沒有模型審題、難度判分、風格評鑑或語意相似度分析，也沒有額外模型費用。

屈折變化、衍生詞或語意是否合併出題，由正在操作的 Agent 依自然語言要求判斷。這是選題策略，不是資料庫去重；原始詞條保留。

## 先驗證或直接儲存

`validate_generated_questions` 接受 `setId`、`kind`、`difficulty`（預設 2）、選填 `senseIds`、`output`、`mode`。它只讀資料，回 `dryRun:true`、逐題診斷及 revision，`savedCount` 為 0，不改 D1 狀態。

`save_generated_questions` 使用相同內容，另可提供 `expectedRevision`、`operationId`。`put_questions` 新增／修改完整正式題目也支援相同批次模式。

- `partial`：預設，只儲存有效獨立題目／完整題組。100 題有 3 題錯誤時，97 題儲存成功，只需修正失敗的 3 題。
- `atomic`：有任何 Error 時整批不寫入；Warning 不阻擋交易。

每批上限 200 個獨立題目或題組。單一文章題組以整組為驗證單位，避免修剪部分子題後破壞正文、空格與答案關係。

回條含 `status`（success／partial_success／rejected）、`submittedCount`、`validCount`、`savedCount`、`failedCount`、`errors`、`warnings`、`items`。每項診斷含 `itemId`、`sourceId`、`sourceWord`、`sourceIndex`、`field`、`code`、`severity`、`message`；字數警告另含 actual／recommendedMin／recommendedMax。sourceIndex 只是本次提交位置，跨批修正以 itemId／sourceId 為準。可自行提供 itemId，省略時由內容產生。

requestedSenseIds／usedSenseIds／unusedSenseIds 只提供覆蓋資訊，不強迫補齊刻意省略的來源。原始生成題 ID 依內容與穩定本集來源產生，跨批重送不新增重複題；自行提供的 itemId 可識別後續修訂。

## 版本與重送

MCP 的 expectedRevision／operationId 選填；省略時服務用當前資料與新 UUID 執行，D1 CAS 仍保護交易期間的並發。提供 expectedRevision 可保護 Agent 先前讀過的版本。重送需沿用同一 UUID operationId，才能取得完全相同的回條。每筆回條直接附新 revision，不必每批額外重讀。

單集 URL 的 PATCH 仍需要 `{expectedRevision,operationId,action}`；題目內容與 partial／atomic 共用同一規則。整批拒絕會回結構化診斷與零 savedCount，不會部分寫入。MCP 用 isError 提示 rejected；部分成功仍是成功回應，Agent 應如實回報未完成的項目。

## 工程驗證

合成 100 題案例確認 97 題保存、3 題具穩定識別的錯誤；atomic 零寫入、唯讀驗證不改 revision、來源亂序／子集、拆批重送及原有內建生成篇幅限制皆有驗證。D1 題目 ID 衝突使用 JSON 批次查詢，避免每題各查一次耗盡 Worker 子請求額度。跨集 ID 衝突在 partial 模式只拒絕該題。

D1 schema 不變，不需要資料 migration。發布步驟見 [D1 維護](d1-cloud.md)：先 Agent workflow，再前端 workflow。

## 發布回條

2026-10-11：後端 `dc86551` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38066261701) 與前端 `88bc186` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38066476190) 都成功。前後端共 597 個本機測試、typecheck、lint、build 通過；本機 HTTP OAuth／18 tools／partial／atomic／唯讀驗證及原有授權隔離也通過。

正式 health、OAuth discovery 與前端授權／連線管理頁皆 HTTP 200，未授權 MCP 仍為 401。本次新增的 97／100 批次證據來自本機原生 D1，未做正式帳號的批次寫入或長任務 CPU 測量；沒有修改使用者的教材或呼叫模型 API。
