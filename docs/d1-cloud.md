# D1 雲端與 Agent 維護

2026-10-10。Firebase 只負責登入；教材、學習紀錄與 AI 偏好改由 Agent Worker＋專用 D1 保存。依使用者決定，新資料庫從空白開始，不遷移 Firestore 舊資料。新版也使用 `d1-v1:<uid>`／`d1-v1:guest` 本機 namespace，舊快取不會自動上傳。

## 資料與同步

- 前端和 MCP／授權 URL 共用同一套 D1 repository；網站看到的就是 Agent 寫入的原生教材。
- Library records 保留目前教材格式 v9；D1 schema 為 v1，共用 `@lexiro/agent-contract` 2.0.0。
- `/sync/records` 按 `(seq,recordId)` 分頁拉取及批次寫入；刪除使用 tombstone。進度、統計、偏好走 `/sync/blobs`，以 blob revision 拒絕過期覆蓋。
- 寫入以 D1 batch transaction、帳號 CAS ticket 與 operationId 回條保護；斷線重送沿用同一操作，journal 只清已成功提交的本機版本。
- 讀字、題目都以本集 memberships/source 索引限定來源；不查整個帳號題庫。未變動的成員／題目來源不重建；相同 records 不反覆改寫。
- 開啟且在線的頁面每 30 秒讀一筆狀態；有外部改動才拉增量，隱藏／離線不發輪詢請求。重新連線不會自動重新載入 PWA。

## 資料夾與 200 筆

MCP 現有 17 個工具，新增 `list_folders`、`create_folder`、`update_folder`、`delete_folder`、`move_set`。建立集可帶 `folderId`。資料夾名稱同層不可重複、不可移進自己或子資料夾；刪除只接受空資料夾，教材的刪除仍須依使用者要求逐一操作。

`put_words`／`delete_words` 每次最多 200 筆；201 筆直接拒絕，不留下部分寫入。題目生成仍遵循 brief 的批量建議。單集 URL 可以列出自己的分類目的地並移動授權集，不能藉此編輯其他集或管理整個資料夾樹。

## 配置與下次發布

網站：`https://lexiro.vercel.app`。MCP：`https://lexiro-agent.tavric.workers.dev/mcp`。前端 `NEXT_PUBLIC_AGENT_WORKER_URL` 維持 `https://lexiro-agent.tavric.workers.dev`，由 GitHub Production variable 同步到 Vercel。

後端配置與 D1 IDs 在 private `lexiro-worker/wrangler.agent.toml`。`AGENT_DB` 管授權，`CLOUD_DB` 管教材／同步；OAuth 另用 KV。Firebase service-account JSON 不再是服務必需品；Agent Worker 不使用模型 API key。

```powershell
# 先發布後端並確認成功
gh workflow run deploy-agent.yml --repo tavricccc/lexiro-worker --ref main
# 再發布前端
gh workflow run deploy.yml --repo tavricccc/lexiro --ref main
```

Agent workflow 會檢查、套用 `agent-migrations` 與 `library-migrations`、發布並檢查 discovery。Frontend workflow 會檢查、設定 Agent origin、build 與發布 Vercel；不再跑 Firestore rules／indexes 或 Google service-account 認證。

## 容量與用量

D1 免費配額為每日 500 萬讀取 rows、10 萬寫入 rows，每個資料庫最大 500 MB。讀取依實際掃描 rows 計算，索引會影響讀写用量；不能只計算 HTTP 次數。此版本以索引限制本集來源，並使用差異寫入降低放大。正式用量仍以 Cloudflare 指標為準。[D1 計價](https://developers.cloudflare.com/d1/platform/pricing/)、[限制](https://developers.cloudflare.com/d1/platform/limits/)。

原 Firestore 故障已直接確認為 HTTP 429、`RESOURCE_EXHAUSTED`、`Quota exceeded.`。當時 service account 無 Monitoring／Billing 查看權限，未取得完整用量明細，因此不能聲稱知道精確消耗量或唯一成因。
