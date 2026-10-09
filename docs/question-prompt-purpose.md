# 目的、示範與逐題檢查的出題提示

這輪已實作並分別凍結 v20–v25 候選，效能與題目語意由主代理控制 A/B。離線契約檢查及本地測試不能當作 Luna 已穩定出題的證據。v19 的五型首次／一次回收結果保留於 [前輪校準](luna-question-quality-20261009.md)。

## 命題出發點

每題先決定學習者要辨認的詞義、詞形、銜接或推論，再決定能讓該辨析成立的文本證據。來源詞是教材，不是宣布正解的理由。題幹以觀察、行動、數量、因果和順序提供線索，錯項解說回到實際文本。

v24 共用 brief 包含 be 與 look forward to 的完整單題正例，並以實際回填句示範 bright／performing 重複的反例。機械計時器的短對照保留 fixed schedule 同樣支持 automatic 的根因；指定來源 mechanical 並不能排除另一合理答案。閱讀規則另有完整單題正反例：只有一台顯微鏡加上三組同時需要使用，才推出協調使用時間；兩個引用若其中一句已明說答案，應標 detail，另出真正的 inference。

每完成一題，按以下順序核對，再寫下一題：

1. 學習目的與證據。
2. 用自然情境提供足夠正面線索。
3. 定位 usage，決定並遮掉精確 answer，確認學習者真正看到的空格。
4. 才選出對應同一辨析點、適合該空格的候選，再逐一填回。
5. 錯項理由是否有剩餘本文依據，不能以原本的答案字證明答案。
6. 來源詞義、合法詞形、原文 span、實際選項覆蓋及可讀性。

全部子題完成後再檢查共享題組的完整配置、未用候選、相鄰線索及題間答案洩漏。這是同一次 writer 的內容檢查，沒有新增 paid reviewer、額外 HTTP 回合、可見推理欄位或檢查紀錄。正常教學解析仍使用繁體中文。

## 實際空格與可觀察線索

usage 只定位，程式實際挖掉的是 answer。v24 schema 與 writer 一致依 `sentence → usage → answer → distractors → teaching` 決定範圍，再選候選，修正先寫干擾項、後來卻挖局部答案的順序衝突。`both signs were bright` 若只挖 were，候選是 was／are／is；was bright 會留下 bright bright。`look forward to performing` 若只挖 look forward to，候選不能再帶 performing。頭詞、固定片語或整段動作都可，但每個選項須配合保留的冠詞、助動詞、受詞及 particle；例如留下 an 時，donation 不能直接填成 an donation。這不要求選項字數完全相同。

被 answer 一起挖掉的地點、動作或屬性，也不能當排除候選的證據。理由須回到剩餘句意，不用「未提及 X 所以 X 不可能」或「X 通常 Y 所以一定不 Z」排錯；近義或獨立屬性若同樣自然，應調整情境或候選。這些是 writer 的品質檢查，沒有新增前端語意猜測門檻。

短對照另示範 loud dog 不能單靠聲量排除 howl；一連串短促、間隔的 woof 是 bark 的可觀察線索。見到搶案也不能宣告一個人不是 victim／suspect；應以他在該調查提供獨立見聞的實際角色命題。較弱但可排除的候選可用，不把「人物可能還有另一屬性」一概判成多解；必須看代入後的完整句意。

## 消除互相牴觸的要求

- 閱讀只要求 supporting evidence 逐字引用，答案可改述或推論；不再把挖空題的「答案必須存在原文」套到 inference 結論。
- 詞義題候選以句意區分；be／aux／形態用法可由真正句法選形，不再一律要求四個選項文法都正確。
- 來源 POS 引導預期詞義，不拿它否定其他常見詞性或名詞修飾語。標準英美屈折、同 lemma 的自然用法與可分離片語可用；顯式派生詞仍另列來源。
- take off 可實現為 took her coat off，usage 保留完整連續原文，固定詞可被受詞隔開。be made up of 可實現為 is made up of three parts，實際空格可取 made。
- cloze 單題修復可用既有原文的來源詞或相關 grammar span，不再強迫所有 grammar blank 回到 source 字形，也不移動文章來假修固定 bank。

## 語法題的學習目的

綜合測驗將語法和詞義放在同一篇連貫文章。完整五格有兩個語法選形、三個詞義／搭配；語法位置由自然篇章決定，維持 activeRef／index 的對應順序。較少格的比例只放在 user specification：

