# Lexiro 全面重構實作計畫

> 這份文件是下一個實作視窗的工作說明。
> 所有產品決策以 [product-decisions.md](./product-decisions.md) 為最高優先；本文件只把已確認的決策整理成實作順序。

## 1. 實作前提

- 這是全新部署，不支援舊資料、舊 localStorage、舊 IndexedDB、舊 Cloud schema 或舊匯出格式。
- 不做 migration，不保留 legacy 欄位，也不為舊資料增加相容分支。
- 新資料模型只有一套；不得同時維護 legacy `VocabSet.items` 和新的 library state。
- 所有新增的 Vue 元件維持在 400 行以下。
- 重複兩次的資料邏輯、UI 操作和格式化函式必須抽成共用元件或 `src/lib/` helper。
- 使用者可見文字全部走 i18n；共用 UI 優先使用既有 UI primitives。

## 2. 最終產品規則

### 單字、sense、例句

- 同一個英文單字只保存一份。單字身份去除前後空白、忽略大小寫、整理片語多餘空白。
- 同一個 word 底下，`POS + 中文意思` 完全相同才是同一個 sense。
- POS 使用統一縮寫：`n.`、`v.`、`adj.`、`adv.`、`pron.`、`prep.`、`conj.`、`interj.`、`det.`、`aux.`、`modal v.`、`phr. v.`、`phr.`。
- POS 比對忽略大小寫和前後空白；中文意思只去除前後空白，不做模糊合併或自動改寫。
- 一個 sense 可以有 0～多個例句；例句可單獨新增、編輯、刪除。
- 例句屬於共用 sense。修改或刪除前要提醒會影響哪些單字集；刪除最後一句不刪除 sense。
- 不提供獨立的使用者「單字庫」功能；使用者看到的是單字集和 Dictionary。
- 每個保存的 word 必須透過至少一個單字集收錄；沒有任何單字集使用的 sense、例句、題目和 FSRS 狀態要清理。
- Vocabulary 編輯頁按單一英文單字管理，分成「字義與例句／題目」兩個分頁；不在此頁管理單字集歸屬。
- 目前單字集的 sense 可編輯；其他單字集的 sense 預設收起且唯讀。
- Sense／例句的新增和編輯都使用小型 Dialog；刪除先顯示影響範圍。

### 單字集與資料夾

- 單字集不允許為空；刪除最後一個單字時，明確告知單字集也會被刪除。
- 同一帳號的單字集名稱全域唯一。
- 根目錄只能放資料夾，不能直接放單字集；每個單字集一定有 `folderId`。
- 同一父資料夾下的資料夾名稱不能重複；不同父資料夾可以同名。
- 資料夾可以巢狀、改名和移動；ID 保持穩定，不能移到自己或自己的子資料夾。
- 刪除資料夾會刪除整棵子資料夾樹和其中所有單字集；確認時顯示總數。
- 共用 sense 仍被其他單字集使用時保留，否則依孤兒清理規則刪除。
- Set 不保存題目難度；難度只屬於題目。

### Dictionary

- Dictionary API 的 phonetic、audio、origin、英文字義、synonyms、antonyms 只在 API 卡片顯示，不保存、不同步。
- Dictionary 頁面只顯示本地 word／所有 sense／各 sense 所在的單字集，以及 API 卡片；不顯示題目。
- API 加入使用多步驟 Dialog：選單字集 → 選／編輯 API 詞性和例句 → 將例句對應既有或新增 sense → 手動輸入中文意思 → 預覽確認。
- 同一個 sense 已存在時只加入選取的新例句和單字集關聯；完全重複例句略過。

### 題目

- 正式題型只有三種：一般四選一、四選一填空、閱讀理解；拼字題移除。
- 三種題型分開生成、分開保存、分開管理；手動編輯器先選題型，再顯示該型欄位。
- 一般四選一題目和答案全部英文；填空是英文句子加四個英文選項；閱讀是英文文章和英文問題／選項。
- 題目難度只有第一級、第二級、第三級，難度屬於題目，不屬於單字或單字集。
- 生成時先選難度，Prompt 帶入難度，程式驗證 AI 回傳不得改級別。
- 閱讀題組整篇使用同一難度；測驗時顯示本題／題組難度，但不顯示 sense 中文意思。
- 每道題都綁定一個 sense；題目是全域共用資料，不保存 `setId`。
- AI 不產生正式 ID。程式提供 `sourceRef`，AI 必須原樣回傳；程式驗證後才建立正式 question ID。
- question ID 和內容 fingerprint 分開；編輯內容不改正式 ID，重複內容使用 fingerprint 去重。
- AI 生成先進預覽 Page；每題可編輯、刪除，確認後才保存。手動題目也可逐題編輯／刪除。
- 同一 sense、題型和難度可以有多題；一場測驗第一輪同一 sense 最多一題，題數不足才補同一 sense 的其他題目，不重複同一道題。
- 閱讀題組每日計數以子題為單位，但題組不可拆；一旦抽到題組就完成全部子題，實際題數可略高於目標。

