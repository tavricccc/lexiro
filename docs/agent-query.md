# Agent 按需讀取與細部編輯

MCP 的 `read_batch` 和單集 URL 的 `POST /access/{id}/query` 共用查詢格式。Agent 可以一次取得不同資料、搜尋結果和範圍，每項各自指定欄位。首次開啟 URL、`get_set` 和 `create_set` 只回集資訊、數量與 revision。

## 一次請求需要的資料

以下是 `read_batch` 的 arguments；將 `setId` 換成實際集 ID。使用單集 URL 時可以省略各項的 `setId`，授權會固定在該集。

```json
{
  "requests": [
    {
      "resource": "words",
      "setId": "11111111-1111-4111-8111-111111111111",
      "q": "救援",
      "fields": ["wordKey", "word", "senses.id", "senses.meaningZh"]
    },
    {
      "resource": "questions",
      "setId": "11111111-1111-4111-8111-111111111111",
      "questionType": "vocabulary",
      "difficulty": 2,
      "q": "school",
      "from": 1,
      "to": 5
    },
    { "resource": "prompt", "kind": "vocabulary", "difficulty": 2 },
    {
      "resource": "brief",
      "setId": "11111111-1111-4111-8111-111111111111",
      "kind": "vocabulary",
      "difficulty": 2,
      "from": 1,
      "to": 8
    }
  ]
}
```

REST 將相同 JSON 提交到 `/query`，帶 `Authorization: Bearer <原連結的 token>`。回應的 `results` 按請求順序標記 `index`；成功含 `data`，失敗含 `error`。單項失敗保留其他結果，完全相同的 request 以 `reference` 指向先前結果。

每次最多 10 個查詢，合計最多 200 筆。預設回應上限 32,000 字元，`maxCharacters` 可設定 2,000–128,000。超過預算的項目回 `response_budget_exceeded`，讓 Agent 縮小範圍或欄位；完整命題提示不會被截斷。字元上限不等於模型的 token 上限。

## 搜尋、範圍與欄位

| 參數 | 行為 |
| --- | --- |
| `q` | 單字搜尋英文／中文詞義；題目搜尋題幹、文章、標題、選項、解說及子題；集／資料夾搜尋名稱。以文字子字串比對，不呼叫模型 |
| `questionType` | vocabulary、grammar、cloze、wordBank、discourse、reading；篩選已存題目。grammar 僅供讀取歷史資料 |
| `difficulty` | 1、2、3；篩選已存題目或指定出題難度 |
| `wordKeys`、`senseIds` | 以穩定來源 ID 篩選，單次最多 50 個 ID |
| `from`、`to` | 1 起算、包含兩端。先搜尋／篩選，再取結果的第幾到第幾筆；單次最多 50 筆 |
| `limit`、`cursor` | 預設 20 筆，最多 50 筆；用回應的 `nextCursor` 接續，不能同時帶 from／to。游標只能沿用相同搜尋條件與集 |
| `fields` | 指定原始資料欄位，支援 `senses.id`、`questions.explanation` 等巢狀路徑；列表套用至各筆資料。未提供的選填欄位省略 |
| `view` | 預設 summary，單字不附例句、題目不附完整解說或整篇文章；detail 才列完整資料。fields 優先 |

列表依固定 ID 排序，回 `items/from/to/hasMore/nextCursor/order`。這個順序與網站目前畫面排序無關。搜尋條件和 from／to 可以一起用；長任務續頁優先使用 cursor。

## 可以讀什麼

| resource | 需要的識別／內容 |
| --- | --- |
| `sets`、`folders`、`set` | 集／資料夾分頁或單集摘要；set 要 setId。sets 可帶 folderId，folders 另附 uncategorized |
| `words`、`word` | 單字列表或指定 wordKey 的單字；要 setId |
| `questions`、`question` | 題目列表或指定 questionId；要 setId。questions 加 questionId 讀文章子題列表；question 加 childId 讀單一子題 |
| `sources` | 出題來源列表；要 setId。可選 includeExamples，只回第一個既有例句 |
| `prompt` | kind、difficulty 對應的完整原始 rules、outputSchema、建議篇幅與批次大小；不含教材 |
| `brief` | 要 setId、kind；回本批 sourceCount、specification、nextCursor，不重複 rules 或 outputSchema |
| `operation`、`diagnostics` | 要 operationId；讀保存回條或分頁讀 errors／warnings。diagnostics 用 severity:error／warning |

