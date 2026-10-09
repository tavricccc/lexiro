# 2026-10-08 Luna 教材照片評測

後續 v12 基線、v13–v19、low／medium／high、人工回饋與 v19 正式 Thinking 五型 fresh＋一次 native recovery 的完整界線見 [2026-10-09 題目品質校準](luna-question-quality-20261009.md)。下表仍是前次 v11 照片及題目採樣，不覆寫為本次結果。

以使用者提供的五張 Unit 09 照片及受控的 32 個詞義，實跑 GPT-6 Luna、GPT-5.6 Luna／low。子代理先建立照片參考，再核對原始回覆；以日常可用為準，主要檢查錯義、明顯多解與解析對位。

照片優先保留 11 個編號主詞，一般透明派生可略過；另以 continual、mechanic、dominate 的特殊差異作備查，不要求收滿所有 21 個大字詞條。文字階段用相同人工來源隔離 OCR 差異，不宣稱各模型照片回覆直接串成同一條端到端管線。

共 30 次 CLI 請求：baseline 照片 2 次、tuned 各階段 20 次、一次指定案例修復 8 次。題型各取一批，第二輪文意選填另測十格與每格九項解析。原圖及不可覆寫的請求／回覆只留 ignored `artifacts/ai-quality/`；人工核對為 `final-content-review.json`、`final-passage-review.json`，用量為 `final-metrics-report.json`。

## 結果與待校對項目

| 項目 | GPT-6 Luna | GPT-5.6 Luna |
| --- | --- | --- |
| 照片清單 | 20 詞，11 個主詞全齊，特殊備查 3／3，無側欄混入 | 13 詞，11 個主詞全齊，特殊備查 2／3；漏 mechanic，無側欄混入 |
| 詞彙題正式 parser 可保留 | 7／16 → 16／16 | 11／16 → 15／16；一題 23 字低於 24 字下限 |
| 詞彙題語意 | 14／16 可用；mechanical／electrical、plotted／agreed 需校對 | 16／16 來源義可用，少數解析可修 |
| 文意選填 | 10／10 答案可用，90 項理由無不存在選項的引用；解析為英文 | 10／10 答案可用，90 項理由無不存在選項的引用；少數詞性理由需修 |
| 綜合測驗 | machinery／equipment、prime／excellent／suitable、continual／constant 有多解 | 第一格無法排除 occasional，其餘四格可用 |
| 篇章結構 | 共用選項解析對位錯誤，尤其 extraOption | 同樣有共用選項解析對位錯誤 |
| 閱讀測驗 | 四個正解均有本文依據，但漏用 dominant | 四個正解均有本文依據，一處錯項解析誤歸因公司說法 |

parser 與語意可用數分開。整批 parse 失敗只報第一個問題，實際以正式 step.recover 留住可用題目；不把整批算成全壞，也不把 parser 通過率當成教學品質。儲存前仍需校對，尤其綜合測驗與篇章結構。

上述模型結果對應 v11 採樣。最後 v12 的小修把 extraOption(s) 移到各題解析前生成，明確要求比較實際選項，並加強綜合測驗排除可互換近義詞／上位詞的規則；沒有追加模型採樣，其內容效果尚未實測。Structured Outputs 依 schema 欄位順序生成，是這次順序調整的依據，不能證明語意必然正確。[OpenAI 文件](https://developers.openai.com/api/docs/guides/structured-outputs)

## 快取與驗證

| CLI 回條 | 請求數 | input tokens | cached input tokens | 輸入讀取比例 |
| --- | ---: | ---: | ---: | ---: |
| GPT-6 Luna | 16 | 350,663 | 11,008 | 3.14% |
| GPT-5.6 Luna | 14 | 295,203 | 33,024 | 11.19% |
| 合計 | 30 | 645,866 | 44,032 | 6.82% |

全部回條明報 cache_write_input_tokens=0。這些數字涵蓋 Codex CLI 的系統、工具及對話上下文，只描述此路徑；正式 API 前綴命中率與供應商費用仍未知。actual model metadata 缺漏保留 null，模型名稱是明確 CLI 指定值。本機沒有正式 API key，沒有 Responses 或部署驗收。

正式契約已統一 words／senses 的 provider schema，且同題型跨難度保持完整 developer 訊息與 schema 相同。可用 API key 重跑 `evaluate-photo-workflow.mjs --transport responses` 核對讀寫與費用；命令見 [prompt-evaluation.md](prompt-evaluation.md)。

本地最終驗證：前端 340 個測試、Worker 165 個測試，以及 typecheck、lint、build。前端另有手機／桌機 headless 顯示與選字檢查；實體 iPhone 長按翻譯未驗證。
