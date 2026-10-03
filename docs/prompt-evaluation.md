# Prompt 評測

Prompt、schema、合成來源與模型評測腳本維護在 private `lexiro-worker`。公開前端測試涵蓋解析、組題、序列執行、恢復、審題進度、請求契約及使用量邊界。

Private evaluator 透過本地 checkout 使用實際前端 parser；真實 CLI 執行消耗 Codex 額度，重驗已存回覆不呼叫模型。2026-10-03 的審題第二版只完成三回合，後續因額度用盡未完成。前一版另以一個 fresh 6 Luna／medium 子代理盲審八題，模型拒絕，修訂稿也未通過原文跨度檢查；請求、回覆及人工發現保存在 private sibling。本輪題型與快取收斂未新增模型採樣；只核對固定前綴、schema 與程式／介面行為。不能以 parser 通過或模型自稱 approved 當作唯一解、干擾力或正式 API 驗收。範圍見[高中題目品質](question-quality.md)。
