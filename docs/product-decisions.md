# 後端實作決策與驗收狀態

## 規格依據

原始完整規格是 [backend-blueprint.html](backend-blueprint.html)，2026-09-12 從使用者指定的 [Claude artifact](https://claude.ai/code/artifact/b803b459-390b-4006-a077-a45d90d1dc20) 匯入，僅移除平台脚本與登入包裝。原稿不覆寫；優先順序為使用者最新指示 → 本檔補充 → 原始藍圖。

前端 `lexiro` 與 private 後端 `lexiro-worker` 是同層的獨立 repository。直接在 main 分段提交，不建 branch 或 PR。使用者已要求本次修正完成、驗證通過後推送並建立新版本 Release；完整實作前不 push，不在本機操作正式 D1 或手動部署 Worker。

## 目前決策

| 項目 | 決策 |
| --- | --- |
| 免費 CPU | 盡量符合免費額度，不把本地 benchmark 當成 Cloudflare CPU 證明，也不自動升級付費方案 |
| 模型、reasoning、tokens | 模型名稱只在使用者要求的設定選單呈現；生成頁維持細分檔位，不展示 reasoning 與 tokens。程式碼及網路回應可存在，不做模型 ID 混淆；管理員可查看用量 |
| Prompt／API key | 留在 private 後端；保留 Responses 協定與原文字，移除 instructions/input/prompt 回顯並中和錯誤 |
| 餘額下限 | 使用者原話「就只有那一批跑完，然後只扣到 0 點，不要讓他扣到變負數」。餘額大於 0 就能開始，預估超額仍執行；結算最低為 0，下一批才因不足被拒 |
| 計費 | 固定點數只供預估與預留；完成後依 input、cache read、cache write、output usage 換算整數 credit，換算基準只在 private Worker |
| 模式倍率 | 開始前依共用合約預估：Lite 1×、Thinking 2×、Pro 10×；實扣依模型及 token 成本，不再乘一次倍率 |
| 實扣紀錄 | `credits` 是供應商成本，`assessed_points` 是餘額上限前應收，`points` 是實扣。管理員與已付費來源的重試實扣為 0，仍記錄供應商成本 |
| 歷史紀錄 | 無法從舊 usage 還原實扣，migration 不猜測回填；`debit_verified=0` 的歷史扣款不納入已核實扣款合計，報表另列筆數。也不自動調整既有帳戶餘額 |
| 額度調整 | 備註更新不改動預留中的負餘額。生成或待核對時，真正的點數／月額度調整回 409；無金融變動的儲存仍可更新備註 |
| 來源完成 | 成功來源的冪等識別與 token 成本分開。閱讀回傳 3–5 題不會因舊的逐題退款刪除成功紀錄；補充多義回傳空詞義仍算完成 |
| 重試限制 | 扣款識別含 session，成功後 30 分鐘內同 session 重試不重扣。嘗試上限識別不含 session，換 UUID 不能重置每來源 6 次／30 分鐘上限 |
| 缺少 usage | 先補查 stored response。仍無有效 usage 時，成本為 NULL；有 response id 則持久化為 `pending`，有產出的帳戶保留預留並暫停新生成，取消／失敗立即退款。帳戶下次請求及 Cron 有界重查，成功後原子結算；不以預估成本冒充實際成本 |
| 無法補查 | 沒有 response id 時標為 `unavailable` 並釋放預留。已有 id 卻持續查不到 usage 時保留待核對，不自動免單或解鎖；需營運者向供應商確認，不能刪除 pending 列假裝已結算 |
| 報表 | 成本合計只含已回報用量，未知成本另列。帳戶與 usage 使用 `cursor`／`nextCursor`，不接受舊 `offset`；時間範圍與游標查詢有 D1 索引 |
| 管理員 | 只依 `ADMIN_EMAILS` secret 與 verified email 判定；不預留、不鎖定、不累計重試次數，但記錄 cursor 與供應商成本 |
| 共用套件 | public `packages/ai-contract` 保存無秘密的解析器、型別與牌價；private repo 使用版本化 tgz，可獨立安裝 |
| 照片 | 前端縮圖／WebP；Worker 有界讀取、驗證、雜湊及串流 envelope，圖片不落地。真實圖片價格與 Workers CPU 仍需正式量測 |
| 模型偏好 | 目前使用者全域選擇 GPT-5.6 Luna 或 GPT-6 Luna，由前端的 owner-only Firestore 偏好同步；JSON 請求必須帶 model，照片用 X-AI-Model。僅接受這兩個模型，沒有模型失敗後的替代路徑 |
| 模型與檔位 | 兩者共用 low／medium／high 與既有 prompt；每輪固定模型。扣款及重試來源識別含模型，切換模型不會沿用另一模型的已付費來源 |
| 模型計費 | 5.6 的 Standard input／cached／cache write／output 每百萬 token 為 $0.20／$0.02／$0.25／$1.20；6 為 $0.10／$0.01／$0.125／$0.50。兩者超過 272K input 時，全請求 input 2×、output 1.5×；實扣仍按 usage，以整數算術向上取整。預估依最大 token 費率比例 2.4× 調整，不作為實扣 |

牌價依 [GPT-5.6 Luna 文件](https://developers.openai.com/api/docs/models/gpt-5.6-luna)
與 [Standard pricing](https://developers.openai.com/api/docs/pricing)，2026-10-02 核對。

Firestore rules 是使用者資料權限邊界；Worker 是 AI 身分、管理員、額度及供應商憑證的邊界。帳號由第一次已驗證請求建立，沒有手動建立帳號或前端授權管理員的流程。

## 部署與驗證界線

正式 D1 已在部署設定中配置；Firebase project 由 GitHub `Production` Environment 注入，不是等待本地填寫的空專案。`.github/workflows/deploy.yml` 在 main push 後先跑四項驗證，再套用 migrations、同步 secrets、部署及檢查 CORS。**推送 main 會部署**，細節見 [deployment.md](deployment.md)。

本次驗證使用本地 Miniflare D1、合成 Responses provider 與前端 jsdom。覆蓋備註不改餘額、金融變動互斥、閱讀重試、實扣上限、延遲結算、待核對預留不被逾時／續期清除、游標翻頁及未知成本呈現。前後端都執行 typecheck、lint、test、build；本地通過不等於正式環境驗收。

未執行真實 Firebase→Worker→供應商的付費生成、正式照片計價、Cron 排程實際驗收或 Cloudflare CPU 量測。歷史 prompt 評測另見 [prompt-evaluation.md](prompt-evaluation.md)，不能當成本次發布的新評測結果。
