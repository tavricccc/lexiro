# 文件與流程地圖維護

README 是入口，docs 說明目前行為，structure 對應模組。產品／設計約束保留於 PRODUCT、DESIGN 與 product-decisions；過去驗證數字保留日期，不能當成目前 checkout 已通過。

| 改動 | 核對來源與文件 |
| --- | --- |
| 路由／導覽 | app、browse-routes、navigation-memory → routes-and-permissions |
| 詞義／題目／保存 | types、repository、store → data-and-sync、structure |
| 練習／FSRS | practice components、fsrs、learning store → practice |
| Firebase／同步 | cloud files、Rules／indexes → configuration、data-and-sync |
| AI 請求／模型 | ai-contract、managed client、private Worker → ai-api |
| 環境／workflow | .env.example、package.json、deploy.yml → local-development、deployment、testing |
| 畫面／元件 | globals.css、DESIGN、design-system |

## 離線地圖

```powershell
node tools/project-map/build.mjs
```

輸出桌面的 `Lexiro-程式流程地圖.html`，也可在命令後提供其他絕對路徑。內容、原碼、時間、版本都內嵌，搬到其他電腦可離線讀。維護與資料覆蓋細節見[產生器](../tools/project-map/README.md)。

Frontend 快照只取已追蹤原碼與契約。Private Worker 的行為以獨立文件／程式核對，地圖公開來源不內嵌 private prompt、金鑰或供應商輸入。任何地圖只表示建立當下程式，不代表雲端已部署或目前帳戶資料。

## 維護完成條件

新 action／route／模型或設定要補解說，重建地圖並檢查參照。文件相對連結與命令對照 checkout，再跑 `git diff --check`。地圖搜尋、逐步、原碼、盤點、縮放與亮暗色都應可用。

新驗證記錄命令、版本、環境和未測範圍。歷史 product-decisions 或評測不因文件刷新而變成新的正式驗收。
