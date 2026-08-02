# Lexiro UI／UX 全面改版計畫

> 狀態：已依計畫實作並完成驗收。
> 本計畫根據 2026-08-02 的桌面／手機介面稽核與使用者訪談整理。
> 資料模型與產品規則仍以 [product-decisions.md](./product-decisions.md) 為準。

## 1. 改版目標

這次不是另做一套品牌，而是在保留現有黑白、低彩度、圓角與陰影語言的前提下，解決三個結構問題：

1. 單字集內容頁把瀏覽、練習、管理與題目生成擠在同一條長頁面。
2. Dialog 只共用外殼，內容排列、footer、響應式形式和視覺語言仍各自為政。
3. Select／dropdown 留在有 `overflow-hidden` 的容器內，造成裁切、層級和鍵盤操作問題。

最終體驗必須同時服務桌面、平板觸控與手機；桌面可利用較寬空間提升編輯效率，但任何核心操作都不能依賴 hover 才能被發現或使用。

## 2. 已鎖定的產品決策

- 進入單字集後，「立即練習」是主行動，「瀏覽單字」是主要內容，「管理」是次要入口。
- 單字集預設先顯示概覽，不直接打開第一個單字。
- 單字集拆成「概覽／單字／題目」三個獨立分頁，並補齊可直接進入、重新整理和返回的路由。
- 題目管理與單字內容分開；生成題目移入「題目」分頁。
- 點「開始練習」後才顯示練習設定。
- 練習設定在桌面使用置中 Dialog；手機與窄版平板使用 bottom sheet。
- Sense 旁直接提供編輯與刪除；編輯開小型 Dialog，可修改詞性、中文意思與全部例句。
- 刪除 Sense 只有在存在跨單字集、題目或其他關聯影響時才要求確認。
- 短確認框永遠置中；長表單與選擇器只在手機／窄版平板改為 bottom sheet。
- 更新為強制更新；不能提供「稍後」或關閉，但必須保護尚未儲存的編輯內容。
- 保留現有色彩、圓角和陰影語言，補齊缺少 elevation 的主要表面。
- 平板視為觸控裝置；不得把必要按鈕做成只有 hover 才出現。

## 3. 新資訊架構與路由

### 3.1 單字集路由

將目前單一路由 `/set/:setId` 拆成可恢復狀態的子路由：

```text
/set/:setId/overview
/set/:setId/words
/set/:setId/words/:wordKey
/set/:setId/questions
```

路由規則：

- `/set/:setId` 導向 `/set/:setId/overview`。
- 桌面在 `/words/:wordKey` 顯示左側單字清單與右側詳情。
- 手機在 `/words` 顯示單字清單，選取後進入 `/words/:wordKey`；返回只退回單字清單，不跳回字庫。
- 重新整理、上一頁、下一頁與深層連結都必須保留目前分頁和選取單字。
- `setId` 或 `wordKey` 無效時顯示明確的 not-found／不屬於本集合狀態，不靜默跳到第一筆。
- 既有 `/vocabulary/:wordKey` 保留為完整單字管理入口；Set words 與 Vocabulary Page 必須共用 Sense 顯示與操作元件，不能複製邏輯。

### 3.2 單字集共同頁首

三個子路由共用同一個 Set shell：

- 返回字庫。
- 單字集名稱、資料夾、單字數。
- 「開始練習」主按鈕。
- 概覽／單字／題目 tabs。
- 管理 overflow menu：編輯單字集、移動資料夾、匯出、刪除。

手機版頁首只保留名稱、必要 metadata、主要 CTA 與 tabs；管理操作收進明確可見的更多選單。

## 4. 單字集三個分頁

### 4.1 概覽

概覽只回答「目前狀態如何」與「下一步做什麼」：

- 主卡：開始練習。
- 指標：單字數、可用題目數、待複習數、最近一次練習進度。
- 最近學習：最多顯示少量最近單字或進度，不建立第二份完整單字列表。
- 空題庫、無待複習、尚未開始等狀態都要有對應說明與合理 CTA。
- 不在概覽顯示題目生成表單或完整練習設定。

### 4.2 單字

桌面：