### 每日複習、FSRS、XP

- 每個全域 sense 只有一張 FSRS 卡；同一 sense 在不同單字集共用熟練度。
- FSRS 只提供 `Again` 和 `Good`，進階參數不開放使用者修改。
- 每個 sense 在同一個每日流程最多更新一次 FSRS。先做 FSRS 後，題目答對不重複排程；題目答錯或 mark 會讓本次最終結果為 `Again`。
- 單獨做題、沒有先做 FSRS 時，該 sense 的題目結果才更新一次 FSRS。
- 每日 FSRS 先抽到期／逾期 sense，再補未學過 sense；新 sense 最多佔每日目標三分之一。
- 每日保留兩個目標：記憶複習目標（15／20／25 個 sense）和題目練習目標（5／10／15／20／25 題）。所有入口共用同一天的進度。
- FSRS 完成後若題目目標未完成且有題目，直接進入題目階段；題型自動 40% 一般四選一、40% 填空、20% 閱讀，不讓使用者重新選題型。
- 每日題目先從本次剛複習的 sense 抽，不足再從全域題庫補；難度三等分混合，題型／難度不足時補給其他池，全部不足就少出，不臨時叫 AI。
- mark 表示本次不熟；答錯或答對但 mark 都是 `Again`。mark 只用於本次重複練習，不另存永久 mark 系統。
- 每完成一個普通練習單位給 10 XP；Good 加 2 XP；Again 仍給 10 XP。
- 同一 sense 同一天第一次以後的重複練習每次 5 XP；完成整場加 10 XP；每天第一次正式練習加 5 XP。
- 每 100 XP 升一級；XP／Level 不代表 FSRS 熟練度，也不因刪除或答錯倒扣。
- 完成任一正式練習單位即可維持當天 streak；漏一天後目前 streak 歸零，歷史最高保留；不做 freeze。
- 移除成就系統。

### 統計

- 統計分成「記憶複習」和「題目練習」，不合成一個總正確率。
- 所有 sense 以全域只計一次；單字集只是篩選器。
- 顯示 FSRS 狀態：未學習、學習中、已排程、待複習；不捏造 0～100 熟練度。
- 題目統計按題型、難度、正確／錯誤和 retry 分組；正確率計算每一次作答，包括重複題。
- 歷史只保存每日彙總，不保存每次選了哪個答案或完整答題內容。
- XP、Level、streak 保留；成就移除。

### 本地、Cloud、備份

- 所有 Lexiro 應用資料使用同一個 IndexedDB；localStorage 不保存應用資料。
- Guest 和每個 Cloud user ID 使用獨立 namespace；Guest 有資料時，登入前提醒匯出完整 ZIP，但允許選擇繼續登入。
- 登入後 Cloud 是權威來源，先取得 Cloud baseline，再處理離線變更；本地不可直接覆蓋 Cloud。
- 離線仍可使用快取的單字集、題目、FSRS、編輯和統計；網路功能恢復後自動同步。
- 非衝突 record 自動合併；同一 record 衝突直接採 Cloud，不提供衝突二選一 Dialog。
- 同步失敗保留 pending queue，自動重試並顯示狀態；不要因一般網路錯誤丟資料。
- Cloud 同步單字、sense、例句、單字集、資料夾、關聯、題目、FSRS、XP、Level、streak、每日彙總、每日目標和非敏感 AI 設定。
- API key 只留目前裝置 IndexedDB，不進 Cloud、ZIP 或 AI 設定匯出；Prompt 固定在程式碼，不同步。
- 完整備份 ZIP 包含全部使用者資料、學習狀態、統計和非敏感 AI 設定，但不含 API key、登入 token/session、SDK cache、Dictionary cache 或其他可重建暫存。
- 完整 ZIP 匯入採合併，不取代目前 Cloud；同一 record 衝突保留目前 Cloud。
- 選定單字集匯出只分享內容；匯入只新增單字集、不覆蓋現有單字集。

## 3. 目前程式的主要問題

以下不是推測，是目前程式審核後的重構原因：