| 格數 | 語法選形 | 詞義／搭配 |
| --- | --- | --- |
| 1 | 0 | 1 |
| 2 | 1 | 1 |
| 3 | 1 | 2 |
| 4 | 2 | 2 |
| 5 | 2 | 3 |

兩個完整單格示範是 had [been] completed 與 could [estimate]，選擇詞形由空格外的助動詞決定。單純偏好 had cracked／cracked 的完整時態不等於唯一選形。這些示範不是要求每篇都複製同一故事或固定前兩個來源。

## v22 原文錨點契約

intended raw 契約為 `@lexiro/ai-contract` 5.0.0／`single-pass-v3`。cloze、wordBank 的 blanks 及 itemRepair 必須先輸出 usage，再輸出 answer；不接受省略 usage 的舊 raw。

- usage 是原句／全文中唯一的完整連續 substring；answer 只需在自己的 usage 內恰好一個完整詞邊界。
- 正文其他地方可再出現 is／are 等普通詞，依 usage offset 定位真正空格。
- cloze 的不同 usage 可有同一 answer，如 is unsafe 與 is reserved。實際空格不得重疊。
- WordBank 仍有十個去重候選、完整答案映射及一對一空格配置；片語可挖內部固定詞，沒有 usage-less 的 sourcehead 猜測。未用普通候選出現在其他原文位置不會一律拒收。
- Discourse 的未用候選是完整句子，仍須在全文之外且與已知敘事不相容。

儲存後的 normalized 題目形狀不變。Dormant reviewer 的結構門檻已同步 usage 定位及 cloze 重複答案，仍未接回正式入口。

## v25 文意選填的來源綁定

WordBank 每個 blank 必須先輸出 `ref`，再寫 usage／answer／teaching。ref 是固定 `^s[1-9]\d*$` 字串，逐字複製該來源的 ref；schema 不依本批來源產生動態 enum。每個來源恰好一次，空格陣列可按文章順序，不能用第 n 個空格猜它屬於第 n 個來源。實際顯示順序仍由 usage offset 排定。前端對 WordBank 用本批 `s1..sn` 綁定，step ID 與其他題型原本的來源策略不變。

itemRepair 的 index 指既有 raw item 位置。Worker 從 `items[index].ref` 取得 targetRef，驗證格式與它確實存在於 sources，再放入 user JSON；修復保留這個 ref，不重標其他來源。缺失／未知 ref 或不存在的 raw index 直接拒收。必要測試以 raw index 0 的 ref=s2 對應 sources[1]，確認來源不會被錯綁為 s1。Dormant reviewer 同步每個來源恰好一次的結構門檻，沒有重新啟用付費 reviewer。

這是生成 raw 邊界的 migration，不接受無 ref 的舊 WordBank 回覆，儲存後 normalized 資料不用改。public 5.0.0／single-pass-v3 尚未部署，沒有另改 packet；舊 v24 回覆與當時載入的 parser 界線原封保留，不用新 ref 門檻改寫舊模型語意分數。

## 凍結與對照

`artifacts/ai-quality/20261009-purpose-prompts/` 保留不可覆寫的 baseline v19、其五型原 prepared requests、reference 及各版候選／manifest。v20 用於目的與例子；v21 對齊詞彙 usage 定位；v22 對齊文章型 usage；v23 補實際剪空格／片語替換與可觀察線索；v24 改為先決定空格再選候選，整合兩個實際粒度反例；v25 只新增 WordBank 的明確來源綁定。vocabulary 的 v21／v22 raw schema 相同；v23 修改 answer 描述，v24 再改 property order 和 distractors 描述，字段型態不變。v25 的其他四題型 instructions／schema／cachePrefix 與 v24 逐項相同，共用命題文字也沒有增加。A/B 可用 evaluator 的 `--schema-module` 固定同一 schema。舊文章型 raw 在新的 v3 parser 不相容，這種拒收不能計成舊模型語意失敗。

