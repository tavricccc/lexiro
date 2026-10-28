# 用自己的 Agent 管理單字集

ChatGPT 或 Codex 透過遠端 MCP 連線到 Lexiro，登入授權後即可完整管理自己帳號的所有單字集。Agent 可一次按需請求單字、題目、搜尋結果或命題規則，指定範圍及欄位。尚未指定時會詢問題型、難度、題數及新增／編輯需求。Agent 自己生成內容後存入單字集，可繼續編輯、刪除。

「我的 → Agent 連線」提供 MCP 網址與已授權應用程式，也可解除連線。在 ChatGPT 或 Codex 新增遠端 MCP 時貼上該網址，再登入 Lexiro 授權。一般 ChatGPT 對話單純打開網址不會自動取得寫入工具，請使用 MCP。

此路徑使用獨立 Agent Worker，Lexiro 不呼叫模型，也不管理點數或方案。Agent 本身的訂閱用量仍由你使用的平台決定。教材使用正式資料格式，Agent 題目寫入只擋結構與來源錯誤；篇幅警告仍可儲存，雲端修改會同步回 Lexiro。

正式 Agent 服務為 `https://lexiro-agent.tavric.workers.dev`，MCP 網址為該原點加 `/mcp`。Firebase 只保留登入；教材走 D1，前端與 Agent 共用資料，外觀偏好留在本機。舊資料不遷移，維護見 [D1 雲端](d1-cloud.md)。

本次變更、下一次部署順序與免費 `vercel.app` 網域設定見 [Agent 變更與發布](agent-release-2026-10-10.md)。

大量出題可使用 partial 模式，只保存有效題、修正失敗項；每題用 senseId 綁定，不需要按來源順序排列，也不必用完所有來源。可先用唯讀工具驗證，解說欄位選填，服務不另外呼叫模型審題。詳見 [批次寫入](agent-validation.md)。

MCP `read` 支援按需查詢；可搜尋單字／題目、篩題型與難度、讀第幾到第幾筆，或只修改一個詞義、例句或子題。完整命題提示每型取得一次，後續只取小批來源。可直接使用的範例見 [按需操作指南](agent-query.md)。