- 左側為可搜尋、可捲動的單字清單。
- 右側顯示所選單字詳情。
- 清單與詳情各自控制捲動，頁面本身不因切換單字上下跳動。
- 未選單字時顯示引導狀態，不自動選第一個。

手機／觸控平板窄版：

- 先顯示搜尋與單字列表。
- 選取後以子路由進入單字詳情。
- 不維持目前固定 `64dvh` 的詳情捲動盒；讓內容依正常閱讀順序捲動。

Sense 操作：

- 每個 Sense 卡片都顯示詞性、中文意思、例句，以及編輯／刪除按鈕。
- 觸控與 coarse pointer 永遠顯示操作按鈕。
- 只有 `@media (hover: hover) and (pointer: fine)` 可在非 hover 狀態降低次要按鈕的視覺強度；鍵盤 focus 時必須重新顯示。
- 點編輯開 `SenseEditorDialog`，一次修改詞性、中文意思與所有例句。
- 無關聯影響的刪除立即完成，並顯示可復原 toast。
- 存在其他單字集、綁定題目、最後一個 Sense／最後一個單字等影響時，開影響範圍確認 Dialog。

### 4.3 題目

- 顯示題目總數、題型與難度摘要。
- 提供題型／難度篩選、搜尋、手動新增、批次生成入口。
- 題目列表、題目編輯與生成流程不得出現在「單字」分頁。
- 無題目時用空狀態解釋題目用途，主要 CTA 為「生成題目」，次要 CTA 為「手動新增」。
- AI 生成仍使用既有的 preview page；分頁只負責入口與已保存題目管理。

## 5. 練習啟動流程

點「開始練習」後開啟 `PracticeSetupDialog`：

- 題型。
- 難度。
- 題數與可用題數。
- 無題可練時顯示原因與「前往題目」入口。
- 確認後才建立 session 並進入正式練習路由。

響應式形式：

- 桌面：置中 `max-w-lg` Dialog。
- 手機與窄版平板：bottom sheet，主要動作固定在安全區上方。
- 平板即使採桌面寬度排列，所有 target 仍至少 44×44px，且不依賴 hover。

## 6. 共用 Dialog 系統

### 6.1 元件責任

擴充現有 `src/components/ui/dialog/Dialog.vue`，不建立第二套 modal：

- `Dialog`：Portal、overlay、focus trap、Escape／backdrop policy、responsive presentation、stacking。
- `DialogHeader`：icon／eyebrow、title、description、close action 的統一網格與對齊。
- `DialogBody`：唯一可捲動區域。
- `DialogFooter`：主要／次要／危險操作排序、mobile full-width 和 safe-area。

預設 API 至少包含：

- `size`: `sm | md | lg | xl`。
- `presentation`: `center | responsive-sheet`。
- `tone`: `default | destructive | mandatory`。
- `closePolicy`: `escape | backdrop | explicit | blocked` 的明確組合。
- `busy` 與 `initialFocus`。
- header、default、footer slots。

### 6.2 版面規則

- Header、body、footer 使用同一組水平 padding token，不再由功能 Dialog 自行補齊。
- Footer 與 body 分離；長內容捲動時操作區保持可見。
- 一般 Dialog 不在 body 裡再包多張有強陰影的大卡片；需要分組時使用 inset section。
- 短確認框置中且不使用 mobile bottom sheet。
- 長表單、picker、匯入／匯出流程在手機使用 bottom sheet。
- 所有功能 Dialog 移除自製 footer、任意品牌色與不一致的分隔線。

### 6.3 更新 Dialog

將 `VersionUpdateDialog` 收斂為同一套 mandatory Dialog：

- 無關閉、Escape、backdrop click 或「稍後」操作。
- 保留清楚的更新圖示，但移除獨有的綠色發光與持續旋轉裝飾。
- 只有一個主要動作：「立即更新」。
- 若目前頁面沒有未儲存資料，立即執行更新。
- 若存在 dirty form，Dialog 改為「保存並更新／放棄變更並更新」；不能直接 reload 丟失資料。
- 更新失敗時留在 Dialog 內顯示可重試狀態，不讓畫面卡在無限 loading。

## 7. Overlay、Select 與 dropdown 層級

### 7.1 統一 layer token

