# Agent 存取

Agent 自己產生內容；Worker 驗證並存入 D1，不呼叫模型 API。資料庫與前端同步相同，Firebase 只驗證登入。正式配置及發布見 [D1 Agent 部署](agent-deployment.md)。

MCP URL：`https://lexiro-agent.tavric.workers.dev/mcp`。OAuth 提供 PKCE、DCR／CIMD、discovery、access／refresh token 及撤銷；完整授權可管理自己的教材與資料夾。MCP 只有 5 個 tools 以減少每次對話的 token：read（批次讀任何 resource）、create_set、write、validate（唯讀檢查生成題）、delete；write／delete 以 `action.type` 指定操作。許多 client 不顯示 server instructions，所以 action 清單、各 action 欄位與 read 的 request 欄位都寫在 tool description／inputSchema（`action.type`、`resource` 為 enum，read request 為 strict，拼錯欄位會回欄位名）；instructions 只留流程。錯誤訊息為「路徑: 原因」並列出合法值；生成題格式錯誤時回條附 `hint` 指向 prompt 的 outputSchema。tools/list 加 instructions 約 6.2k 字元（約 1.85k tokens）。

create_set 可帶 folderId；需要分類 ID 時讀 folders。parentId:null 代表根層。同層不可同名、不能移入子層、只刪空資料夾。put_words 每次1–200筆，examples 選填；201筆不寫入。MCP expectedRevision／operationId 選填；提供時保留過期版本檢查與相同回條重送，省略仍受 D1 交易 CAS 保護。

單集 URL 預設兩小時，限定 uid＋setId。首頁 GET 只讀摘要、revision 及操作指引，`POST /access/{id}/query` 一次查多種資料。列表預設20筆摘要、最多50筆，支援搜尋、題型／難度／來源篩選、from/to、cursor 和 fields。Authorization 使用 Bearer token；folders 分頁列分類目的地，move_set 可移動授權集。

根路徑 PATCH 接受 `{expectedRevision?,operationId?,action}`。原有 action 支援 rename_set、move_set、put_words、delete_words、put_questions、delete_questions、generated_questions、delete_set；新增 edit_word／edit_sense／edit_question。細部 REST 路徑與 MCP 編輯可只傳指定詞義、例句或子題 patch，其他內容保留。來源刪除／重綁仍調整失效題目及來源進度，D1 batch／CAS 與操作回條保護交易及重送。

命題用 `/prompt?kind=vocabulary` 或 MCP read prompt 取得完整提示一次；brief 預設只取小批來源 specification，可在同一次 read 取得。所有五型 rules／specification 直接由內建 questionPrompt 產生，內容相同。來源以 senseId 綁定，順序不限，可只生成指定字、同字多題；解說、逐錯項理由、閱讀 skill／evidence 選填。篇幅是 warning，來源／答案定位／選項結構錯誤是 error。綜合測驗可挖空相關文法詞。

MCP validate 只讀並回逐題診斷，不改 revision。generated_questions 與 put_questions 預設 mode:partial，只保存有效獨立題目／完整題組，mode:atomic 有任何 error 就零寫入。每批最多 200 個獨立題目／題組；回 savedCount、failedCount、errors、warnings 與 itemId／sourceId，sourceIndex 只是本次位置。可只修正錯誤項；生成題 ID 穩定，拆批不重複新增。沒有另用模型評難度、風格或語意相似度；出題去重由 Agent 判斷，原始詞條保留。

回條預設只回數量／版本、10筆 errors、3筆 warnings；responseFields 可選欄位，更多診斷用 operationId 分頁讀。查詢範例、13種 resource 與 REST 路徑見公開 [按需操作指南](https://github.com/tavricccc/lexiro/blob/main/docs/agent-query.md)。本機 HTTP 回歸見 [測試回條](agent-local-results.md)。local config 才有合成 auth，正式入口驗證 Firebase token。