v22 共用前綴 1,760 tokens；v23 為 2,154，v24 精煉為 2,083，v25 維持 2,083。v25 詞彙 2,405、cloze 2,759、WordBank 2,591、discourse 2,419、reading 3,017 固定 instructions tokens。這是本地 tokenizer 計數，沒有證明正式快取命中。本次題目鍵升 `lexiro-questions-20261009-v25`、itemRepair 升 `lexiro-question-item-20261009-v15`，因 WordBank schema／修復資料契約已變；words、senses、organizeText、explain 的 instructions、schema、cache key 與凍結 v19 逐項相同。詞彙批次 1／4／8／16 配合難度 1／2／3 的十二種組合均保持相同固定 instructions 與 schema。

v25 bundle 是 `candidate-v25-backend.mjs`，SHA-256 `be4ff203828e48d7027967ca9c6d44143a50a0dc8004005f742767d2f10a7e37`；同目錄 manifest 保存每個來源檔、schema、版本、raw index／targetRef 的實例及 tokenizer 數值。原 v24 與更早 bundle、所有實驗原稿均不變，凍結候選不能在模型輪次中途覆寫。

批次 1／4／8／16 與有界並行的對照由主代理控制，固定來源排序、難度、model／effort 及同一前端 parser，再分開量測整輪時間、首次／native partial recovery 與語意品質。正式批次和並行的比較及決策見 [工作量評測](luna-workload-evaluation.md)，tier 沒有升級。v20–v23 freeze 使用 local vendor 4；v24 已使用 vendor 5，HTTP v3 與並行配置的最終全面 gate 由主代理統一整合。

v23 在 vendor 4 工作區完成 typecheck、lint、build 與 15 個測試檔／174 個測試；v24 在 vendor 5 通過 typecheck、lint 與三個目標測試檔／43 個測試；v25 通過 typecheck、lint 與四個目標測試檔／48 個測試。這些不是模型品質驗收；最終全面 gate 保留給主代理的 runtime／並行整合。提示代理在這輪沒有發新模型請求，對照請求由主代理統一派送。

## v23 每批四題的獨立語意覆核

只讀 `2026-10-09T14-38-14-121Z-26d56e2b` 的六份 raw response，遮實際 answer 後逐項填回，覆核 24 題與 72 個理由。此份獨立分類為 9 題 usable、7 題 advisory、8 題 needsFix。範圍錯誤是 were 留下 bright、look forward to 留下 performing，錯項卻再帶相同字；另有 bank 的設施／位置硬排除、雨衣 carried 後掛起仍合理、stayed 郵局不能返校的錯誤解說，以及測量／情節的排他性不足。rescue、witness、turn off 有保留的實際證據；bark 有聲型線索但後文洩漏 barked，列 advisory。mechanical／digital、reliable 的其他屬性及部分弱項保留為建議，沒有一概判多解。

報告是同輪 ignored `review-v23-b4-quality.json`，readable JSON 與報告均以不同名稱／不可覆寫方式建立。此審核沒有讀任何 native recovery、parser metrics 或其他代理報告；24 是 fresh raw 審查數，不能改稱修復後通過率。後續候選實測分開記錄，沒有以離線例子冒稱穩定。

## v24 low 四題批次的獨立語意覆核

審查 `2026-10-09T14-59-08-293Z-0f95665f` 的全部 24 題 fresh raw／72 理由，分類為 6 題 usable、9 題 advisory、9 題 needsFix。be 和 look forward to 在此樣本不再重複空格外的形容詞／performing，nervous 理由也承認情緒可共存；但 mechanical 的 a electronic、shortage 的 a a、go 的 from to／outside to 尚未修好。rescue 的 carried、plot 的 character、child 的 student，以及 turn off 的空白畫面和 get used to 的前後時間，也仍有合理替代或排除理由缺口。近義 investment／expense 和部分弱項列 advisory，沒有一律當多解。

第 6／8／16／17 題依本次英文計數為 24／24／27／26 詞，低於既定進階 28–48；篇幅記結構欄，不把它們都判語意錯。報告位於 purpose-prompts 的 ignored `review-v24-b4-low-quality.json`，另存六份獨立命名 readable JSON。Native 保留 20／24 是主代理回報的結構回收結果，沒有審任何 recovery 新稿，不能把它當品質百分比。v23 的對照用 medium、此輪用 low 且場景不同，這些觀察也不能單獨歸因為提示改善或模型優劣。

[OpenAI reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices) 支持明確完成標準與貼近任務的示範，不要求模型輸出思考步驟。[Latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization) 說明小模型可嘗試較詳細提示與例子、獨立工作可並行；這些是評測方向，並非本專案的品質或甜蜜點結論。
