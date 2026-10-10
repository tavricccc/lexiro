# Agent 題目批次寫入

2026-10-11。共用契約 3.0.1；MCP 有 27 個工具。Agent 和內建 AI 的所有題型共用同一套命題提示詞，Agent 的寫入驗證另採寬鬆規則。查詢與細部編輯見 [按需操作](agent-query.md)。

## 使用者要求優先

Agent 可以只替指定單字出題、調整順序、同字出多題，不必覆蓋整個來源清單。`get_generation_prompt` 的 rules 與 `get_generation_brief` 的 specification 直接來自內建 questionPrompt：五型都保留完整共用與題型指引，包括語境、唯一解、干擾選項、解說與原文依據。完整提示取得一次後沿用，brief 預設只回小批來源；可在同一次 read_batch 取得兩者。API 不強制先取 brief 才允許寫入。

提示詞指導 Agent 如何生成；寫入端仍允許解說、逐錯項理由、閱讀 skill／evidence 選填及任意 JSON 欄位順序。篇幅仍是 Warning，partial／atomic、穩定 senseId 及唯讀驗證維持原行為。綜合測驗允許依共用提示考文法：來源 continual 的句子可以挖空 been；來源 ID 必須有效，答案仍須唯一定位。

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

精簡回條含 `status`（success／partial_success／rejected）、提交／保存／失敗數、revision、operationId、最多10筆 errors 和3筆 warnings，以及完整 errorCount／warningCount。用 `responseFields` 選取 items.questionIds 等欄位，或用 operationId 分頁讀更多診斷。每項診斷含 itemId、sourceId、sourceWord、sourceIndex、field、code、severity、message；字數警告另含 actual／recommendedMin／recommendedMax。跨批修正以 itemId／sourceId 為準，sourceIndex 只是本次位置。

requestedSenseIds／usedSenseIds／unusedSenseIds 可明確選取，只提供覆蓋資訊，不強迫補齊刻意省略的來源。原始生成題 ID 依內容與穩定本集來源產生，跨批重送不新增重複題；自行提供的 itemId 可識別後續修訂。

## 版本與重送

MCP 的 expectedRevision／operationId 選填；省略時服務用當前資料與新 UUID 執行，D1 CAS 仍保護交易期間的並發。提供 expectedRevision 可保護 Agent 先前讀過的版本。重送需沿用同一 UUID operationId，才能取得完全相同的回條。每筆回條直接附新 revision，不必每批額外重讀。

單集 URL 的 PATCH 接受 `{action,expectedRevision?,operationId?}`，也可用細部 REST 路徑；題目內容與 partial／atomic 共用同一規則。整批拒絕回結構化診斷與零 savedCount，MCP 用 isError 提示 rejected；部分成功仍是成功回應，Agent 應如實回報未完成的項目。

## 工程驗證

合成 100 題案例確認 97 題保存、3 題具穩定識別的錯誤；atomic 零寫入、唯讀驗證不改 revision、來源亂序／子集、拆批重送及原有內建生成篇幅限制皆有驗證。D1 題目 ID 衝突使用 JSON 批次查詢，避免每題各查一次耗盡 Worker 子請求額度。跨集 ID 衝突在 partial 模式只拒絕該題。

D1 schema 不變，不需要資料 migration。此次按需查詢只改 Agent runtime，執行 Agent workflow 即可；前端 runtime 改動時再發布前端。維護見 [D1 雲端](d1-cloud.md)。

## 發布回條

2026-10-11：後端 `dc86551` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38066261701) 與前端 `88bc186` 的 [Vercel workflow](https://github.com/tavricccc/lexiro/actions/runs/38066476190) 都成功。前後端共 597 個本機測試、typecheck、lint、build 通過；本機 HTTP OAuth／18 tools／partial／atomic／唯讀驗證及原有授權隔離也通過。

正式 health、OAuth discovery 與前端授權／連線管理頁皆 HTTP 200，未授權 MCP 仍為 401。本次新增的 97／100 批次證據來自本機原生 D1，未做正式帳號的批次寫入或長任務 CPU 測量；沒有修改使用者的教材或呼叫模型 API。

2026-10-11 提示詞恢復：後端 `54fc8a3` 的 [Agent workflow](https://github.com/tavricccc/lexiro-worker/actions/runs/38068141765) 成功。所有五型 rules／specification 已直接使用內建 questionPrompt；完整共用及題型指引都恢復，寫入仍保留 partial／atomic、Warning 與穩定來源。共用契約 3.0.1 修正綜合測驗文法空格被誤擋；前後端 599 個本機測試、typecheck、lint、build 通過，五型提示逐一與內建輸出完全相同。沒有改動內建提示原稿或其快取版本，沒有呼叫模型。公開前端只更新共用套件與文件，網站執行程式沒有變動，本次僅發布 Agent Worker。
