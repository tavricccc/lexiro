# Agent 存取

Agent 自己產生內容；Worker 驗證並存入 D1，不呼叫模型 API、不扣生成點數。資料庫與前端同步相同，Firebase 只驗證登入。正式配置及發布見 [D1 Agent 部署](agent-deployment.md)。

MCP URL：`https://lexiro-agent.tavric.workers.dev/mcp`。OAuth 提供 PKCE、DCR／CIMD、discovery、access／refresh token 及撤銷；完整授權可管理自己的教材與資料夾。18 個 tools 包括資料夾 CRUD、move_set、validate_generated_questions 與教材工具。

create_set 可帶 folderId；需要分類 ID 時用 list_folders。parentId:null 代表根層。同層不可同名、不能移入子層、只刪空資料夾。put_words 每次1–200筆，examples 選填；201筆不寫入。MCP expectedRevision／operationId 選填；提供時保留過期版本檢查與相同回條重送，省略仍受 D1 交易 CAS 保護。

單集 URL 預設兩小時，限定 uid＋setId。GET 讀回 snapshot／revision，PATCH 提交 `{expectedRevision,operationId,action}`，Authorization 使用 Bearer token。`GET /access/{id}/folders` 只列分類目的地；`move_set` 可移動授權集，不能跨 uid、改其他集或管理資料夾。

action 支援 rename_set、move_set、put_words、delete_words、put_questions、delete_questions、generated_questions、delete_set。所列單字 senses 完整替換，其餘保留。來源刪除／重綁會調整失效題目及來源進度，保留其他集與整體歷史；D1 batch 原子提交及操作回條避免重送。

命題使用 `/access/{id}/brief?kind=vocabulary&difficulty=2` 或 get_generation_brief 取得完整提示。rules／specification 直接由內建 questionPrompt 函式產生，所有五種題型共用同一套品質指引，不另維護簡化版。已取得提示可沿用。寫入仍以穩定 senseId 綁定，來源順序不限，可只生成指定字、同字多題，不強迫覆蓋全來源；解說、逐錯項理由、閱讀 skill／evidence 選填。篇幅是 warning，來源／答案定位／選項結構錯誤是 error。綜合測驗依提示可挖空相關文法詞，不必等於來源字。

validate_generated_questions 只讀並回逐題診斷，不改 revision。save_generated_questions 與 put_questions 預設 mode:partial，只保存有效獨立題目／完整題組，mode:atomic 有任何 error 就零寫入。每批最多 200 個獨立題目／題組；回 savedCount、failedCount、errors、warnings 與 itemId／sourceId，sourceIndex 只是本次位置。可只修正錯誤項；生成題 ID 穩定，拆批不重複新增。沒有另用模型評難度、風格或語意相似度；出題去重由 Agent 判斷，原始詞條保留。

完整本機 HTTP 回歸見 [測試回條](agent-local-results.md)。local config 才有合成 auth；正式入口永遠驗證 Firebase token。舊 Firestore SDK、service-account REST 和 cloud migration 已移除，舊資料不搬入新 D1。
