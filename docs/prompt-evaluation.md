# 生成與審題評測紀錄

後續 v20–v23 已改為命題目的、正反例、逐題檢查及真正遮掉 answer 後的候選代入，並將文章型 raw 移為 required usage 錨點；新候選實測由主代理控制，方法及版本界線見 [目的與契約](question-prompt-purpose.md)。下列 v19 結果仍是前輪凍結資料。

## 2026-10-09 出題契約與有界能力對照

該輪題目 writer 為 `lexiro-questions-20261009-v19`、raw 契約 `single-pass-v2`。錯項解說明確綁定候選文字，共用選項先生成；正式仍單次 writer，Lite／Thinking／Pro 分級及不相關快取不變。v19 改原文含義／搭配理由並讓閱讀先選 skill／evidence；同六詞的正式 5.6 Thinking medium 五型 fresh 首次 parser 3／5，一次 native reliable 補缺後 4／5，仍有多解、錯標推論及缺 aux 格。此前凍結 v12、兩個 Luna／low、5.6 medium／high、明確人工回饋與 v18 high 全留為歷史。原始失敗與傳輸 timeout 全保留；high 人工回饋稿不能當成 medium fresh 的證據，也不能以較弱但可用的題目混同錯誤解析，詳見 [本輪紀錄](luna-question-quality-20261009.md)。

## 2026-10-08 五張教材照片與兩個 Luna

本輪使用使用者提供的五張 Unit 09 教材照片，獨立子代理先建立參考，再核對原始模型回覆。依使用者補充，11 個編號主詞優先保留，一般詞性轉換／透明派生可略過；另以 continual、mechanic、dominate 的差異作語意備查。參考清單不是要求所有大字次詞一律收滿的 exact-count 門檻。

兩個指定模型為 `gpt-6-luna`／`gpt-5.6-luna`，均以 low 實跑已登入 Codex CLI；沒有替換成較大模型或改成獨立 AI 審題。照片整理與 32 個受控詞義的單字／五題型／補義／解說分開採樣，後者用相同人工來源隔離 OCR 差異，不宣稱是把每份照片回覆直接接成同一條端到端管線。題型各抽一個正式批次；文意選填第二輪另用十個不同詞的一義，驗證十格及每格九項完整錯項理由。

保留舊 backend bundle 作 baseline，所有請求在執行前保存；原圖不提交。回條保存在 ignored `artifacts/ai-quality/<phase>/<model>/<timestamp-id>/`，包含原始文字、schema、來源覆蓋、解析、可回收題目及用量。首次 parse 失敗只報第一個問題，不代表所有子題都失敗；以正式 step.recover 回收結果記錄可保留與待補來源。

採樣限定 baseline 照片、tuned 各階段及一次指定案例修復。子代理主要檢查錯義、明顯多解、來源範圍與解析對位；弱干擾、可更自然或未達完整學測風格列建議，不把結構通過率當作教學品質分數。詳細數量與待校對問題見 [本輪結果](luna-photo-evaluation.md) 及本地 content-review／run summary。

```powershell
# PowerShell 7；使用 Codex 帳戶額度，原圖目錄及 {lines:[...]} 參考檔由自己提供。
$env:CODEX_PROMPT_EVAL_CLI = (Get-Command codex).Source
node scripts/evaluate-photo-workflow.mjs --phase tuned `
  --images-dir '<五張 JPG 所在目錄>' --reference '<參考詞義 JSON>' --transport codex
