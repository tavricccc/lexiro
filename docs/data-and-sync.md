# 資料模型、保存與同步

## 每集獨立的內容

| 資料 | 身份與關係 |
| --- | --- |
| `VocabFolder` | id／parentId 組成資料夾樹 |
| `LibrarySet` | id／folderId 保存集合資訊 |
| `WordEntry` | buildSetWordKey(setId, word) 建立本集身份，內含本集 WordSense |
| `WordSense` | 由本集 wordKey、詞性與中文建立 SenseId；例句與 supplementary 旗標只屬於此詞義 |
| `SetMembership` | 本集 wordKey + senseIds，不可指向其他集的內容 |
| `LibraryQuestion` | 題目／文章包，全部 wordKey／senseId 來源必須在同一集 |
| `LearningProgress` | 每個 SenseId 的 FSRS card、due、stability 等 |
| `DashboardStats` | 每詞義題型成績、每日活動、目標與連續學習 |

定義在 `src/types/library.ts`、`learning.ts` 與 `session.ts`。`canonicalHash` 用 SHA-256 前 128 bits，checksum、詞義／題目指紋和 cloud record ID 都使用同一算法。

同拼字在不同集有不同 wordKey／SenseId／題目指紋。`normalizeWordKey` 只供草稿拼字比對和舊資料遷移，不能用來建立新保存內容的全域身份。保存例句不會自動建立題目。`clearQuestions(setId)` 清空本集，不帶 setId 清空全題庫，包含歷史文法題；兩者保留單字、詞義、例句、FSRS 與學習紀錄。

## 備份與本機 domain 格式

`library-set-migration.ts` 按舊 membership 複製每集原本收錄的詞義與可見題目，重綁 word、sense、父題與子題身份並重算指紋。跨集且無單一歸屬的歷史文章題保存在「遷移保留題組」，不拆散文章或丟棄子題。`learning-scope-migration.ts` 承接每詞義卡片與明細，帳號總量、每日紀錄及連續天數不增加；重試不累加。

上述為本機／手動備份匯入的 domain 格式處理。這次 D1 切換不讀 Firestore 或舊帳號 namespace；從空白新雲端及新快取開始，不做雲端遷移或 fallback。

Full backup v4／set share v1 匯入時一次升級，新匯出只有 v5／v2。分享複製到新集時重建全部來源與父／子題身份。舊生成草稿只依原所選集重綁完成成果，保留付費操作 ID、checkpoint 用量與原 task hash；不假造可續接狀態。舊全庫草稿若未記集，須明確選原集才能重綁；來源無法確認時保留原稿。

`practice-scope-migration.ts` 從目前 Library 反算舊 ID，保留題序、計數、已選答案與原呈現選項。全庫舊題若原本共享，確定地承接一份，不複製已作答 entry。遷移成功先保存再提供接續；缺來源或保存失敗時保留原稿，只有明確重新開始才清除。

## 本機 commit

LibraryRepository 是 Library 的唯一 IndexedDB writer。Folder／set／membership／word／question 以內容 hash 保存；manifest 對應 record 與 hash，最後發布 head 才讓這代資料可見。保留上一代供恢復，更舊世代在 commit 後清理。

Read-modify-write 必須進 mutation queue，先讀最新 state，保存成功才更新畫面。損壞資料保留可辨識錯誤。`persist.ts` 把 key 加上 guest 或帳號 namespace；localStorage 的流程、練習及設定草稿也按帳號隔離。

Journal 更新先持久化，成功後才替換記憶體副本；失敗不假裝完成。

## 同步規則

D1 `cloud_records` 保存 folder／set／membership／word／question，以 uid＋recordId 為主鍵。刪除保留 tombstone，其他裝置才能看見刪除。cloud_accounts 保存 record／blob revision 和寫入來源，學習／統計／偏好放 cloud_blobs；Agent 和前端使用同一 repository。

