# AI 生成與 API

Browser 只送 Firebase-authenticated 的來源資料到 `NEXT_PUBLIC_AI_WORKER_URL`。Private Worker 保存 prompt、output schema、provider key、計費與管理設定；前端沒有 provider key 或手動 prompt 面板。

## 請求與串流

| 入口 | 請求與責任 |
| --- | --- |
| `GET /me` | 登入帳號點數、月額度、續期與 admin 身份 |
| `POST /generate` | JSON：kind、model、session、tier 與 raw／sources；可帶 repair；X-Generation-Id 固定同一次操作 |
| `GET /generation/{session}/{id}` | 登入者取回自己的原任務串流或已完成結果，不再次呼叫模型 |
| `POST /organize` | 文字 JSON，或 text/plain 的多張 WebP base64 |
| `/admin/accounts`、`/admin/accounts/{uid}` | 管理帳號、cursor 翻頁與 expected PATCH |
| `/admin/usage` | 近 30 天、各模型／工作／帳號的用量與未知成本 |
| `/admin/settings` | 新帳號初值與免費試用，expected PATCH |

`managed-client.ts` 只在 401 強制刷新 token 一次。串流消費 Responses text events，累計每個 response 的 usage；帳號改變會中止／拒絕舊結果。Worker 用白名單重建 Response metadata，移除 instructions／input／prompt 回顯並中和上游錯誤。前端逐項解析完整 JSON 物件，立即顯示題數與詞義數；這是已解析數，完成數仍以整批驗證為準。

已驗證管理員的生成錯誤另附 diagnostic：出稿／審題階段、實際模型與 reasoning、上游 HTTP 狀態、request ID 及 code／param／type／message。HTTP 與 SSE 都保留診斷至管理員面板；供應商 key 遮蔽，不轉發 request body、prompt 或其他回應欄位。一般帳號不接收此欄位。

題目請求帶 `X-Question-Contract: single-pass-v1`。舊版或缺少此契約的請求在預留與 provider 呼叫前回 426／`question_update_required`，需先啟用 App 更新。

題型只接受 vocabulary、cloze、wordBank、discourse、reading；停用的 grammar 在預留前回 400／invalid_input。題目固定規則在快取前綴，來源、初稿、難度及 lengthRange 留在最後輸入。只更新題目 writer／review 的版本，單字、補義、整理及解釋的快取保留；實際命中看供應商回報。

Session 在開始時固定模型、檔位與 UUID，每批不帶 previous_response_id，上下文獨立。Worker 以每帳號／session 的 Durable Object 管理工作，與供應商用 WebSocket 連線，手機仍透過 SSE 接收。固定 prompt／schema／cache key 不變，只有本批來源在動態尾端；快取命中以 provider usage 為準。

生成需帶 X-Generation-Id，缺少時回 426，啟用 App 更新後使用新介面。斷線自動接回原任務，四次連線失敗後可在同頁面手動續跑；暫停只停止瀏覽器接收與後續批次，本批後端仍會完成。每批上限 10 分鐘，完成／失敗結果保存至任務開始後 30 分鐘，以 alarm 清除。圖片與私有提示只存在執行中的記憶體，不存入 Durable Object；短暫保存來源、輸出及結算 metadata 用於回放。重新整理會失去瀏覽器的 pending 任務 ID；流程草稿仍保存已完成且可校對的成果。

## 批次與校對

`src/lib/ai/tasks.ts`：單字每批 25 個來源、補充多義每批十字；題目批次由 `splitGenerationBatches` 決定，詞彙每批最多八個來源。Runner 依序執行並保留有效部分，來源的 ref 跟著內容傳遞。

所有 AI 題目及解說同次生成，暫停獨立模型審題。前端保留篇幅、跨度、閱讀依據與格式驗證；有效題目保留，錯誤詞彙題逐題重生，文章題保留原文與有效子題，只重生錯誤子題。無法修復的文章錯誤停止該段，讓使用者手動重試。句子題完整寫出 sentence，再取 usage／answer，程式負責挖空及排序。校對一次看一題／題組，可取消納入後儲存選取項目；逐題解說與錯項理由跟選項保存。語意與唯一解仍須人工校對。

照片確認後先縮 WebP，每張最多 1.5 MB、長邊 1800；每批 1-10 張。text/plain 每行一張 base64，整批上限 20,000,009 bytes，headers 帶 `X-Session-Id`、`X-AI-Model`、`X-AI-Tier`。Worker 驗證後一次送多圖片 Responses request，圖片不落地。不同批次依序執行，已完成部分保留。

照片整理只驗 lines 陣列、長度與格式。Prompt 對來源範圍的要求不等於 deterministic 語意過濾；沒有可證明自動排除所有相關詞／同反義詞的來源追溯檢查。

## 模型、估算與結算

共用 contract 3.2.0 接受 `gpt-5.6-luna` 與 `gpt-6-luna` 偏好，預設後者；Pro 由 Worker 統一送 `gpt-6.1-sol`、`reasoning: { effort: "low" }`。Lite／Thinking 使用所選 Luna 的 low／medium。帳號模型偏好保存在本機及 owner-only Firestore preferences/ai；整理文字與照片可另選模型與檔位，保存於流程草稿。Lite／Thinking／Pro 估算倍率為 1／2／20；Pro 的估算不再乘 Luna 家族因子。實扣按供應商回報 usage，估算不是扣款保證。[官方 Sol 規格與費率](https://developers.openai.com/api/docs/models/gpt-6.1-sol)。

題目估算已移除第二次審題的係數；失敗子題的重生仍會消耗供應商用量，估算不是實測成本上界。`TokenUsage.parts` 保留每次 response 用量，各自計價後加總。用量缺漏維持未知並逐 cursor 補查。

程式 `MODEL_PRICES` 記錄 Standard／cache read／cache write／output 的採用費率；兩個 Luna 與 Sol 的 input 超過 272,000 時，整次 response 的 input 成本 2 倍、output 1.5 倍。每個 response 先計價再彙總，不能把多次 input 加總後套長上下文門檻。歷史 Terra 價格保留供既有用量查閱。

一般帳號以 D1 原子預留，餘額大於零可開始一批，最終扣到零為下限；生成中的負值只是預留。管理員不預留、不鎖定、不累計重試次數，但記供應商成本。Token／USD／credit 詳細用量與錯誤診斷在生成及整理流程只向管理員呈現。進度條的「約 TPS」則所有人可見：每 100ms 更新該批次累計輸出 tokens 除以批次耗時的平均速度，下一批重新計算；o200k tokenizer 的估計不含推理 token，也不是供應商最終計費用量。

缺 usage 先補查 stored response，仍未知就保存 pending metadata；有產出的帳號保留預留，取消／失敗釋放。帳號下次請求和每日 Cron 有界補查。成本保持 null，不能填零或用估算冒充。來源成功身份和 provider cost 分開，同 session 成功來源重試有冪等規則，新 session 重新計費。

管理 PATCH 帶 expected 版本；帳號／設定有變則 409，不會部分套用。資金調整等待預留／結算完成，備註可更新；未知歷史 credit 與未核實 debit 不列為已知零成本。

## 維護邊界

公開型別、來源 parser 和估算在 packages/ai-contract，Worker 使用版本化 tgz。更新 contract 要同步 repack、Worker lockfile 與測試；prompt／schema／評測只在 private repo。各儲存格式版本見[資料與同步](data-and-sync.md)，評測方法見[Prompt 評測](prompt-evaluation.md)。
