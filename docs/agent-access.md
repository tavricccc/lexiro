# 用自己的 Agent 管理單字集

在新增單字集選「交給自己的 Agent」，或在現有集頁首按「產生授權 URL」。登入並完成雲端同步後，可以取得預設兩小時的連結，也可選 30 分鐘或 6 小時。新集會先建立空白集；手動表單已填好的內容會一併保存，未填完的資料需先補齊。

把連結交給支援 HTTP 讀寫的 Agent，它會讀到操作方式、目前單字、題目和命題規則。尚未指定時會詢問題型、難度、題數及新增／編輯需求。Agent 自己生成內容後直接存入該集，可繼續編輯、刪除；期限內可多次使用。這個連結授權整個集，也包含刪除整集，其他集不在範圍內。

「我的 → Agent 連線」提供 MCP 網址、已授權應用程式與 URL 撤銷。ChatGPT 或 Codex 透過遠端 MCP 加入該網址，再登入 Lexiro 授權，能完整管理自己帳號的所有單字集。一般 ChatGPT 對話單純打開網址不會自動取得寫入工具，請使用 MCP；URL 適用於具有 HTTP／CLI 工具的 Agent。

此路徑使用獨立 Agent Worker，不呼叫原本 Worker 的模型 API、不扣 Lexiro 生成點數。Agent 本身的訂閱用量仍由你使用的平台決定。教材沿用正式資料與驗證規則，雲端修改會同步回 Lexiro。

前端需設定 `NEXT_PUBLIC_AGENT_WORKER_URL`。服務尚須配置正式 D1、OAuth KV、Firebase service-account secret 與 HTTPS 網址；private `lexiro-worker/docs/agent-access.md` 提供配置、migration 與本機驗證方式。本次只完成本機測試，尚未部署或驗收正式 ChatGPT／Firestore。