```

CLI 回條未提供 actual model metadata 時保持 null，只記明確指定的模型，不自行補成 provider 確認。CLI 快取 token 包含其工具／系統上下文，API 費用保持未知；正式 Responses 路徑需要可用 API key，沒有自動 fallback，也沒有觸發正式部署。下列較早版本保留為歷史紀錄。

## 2026-10-03 獨立審題與攔截

本輪進一步只保留學測五種選擇題型，移除獨立 grammar 生成；文法仍可在 cloze 評量。
現行 writer 為 `lexiro-questions-20261003-v8`、review 為 `lexiro-question-review-20261003-v4`。
Reviewer 的固定規則、理由排序及格式要求集中在一個 developer block，difficulty 與
lengthRange 移到最後 user input，不產生空的 developer block。專案 tokenizer 計 writer
固定前綴 2,482、review 1,992 tokens，同題型跨來源／難度維持相同前綴與 schema。
本輪沒有新模型採樣或正式 cache hit 測量；必要 synthetic／D1 四個 gate 通過，測試為
156 項，另核對停用 grammar 在預留及 provider 前拒絕。下列 v3 子代理試審是前一版證據。

正式出題改為同一次預留內的初稿與 fresh 審題兩回合，不接續初稿 cursor，審題使用選定模型但至少 medium。審題稿帶逐題 explanation／whyWrong；不通過就拒絕整批，釋放預留，仍記錄各回合供應商成本。前一版 writer 為 `lexiro-questions-20261003-v7`、review 為 `lexiro-question-review-20261003-v3`。

對既有 34 道合成 low 初稿做不提供人工批註的 medium 盲審，原始資料保存在 private sibling `highschool-review-v1`／`highschool-review-v2`。第一版八個回合中兩份通過當時結構門檻，但人工仍發現搭配無效、干擾弱，以及閱讀正解與錯項同義；不是教學品質通過率。第二版只有三個真實回覆，其餘五個因 Codex 額度用盡未完成。三份分別被審題拒絕、篇幅門檻及原文跨度門檻擋下，不能把五個 CLI 失敗算成模型出題失敗。

第二版曾先寫 approved=true，後面的 whyWrong 卻承認 wary／cautious 或 estimate／measure 都合理；recover 也被改成原文不存在的字形。據此調整句子 schema 為先寫完整 sentence 再取 usage／answer，審題 schema 先列 corrected／unresolvedIssues、最後才判 approved，任一未解決問題非空即拒絕。[OpenAI Structured Outputs 文件](https://developers.openai.com/api/docs/guides/structured-outputs)確認回覆鍵順序跟隨 schema；這支持輸出順序的實作，不能證明模型判定必然正確。

前一版只再做一次 fresh `gpt-6-luna`／medium 子代理試審：直接讀當時正式 instructions／schema 和凍結的 latest 詞彙八題，不提供既有人工批註。JSON 符合 schema，但 approved=false，正式 admission 拒絕；即使獨立只檢查 corrected，也因 barked 不在原文而拒絕。人工另發現 retrieve 仍合理、pollution 的理由承認它也成立、release a gas leak 搭配不合法、isolate them 指涉錯誤，以及 estimate／measure 未排除。unresolvedIssues 空陣列與拒絕判定的診斷不一致，不能稱為完整成功審題。原請求、完整回覆及 `content-review.json` 保存在 private sibling `highschool-review-v3-subagent/`。此試審使用子代理工具，沒有正式 Responses API 的 constrained decoding、帳單或 cache metadata；不宣稱普遍改善或完整命題品質驗收。

`question-review-validation` 在交付及結算前檢查完整篇幅、底線、答案／usage 恰好一次、來源順序、選項唯一、空格跨度、完整非相鄰篇章句與跨句原文依據。它驗證可機器判定的條件，不證明全文唯一解、來源詞義、實質推論或鑑別度。機器與前端核對都通過後仍需人工校對。

本地合成 provider 與真正 D1 測試：157 項、typecheck、lint、build 通過，涵蓋兩回合修訂交付、拒絕不交初稿／退款、取消、同 session 不再扣、逐回合缺漏用量及 migration13。尚未驗收正式 provider、帳單、CPU、快取命中或 Firebase 生成。

### 現行 prompt cache 結構

Writer 把共用規則放在第一個 developer block，題型／難度放在後續 block，來源及修復資料最後放 user input。Reviewer 則把所有固定規則收在單一 developer block，動態欄位全部放 user input。固定前綴 1,992 tokens，explicit breakpoint 配合 30 分鐘 TTL；同題型跨來源、難度及初稿保持 schema 與固定前綴一致。Lite／Thinking 的 reviewer 都採 medium，Pro 採 high；不同模型、reasoning 或題型 schema 可能形成不同前綴，不能宣稱跨所有題型共用一次 cache。

依 [OpenAI prompt caching 文件](https://developers.openai.com/api/docs/guides/prompt-caching)，GPT-5.6 以上可快取前綴至少 1,024 visible input tokens，必須逐字一致，schema／模型設定也會影響匹配；cache key 可作分帳隔離，不需要靠 key 優化這些模型的路由。版本鍵只跟固定 prompt 契約走，不含 uid、session、來源或難度；保持單字／補義、整理、解釋的既有鍵。必要測試核對真正 upstreamRequest 的前綴、schema、reasoning、breakpoint、TTL 與無 writer cursor，實際命中仍以供應商 cache read／write tokens 為準。

```powershell
# 會消耗 Codex 額度；可用最後參數只選一類樣本。
$env:LEXIRO_REVIEW_EVAL_PHASE = "highschool-review-v4"
node scripts/evaluate-question-review.mjs latest-reading
```

腳本預設 phase 仍為 `highschool-review-v3`；評測現行版本時使用上述 `LEXIRO_REVIEW_EVAL_PHASE`，不要覆寫舊基準。每次另存 timestamp 快照，CLI 非零即停止後續樣本。其他歷史評測與來源說明保留如下。

## 2026-10-02 高中題目品質校準

本次依 [115 學年度起適用的學測英文考科考試說明](https://www.ceec.edu.tw/files/file_pool/1/0P091472305863258925/01_115%E5%AD%B8%E5%B9%B4%E5%BA%A6%E8%B5%B7%E9%81%A9%E7%94%A8%E5%AD%B8%E6%B8%AC%E8%8B%B1%E6%96%87%E8%80%83%E7%A7%91%E8%80%83%E8%A9%A6%E8%AA%AA%E6%98%8E.pdf) 與 [115 學測英文試題特色](https://www.ceec.edu.tw/xcepaper/cont?qunit=0Q105367191322447606&sid=0Q105583094870257539&xsmsid=0J066588036013658199) 調整六種題型。參考詞彙以第 1 至 5 級的 4,500 詞為主；難度取決於語境判讀、線索距離與跨句／篇章整合，避免依靠艱深詞或繁複句法。官方說明中的篇章約 180 至 400 詞作為校準依據，各題型與難度的實際長度仍是本產品的練習規格，統一讀取 `@lexiro/ai-contract` 的 `questionLengthRange`。

詞彙題現在要求一至兩句完整情境，同詞性與合適屈折的四個選項都能進入句法位置，至少兩個干擾項與情境相關，再由具體語意排除。文意選填完整題組採十格十選項；來源不足時減少空格並補足誘答詞，保留完整篇章長度。篇章結構維持四格五選項。

閱讀題要求主旨與不同閱讀任務，中等及進階納入跨句推論。錯項可以混淆文中人物或時序、擴大範圍、倒置因果或做過度推論，只要能由文本排除；不再要求所有錯項都與原文字面矛盾。選項長度與句法結構相近，避免正解總是最長、最具體或唯一直接回顯原文。

只有題目快取鍵改為 `lexiro-questions-20261002-v5`；單字、補充詞義、整理及解釋的快取鍵保留。這次本地檢查驗證出題介接與固定前綴，沒有呼叫付費生成 API；提示詞品質仍需以後續實際產出與人工內容審查確認，不能把結構驗證當成唯一解或教學品質保證。

## 2026-10-03 少量真實 CLI 評測

用已登入的 Codex CLI 執行 `gpt-6-luna`／low、read-only，回條確認模型與設定；僅採樣 `vocabulary-two-turn` 與 `reading-difficulty-2`。首次各兩輪，發現問題後各重跑一次，沒有擴大題型或全量重試。請求、原始回覆、回條與每輪結果存於 private sibling 的 `../lexiro-prompt-eval-private/highschool-v5/`；每次執行另有 `runs/<UTC timestamp>/` 快照，保留第一次結構通過但內容不合格的樣本。完整逐題審查見該目錄的 `content-review.json`。

詞彙初版 8 + 1 題全通過解析，但狗題只有陌生人開門、`so loudly` 及鄰居亮燈；`barked`、`growled`、`howled`、`whined` 均可合理代入，人工唯一解審查未通過。加入反向檢查錯項及聲音型態反例後，唯一一次重跑仍為 8 + 1 題解析通過，狗題改為 `short, sharp bursts`，已補上原先缺少的區別線索。

重跑的九題逐題審查仍發現多解：疾病後 `gradually began to recover` 可同樣使用 `improve`；用牆上水痕 `estimate how high the water had risen` 也可合理使用 `measure`。`rescue`／`guide`、`isolate`／`treat` 及情緒詞的排除還需要更明確語境；`contamination` 的錯項 `mixture` 在該句缺冠詞，干擾力也偏弱。最後補入這兩組已確認的近義詞反例，要求無法排除時更換錯項或重寫情境，不以常見程度、詞庫目標或「choose the best」作唯一解依據。這次最後的詞彙提示未再採樣，不能宣稱已證明普遍改善。

閱讀初版兩篇分別 277、267 詞，各四子題，解析通過；第一篇只有主旨與原句查找，並把目標 `reliable` 改成 `trusted`。第二篇所稱推論只是換詞重述已明說的梯子短缺。之後加上必填 `skill` 與逐字原文 `evidence`：至少主旨及兩種閱讀任務，中等以上必須有推論與來自不同句子的兩處依據。新契約唯一一次重跑產生兩篇各 261 詞的文章、各四子題；目標詞已實際出現，選項約 9–16 詞，最新四輪解析／重驗全通過。

閱讀內容仍未全面通過人工審查。第一篇推論題的主要依據已直接寫「因共用地圖與紀錄表而結果可靠」，第二句只提供一般回顧，並未增加必要推論資訊；錯項如「地圖讓溪水速度相同」也過於容易排除。第二篇問兒童初學書籍的 `shortage`，正解內容可由文章支持，`evidence` 卻引用花園水槽快空了的句子，文字存在而語意不相干。契約能強制閱讀任務欄位與原文依據，仍不能自動證明依據支持正解、跨句推論層級或錯項干擾力。

```powershell
node scripts/evaluate-ai-prompts.mjs --run highschool-v5 vocabulary-two-turn
node scripts/evaluate-ai-prompts.mjs --run highschool-v5 reading-difficulty-2
node scripts/validate-prompt-eval.mjs highschool-v5
```

前兩個命令使用 Codex 帳戶額度；最後一個只重驗已存回覆，寫入同一 private phase 的 `validation.json`。這是少量合成來源的診斷樣本，並非正式 Worker、Responses API 傳輸、付費 API、快取／計費或部署驗收；不把解析通過率當作題目品質通過率。

## 2026-09-24 快取與成本基準

獨立詞彙／文法題的 structured output 現在要求 `sentence`、`usage`、`answer`、`distractors`。`usage` 是模型自己填好片語佔位詞後，從句子逐字摘出的連續片段；`answer` 是單獨要挖空的連續片段。程式驗證 `usage` 在句中恰好一次，並用來源模板的固定詞順序核對，沒有「佔位詞最多幾字」的限制。文法題可以考 `usage` 之外的相關文法詞，詞彙題的 `answer` 必須是 `usage` 的目標字形。規則寫在共用前綴，題型差異留在穩定的題型區段，來源及修復訊息仍在後段。

以已登入 Codex CLI 的 `gpt-6-luna`/low 實跑 `phrase-usage-realizations`：三個來源 `convince sb of sth`、`turn down`、`give sb a hand` 都回傳含具體填入內容的 `usage`，前端組題解析通過 3/3。既有 `vocabulary-two-turn` 案例的新格式亦通過 8/8 加 1/1。這些是少量合成案例，證明回覆格式與解析可銜接；不是正式 Responses API 的快取命中或教學品質統計。

Responses 請求把所有使用者共用的規則放在 developer 訊息前段，最後才放來源、activeRefs、修復錯誤與追加要求。題目共用的 `TASK_RULES` 超過 1,024 tokens，並在固定前段結尾放 explicit breakpoint；題型專屬規則接在其後。`prompt_cache_key` 隨提示詞版號更新，ttl 為 30 分鐘。`service_tier: default` 固定 Standard 費率。這個安排避免動態來源佔據快取寫入段；依 [OpenAI prompt caching 文件](https://developers.openai.com/api/docs/guides/prompt-caching)，只有逐字相同的前綴可能命中，寫入成本為一般輸入的 1.25 倍，讀取為 0.1 倍。structured-output schema 與模型設定也可能讓前綴分流，因此僅憑本地 token 數不能宣稱生產命中率。管理員應觀察 Responses 回傳的 cache read／write tokens 與每次成本，再調整共用規則；不把一次性來源移入明確寫入段。

USD 報表逐筆按 [GPT-6 Luna Standard 費率](https://developers.openai.com/api/docs/models/gpt-6-luna) 計算，先將 input 拆成 fresh、cached、cache write，再加 output；輸入超過 272,000 tokens 的同一回覆改用長上下文倍率。每筆計算後才依模型、帳戶與題型加總，避免把整月用量誤認為單次長上下文。未知 usage 仍標記待核對。供應商價格估算不含其他基礎設施費用。

目前使用 private `src/generation.ts` 的 instructions/schema 與 sibling frontend 的實際 parser。執行 `node scripts/evaluate-ai-prompts.mjs --run optimized <case>` 會使用已登入 Codex 的 `gpt-6-luna`/low 額度；`node scripts/validate-prompt-eval.mjs` 只讀已存回覆。`LEXIRO_FRONTEND_PATH` 可指定前端 checkout。

最新 18 個回覆重驗通過 18/18，包含單義階段保留的題型案例、新多義回覆及文字／合成照片整理。多義人工檢查確認兩個指定義均保留、詞性與例句對應、沒有強行增加罕見義。原模糊片語案例曾漏義，修正提示後已重測，歷次失敗留在 runs 快照。

照片案例是本地生成的印刷清單，以 CLI `--image` 附加，不是正式 HTTP 圖片管線或任意手寫辨識驗收。所有模型評測結果都不能代替 Cloudflare CPU、正式 Firebase／D1 與部署驗收。

以下保留前期評測方法與歷史結果；舊 public frontend 路徑、medium 結果或單義 schema 不是目前介接方式。

# 出題提示詞與實測

2026-09-12。保留詞彙、文法、綜合測驗、文意選填、篇章結構、閱讀六種題型；一個單字／詞義一題仍是輕量練習的核心。以下校準參考真實試卷，不代表產生完整模擬考，也不宣稱符合每所學校的進度。

## 考卷依據

- [大考中心 115 學測英文原卷](https://www.ceec.edu.tw/files/file_pool/1/0q054532302653501476/02-115%E5%AD%B8%E6%B8%AC%E8%8B%B1%E6%96%87%E8%A9%A6%E5%8D%B7.pdf)：直接閱讀原卷及檢查版面。詞彙為獨立四選一；綜合測驗每篇五格，涵蓋詞彙、時態、片語與連接語；文意選填十格十選項；篇章結構四格五整句選項；閱讀每篇四題。
- [大考中心 115 英文試題特色](https://www.ceec.edu.tw/xcepaper/cont?qperoid=0Q105359543716106563&sid=0Q105583094870257539&xsmsid=0J066588036013658199)：以常見高中詞彙與語法考閱讀、分析及推論。詞彙題目標以參考詞彙表第 1–5 級為範圍，大多在第 4 級以下。
- [立人高中 114-1 英文試題公告](https://www.lzsh.tc.edu.tw/p/405-1000-4857,c110.php?Lang=zh-tw)：下載高一、高二原卷並逐頁檢查。兩份都有詞彙、綜合測驗、閱讀及混合題；高二另有十格文意選填、四格五選項篇章結構。文法融入綜合測驗、字形與翻譯。這是單一學校樣本，不能代表全台段考。

## 採用的調整

- 詞彙題保留一詞義一題；句型多樣化，干擾選項保留模型依語境設計的內容。要求同詞性、合理字形、相近語意領域，並有可排除的線索。
- 文法題考競爭形式，可接受不規則動詞及多字片語；目標詞仍須出現在句中，但可挖相關介系詞，例如 interested **in**。
- 綜合測驗同篇混合語意、文法及篇章線索；選項可為片語。
- 文意選填仍採適合短練習的最多八格、十選項；這是有意縮短的版本，並非學測原卷十格格式。進階避免在空格後直接給同義詞定義。
- 篇章結構四格五選項，要求前後指涉及邏輯都成立，不移除相鄰句，不僅靠 First／Next 等標記。
- 閱讀涵蓋主旨、細節、指涉、字義及推論；正解需要文本支持，干擾選項需要可排除的依據。
- 難度依線索距離及資訊整合調整。文章長度採練習用途的設計範圍：閱讀基礎 150–200、中等 220–300、進階 320–400 字；這不是大考中心規定的字數。
- 多義詞分配到不同篇章，避免同一拼字造成重複空格；保持全域來源 ref，續跑只處理指定來源，追加輪可再次使用同一來源出新題。

## 前次 medium 評測方法與限制

使用已登入的 Codex CLI 實際執行 `gpt-5.6-luna`、`model_reasoning_effort="medium"`，檢查執行回條中的模型與 effort。測試使用合成單字及情境，沒有將整份考卷餵給模型或複製進專案。原始 prompts、回覆與解析結果存於 `artifacts/prompt-eval/`。

這些請求以完整歷史重播測試提示詞和程式解析，並非瀏覽器直接呼叫各家公開 API 的測試；不能據此推估快取命中、帳單或延遲。每案例少量抽樣也不是統計品質保證。JSON 與資料驗證通過，不等於題目必然沒有多解，因此另做內容檢查。

當時使用 `node scripts/evaluate-ai-prompts.mjs --run final`；以下歷史結果仍是 medium，不能當成本次 low 的驗收證據。

## 前次 medium 實測結果

初始 14 輪有 12 輪通過當時的程式驗證；失敗為文意選填重複答案，以及不規則動詞／文法題的驗證限制。經多輪調整，最新各案例合計 14 份回覆，以最終解析器重驗為 **14/14 通過**，包含 9 題詞彙、5 題文法、3 筆詞義與 10 個文章題組。詳見 `artifacts/prompt-eval/validation.json`；這是提示詞與解析器共同改善後的結果，不是固定解析器下的純提示詞 A/B 分數。

其中詞彙題的 `searched for` 片語干擾選項最初被程式錯誤過濾；保留原始失敗紀錄，修正後直接重驗同一份模型回覆，沒有假稱重新生成成功。`final-tuned` 是內容審查後的針對性重測，其他案例沿用 `final`。規劃 agents 寫入 fixtures 的示例不計入實測。

內容抽查確認：詞彙句型不再整批以 Although 起頭；`run into` 從混合「遇見／撞上」改為單一「偶然遇見」；文意選填答案不再重複，進階線索由直接同義詞改為行為及結果；文法能保留合法時態與片語選項。也要求排除 staff has／have 這類英美皆可接受的文法差異。

另由 agent 檢查四份篇章結構的四個實際空格與五個選項，未發現第二種合理完整排列；四份閱讀未發現多個正解，`current` 的「水流／目前的」義項及來源 ref 已區分。進階閱讀的雨後水流比較、人力不足導致精簡菜單都有跨句文本依據。主旨題對單一詞義的關聯仍可能較寬，這不等同每道閱讀題都在測指定單字。

仍需預覽的部分：某些中等題仍偏直接，篇章的局部表述與場景連續性偶有生硬處，詞義、答案唯一性和實際難度無法由 JSON 檢查保證。此輪未把少量生成樣本當作正式試題品質認證。

程式檢查：157 個測試通過，TypeScript、lint 與 production build 通過。`node scripts/validate-prompt-eval.mjs` 可不消耗模型用量地重驗已保存回覆。

## 後端藍圖：low 固定前綴評測

2026-09-12 改用 `gpt-5.6-luna`、`model_reasoning_effort="low"`，每次檢查 CLI 回條的實際模型與 effort。新產物放在 public repo 外的 `../lexiro-prompt-eval-private/`；不再把本次提示詞與回覆加入公開版控。執行器會保留每次執行的 `runs/<timestamp>/` 副本，失敗案例會讓指令以非零狀態結束，沒有匹配到案例也會報錯。

在修改 prompt 前，以原程式重新跑 low 基準：`final/` 的 14 輪有 13 輪通過。進階篇章結構第二輪的 removals 與 passage 用字不一致，程式找不到完整原句。

本次候選將十三種詞性的判斷準則、邊界案例、字義好壞對照與固定輸出範例放在來源之前；例句固定必填，移除原本的開關和參數。題目提示加上短練習規格及答案逐字取自最終文章的對照。使用同一批案例重新跑 low，14 輪全部通過；再加入詞性邊界案例，最新回覆重驗為 **15/15 通過**。單字 schema 同時改為強制例句，因此這是提示詞與輸出契約一同調整的驗證，不能宣稱是固定 schema 的純 A/B 品質提升。

人工檢查發現新詞性案例第一版雖通過解析，can「能夠」卻配了許可語意的借傘例句。增加能力／許可對照後，重新執行的例句改為游泳能力；have 的完成式與擁有義、片語動詞與一般片語亦符合指定語意。這也说明 JSON 通過不足以取代語意檢查。單次抽樣的 15/15 不代表所有實際題目都會唯一解。

`tests-next/prompt-prefix.test.ts` 驗證不同輸入產生的固定段位元組相同，並以 o200k tokenizer 計算至少 1,024 tokens；這是本地前綴條件檢查，並非 Responses API 快取命中的實測。

重跑目前提示：`node scripts/evaluate-ai-prompts.mjs --run optimized`，可在最後指定案例 ID 子字串。`node scripts/validate-prompt-eval.mjs` 重驗本次 `optimized/` 最新回覆。`--run final` 仍會執行當下程式，不能用它覆寫本次修改前的基準後，還將新結果稱為舊基準。

本次尚未實作多詞義輸出、文字／照片整理與 Worker 切換；其 baseline 和端到端驗收仍待對應階段。CLI 測試不代表 Workers CPU、HTTP 串流、API 帳單或快取測試。
