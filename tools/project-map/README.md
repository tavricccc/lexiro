# Lexiro 離線程式流程地圖

在前端 repo 根目錄使用 PowerShell 7：

```powershell
node tools/project-map/build.mjs
```

預設輸出桌面 `Lexiro-程式流程地圖.html`。第二個參數可指定輸出絕對路徑，第三個參數可指定 private Worker repo；未指定時使用同層 lexiro-worker。產生器需要這兩個 checkout 與前端已安裝依賴，成品只需瀏覽器，可搬走離線開啟。

閱讀目標與範圍見 [PRODUCT.md](PRODUCT.md)，介面規格見 [DESIGN.md](DESIGN.md)。左上角可切換亮暗色；編號節點、選取狀態與相鄰連線標示目前步驟。Lexiro 的森林綠識別與 Novae 共用相同操作方式。

| 檔案 | 責任 |
| --- | --- |
| content.mjs | 架構、使用者／AI／管理／自動流程與完整 route 解說 |
| models.mjs | 模型身份、生命週期與程式關聯 |
| settings.mjs | 使用者偏好、技術常數與生效時機 |
| schema.mjs | Babel TypeScript AST 提取實際欄位與初值，不執行產品程式 |
| build.mjs | 已追蹤來源、hash、route／endpoint／contract 覆蓋與 inline script 驗證 |
| template.html、map.css、map.js | 目錄、閱讀畫布、浮動解說、亮暗色與原碼 |

公開原碼快照取 app、components、stores、lib、src、契約及文件，排除環境檔／資料／private prompt。Worker 核對 HEAD、Cron、HTTP 字串與 migration 檔名，並用 Node 24 的記憶體 SQLite 重建 D1 schema，僅輸出欄位／FK／程式設定初值；不內嵌 SQL 或 Worker 原始檔案。新增 page／Worker endpoint／D1 表或 contract 不同版時，產生器停止並指出要補的解說。

TypeScript model 的關係是 domain 身份；D1 的欄位與 FK 從完整 migration schema 提取。設定初值取目前常數或 migration 種子，正式 runtime 值可能不同。Firestore／D1 實際帳號和部署狀態不在地圖內。資料變更後更新 models／settings／流程，重新產生即可。

操作沿用 Novae：目錄搜尋、節點、相鄰連線、浮動解說、逐步、原碼、盤點、適合畫面、拖曳及縮放；手機圖向下，桌面向右。介面為獨立離線資產，不影響 Lexiro App。
