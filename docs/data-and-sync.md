# 資料模型、保存與同步

## 共享身份

| 資料 | 身份與關係 |
| --- | --- |
| `VocabFolder` | id／parentId 組成資料夾樹 |
| `LibrarySet` | id／folderId 保存集合資訊 |
| `WordEntry` | 正規化 WordKey，內含多個 WordSense |
| `WordSense` | SenseId、詞性、中文、例句與 supplementary 來源旗標 |
| `SetMembership` | 集合收錄的 wordKey + senseIds，共享詞義 |
| `LibraryQuestion` | 題目／文章包，指向 wordKey／senseId |
| `LearningProgress` | 每個 SenseId 的 FSRS card、due、stability 等 |
| `DashboardStats` | 每詞義題型成績、每日活動、目標與連續學習 |

定義在 `src/types/library.ts`、`learning.ts` 與 `session.ts`。`canonicalHash` 用 SHA-256 前 128 bits，checksum、詞義／題目指紋和 cloud record ID 都使用同一算法。

## 本機 commit

LibraryRepository 是 Library 的唯一 IndexedDB writer。Folder／set／membership／word／question 以內容 hash 保存；manifest 對應 record 與 hash，最後發布 head 才讓這代資料可見。保留上一代供恢復，更舊世代在 commit 後清理。

Read-modify-write 必須進 mutation queue，先讀最新 state，保存成功才更新畫面。損壞資料保留可辨識錯誤。`persist.ts` 把 key 加上 guest 或帳號 namespace；localStorage 的流程、練習及設定草稿也按帳號隔離。

## 同步規則

Firestore 每個 record 一份 document：`users/{uid}/records/{type}-{hash}`。刪除保留 `deleted: true` tombstone；Rules 拒絕直接刪 record，其他裝置才能看見刪除事實。`meta/library` 保存 server changedAt 和分頁 changedBy，避免自己的 push 觸發多餘同步。

增量以 server `writtenAt + documentId` 排序，每頁／寫入批次 400 筆。Cursor 同時記時間與 ID，避免同 timestamp 跨頁漏資料。Merge 依 server 寫入順序覆寫；updatedAt 是 domain metadata，不用裝置時鐘決定 Library 衝突。本機尚未 push 的 dirty record 保留。

Journal 是 sidecar，記未送 record、刪除與 learning／preference blob。每筆有本機 version，push 只清自己送出的版本，送出期間的新編輯仍待同步。帳號切換隔離 cursor、journal、listener 與回應。

學習進度按 card 合併、統計按欄位處理；模型偏好為 owner-only `preferences/ai` v1，用其 updatedAt 合併。這兩者不是 Library 的 server-order 規則。每日目標只保存實際修改欄位，避免覆蓋新同步的統計。

同步單次 request 上限 10 秒，失敗保留 journal。Learning／stats 上傳前檢查 900 KiB，每日歷史保留 90 天。這些是程式配置，不是已量測的雲端成本。

## 格式版號

| 格式 | 版本 | 來源／升級 |
| --- | --- | --- |
| Library repository | 2 | library-repository.ts 的 head／manifest／records |
| Sync journal | 4 | sync-journal.ts，由 v2／v3 migration 保留待送資料 |
| Firestore records／learning | 8 | constants/cloud.ts、firestore.rules，只接受目前版本 |
| Practice snapshot | 5 | types/session.ts，v3 先轉詞義題，v4 移除退役模式並重排位置／答案 |
| AI preferences | 1 | ai-preferences.ts、preferences/ai |
| Flow drafts | 1 | use-resumable-draft.ts |
| Pending preference drafts | 1 | preference-drafts.ts，只存編輯欄位 |
| Full backup ZIP | 4 | constants/backup.ts，內含 lexiro-backup.json，舊版本拒絕 |
| Set share ZIP | 1 | types/backup.ts，內含 lexiro-set.json |
| AI contract | 3.0.0 | packages/ai-contract/package.json，與 private Worker tgz 同步 |

版號各自演進，修改一段 prompt 不會重設全部資料。備份匯出等待保存；匯入預覽只回數量，確認後在 queue 合併最新 state，不拿預覽快照覆蓋後續編輯。

題組子題新增可選 `explanation`／`whyWrong`，沿用原 canonical 題目與備份格式；舊題沒有解析仍可編輯。Reading editor 舊草稿一次補回原題型、共用選項與空格；single editor 草稿一次補上可編輯的理由。這些升級不清除原題、詞義、學習進度或同步佇列。

現行生成只接受五種學測選擇題型。既有文法題與其歷史統計保留在儲存及備份，活躍題庫與題數不納入；沒有將它們改標為其他題型。退役題型的生成／編輯草稿要求重新開始；混合練習草稿可保留剩餘題目。Firestore schema 與 Library repository 版號不因這次篩選變動。

## Firestore 權限

Rules 要求登入 UID 等於 path UID，ownerId 相符、schema 正確且欄位集合合法。Record ID 是類型加 32 hex 字元，payload 不做單欄索引，查詢使用 writtenAt。AI prompt、憑證與 D1 billing 不在這組文件內。