Firestore cloud migration、SDK、rules／indexes 與 service-account REST 已移除。namespace 為 `d1-v1:<uid>`／`d1-v1:guest`，避免舊 cursor、journal 或資料自動進入新後端。

增量按 server `(seq,recordId)`，每頁／寫入批次 400。Cursor 同時記 sequence 與 ID，避免同批跨頁漏資料。Merge 依 server 寫入順序，本機尚未送的 dirty／tombstone 保留。寫入以 D1 batch＋CAS ticket＋operation 回條原子提交；未變動 records／來源不重寫。

Journal 是 sidecar，記未送 record、刪除與 learning／preference blob。每筆有本機 version，push 只清自己送出的版本，送出期間的新編輯仍待同步。帳號切換隔離 cursor、journal、listener 與回應。

學習按 card、統計按欄位、模型偏好按 updatedAt 合併；blob revision 拒絕過期覆蓋。每日目標只保存實際修改欄位，避免覆蓋新同步統計。visible／online 每 30 秒查一筆狀態，有外部改動才拉增量；隱藏／離線停止請求。

同步單次 request 上限 10 秒，失敗保留 journal。Learning／stats 上傳前檢查 900 KiB，每日歷史保留 90 天。這些是程式配置，不是已量測的雲端成本。

## 格式版號

| 格式 | 版本 | 來源／升級 |
| --- | --- | --- |
| Library state | 2 | 每集獨立內容；v1 一次遷移 |
| Library repository | 3 | head／manifest；schema 2 載入後完成 migration intent |
| Sync journal | 5 | 保留 v2／v3／v4 待送 records、blobs，新增舊來源標記 |
| Cloud records／learning DTO | 9 | 固定原生教材格式，由 D1 owner API 驗證 |
| D1 library schema | 1 | library-migrations/0001_library.sql |
| Practice snapshot | 5 | types/session.ts，v3 先轉詞義題，v4 移除退役模式並重排位置／答案 |
| AI preferences | 1 | ai-preferences.ts、cloud_blobs |
| Flow drafts | 1 | use-resumable-draft.ts |
| Pending preference drafts | 1 | preference-drafts.ts，只存編輯欄位 |
| Full backup ZIP | 5 | lexiro-backup.json；v4 一次匯入升級 |
| Set share ZIP | 2 | lexiro-set.json；v1 一次匯入升級 |
| AI contract | 5.0.0 | packages/ai-contract/package.json，與 private Worker tgz 同步 |

版號各自演進，修改一段 prompt 不會重設全部資料。備份匯出等待保存；匯入預覽只回數量，確認後在 queue 合併最新 state，不拿預覽快照覆蓋後續編輯。

題組子題新增可選 `explanation`／`whyWrong`，沿用原 canonical 題目與備份格式；舊題沒有解析仍可編輯。Reading editor 舊草稿一次補回原題型、共用選項與空格；single editor 草稿一次補上可編輯的理由。這些升級不清除原題、詞義、學習進度或同步佇列。

現行生成只接受五種學測選擇題型。既有文法題與其歷史統計保留在儲存及備份，活躍題庫與題數不納入；沒有將它們改標為其他題型。退役題型的生成／編輯草稿要求重新開始；混合練習草稿可保留剩餘題目。Firestore schema 與 Library repository 版號不因這次篩選變動。

本次單字集隔離才升級 Library repository 與 Firestore 版號；清空題目包含已存的歷史文法題。練習 v5 的 meaningChoices 欄位保存所有題型的原呈現選項，重綁身份後不重抽順序。

## D1 權限

Worker 驗證 Firebase ID token，uid 永遠由驗證結果取得；每個 SQL 都限定 uid。Record ID 為 type＋32 hex。單字及題目透過本集 memberships／sources 索引定位，不掃全帳號題庫。模型 key 與 billing 仍在獨立生成 Worker。

本機測試不代表正式 Firebase／D1／多裝置已驗收；先發布 Agent Worker／migration，再發布前端，見 [D1 維護](d1-cloud.md)。