1. `VocabSet.items` legacy 模型和 `library.words / memberships / questions` 新模型同時存在，造成單字、題目和學習狀態有兩套來源。
2. `persist.ts` 把 library、sets、learning、session、Dictionary cache、AI settings 分散在 IndexedDB 和 localStorage，還有 marker、大小門檻和 fallback。
3. Cloud Sync 目前可能在 Cloud baseline 尚未完成時依本地時間／hash 回寫 Cloud，不符合 Cloud 優先。
4. 目前 FSRS 進度按單字集 item 保存，不是全域 sense；同一 sense 在多個單字集會重複計算。
5. 現有 FSRS 仍有 Hard／Easy，`dailyGoal` 與兩個新 daily goal 重複，成就系統也混入舊統計。
6. 題目生成目前以 word 為主、sense 關聯不完整、沒有固定難度參照，也沒有完整的 AI ID 驗證和預覽編輯流程。
7. 題目 ID 目前和內容 hash 綁在一起，編輯題目會破壞穩定身份。
8. 每日題目目前可能把不同題型塞進同一種 session，和三種正式題型分離的規則衝突。
9. 統計目前只看 FSRS item，題目練習、題型、難度、跨單字集 sense 和歷史趨勢都不完整。
10. `StatsView` 的 learned／due 會因共用單字重複計算；XP、streak、每日統計也沒有涵蓋全部正式練習。
11. 現有 achievements、set difficulty、spelling 和多個未採用欄位都應移除。
12. Dictionary 頁目前仍有題目呈現邏輯；新規則下只能顯示本地 sense／單字集關聯和 API 卡片。
13. AI 設定匯出目前會帶出 API key，必須改成永遠排除。
14. `output/` 的內容可作為 Prompt 風格參考；若作為資料種子或匯入來源，必須遵守本文件定義的 canonical schema，不接受舊格式欄位。

## 4. 建議的新資料層

| 資料 | 主要身份 | 關聯與責任 |
| --- | --- | --- |
| Folder | `folderId` | `parentId`；根目錄只容納資料夾 |
| Set | `setId` | `folderId`；不保存 items、不保存 difficulty |
| Word | normalized `wordKey` | 保存顯示單字；一個 word 只有一份 |
| Sense | `senseId` | `wordKey + normalizedPos + meaningZh`；一份全域共用 |
| Example | `exampleId` | `senseId`；0～多筆，共用 |
| Set membership | `membershipId` 或 `(setId, senseId)` | 表示單字集收錄哪個 sense |
| Question | `questionId` | `senseId + type + difficulty + payload + fingerprint` |
| Reading pack | `packId` | passage、同一難度、多個 reading sub-question |
| FSRS card | `senseId` | 全域一張卡，不按單字集複製 |
| Daily activity | `localDate` | 只保存每日彙總，不保存逐題答案 |
| AI settings | account-scoped non-secret fields | API key 另存 device-local |
| Sync outbox | internal operation ID | 只負責離線同步，不是答題歷史 |

所有資料寫入都應經過 repository／domain service，元件不能自行拼資料或直接改多個 store。

## 5. 實作順序

### Phase 0：建立乾淨基線

- 建立新資料型別和新 IndexedDB schema。
- 移除 migration、舊資料 fallback、localStorage marker 和舊欄位相容邏輯。
- 暫時保留舊 UI 但禁止新增 legacy 資料，先讓新 domain 層可以獨立測試。

### Phase 1：完成唯一資料模型

- 建立 word／sense／example／membership／set／folder repositories。
- 實作 word、POS、meaning、example 的唯一化規則。
- 移除 `VocabSet.items` 作為資料來源，改由 set membership 查詢。
- 實作單字集、資料夾、刪除和孤兒清理的原子操作。
- 實作共享 sense／例句的影響範圍計算。

### Phase 2：重做本地儲存與離線工作區

- 用單一 IndexedDB repository 取代 `persist.ts` 的 localStorage／marker／threshold 分支。
- 分離 guest namespace、user namespace、device-local AI key。
- 把 session 明確定義成本機暫態，不進 Cloud。
- 確保 App 啟動先能從 IndexedDB 讀 cache；無網路也能進入本地功能。

### Phase 3：重做單字、Dictionary、資料夾 UI

- Dictionary 改成本地 sense／單字集關聯 + API 卡片，不顯示題目。
- 建立多步驟 Dictionary add Dialog。
- 建立 Vocabulary Page 的「字義與例句／題目」分頁。
- Sense／例句新增與編輯使用共用小型 Dialog；刪除使用 icon、tooltip、aria-label 和影響範圍確認。
- Set／Folder 頁面落實根目錄限制、空 set 禁止、名稱唯一和整棵資料夾刪除。

### Phase 4：重做題目 domain 和 AI 生成

