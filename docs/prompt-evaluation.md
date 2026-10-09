# Prompt 評測

Prompt、schema、合成來源與模型評測腳本維護在 private `lexiro-worker`。公開前端測試涵蓋解析、組題、並行執行、恢復、生成進度、請求契約及使用量邊界。

Private evaluator 透過本地 checkout 使用實際前端 parser；真實 CLI 執行消耗 Codex 額度，重驗已存回覆不呼叫模型。2026-10-09 採樣涵蓋 GPT-5.6 Luna／GPT-6 Luna 的五種題型，另以 5.6 Luna／medium、high 對照高風險來源；最後 v19 用正式 Thinking／medium 重跑五型及一次單來源補缺。每個回條保留模型、推理等級、難度、來源、prompt/schema 指紋、前後端 Git 狀態、原始回覆及 parser 結果；首輪與一次修復後分開記錄，不覆寫 baseline。

人工逐題檢查合法來源詞形、唯一解、每個錯項的原文排除依據與閱讀推論。必須保留失敗案例，不能以 parser 通過或模型自稱 approved 當作唯一解、干擾力或正式 API 驗收。CLI 不提供正式 Responses API 的 constrained decoding、產品快取命中或付費帳單驗證。命令、採樣回條與逐題發現位於 private Worker 的 `docs/prompt-evaluation.md`；公開規格見[高中題目品質](question-quality.md)。

本輪只版本化題目與單題修復的 prompt/schema 快取；單字、詞義、照片整理與錯題解析的完整提示、schema 及快取鍵維持原契約。未藉由增加第二輪自動模型審題提高採樣通過率，正式 Lite／Thinking 仍依使用者選擇。

共保留 65 次 CLI 請求、63 份內容回覆與兩次 timeout。v19 首次三型、補缺後四型通過結構檢查，仍有真多解、錯標推論及未完成指定文法格；5.6 Luna 的穩定可用目標尚未達成。可用但誘答較弱的題目、正文或解析錯誤與結構失敗分別記錄，不把弱題全部拒收。
