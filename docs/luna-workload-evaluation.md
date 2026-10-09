# Luna 固定工作量對照

只使用 private Worker 評測工具。`luna-workload-sources.json` 保留原 16 個高風險詞義，另列 be、go、take off、turn off、look forward to、get used to、child、good，共 24 來源。衍生詞須另列；正常變形與片語仍交由目前正式 parser 驗證。乾跑已確認 `phr. v.` 不會吞入英文單字。

## 固定來源與版本

同一次 A/B 使用同一份 reference、難度、模型、tier／effort、parser fingerprint、批次與並行設定。`--backend-module` 指向已凍結的 v19 或候選模組；不在實測中讀取會變動的 prompt 原始碼。計畫保存 backend SHA、目前 parser 檔案 SHA、schema SHA、固定提示 SHA、API 請求與 CLI 輸入。各批按原始 reference 索引合併，原請求／回覆／回條一律以新的 run ID 保存，禁止覆寫。

只對照提示時，兩邊另外指定相同的 `--schema-module <candidate-v21-backend.mjs>`；有效 schema 由該凍結模組提供，舊 writer 的 instructions／input／cache key 不變，原 schema 及 SHA 另存。未指定時完整保留各版本自己的凍結 schema，適合歷史重跑，不能把它宣稱為只改提示的 A/B。

`--batch-size 1|4|8|16` 只控制詞彙題，每個 chunk 使用正式 `questionTask` parser 與 `prepareGeneration`。指定大小後預設跑完整來源池，24 詞分別是 24／6／3／2 批；`--batch-index` 才選單一 probe。文章型沿用正式完整文章與候選庫，一個題組就是一個不可分割請求；不隨詞彙大小拆每格。

`--concurrency 1|2|4` 是整輪上限，兩模型合計也受同一上限控制。4 只允許 Codex CLI；Responses 路徑至多 2。`--warm-first` 等每個模型／題型／cache key 的第一批完成後，才釋放該組剩下的獨立請求。CLI 或供應商失敗後停止該模型的新派送，已開始的請求保留回條，不追加重試。明示 `--targeted-repair` 維持一次原生修復且只能並行 1，避免改變共用文章的依序回收語意。

## PowerShell 7 命令

```powershell
# 只建計畫，不呼叫模型；把模組路徑換成要比對的 frozen bundle。
node scripts/evaluate-photo-workflow.mjs --phase tuned --models gpt-5.6-luna `
  --tasks vocabulary --reference tests-next/fixtures/prompt-eval/luna-workload-sources.json `
  --difficulty 3 --tier thinking --batch-size 8 --concurrency 2 --warm-first `
  --backend-module artifacts/ai-quality/20261009-purpose-prompts/candidate-v21-backend.mjs `
  --schema-module artifacts/ai-quality/20261009-purpose-prompts/candidate-v21-backend.mjs --dry-run

# 受控實測：先設定已安裝的 Codex executable／JS entry，再移除上面的 --dry-run。
# 正式 Thinking 由 frozen backend 決定 medium；--effort low|medium|high 僅是明示評測覆寫。

# 只重新驗證既有不可覆寫的回覆；不用 phase、reference、API key 或 backend。
node scripts/evaluate-photo-workflow.mjs --revalidate-from '<model/run-id directory>'
```

v19 對照把 `--phase` 換成 `baseline`，`--backend-module` 換成同資料夾的 `baseline-v19-backend.mjs`。1 詞 probe 可用 `--batch-size 1 --batch-index 18`，會選第 19 列 take off。並行對照固定同一個細批次大小，只改 concurrency；比較 batch-size 時固定 concurrency 與 effort。不要手改已保存 request。

## 讀取結果

- `artifacts/ai-quality/<phase>/runs/<run-id>/plan.json`：整輪計畫、原來源索引、API 請求上限及版本指紋。
- 同目錄 `summary.json`：包含 preparation、execution／whole-round wall clock、最大 active 數、首次回覆／整批通過／可保留成果時間、token 與各模型結果。
- `artifacts/ai-quality/<phase>/<model>/<run-id>/`：每批 request、CLI prompt、原始 response、CLI JSONL、event timeline、parsed、native recovery 與 metrics。
- `artifacts/ai-quality/revalidation/runs/<run-id>/`：新 parser 的重驗報告及原回覆 SHA；原始 run 不改動。

整批通過是 `PARSED`；parser 拒絕但原生 recovery 保留可存題目是 `PARTIAL`。`retainedUnits`／`retainedSourceIndices` 記錄可保存成果，`remainingUnits` 記錄未執行的修復步驟；首次可保留成果包含 PARTIAL。文章僅暫存的 child 另記 `stagedChildren`，不能當作已保存的完整題組。結構失敗、傳輸失敗、尚未派送分別記錄，不把漏跑批次列為出題失敗。這些是機器契約與覆蓋指標，逐題的多解、明確錯誤與可用但弱仍需另外評閱。

目前文章 raw 契約遷移到 `single-pass-v3`；重驗 v19–v21 的舊文章回覆標成 `INCOMPATIBLE_CONTRACT`，不算模型內容或語意失敗。詞彙 raw 形狀未變，仍可用同一個當前 parser 做 v19／v21 對照。

CLI JSONL 的 `turn.completed` 用量包含 Codex context；第一個文字事件可能已是完整 agent message，不能稱為 provider TTFT。[官方非互動模式文件](https://learn.chatgpt.com/docs/non-interactive-mode)列出 JSONL 事件與最終用量。CLI cap 4 只證明 CLI 程序有重疊，不能推論正式 Provider WebSocket 有四個 lane，也不能當 Cloudflare CPU 或正式費用驗收。API request 的 `max_output_tokens` 與觀察到的 CLI output 分開記；CLI 輸出超過 API budget 只記診斷。

正式 API 快取須讀該請求的 cached／cache-write usage；計價也須完整 provider usage。[官方快取文件](https://developers.openai.com/api/docs/guides/prompt-caching)說明相應欄位。CLI token、快取率及 wall-clock 不換算正式 API 成本。

必要的排程／部分保留測試由 `npm run test` 收錄；本地 gate 仍是 typecheck、lint、test、build。乾跑及 saved-reply 重驗完全不發模型請求。