在 theme／constants 建立唯一層級表，不再由元件散落 `z-50`、`z-[70]`：

```text
base content
sticky navigation
popover / dropdown / select
dialog overlay
nested dialog
toast
```

### 7.2 Select 重構

重做現有 `src/components/ui/select/Select.vue`：

- 選單 Portal／Teleport 到 `body`，避免被 Card、Dialog body 或其他 overflow ancestor 裁切。
- 依 trigger 實際位置計算寬度與座標。
- 支援上下翻轉、viewport collision padding 與最大可用高度。
- Dialog 內的 Select 必須仍屬於正確 focus scope，且高於 Dialog panel、低於 nested Dialog。
- 完整支援 Arrow Up／Down、Home／End、Enter、Space、Escape、typeahead 與 disabled option。
- 使用正確 combobox／listbox／option semantics、`aria-expanded`、`aria-controls` 和目前選項狀態。
- `onClickOutside` 必須同時理解 trigger 與 teleported content。

優先評估使用專案既有的 `reka-ui` Select／Popover primitive，避免自行維護 positioning 與 accessibility 邏輯。

所有卡片 action menu、folder picker 與未來 popover 都必須建立在同一套 Portal／positioning primitive 上。

## 8. 其他頁面的整理範圍

### 首頁

- 保留今日學習主題。
- 強化唯一主 CTA，避免卡片彼此同權重。
- 補齊有資料／無資料狀態的相同視覺節奏。

### 字庫

- 保留資料夾樹，但減少「樹、資料夾列表、breadcrumb」三套導航同時競爭。
- 卡片管理 menu 改用共用 Popover／Menu。
- 搜尋、資料夾位置與結果數形成同一個 toolbar。

### 字典

- 保留目前清楚的搜尋主入口。
- 空白頁補上最近查詢、已保存單字或簡短使用提示；沒有資料時不留下整片無意義空白。

### Vocabulary

- 保留「字義與例句／題目」分頁。
- Sense 顯示、SenseEditorDialog 與刪除影響確認必須和 Set words 共用。
- 避免同一個 Sense 在兩頁存在兩套操作 UI。

### 統計

- 有資料時維持指標 → 記憶 → 題目 → 趨勢的層級。
- 零資料時不要先展示完整九列 0 值題型表；改為簡化 empty state。
- Select 使用新 Portal，避免統計範圍選單被卡片裁切。

### 設定

- 修正直接顯示 `sync.signed-out` 的 i18n key。
- 將「儲存／恢復／匯出／匯入」整理成主要動作與次要管理動作。
- 保留帳號、每日目標、AI provider 三個清楚區段。

## 9. 視覺與響應式規則

- 保留現有 HarmonyOS Sans TC、黑白／暖灰 palette、圓角與低彩度語言。
- `surface-card` 使用 card shadow；浮動選單使用 floating shadow；Dialog 使用 modal shadow。
- 補陰影只限真正有 elevation 的主要表面，不在每個巢狀 section 疊加陰影。
- 主要頁面統一 title、section heading、body、metadata 四級文字層級。
- 互動 target 最小 44×44px。
- focus-visible 不能被 hover 樣式覆蓋。
- 390px 手機、768px 觸控平板、1024px 寬平板與 1280px 桌面都列入 QA。
- 版面 breakpoint 不能被當成輸入方式判斷；是否隱藏 hover affordance 必須依 `hover`／`pointer` media feature。

## 10. 建議元件拆分

所有 `.vue` 檔案維持 400 行以下；相同邏輯出現兩次即共用。

```text
src/components/set/
  SetShell.vue
  SetOverviewPanel.vue
  SetWordsPanel.vue
  SetWordList.vue
  SetWordDetail.vue
  SetQuestionsPanel.vue

src/components/word/
  SenseCard.vue
  SenseList.vue
  ExampleList.vue

src/components/dialogs/
  PracticeSetupDialog.vue
  SenseEditorDialog.vue
  SenseDeleteImpactDialog.vue
  VersionUpdateDialog.vue

src/components/ui/dialog/
  Dialog.vue
  DialogHeader.vue
  DialogBody.vue
  DialogFooter.vue

src/components/ui/popover/
  Popover.vue
  Menu.vue

src/components/ui/select/
  Select.vue
```

