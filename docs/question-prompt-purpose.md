# 目的、示範與逐題檢查的出題提示

這輪已實作並分別凍結 v20–v23 候選，效能與題目語意由主代理控制 A/B。離線契約檢查及本地測試不能當作 Luna 已穩定出題的證據。v19 的五型首次／一次回收結果保留於 [前輪校準](luna-question-quality-20261009.md)。

## 命題出發點

每題先決定學習者要辨認的詞義、詞形、銜接或推論，再決定能讓該辨析成立的文本證據。來源詞是教材，不是宣布正解的理由。題幹以觀察、行動、數量、因果和順序提供線索，錯項解說回到實際文本。

v23 共用 brief 包含一個完整 take off 正例及一個機械計時器反例。正例用脫鞋前後的具體結果辨認動作，完整答案與候選替換相同的空格範圍。反例呈現 fixed schedule 同樣支持 automatic；指定來源 mechanical 並不能排除另一合理答案。閱讀規則另有完整單題正反例：只有一台顯微鏡加上三組同時需要使用，才推出協調使用時間；兩個引用若其中一句已明說答案，應標 detail，另出真正的 inference。

每完成一題，按以下順序核對，再寫下一題：

1. 學習目的與證據。
2. 選出對應同一辨析點的候選。
3. 用自然情境提供足夠正面線索。
4. 定位 usage，遮掉精確 answer，再將候選逐一插入學習者真正看到的空格。
5. 錯項理由是否有剩餘本文依據，不能以原本的答案字證明答案。
6. 來源詞義、合法詞形、原文 span、實際選項覆蓋及可讀性。

全部子題完成後再檢查共享題組的完整配置、未用候選、相鄰線索及題間答案洩漏。這是同一次 writer 的內容檢查，沒有新增 paid reviewer、額外 HTTP 回合、可見推理欄位或檢查紀錄。正常教學解析仍使用繁體中文。

## v23 實際空格與可觀察線索

usage 只定位，程式實際挖掉的是 answer。若原文是 `Mira took her muddy shoes off beside the door`，answer 取完整 `took her muddy shoes off`，候選可用 `put her muddy shoes on`，代入後仍是完整自然的句子；若 answer 只取 `took` 卻沿用該候選，就會留下 `put her muddy shoes on her muddy shoes off`。頭詞或完整片語都可以，但每個候選須配合空格外保留的助動詞、受詞和 particle，不能只比較 JSON 裡的詞義。這不要求每個選項字數完全相同。

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

## 凍結與對照

`artifacts/ai-quality/20261009-purpose-prompts/` 保留不可覆寫的 baseline v19、其五型原 prepared requests、reference 及各版候選／manifest。v20 用於目的與例子；v21 對齊詞彙 usage 定位；v22 對齊文章型 usage；v23 補實際剪空格／片語替換與可觀察線索。vocabulary 的 v21／v22 raw schema 相同；v23 僅修改 answer 描述，A/B 可用 evaluator 的 `--schema-module` 固定同一 schema。舊文章型 raw 在新的 v3 parser 不相容，這種拒收不能計成舊模型語意失敗。

v22 共用前綴 1,760 tokens；v23 共用前綴 2,154，詞彙 2,464、cloze 2,830、WordBank 2,617、discourse 2,490、reading 3,088 固定 instructions tokens。這是本地 tokenizer 計數，沒有證明正式快取命中。現行 `lexiro-questions-20261009-v23`／`lexiro-question-item-20261009-v14` 只更新題目契約；words、senses、organizeText、explain 的 instructions、schema、cache key 與凍結 v19 逐項相同。詞彙批次 1／4／8／16 配合難度 1／2／3 的十二種組合均保持相同固定 instructions 與 schema。

v23 bundle 是 `candidate-v23-backend.mjs`，SHA-256 `6111661bff5635f53cbd1a737a7aa529d106201e26d891b1a713ee1e2468decf`；同目錄 manifest 保存每個來源檔、schema、版本及 tokenizer 數值。凍結候選不能在模型輪次中途覆寫。

批次 1／4／8／16 與並行 1／2 的對照由主代理控制，固定來源排序、難度、model／effort 及同一前端 parser，再分開量測整輪時間、首次／native partial recovery 與語意品質。尚未依本文自行選定正式預設，也未升級 tier。候選 freeze 以 local vendor 4 編譯供 CLI prepare；HTTP v3 header 及最終全面 gate 需和 root 最後的 vendor 5 pack 一起整合。

v23 在上述 vendor 4 工作區完成 typecheck、lint、build 與 15 個測試檔／174 個測試，包含 stream lane 重用；此結果不是 v3 HTTP 整合或實際模型品質驗收。提示代理在這輪沒有發新模型請求，對照請求由主代理統一派送。

[OpenAI reasoning best practices](https://developers.openai.com/api/docs/guides/reasoning-best-practices) 支持明確完成標準與貼近任務的示範，不要求模型輸出思考步驟。[Latency optimization](https://developers.openai.com/api/docs/guides/latency-optimization) 說明小模型可嘗試較詳細提示與例子、獨立工作可並行；這些是評測方向，並非本專案的品質或甜蜜點結論。