文章摘要只含標題、來源數和子題數。單一子題帶 `childId`，文章正文帶 `includePassage:true`；需要完整文章資料時可明確選 `fields:["passage","questions"]`。

fields 使用保存後的資料格式：詞彙題是 prompt／options／answerIndex，文章題組是 passage／questions。生成的 sentence／answer／distractors 用於 output，並不是保存格式的欄位；若需要取得新題 ID，可在保存時選 responseFields:items.questionIds。

命題先在同一次 `read_batch` 取得 prompt 和 brief，之後沿用完整提示，只續取小批 brief。詞彙／綜合測驗／文意選填／篇章結構／閱讀五型的 rules 直接使用內建 `questionPrompt`，內容相同。brief 預設來源數分別為 16／5／10／30／30；也可選 `includePrompt:true` 一次附上完整提示與 schema。使用者已指定題型、來源及題數時直接照要求做；未指定題型才詢問。

## 個別 REST 路徑

所有路徑接在 `/access/{id}` 後，期限內可重複使用。GET 用 `?q=...&from=...&to=...&fields=wordKey,word`，wordKey／senseId 可重複帶參數或逗號分隔；路徑內 ID 要 URL encode。

| 方法／路徑 | 用途 |
| --- | --- |
| GET `/words`、`/words/{wordKey}` | 搜尋列表／只讀一個字 |
| GET `/questions`、`/questions/{id}` | 篩選列表／只讀一題或文章摘要 |
| GET `/questions/{id}/children`、`/questions/{id}/children/{childId}` | 分頁讀子題／只讀一個子題 |
| GET `/questions/{id}/passage` | 明確取得文章正文 |
| GET `/prompt?kind=vocabulary`、`/brief?kind=vocabulary&limit=16` | 取得完整提示／取得小批來源規格 |
| GET `/folders` | 分頁搜尋分類目的地 |
| GET `/operations/{operationId}`、`/operations/{operationId}/diagnostics?severity=error` | 精簡回條／分頁診斷 |
| POST `/words`、`/questions`、`/generated-questions` | 新增或批次更新；body 用 words／questions 或 kind／difficulty／output |
| PATCH `/words/{wordKey}` | body `{ "patch": { "word": "rescue" } }`，其餘詞義保留 |
| POST `/words/{wordKey}/senses` | 新增一義，patch 必須有 pos／meaningZh |
| PATCH／DELETE `/words/{wordKey}/senses/{senseId}` | 只改／刪一義；patch 的 examples 替換，appendExamples 追加 |
| PATCH `/questions/{id}`、`/questions/{id}/children/{childId}` | 只傳 patch 的指定欄位；其餘正文與子題保留 |
| DELETE `/words/{wordKey}`、`/questions/{id}`、根路徑 | 刪單字／題目／整集；刪最後一義請刪單字 |

MCP 對應 `list_words/get_word/list_questions/get_question/edit_word/edit_sense/edit_question`，完整新增與刪除仍可用原有工具。根路徑 PATCH 接受 `{action,expectedRevision?,operationId?}`，可使用 rename_set、move_set 及原有批次操作。revision／operationId 在 MCP 和 REST 均選填；斷線重送需要自行提供並沿用同一 UUID。沿用保存回條的 revision，不必為下一次寫入重讀教材。

回條預設只回數量、版本、最多 10 筆 errors 和 3 筆 warnings。需要題目 ID 或其他回條欄位時使用 `responseFields:["revision","items.questionIds"]`；更多診斷用 operationId 分頁讀取。MCP 唯讀驗證也可用 responseFields 選取完整診斷所需欄位，例如 errors.itemId／errors.code。Error／Warning 與 partial／atomic 規則見 [批次寫入](agent-validation.md)。

## 本機量測與部署

200 個合成單字、199 題，以 o200k_base 估算：重建整集單字／題目 JSON 為 163,540 字元／60,322 tokens；新版 URL 首頁 2,327 字元／1,004 tokens；一次指定讀 5 個單字與 3 題為 1,849 字元／746 tokens。這是回傳文字量比較，未計入 membership、Agent 的其他對話、工具定義、推理、寫入或完整提示詞，也不是各平台的實際計費紀錄。

這次只有 Agent Worker 執行程式與操作文件變動；資料 schema、共用套件及前端 runtime 不變。發布 `lexiro-worker` 的 `deploy-agent.yml` 即可。既有 URL 在有效期內會使用新介面，Agent 應重新讀首頁指引；MCP 重新整理工具定義，改用分頁 items 和新 prompt／brief 格式。
