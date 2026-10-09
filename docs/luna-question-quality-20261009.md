# 2026-10-09 Luna 題目品質校準

本輪完成單次生成契約、解析對位及可機器驗證條件的改善；**尚未證明 GPT-5.6 Luna 在五題型都能一遍穩定產出沒有多解的題目**。低推理、中推理及高推理都保留原始失敗，不能用 parser 通過數、168 個後端測試或一次修復的成功樣本代替語意驗收。

## 方法與版本界線

- A 來源是前次 Unit 09 的 32 個受控詞義；B 來源是 16 個合成高中詞義，涵蓋近義、角色、機械描述及多義風險。v17／v18 另抽 B 的六個高風險來源，不改來源詞性或中文義。
- v12 後端在修改前凍結，基線使用前端 `7313ca7`、`single-pass-v1`。之後的 `single-pass-v2` 同時改 schema 與 parser，不能把 parser 的新門檻當成純提示 A/B 分數。
- 題組用正式 `questionTask`、writer、schema、parser 與 `step.recover`。每次請求先保存，回覆及回條不可覆寫。後續前端追加篇章及詞形門檻時，保留每次載入的版本界線，不改寫舊 metrics。
- 全部使用已登入 Codex CLI，明確指定模型與 effort；沒有正式 API key，沒有 Responses API、正式計費、快取率或部署驗收。回條缺 actual model 時保持 null。
- CLI 或供應商失敗停止該模型後續案例。兩次 300 秒 CLI timeout 沒有產出，列為傳輸失敗，不算模型內容失敗，也不把尚未執行的案例算成出題失敗。

原始資料、凍結 v12–v18 模組、來源、請求、schema、回覆、解析及人工核對放在 ignored `artifacts/ai-quality/`。最終索引為 `artifacts/ai-quality/20261009-quality/stage-metrics-complete.json` 與 `content-review-complete.json`，主代理的獨立覆核另存 `release-v18-independent-review.json`；較早索引保持原樣。共 59 次 CLI 請求、57 份內容回覆、2 次傳輸 timeout；其中 2 次是明示回饋的整批新稿，1 次是單來源補缺。

## 首次產出與一次修復

下表只記錄當時 parser 的整批通過數。「傳輸失敗」不納入內容回覆分母；schema、source gate 或 parser 版本不同時，不能直接推論哪個模型較好。

| Writer／來源 | 模型／effort | 首次 parser | 已知內容問題 |
| --- | --- | --- | --- |
| v12 A 基線 | 5.6／low | 3／5 | 詞彙回收只有 2／16；雨的頻率與期間混用、篇章解析引用不存在候選 |
| v12 A 基線 | 6／low | 2／5 | machinery／equipment、crack／bend 多解，篇章解析錯序 |
| v13 A | 5.6／low | 2／5 | 單字 usage 多帶冠詞；綜合測驗正文畫底線；文意選填重複 investor |
| v13 A | 6／low | 5／5 | 已通過的篇章仍挖相鄰句；詞彙與綜合測驗仍有多解 |
| v14 A | 5.6／low | 1／5 | 中文選項、英文解析、字數與答案重複被攔截 |
| v14 A | 6／low | 3／5 | 詞彙答案重複、文意選填重複 mechanic |
| v15 A | 5.6／low | 無內容回覆；1 次傳輸失敗 | 第一批 CLI timeout，後四批未執行 |
| v15 A | 6／low | 5／5 | prime 被換成 main／best、regulate 被換成 adjusted；新詞形門檻之後才加入 |
| v15 B | 5.6／low | 2／5 | estimate／measure、mechanical／wooden 等多解；三篇文章字數或重複不合規 |
| v15 B | 5.6／medium | 1／2 | 部分語境改善，但 usage 字形錯誤；仍有不同描述面向及角色重疊 |
| v16 A | 5.6／low | 4／5 | 詞彙回收 15／16；篇章卻把已拆橋的矛盾句當正解，文意選填有過寬詞性理由 |
| v16 B | 5.6／low | 無內容回覆；1 次傳輸失敗 | 第一批 CLI timeout，第二批未執行 |
| v17 六詞小樣本 | 5.6／medium | 2／2 | 六詞彙直接列出候選否定；綜合測驗 mechanical／digital、estimate／record 未排除 |
| v17 同六詞 | 5.6／high | 2／2 | 直接否定減少但仍存在；沒有依要求產生兩個 aux 選形格 |
| v17 明確人工回饋，一次新稿 | 5.6／high | 1／2；詞彙可回收 5／6 | 詞彙 mechanical 未出現在原文。其餘詞彙與綜合測驗五格可作練習，少數理由可更精確 |
| v17 單來源 native 補缺 | 5.6／high | 1／1 補缺；保留 5 題 | mechanical 補回；整批重新驗證 6／6，情境較直接 |
| v18 同六詞，其他三型 | 5.6／high | 3／3 | 文意選填 6 格答案與完整配置可用，3 條詞性理由需修正；篇章局部銜接較弱；閱讀錯標跨句推論 |

v17 最後兩個整批新稿是明確人工回饋後的結果，沒有另呼叫付費 reviewer。它們沿用六詞、難度三及 high；不能說成 fresh 一遍通過。綜合測驗在原文保留 `had [been] completed` 與 `could [estimate]` 的選形限制，另外三格以資金投入的因果、正常控制訊號與磨損零件、多天候測試提供線索。弱干擾與少量用語可更精確列為建議，不把另一項可能存在的屬性一律當多解；仍須看代入後完整句意及因果。

