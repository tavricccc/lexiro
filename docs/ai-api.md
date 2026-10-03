# AI 生成與 API

Browser 只送 Firebase-authenticated 的來源資料到 `NEXT_PUBLIC_AI_WORKER_URL`。Private Worker 保存 prompt、output schema、provider key、計費與管理設定；前端沒有 provider key 或手動 prompt 面板。

## 請求與串流

| 入口 | 請求與責任 |
| --- | --- |
| `GET /me` | 登入帳號點數、月額度、續期與 admin 身份 |
| `POST /generate` | JSON：kind、model、session、tier 與 raw／sources；可帶 cursor、repair |
| `POST /organize` | 文字 JSON，或 text/plain 的多張 WebP base64 |
| `/admin/accounts`、`/admin/accounts/{uid}` | 管理帳號、cursor 翻頁與 expected PATCH |
| `/admin/usage` | 近 30 天、各模型／工作／帳號的用量與未知成本 |
| `/admin/settings` | 新帳號初值與免費試用，expected PATCH |

`managed-client.ts` 只在 401 強制刷新 token 一次。串流消費 Responses text events，累計每個 response 的 usage；帳號改變會中止／拒絕舊結果。Worker 用白名單重建 Response metadata，移除 instructions／input／prompt 回顯並中和上游錯誤。題目額外使用 `lexiro.question.progress` 表示出題／審題進度，初稿不轉發。

題目請求帶 `X-Question-Contract: reviewed-v1`。舊版或缺少此契約的請求在預留與 provider 呼叫前回 426／`question_update_required`，需先啟用 App 更新。`question_quality_rejected` 不自動重試，也不保留未核准的初稿。

Session 在開始時固定模型、檔位與 UUID，cursor 只接已接受的 response。暫停保留記憶體中的 pending work；重新整理結束未完成工作。流程草稿另保存已完成且可校對的成果，恢復它不必再次生成。

## 批次與校對

`src/lib/ai/tasks.ts`：單字每批 25 個來源、補充多義每批十字；題目批次由 `splitGenerationBatches` 決定，詞彙／文法每批最多八個來源。Runner 依序執行並保留有效部分，來源的 ref 跟著內容傳遞。

所有 AI 題目由 Worker 出初稿並獨立審題，核准稿通過高中篇幅、跨度與閱讀依據門檻後才回前端。句子題完整寫出 sentence，再取 usage／answer，程式負責挖空及排序。校對一次看一題／題組，可取消納入後儲存選取項目；新增的逐題解說與錯項理由跟選項保存。語意與唯一解仍須校對，完整規格見[高中題目品質](question-quality.md)。

照片確認後先縮 WebP，每張最多 1.5 MB、長邊 1800；每批 1-10 張。text/plain 每行一張 base64，整批上限 20,000,009 bytes，headers 帶 `X-Session-Id`、`X-AI-Model`。Worker 驗證後一次送多圖片 Responses request，圖片不落地。不同批次依序執行，已完成部分保留。

照片整理只驗 lines 陣列、長度與格式。Prompt 對來源範圍的要求不等於 deterministic 語意過濾；沒有可證明自動排除所有相關詞／同反義詞的來源追溯檢查。

## 模型、估算與結算

共用 contract 2.3.0 接受 `gpt-5.6-luna` 與 `gpt-6-luna`，預設後者。帳號模型偏好保存在本機及 owner-only Firestore preferences/ai。Lite／Thinking／Pro 估算倍率為 1／2／10，模型的估算因子分開；實扣按回報 usage，估算不是扣款保證。

題目估算另含兩回合係數，審題至少 medium；不是實測成本上界。兩回合仍只預留與結算一次，拒絕／取消整批釋放預留。`response.lexiro.usageParts` 與 client `TokenUsage.parts` 保留每個 response 的用量，各自計價後加總。任一回合用量缺漏，整批成本維持未知並逐 cursor 補查；不能用已知一半冒充總成本。

程式 `MODEL_PRICES` 記錄 Standard／cache read／cache write／output 的採用費率；兩個模型 input 超過 272,000 時，整次 response 的 input 成本 2 倍、output 1.5 倍。每個 response 先計價再彙總，不能把多次 input 加總後套長上下文門檻。這是版本化程式契約，不是本文件查證的供應商即時牌價。

一般帳號以 D1 原子預留，餘額大於零可開始一批，最終扣到零為下限；生成中的負值只是預留。管理員不預留、不鎖定、不累計重試次數，但記供應商成本。Token／USD／credit 詳細用量只在管理介面呈現。

缺 usage 先補查 stored response，仍未知就保存 pending metadata；有產出的帳號保留預留，取消／失敗釋放。帳號下次請求和每日 Cron 有界補查。成本保持 null，不能填零或用估算冒充。來源成功身份和 provider cost 分開，同 session 成功來源重試有冪等規則，新 session 重新計費。

管理 PATCH 帶 expected 版本；帳號／設定有變則 409，不會部分套用。資金調整等待預留／結算完成，備註可更新；未知歷史 credit 與未核實 debit 不列為已知零成本。

## 維護邊界

公開型別、來源 parser 和估算在 packages/ai-contract，Worker 使用版本化 tgz。更新 contract 要同步 repack、Worker lockfile 與測試；prompt／schema／評測只在 private repo。各儲存格式版本見[資料與同步](data-and-sync.md)，評測方法見[Prompt 評測](prompt-evaluation.md)。
