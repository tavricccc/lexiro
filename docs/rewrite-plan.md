# Lexiro 重寫計畫

分支：`rewrite`（lexiro 與 lexiro-worker 各一）。舊 docs 不作依據；lexiro-app 暫不同步。

## 決定

- **線上為主**：D1 是唯一真相。前端以 react-query 讀，快取持久化到 IndexedDB，離線可讀、可練習。
- **離線只有練習紀錄會排隊**：作答事件存本機佇列，上線後批次送出（idempotent batch id）。教材編輯離線時停用。
- **舊資料**：server 端轉換腳本一次轉到新 schema；裝置上未同步的本機修改直接丟棄。API 只保留最新版，不做版本並存。
- **保留功能**：單字集／資料夾、單字與詞義、題目（單句與四種篇章）、練習、今天、進度、對戰、分享、Agent（MCP + OAuth）、admin、備份匯出匯入、PWA。
- **刪除**：本機 repository／head pointer／manifest、sync journal、mutation 與 account queue、所有 migration／repair、前端題目組裝（`question-assembly` 等已無呼叫者）、跨裝置練習草稿（改為只存本機）、set cache、membership 表。
- **UI**：web design kit 複製進 `packages/design-kit`；主色 Lexiro pine 綠（`#1f7a5c` / 暗色 `#7fdcb4`），其餘副色重新搭配。
- **資訊架構**：一頁一件事，次要內容進子頁或 sheet。「我」只放頭像與導覽列。

## 資料模型（D1 `CLOUD_DB`，新 schema）

單字屬於單一單字集（現有 wordKey 已含 setId），所以 membership 是多餘的：`words.set_id` 取代。

```sql
accounts(uid PK, revision INT, quota_day, quota_writes, stored_bytes, created_at)
folders(uid, id, name, parent_id, ord, updated_at, PK(uid,id))
sets(uid, id, folder_id, name, hue, icon, ord, created_at, updated_at, PK(uid,id))
words(uid, id, set_id, word, starred, senses JSON, updated_at, PK(uid,id))
questions(uid, id, set_id, kind, difficulty, body JSON, updated_at, PK(uid,id))
question_words(uid, question_id, word_id, PK(...))       -- 刪字時找出受影響題目
learning_senses(uid, sense_id, word_id, level, answered, correct, last_day, PK(uid,sense_id))
learning_days(uid, day, answered, correct, PK(uid,day))
learning_kinds(uid, kind, answered, correct, PK(uid,kind))
learning_meta(uid PK, goal, goal_updated_at)
receipts(uid, id, created_at, PK(uid,id))                -- 練習批次與寫入的冪等
prefs(uid PK, data JSON, updated_at)
shares(id PK, uid, set_id, created_at, UNIQUE(uid,set_id))
```

`accounts.revision` 每次寫入 +1；前端輪詢 `GET /me/revision` 決定是否重新抓。
`AGENT_DB`（OAuth、連線、rate limit、app auth、停用帳號、profile）維持獨立 DB，程式重寫、schema 只整理不搬家。

## Worker API（全部需 Firebase ID token，除了標註 public）

| 方法 | 路徑 | 用途 |
| --- | --- | --- |
| GET | `/me` | 帳號、revision、偏好、學習摘要 |
| GET | `/library` | folders + sets（含字數、題數），不含單字 |
| GET | `/sets/:id` | 單一集合的 words + questions |
| PUT/DELETE | `/folders/:id`、`/sets/:id`、`/words/:id`、`/questions/:id` | 單筆寫入 |
| POST | `/sets/:id/words:batch` | 批次新增／複製單字 |
| POST | `/learning/answers` | 練習批次 `{batchId, answers[]}` |
| GET | `/learning` | 完整學習紀錄 |
| PUT | `/prefs` | 偏好 |
| GET/POST | `/backup` | 匯出／匯入 |
| POST/DELETE | `/shares`；GET `/shares/:id`（public） | 分享 |
| `/rooms/*` | 對戰（Durable Object，協定沿用） |
| `/mcp`、`/oauth/*`、`/authorize`、`/connections`、`/app-auth/*` | Agent |
| `/admin/*` | admin |
| DELETE | `/account` | 刪除帳號 |

前端與 MCP 共用同一個 repository 模組。驗證 schema 放在共用 contract 套件。

## 前端結構

```
app/        入口、routes、providers、sw
features/   library / practice / today / progress / me / rooms / share / agent / admin
data/       api client、query keys、learning queue、auth
domain/     純邏輯：練習出題（meaning / reverse）、學習紀錄、排序、匯入解析
packages/design-kit
```

## Slice 順序（每個做完即 commit）

**Worker**
1. 新 schema migration + repository + 單元測試
2. REST API（library / sets / words / questions / learning / prefs / backup / shares）
3. MCP 改接新 repository；admin、account
4. 轉換腳本（舊 `cloud_records` → 新表），含本地 fixture 測試；**正式執行前停下問**
5. rooms 精簡

**前端**
1. design kit、主題、殼層與導覽、auth
2. 我的單字：資料夾與單字集列表 → 單字集 → 單字詳情／編輯 → 新增單字 → 題目編輯
3. 練習：設定 → 作答 → 結果；學習佇列
4. 今天、進度
5. 我與子頁（帳號與同步、偏好、資料與備份、Agent 連線、關於與更新、管理）
6. 對戰
7. 分享頁、Agent 授權、app-auth、offline、404
8. 刪舊程式、測試、文件

不自行執行：push、部署、正式 D1 操作、安裝新套件。
