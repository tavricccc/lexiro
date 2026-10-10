# Lexiro 文件

README 提供專案入口；下列章節按目前 checkout 的程式、型別和部署配置維護。

| 文件 | 內容 |
| --- | --- |
| [產品與操作](product.md) | 建立教材、編輯、練習、進度、備份及管理 |
| [路由與權限](routes-and-permissions.md) | `/` 與 `/app`、登入、資料所有權、Worker 管理員 |
| [架構](architecture.md) | UI／store／domain／IndexedDB／D1／Worker 的交接 |
| [D1 雲端](d1-cloud.md) | 新雲端、資料夾／200 筆、配額與發布維護 |
| [Agent 批次寫入](agent-validation.md) | senseId、逐題診斷、partial／atomic、唯讀驗證與無模型品質提示 |
| [資料與同步](data-and-sync.md) | 詞義身份、IndexedDB commit、dirty journal、merge、版號 |
| [練習](practice.md) | 題型、排程、判分、存檔、接續與結果解說 |
| [高中題目品質](question-quality.md) | 官方依據、題型篇幅、干擾選項與生成驗證 |
| [AI API](ai-api.md) | 串流、模型偏好、批次、結算與 private 邊界 |
| [設定](configuration.md) | 公開環境變數、local／GitHub 名稱與配置 |
| [本機開發](local-development.md) | 安裝、純本機、emulator、Worker 與 production PWA |
| [部署](deployment.md) | Workflow、Vercel 與 D1 Worker 發布先後 |
| [測試](testing.md) | 檢查命令、測試責任與真實環境驗收界線 |
| [文件維護](documentation-maintenance.md) | 程式來源、文件同步、離線地圖重建 |
| [設計系統](design-system.md) | 元件、tokens、圖示、桌面／手機工作區 |
| [產品決策](product-decisions.md) | 帶日期的決策與驗證紀錄 |
| [Prompt 評測](prompt-evaluation.md) | Private 評測位置與歷史 parser 結果的範圍 |

開發者可搭配 [structure.md](../structure.md) 找負責模組。`PRODUCT.md`／`DESIGN.md` 保存產品與視覺約束，工作證據中的日期、案例數和截圖只適用於記錄時的版本。
