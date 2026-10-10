# Agent 本機 HTTP 驗證（2026-10-10）

執行：PowerShell 7，`node scripts/agent-smoke.mjs`；目標僅 `http://127.0.0.1:8791`，使用 local-user-a／local-user-b 與本機 D1 合成資料。最後一輪 exit 0、passed true。未呼叫模型 API、未讀 secrets、未使用正式 Firestore／Cloudflare。

| 實際操作 | 回條 |
| --- | --- |
| seed／owner 建立單集 URL／讀取文字 instructions | 200／201／200 |
| URL 新增 conserve、temporary，生成 2 詞彙題，讀回 2 題 | PATCH 200、questionCount 2 |
| 完整編題、刪題、保留 wordKey／sense id 編例句、刪字 | 各 200 |
| 同 operationId 相同 envelope | 200、回條完全相同 |
| 同 operationId 不同 action／stale revision | 409／409 |
| token 錯誤／拿 A URL token 讀另一集 link | 401／401 |
| URL envelope 注入其他 setId | 400 |
| A owner 建 B 使用者 set URL／B 撤銷 A URL | 404／404 |
| owner 撤銷 URL，重讀 | 200／410 |
| 本機 D1 將合成 link expires_at 改為 0，重讀 | 410 |
| public client DCR、S256 authorization、owner approval、token exchange | 201／302／200／200 |
| 真 MCP initialize、tools/list、tools/call | 200；18 個工具 |
| OAuth 建集、加字、改名、刪字、刪集 | tools/call 200，回條及讀回驗證 |
| OAuth list_sets 隔離 B，get_set(B) | B 不列出；isError true |
| sets:read 單獨 scope 存取 MCP | 403 insufficient_scope |
| 空 items 的 generated_questions | 200 rejected、savedCount=0、invalid_batch_size；revision 不變 |
| vocabulary brief 格式參考、specification、outputSchema | 200；sources／instructions／object schema 含 items；無強制品質門檻 |
| brief 選取本集單一 senseId／其他集來源 | 200、只有該來源／400 invalid_content |
| refresh_token exchange，再用新 access token 存取 tools/list | 200／200 |
| connections 列出 clientName=Local Smoke，解除後再列出 | 200／200；該連線消失 |
| 解除後原 access token 與 refresh 換出的 access token | 均 401 |
| Native D1 一次 put_words 200 筆、201 筆拒絕 | 200，wordCount=200、讀回200筆／MCP isError true |
| MCP 建資料夾、改名與 null 根層、指定 folderId 建集 | 200，讀回 folderId 正確 |
| URL /folders 讀取／PATCH 資料夾 | 200，可見目的地／405；URL僅能分類本集 |
| URL move_set 到未分類、MCP move_set 回資料夾 | 200，MCP讀回與URL共用同一native D1資料 |
| 刪除仍有集的資料夾／刪集後刪空資料夾 | MCP isError true／200 |
| /sync/status、/sync/records 分頁讀到Agent的200詞及資料夾 | 200 |
| /sync/records 前端更名、重送、MCP讀回 | 200，相同回條，MCP看見「前端 HTTP 更新」 |
| /sync/blobs preferences 写入／重送／讀回 | 200／200／200，schemaVersion=1 |
| /sync/blobs 新operationId舊blobRevision | 409 |
| Agent刪集後 /sync/records 增量拉取 | 200，存在該集 tombstone |

instructions 明定「使用者未說明題型時，先問」並要求「已說明的項目不要重問」，符合題型澄清需求；這是逐字內容檢查及依此操作的本機代理測試，不是 ChatGPT 連線端的實際對話驗收。

自行撰寫兩題英文情境及三項繁中排除理由；conserve 題以乾旱、縮短淋浴提供唯一解；temporary 題以主橋下月重開提供暫時性線索。原稿第一題挖空後只有 23 words，被 parser 的 24–40 words 門檻拒絕；加上有意義的等待雨季情境後兩题均保存成功。此結果只說明這兩個合成稿通過 parser 並可讀寫，不代表所有題型教育品質穩定。

題目現在回結構化批次診斷：全批拒絕的 URL 回 200 rejected、savedCount=0，MCP 用 isError 提示；revision 不變。格式錯誤的操作 envelope 仍是 HTTP 錯誤。brief 提供 sources、specification 與 outputSchema，取 brief 不再是必經步驟。

補驗最後一輪 exit 0、passed true；`npx oxlint scripts/agent-smoke.mjs` 為 0 warnings／0 errors。refresh 與撤銷驗證在另一輪較窄 scope 授權之前完成，避免同 client 新授權替换 grant 影響測試。

本輪已改用正式 D1AgentLibrary 實作與真本機 CLOUD_DB，沒有 snapshot repository 替身；Firebase 模擬僅用於身分驗證。舊 Firestore 資料不遷移、不設 fallback。腳本會重置 A 合成集的單字、生成及刪除資料，並留下一個生成題作檢查；OAuth CRUD 使用另建的合成集與資料夾並刪除。未處理使用者的 134 筆資料。

EXPLAIN 檢查原 JOIN 發現 planner 先掃 uid 的全帳號來源／records；目前已用 CROSS JOIN 固定本集 membership 起點，並以 INDEXED BY cloud_records_key 讓 words／questions 逐 key 查詢。再次 EXPLAIN 已確認限定本集的索引路徑；不能把這項結果換算成正式累積 rows 用量。

正式 OAuth、Firebase Auth、200 筆與共用同步後續已通過 45 項 HTTPS 檢查並發布，見 [正式發布回條](agent-deployment.md#正式發布回條)。此文件前表記錄的是本機操作；工程端沒有驗收 ChatGPT 新增 MCP 的 UI 或長任務效能。

## 2026-10-11 Agent 批次補驗

最新本機 HTTP smoke exit 0／passed true。真 MCP 驗證短題幹的 warning 不擋儲存；兩題含一個未知來源時 partial 保存一題、回穩定 itemId／sourceId，atomic 零寫入。validate_generated_questions savedCount=0 且 revision 不變；MCP 省略 revision／operationId 可寫入，拆批重送同一內容後題數仍為一題。18 tools 與原 OAuth、URL、200 筆、資料夾及同步回歸通過。

Native D1 測試另以 100 題確認 partial 保存 97、三個錯誤各有穩定來源與代碼、atomic 零寫入、唯讀驗證不改帳號 revision、相同 operationId 回條完全相同。跨集既有題目 ID 只拒絕該項，其餘有效項仍保存。

題目 ID 衝突已改 JSON 批次查詢；EXPLAIN 先發現 SQLite 使用 uid／kind／deleted 掃全帳號題目，隨後改為 cloud_records_key covering index，確認查詢使用 uid／kind／record_key／deleted 限定各個候選 ID。此證據是本機查詢計畫，不是正式 CPU 或累積 rows 測量。未呼叫模型 API、未處理使用者的 134 筆教材。
