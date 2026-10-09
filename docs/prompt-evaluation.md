# Prompt 評測

Prompt、schema、合成來源與模型評測腳本維護在 private `lexiro-worker`。公開前端測試涵蓋解析、組題、並行執行、恢復、生成進度、請求契約及使用量邊界。

Private evaluator 透過本地 checkout 使用實際前端 parser；真實 CLI 執行消耗 Codex 額度，重驗已存回覆不呼叫模型。2026-10-09 採樣涵蓋 GPT-5.6 Luna／GPT-6 Luna 的五種題型，另以 5.6 Luna／medium 對照高風險詞彙與綜合測驗。每個回條保留模型、推理等級、難度、來源、prompt/schema 指紋、前後端 Git 狀態、原始回覆及 parser 結果；首輪與一次修復後分開記錄，不覆寫 baseline。

人工逐題檢查合法來源詞形、唯一解、每個錯項的原文排除依據與閱讀推論。必須保留失敗案例，不能以 parser 通過或模型自稱 approved 當作唯一解、干擾力或正式 API 驗收。CLI 不提供正式 Responses API 的 constrained decoding、產品快取命中或付費帳單驗證。命令、採樣回條與逐題發現位於 private Worker 的 `docs/prompt-evaluation.md`；公開規格見[高中題目品質](question-quality.md)。

本輪只版本化題目與單題修復的 prompt/schema 快取；單字、詞義、照片整理與錯題解析的完整提示、schema 及快取鍵維持原契約。未藉由增加第二輪自動模型審題提高採樣通過率，正式 Lite／Thinking 仍依使用者選擇。