計算關聯影響、練習選項與 overlay layer 的邏輯放在 `src/lib/` 或 `src/constants/`，不得塞回 view component。

## 11. 實作階段

### Phase 0：建立視覺與互動基線

- 為現有桌面、手機與觸控平板狀態保存基準截圖。
- 建立 Dialog、Select、Set route 的互動測試清單。
- 盤點所有自製 modal、menu、dropdown 與硬編碼 z-index。

### Phase 1：Overlay 與 Dialog 基礎

- 建立 layer tokens、Portal Popover/Menu 與新版 Select。
- 擴充唯一 Dialog primitive、header/body/footer 與 responsive presentation。
- 先遷移 Confirm、Version update、Folder picker 作為三種代表案例。
- 驗證 nested overlay、focus trap、scroll lock 和 mobile safe-area。

### Phase 2：單字集路由與 Shell

- 新增 overview／words／word detail／questions 子路由。
- 將 `SetStudyView.vue` 瘦身為 route shell 或拆除，由子頁元件負責內容。
- 實作共同 header、tabs、管理 menu 與路由恢復。

### Phase 3：概覽與練習設定

- 建立精簡 Overview。
- 建立 PracticeSetupDialog／bottom sheet。
- 移除 Set page 內永久顯示的練習設定卡片。

### Phase 4：單字與 Sense 管理

- 建立桌面 split view、手機 list → detail route。
- 共用 SenseCard、ExampleList 與 SenseEditorDialog。
- 實作關聯影響檢查、條件式確認與無關聯刪除 undo。
- 套用 coarse／fine pointer 顯示規則。

### Phase 5：題目分頁

- 移入題目摘要、篩選、管理、手動新增與 AI 生成入口。
- 移除單字分頁和概覽底部的題目生成 UI。
- 接回既有 preview page，不改題目 domain 規則。

### Phase 6：其餘頁面收斂

- 字庫導航與 card menu。
- 字典空狀態。
- Vocabulary 共用 Sense 元件。
- 統計零資料狀態與新 Select。
- 設定動作層級、陰影與 i18n 修正。
- 首頁 CTA 與卡片權重整理。

### Phase 7：完整 QA 與清理

- 桌面、手機、觸控平板的視覺比較與主要流程測試。
- 鍵盤、focus return、screen reader semantics、reduced motion 與 200% zoom。
- 移除舊 dropdown、重複 footer、任意 z-index 與不再使用的翻譯。
- 執行 typecheck、lint、unit tests，並檢查 Vue 行數與 Rule of Two。

## 12. 驗收條件

### Dialog

- 所有 Dialog header、body、footer 對齊一致。
- 長內容只有 body 捲動，footer 持續可用。
- 短確認桌面和手機都置中；長表單只在窄觸控版變 bottom sheet。
- 強制更新不可關閉，dirty form 不會因 reload 遺失。
- 關閉後 focus 回到觸發控制。

### Select／dropdown

- 放在 `overflow-hidden` Card、可捲動 Dialog 和頁面底部時都不裁切。
- 遇到 viewport 邊界能翻轉或縮短高度。
- 滑鼠、鍵盤與觸控均可完整操作。
- 不再由各功能元件自行指定 z-index。

### 單字集

- 預設進入 Overview，立即看見主要 CTA。
- Words 與 Questions 完全分離。
- 路由可直接載入、重新整理、上一頁／下一頁並保留狀態。
- Sense 操作在觸控裝置永遠可見。
- 開始練習前才出現設定；取消不建立 session。

### 工程品質

- 無 `.vue` 檔超過 400 行。
- Dialog、Sense、Select、Menu 邏輯沒有第二套實作。
- 所有新增使用者文字進入 `src/locales/zh-TW.ts`。
- `npm run typecheck`、`npm run lint`、`npm run test` 全部通過。

## 13. 明確不在本次範圍

- 不重新設計品牌 palette、logo 或字體。
- 不改變資料模型、FSRS、題目抽取、Cloud Sync 或匯入匯出規則。
- 不增加新的正式題型。
- 不把每個頁面都改成高陰影卡片；陰影只表達 elevation。
- 不在本規劃階段修改任何產品程式碼。
