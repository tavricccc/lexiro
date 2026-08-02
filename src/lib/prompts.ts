const PROMPTS = {
  generateWordSet: `你是英文單字教材編輯。請根據提供的英文單字或片語，產生可直接匯入 lexiro 的 JSON。

【生成規則】
- 只處理程式提供的 sourceRef，不要自行新增、刪除或合併；每個 sourceRef 必須輸出一次。
- word 必須原樣對應 sourceRef 的英文單字或片語；不要把中文提示放進 word。
- 為每個單字提供常見且精確的詞性，以及繁體中文意思。
- 每個單字最多提供三個常見 senses。
- 不要生成選擇題或閱讀題。{{EXAMPLES_RULE}}
- 不論使用者輸入順序，輸出時請按單字 A-Z 字母順序排列。

【輸出規則】
- 只輸出可被 JSON.parse 直接解析的單一 JSON object；不要 Markdown、註解或說明文字。
- 最外層必須是單一 object，格式如下：
-{"kind":"words","words":[{"sourceRef":"source-1","word":"單字","senses":[{"pos":"n.","meaningZh":"繁體中文意思","examples":[]}]}]}
- words 數量必須與 sourceRef 數量相同，不能遺漏、重複或自行新增。
- 每筆 word 必須包含 sourceRef、word 和 senses；每個 sense 必須包含 pos、meaningZh、examples。
- pos 只能使用 n.、v.、adj.、adv.、pron.、prep.、conj.、interj.、det.、aux.、modal v.、phr. v.、phr.。

【使用者原始輸入】
{{INPUT}}

【程式提供的 sourceRef 對照】
{{SOURCES}}`,

  explainQuestion: `請用繁體中文詳細解析這一題英文單字選擇題，幫我理解正確答案與其他選項為什麼不適合。

請用以下格式回答：
題目：[完整題目]
我的答案：[我選的答案；如果我沒作答請寫「未作答」]
正確答案：[正確答案]
解析：
- 正確答案為什麼正確
- 每個錯誤選項為什麼不適合這個語境
- 補充這個單字在題目中的用法、語氣或常見搭配

題目：{{QUESTION}}
選項：
{{OPTIONS}}
我的答案：{{USER_ANSWER}}
正確答案：{{CORRECT_ANSWER}}
單字字義：{{MEANING}}
例句：{{EXAMPLE}}`,

  explainAllWrongQuestions: `我剛剛完成了一次英文單字測驗，以下是我答錯的題目。請以繁體中文擔任耐心但精準的英文老師，逐題解析並幫我建立可執行的複習方式。

請依序針對每一題提供解析：
1. 選擇題請解釋為何正確答案適合，以及其他選項（若有）為何不適合。
2. 提供這些單字常見的搭配用法。
3. 最後歸納我的錯誤模式。
4. 不要捏造字源；不確定時直接省略字源說明。

以下是我的錯題列表：
{{WRONG_QUESTIONS}}`,
}

export default PROMPTS