- 建立三種正式 question payload 和 reading pack/sub-question 模型。
- 移除 spelling、set difficulty、舊 source 分支。
- 將 AI 輸入改成 sense 選擇，所有生成 Prompt 帶 `sourceRef` 和難度。
- 建立共用 AI response parser、sourceRef validator、question fingerprint 和 stable ID factory。
- 生成結果改成 Page 預覽；每題可編輯／刪除，確認後才保存。
- Vocabulary 題目分頁支援題型／難度篩選和手動 CRUD。

### Phase 5：重做練習、FSRS、XP、統計

- 建立全域 sense FSRS repository，移除 per-set card。
- 只保留 Again／Good，實作每日流程「FSRS → 自動 40／40／20 題目」。
- 實作 mark、retry、閱讀題組不可拆和每日補題規則。
- 建立 XP、Level、streak 和每日彙總服務；移除 achievements。
- 重做 StatsView：FSRS 狀態、題型／難度統計、每日歷史、XP／Level／streak、全域 sense 和單字集篩選。

### Phase 6：重做 Cloud Sync

- Cloud 初次 baseline 完成前禁止 upload。
- 建立 record-level outbox 和 base revision/hash。
- 實作 Cloud baseline → 非衝突合併 → Cloud 衝突優先 → 寫回 → 更新 baseline 的固定順序。
- 將 content、FSRS、daily aggregate、非敏感 AI settings 分開同步，但共用同一套 outbox／衝突規則。
- 加入離線、自動重試、pending count、sync status 和不阻塞 App 的錯誤處理。
- 移除目前依本地 timestamp 直接回寫 Cloud 的邏輯。

### Phase 7：重做完整備份與部分分享

- 完整 ZIP：所有 user data、FSRS、統計、XP、streak、目標、非敏感 AI settings，不含 key/token/cache。
- 部分分享 ZIP：只含選定單字集內容，不含帳號學習資料。
- 匯入都先解析、驗證、預覽，再由使用者確認。
- 完整備份匯入採合併；部分分享匯入只建立新單字集。
- 匯出 AI settings 時先移除 API key；匯入不得覆蓋本機 key。
- Guest 登入前檢查資料並提供完整 ZIP 提醒。

### Phase 8：產品 UI 收斂

- 小型日常操作使用共用 icon button；重要流程保留文字按鈕。
- 所有 icon 有 tooltip、focus 狀態和 aria-label。
- 編輯／刪除／新增 sense、例句、題目不各自實作一套控制元件。
- 大型流程使用 Page；短確認和單筆編輯使用 Dialog。
- 移除成就、Dictionary 題目卡、set difficulty 和未採用欄位的畫面與翻譯。

### Phase 9：驗證與清理

- `npm run typecheck`
- `npm run lint`
- `npm run test`
- 檢查所有 `.vue` 檔案不超過 400 行。
- 檢查同一份業務邏輯沒有第二套 store／helper／parser。
- 完成離線、Cloud 衝突、Guest 登入、完整匯入、資料夾刪除、共享 sense、閱讀題組和 API key 安全測試。

## 6. 必測情境

1. 同一個 `run` 在兩個單字集出現不同 sense；資料庫只有一個 word，兩個 sense，各自正確顯示。
2. 同一 sense 新增例句；兩個單字集都看到同一句，刪除前有影響範圍提醒。
3. 刪除某單字集最後一個 sense；若其他集合仍用，只有 membership 被刪除。
4. 刪除最後一個單字；使用者確認後單字集也刪除，不能留下空 set。
5. 刪除含子資料夾的資料夾；預覽總數，確認後整棵樹刪除，共用資料正確清理。
6. 每日 FSRS 先到期後新 sense，題目自動按 40／40／20；閱讀題組不被拆開。
7. 同一 sense 在每日流程只更新一次 FSRS；題目答錯／mark 將結果變成 Again。
8. 題目生成 AI 回傳錯誤、未知或缺少 `sourceRef`；該筆拒絕，不猜測關聯。
9. AI 生成結果可在保存前編輯和刪除；題目正式 ID 穩定，fingerprint 正確去重。
10. 登入前 Guest 有資料；看到完整 ZIP 提醒，可匯出、繼續登入或取消。
11. Guest 登入已有 Cloud 資料；不自動混合、不覆蓋 Cloud。
12. 離線新增／編輯／刪除，復網後非衝突合併、同 record Cloud 優先。
13. Cloud 網路錯誤；pending queue 保留、App 不阻塞、重試後才清除。
14. 完整 ZIP 不含 API key；AI settings 匯出也不含 API key。
15. Stats 以 sense 計算，不因多個單字集重複；題目統計按題型／難度和每次作答計算。
