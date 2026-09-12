# Lexiro Worker 檔案地圖

獨立後端工作區。目前有串流隱私邊界與 Firebase JWT 驗證模組，尚未接上 HTTP handler、D1 計費或正式部署；前端仍使用原有路徑。

| 路徑 | 責任 |
| --- | --- |
| `src/response-stream.ts` | 保留 Responses SSE 協定，只移除上下文回顯並中和錯誤；文字事件不解析 JSON，內部完成通知保留伺服器結算需要的原始回覆 |
| `src/auth.ts` | Google RS256 簽章、Firebase project/uid/時間驗證、Cache-Control 公鑰快取與 ADMIN_EMAILS 管理員判斷 |
| `tests-next/auth.test.ts` | 錯誤簽章／claims、快取期限、並行讀取及已驗證管理員 email 的行為測試 |
| `tests-next/response-stream.test.ts` | 文字保持不變、metadata 不外流、分塊、拒答、錯誤、取消與背壓行為 |
| `scripts/benchmark-stream.mjs` | 合成串流在本地 Node 的效能量測，不代表 Workers CPU 額度 |
| `package.json`、`tsconfig.json` | 獨立套件與檢查設定 |
| `docs/backend-blueprint.html` | 完整原始藍圖，移除平台執行腳本與登入包裝後的本地版本 |
| `docs/product-decisions.md` | 使用者補充、矛盾處理與階段驗收；優先於原始藍圖 |

公開串流保留 `response.created`、`response.in_progress`、`response.completed`、`response.incomplete`、`response.failed` 及文字增量／完成事件。只有 Response 元資料事件解析 JSON 並刪掉 `instructions`、`input`、`prompt`。模型、用量與 schema 可存在於網路回應，使用者只要求介面不顯示；不為了隱藏程式碼或這些欄位增添复杂度。API key 始終只用於後端供應商請求標頭。上游錯誤文字不直接回傳。

`onTerminal` 在終止事件送給前端之前完成，之後接入結算與 cursor 寫入，避免前端看到完成立刻送下一段時碰上尚未釋放的鎖。取消也會發出一次內部終止通知。此處只保護協定層的上下文回顯，不改寫模型產生的內容。

## 持久化版本

尚未新增持久化資料表或 migration。
