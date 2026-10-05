# 生成連線、批次與快取

## Pi 原始碼參考

研究版本為 earendil-works/pi 的 b2b5c42f6138b73ec4b2f49ec0ca468800f88586。

- [Codex transport](https://github.com/earendil-works/pi/blob/b2b5c42f6138b73ec4b2f49ec0ca468800f88586/packages/ai/src/api/openai-codex-responses.ts) 使用 session 的 WebSocket pool；websocket-cached 在歷史前綴與原請求設定相符時，送 previous_response_id 與新增 input。這減少傳輸與延續開銷，適用延續對話。
- [API key Responses path](https://github.com/earendil-works/pi/blob/b2b5c42f6138b73ec4b2f49ec0ca468800f88586/packages/ai/src/api/openai-responses.ts) 使用 Responses SDK 的 HTTP stream；Pi 的不同 provider 路徑並非都使用相同 WebSocket transport。
- [Cache warming 設定](https://github.com/earendil-works/pi/blob/b2b5c42f6138b73ec4b2f49ec0ca468800f88586/packages/coding-agent/docs/settings.md) 只在估計可避免足夠 cache miss 費用時 refresh；refresh 用量仍計費。Lexiro 的短時流程使用實際第一批產出暖前綴，不額外生成暖快取稿。

## Lexiro 的實作

詞彙題每批由 8 增至 16 個詞義，53 個來源由 7 批減至 4 批。單字最多 30 個來源且 raw 不超過 5,000 字元。文章題組仍按格式保持完整；8192 輸出 token 上限包含思考，用語更聰明不表示可無限增大回覆。

第一批完成後，最多兩個獨立批次同時產出；同一條 WebSocket 用 stream_id 分流，避免反覆握手，也避免回覆混用。Socket 閒置 60 秒關閉。每個子工作有獨立的 operation ID、重連、驗證、局部修復與用量。父流程按來源順序合併已接受成果；每批 TPS 各自以 tokens／耗時計算。

每批不送前一批的輸出；固定 developer 前綴、schema、breakpoints 及 30 分鐘 retention 保持一致，來源在尾端。題目因 16 題與精簡解說更新為 v10，其餘 prompt key 不改。並行加速不會降低輸出 token 的單價，也不能以命中比例冒充總費用下降。

一般帳號同 session 可有兩個預留，其他 session 保持互斥。每 attempt 都有自己的 lease；未結算的另一個 hold 必須保留，不能把第一批結算後的負預留提前歸零。結算、退款與費用報表仍逐 response 記錄。

## 真實供應商快取驗證

首次發布的 commit 標記 [cache-probe] 會在部署前測試 gpt-6-luna／low、gpt-5.6-luna／low、Pro 的 gpt-6.1-sol／low。每條路由先一個實際請求暖快取，再兩個並行請求；每次最多 128 output tokens，共九次。輸入另計費，不寫入使用者 D1 帳目。以實際 input_tokens_details.cached_tokens 判斷，兩個並行回條都需至少 1,024 cache read tokens；失敗停止部署。

回條只列模型、input／cache read／cache write／output、首事件與完成時間及估計 USD，不列 prompt、生成內容或 key。這確認 multiplexing 與 cache read，不代表 16 題的教育品質、手機體感速度或 Workers 免費 CPU 額度已實測。

需要重查時執行：

```powershell
gh workflow run deploy.yml --repo tavricccc/lexiro-worker -f verify_cache=true
gh run list --repo tavricccc/lexiro-worker --limit 3
```

此操作會執行小額付費 probe 並部署；一般 push 只做無生成的 WebSocket handshake，避免每次發版重複付 probe 費用。

[官方 Prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching) 規定 GPT-5.6 之後的顯式前綴至少 1,024 visible tokens，30m retention 於 reuse 時刷新；模型／區域／前綴及設定需保持匹配。[Responses WebSocket](https://developers.openai.com/api/docs/guides/websocket-mode) 說明不同 stream_id 可以並行，每 lane 的 previous_response_id 是另一個獨立概念。