詞彙只再執行一次正式 `step.recover` 要求的 mechanical 單來源補缺。五題保留加一題補缺，在 fresh 前端 `d4fc67f` 重新解析為 6／6；重建稿另存 `final-vocabulary-reconstruction.json`、`final-vocabulary-revalidation.json`，註明來源及取代位置，原始模型回覆保持原樣。estimate 的 recorded 是較弱錯項：理由應說明記錄既有資訊與預測尚未發生人數的功能差異，不能把未述動作說成已知。

v18 把有效回饋寫入正式 brief，並以同六詞、難度三、high 對文意選填、篇章與閱讀各做一個 fresh 批次；實際正式分批取 6／4／5 個來源。三型皆通過當時 `d4fc67f` parser。文意選填 54 個理由逐一對位，但 estimate 那格錯把 witness／suspect 排除為非動詞，investment 那格又把 estimate 限定為只有動詞，必須以實際語意修正。閱讀四個答案與十二個錯項理由有本文支持，但標為 inference 的第三題正解已由第二句 evidence 單獨支持；它是單句改述，不能宣稱已完成兩個必要事實的跨句推論。

主代理獨立覆核篇章的四格整體排列可用，永久關館的第五候選也與本文相斥；但第二格局部填入估計等待時間的方法句，仍可自然描述資料分析。該錯項由第一格缺少 The numbers 的先行資料排除整體交換，不能單憑「打亂研究順序」宣稱每格局部唯一性都強。定義投資的句子及泛稱機械零件讓難度三偏直接，列為可用但較弱，不和錯誤詞性解析、錯標推論混為一談。

v16 A 閱讀四個正解有本文支持，但字義題錯寫目標字位於 second sentence，需局部校對；篇章敘事矛盾需重做整組。文意選填候選文字對位正確，仍不能因此核准把 prime／plot 的其他合法詞性一律否定的解析。

這些是有界診斷與校準樣本，來源、難度、批次大小與推理不同，未形成統計品質保證，也不足以宣稱 5.6 或 6 普遍較好。

## 已完成的實作

1. `@lexiro/ai-contract` 4.0.0 與 `single-pass-v2` 取代舊題目 raw 契約；不接受舊 positional reasons。
2. `whyWrong` 使用 `{option,reason}`，每個理由明確綁定完整實際候選。文意選填十個與篇章五個 `options` 在逐題解析前生成；前端拒絕重複、缺漏或陌生候選。
3. Schema 限制英文欄位不含漢字、中文解析含漢字、正文不畫底線，並固定已知選項／理由數量。這些限制能減少格式失敗，不能證明語意唯一。
4. 詞彙先寫定 distractors，再寫情境與複製 usage／answer。閱讀先寫 skill／evidence，再編寫選項。v18 英文 brief 只保留一個完整正面示範，與題型規則分檔維護；用觀察到的事件、機制、因果提供線索，避免題幹列舉否定候選。綜合測驗前兩格明確以外部 aux 選形。
5. 前端檢查來源單字的合法詞形、完整篇章句、首尾句、相鄰空格、已知字數及未使用共用候選不得出現在正文。固定 bank 的文章或結構失敗重做整組；解說或單題失敗才用局部修復。
6. 評測可指定 difficulty、正式批次索引與 tier；`--effort` 僅作明示能力對照。正式 Lite＝low、Thinking＝medium、Pro＝Sol／low 及計費保持原樣。
7. `--targeted-repair` 只跑一次正式 `step.recover` 產生的剩餘子題，最多四個；沒有可局部修復的結果時直接拒絕，不自行改成整組重試。

現行題目鍵為 `lexiro-questions-20261009-v18`，局部子題鍵為 `lexiro-question-item-20261009-v9`。words、senses、organizeText、explain 的完整 instructions、schema、cache key 與凍結 v12 逐項比對皆相同，回條為 `release-v18-cache-verification.json`。v18 共用前綴 1,339 tokens、詞彙完整固定 instructions 1,522 tokens；這是本地 tokenizer 數字，沒有證明正式 cache hit。CLI high 樣本與正式 Thinking 的 medium 亦保持明確區分。

## 自行重跑

```powershell
# PowerShell 7。會使用 Codex 帳戶額度；原始結果保存在新的不可覆寫目錄。
$env:CODEX_PROMPT_EVAL_CLI = (Get-Command codex).Source
node scripts/evaluate-photo-workflow.mjs --phase tuned --models gpt-5.6-luna `
  --tasks vocabulary,cloze --reference tests-next/fixtures/prompt-eval/luna-quality-sources.json `
  --difficulty 3 --batch-index 0 --tier thinking --transport codex

# 明示能力對照；不會改正式 Thinking 的推理設定。
node scripts/evaluate-photo-workflow.mjs --phase tuned --models gpt-5.6-luna `
  --tasks vocabulary,cloze --reference '<同一參考來源 JSON>' `
  --difficulty 3 --tier thinking --effort high --transport codex
```

有可用 API key 時才能選 `--transport responses`；不做傳輸 fallback。CLI cached/input/output token 包含 Codex 的系統及工具上下文，不能換算 Lexiro 的正式前綴命中率或帳單。

本地四個 gate：typecheck、lint、168 個測試、build。這不代表正式出題、Cloudflare CPU、計費、部署或跨裝置學習已驗收。

校準以 [大考中心 115 英文試題特色](https://www.ceec.edu.tw/xcepaper/cont?qunit=0Q105367191322447606&sid=0Q105583094870257539&xsmsid=0J066588036013658199) 的篇章、常用詞彙及閱讀判斷方向為依據；[OpenAI Structured Outputs 文件](https://developers.openai.com/api/docs/guides/structured-outputs) 支持 schema 鍵順序及格式約束，同時提醒內容仍可能有錯。兩者都不能替本次生成樣本背書。
