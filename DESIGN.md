---
name: Lexiro
description: 導覽與操作位置穩定的個人單字學習工作區
colors:
  primary: "#2f5d4a"
  primary-dark: "#8ecdab"
  primary-foreground: "#f6faf7"
  primary-foreground-dark: "#0c1712"
  background: "#fbfcfb"
  background-dark: "#0f1512"
  foreground: "#121a16"
  foreground-dark: "#eaf1ec"
  card: "#ffffff"
  card-dark: "#161d19"
  surface-stage: "#f4f8f5"
  surface-stage-dark: "#0d1310"
  surface-inset: "#eaf0ec"
  surface-inset-dark: "#1a221e"
  muted-foreground: "#5c6b63"
  muted-foreground-dark: "#93a49b"
  study-ink: "#173f32"
  study-paper: "#f4fbf6"
  study-soft: "#c6dfd1"
  study-lime: "#ccf3a9"
typography:
  page:
    fontFamily: '"HarmonyOS Sans TC", "PingFang TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.35
    letterSpacing: "-0.01em"
  section:
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-0.01em"
  group:
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-0.005em"
  body:
    fontSize: "0.8125rem"
    lineHeight: 1.65
  lead:
    fontSize: "0.9375rem"
    lineHeight: 1.65
  row:
    fontSize: "1.0625rem"
    fontWeight: 400
    lineHeight: 1.45
  hint:
    fontSize: "0.8125rem"
    lineHeight: 1.6
  result-score:
    fontSize: "3.5rem"
    fontWeight: 500
    lineHeight: 1
rounded:
  control: "1.5rem"
  card: "1.75rem"
  stage: "2.25rem"
  tab: "1.3125rem"
  navigation: "9999px"
  study-surface: "2.25rem"
  action-dock: "2.125rem"
spacing:
  page-gutter: "clamp(1rem, 2vw, 1.5rem)"
  page-header-gap: "0.5rem"
  page-content-gap: "1.25rem"
  section-gap: "1.5rem"
  block-gap: "1rem"
  row-gutter: "1.25rem"
  action-gap: "0.75rem"
  navigation-bottom: "max(1.125rem, var(--safe-bottom))"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-foreground}"
    rounded: "{rounded.control}"
    height: "2.75rem"
  button-secondary:
    backgroundColor: "{colors.card}"
    textColor: "{colors.foreground}"
    rounded: "{rounded.control}"
    height: "2.75rem"
  workspace-tab:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.tab}"
    height: "2.75rem"
  button-desktop:
    rounded: "{rounded.control}"
    height: "2.25rem"
  mobile-navigation:
    backgroundColor: "{colors.card}"
    rounded: "{rounded.navigation}"
    height: "3.875rem"
  study-surface:
    backgroundColor: "{colors.study-ink}"
    textColor: "{colors.study-paper}"
    rounded: "{rounded.study-surface}"
---

# Design System: Lexiro

## Overview

**Creative North Star: "固定操作的學習工作區"**

延續 HarmonyOS Sans TC、森林綠與既有插畫，讓教材、分頁與主要操作直接可見。
霧白內容、大圓角與緊湊控制承載日常學習。桌機側欄保留導覽，主要操作位於黏附頁首右側；手機保留底部導覽與操作。
內容獨立捲動，分頁切換任務，桌機側欄以 Lexiro 名稱辨識工作區。

**Key Characteristics:**

- 森林綠標示選取與主要操作，中性色承載教材。
- 緊湊分頁切換內容，主要操作在右、次要操作在左。
- 安靜的分組資料列，插畫只輔助空狀態與既有回饋。
- 進度與完成回饋對應已儲存的學習成果。

## Colors

主色來自帶灰的森林綠；中性色略帶綠，完成回饋延續墨綠與春綠。

### Primary

`primary` 用於主要行動、選取、進度與首頁空狀態插畫；`study-ink` 是完成區的底色，
`study-lime` 用於完成區勾選。完成區文字分為
`study-paper` 與較安靜的 `study-soft`。

### Neutral

`surface-stage` 是殼層，`background` 是頁面底色，`card` 承載分組，
`surface-inset` 用於內嵌區與進度軌道。次要文字使用 `muted-foreground`。

深色模式由 `app/globals.css` 的 `.dark` 覆寫語意色與品牌色階；frontmatter 中
`-dark` 項目記錄這些對應值。`study-*` 保持相同值。元件使用 CSS 變數，不自行選擇
亮暗色。錯誤、警告、成功沿用既有語意 token，並配合圖示與文字。

## Typography

所有介面、中英文教材與數字共用 page 中的字體堆疊，以字級、字重和行長分工。
page 對應工作區頁面標題，section 是首頁任務標題，group 保留既有分組標題；body
是首頁說明，lead 為共用標題說明，row 為列表內容，hint 為輔助文字。
result-score 僅用於結算區的本輪記得或答對數量，數字採等寬排列。
首頁說明行長最多 45ch，共用 lead 最多 56ch。中文字距只輕微收緊，避免擠壓字形。

## Layout

殼層高 100dvh，內容區單獨垂直捲動。桌機從 48rem 起使用 13rem 側欄，包含
練習時也保留；內容使用剩餘寬度，主要操作置於 top:0 的黏附頁首右側。
首頁桌機任務分成左右兩欄；保存的單字與題目列表從 80rem 起使用兩欄。手機主要頁面使用高 62px
的底部膠囊導覽，距底為 18px 與安全區的較大值；操作列在導覽上方相隔 12px。
子頁與專注練習收起手機導覽。各尺寸保留相同目的地與順序。
桌機今日任務下方有內容時直接顯示最近教材與未完練習，兩欄排列；手機維持最近分頁。

frontmatter 的間距是手機基準；48rem 起，標題、內容、區段與內部區塊間距依序為
0.75rem、1.5rem、2rem、1.5rem。手機頁邊與資料列 gutter 為 1rem。

**The 穩定操作 Rule.** 用分頁切換工作內容；主要操作在右、次要操作在左。
桌機操作跟隨黏附頁首，手機操作保持底部位置；StepActions 只在手機預留底部空間。
預留區必須是內容的最後一段，位於所有動態解析之後，並隨操作列實際高度更新。
首頁與教材頁的具體內容依 `.impeccable/surfaces/app-workspace.md` 維護。

## Elevation & Depth

以色面、留白和細線分層。分組列表沒有陰影；普通浮起表面及彈出層各用既有 card、
floating 陰影，完整值收在 sidecar。細線由 `--hairline` 控制，高像素密度螢幕縮細。
不要同時以多層卡片、邊線與陰影重複分組。

## Shapes

控制項、群組、外層表面使用 control、card、stage 的大圓角尺度。分頁外軌使用
control，內選取面使用 tab，兩者差值對應 3px 內距；手機導覽使用 navigation
膠囊。根頁操作 dock 使用 action-dock，與內部 control 按鈕差值對應 10px 內距。
首頁任務與列表使用 card，完成區使用對稱的 study-surface。

## Components

### Buttons

手機操作高 44px；桌機頁首操作高 36px、字級 13px，依內容寬度排列。主要使用
primary，次要使用 outline。操作間距 8px；手機兩欄比例為 1:1.3，文字可換行。
Hover、停用與鍵盤焦點沿用共用語意 token 與元件。

### Lists and Fields

以一個群組容納同層資料列，細線分隔同組內容。每列至少高 52px，整列可操作。
一般文字欄位聚焦時使用一條邊框與柔和外光；行內欄位使用整列底色及值的底線。
錯誤使用 destructive 色。保留共用元件的鍵盤、標籤與停用行為。

### Navigation

桌機側欄及手機底部導覽共用 LiquidNav 的選取表面與目的地；新頁提交後才切換目前項目。
手機子頁與專注練習的顯示規則依 AppShell，不另造常駐導航。
返回控制使用手機 44px、桌機 36px 箭頭按鈕，只顯示圖示，返回標籤保留在 aria-label。

### Tabs

工作區分頁等分且高 44px，手機橫跨可用寬度，桌機最大寬度 25rem；選取面用 card，底軌用 surface-inset。
首頁切換今日任務與最近教材；教材頁切換單字、題目與工具，避免把工具堆在內容下方。

### Learning feedback

進度列同時呈現數量、目標、比例與提示文字；達標後，播放圖示換為勾選。
完成區延續墨綠與春綠，只有儲存成功才能宣布完成。動畫輔助狀態辨識，沒有裝飾性
入場等待；減少動態效果設定保留最終數值與狀態。

結算頁由完成區、AI 說明與底部預留區依序排列，不以視窗最小高度置中長文。
手機完成區與解析區使用 section-gap 分隔；長文可捲到固定操作列上方。
英選中取代單字卡自評，與拼字、既有題型在同一頁選擇。英選中不需 AI；
英文置於題目中央，四個中文選項沿用一般答題列與綠／紅語意回饋。
題目、選項與對錯結果作為同一群組在可用空間置中，固定操作的預留空間
不納入群組；高度不足時自然由上往下捲動。拼字也依實際答案判分，不再自評。
英選中結果使用「錯題解析」，混合練習使用「學習解析」。

共用動態使用 generated motion ladder；進度條的 180ms 是局部例外，詳見
`docs/design-system.md` 與 sidecar，不作為新的全域尺度。

插畫沿用既有 Open Doodles SVG 與來源紀錄；閱讀人物以 CSS mask 套色並隱藏於
輔助技術。這次沒有新增點陣圖片。Highlights 維持同一綠色系，不能妨礙閱讀或作答。

## Do's and Don'ts

### Do:

- **Do** 用既有 token、共用字級與元件保持一致，讓學習內容成為畫面主角。
- **Do** 用文字、數值與圖示共同表達進度和錯誤，保留鍵盤焦點與減少動態效果。
- **Do** 在手機、桌機和深色模式確認主要行動與狀態可讀。

### Don't:

- **Don't** 把桌機主要操作放回底部固定列。
- **Don't** 把完成區的強色套滿密集表單。
- **Don't** 把前進操作塞到捲動內容末尾或在分頁間搬動操作區。
- **Don't** 在資料尚未儲存成功前播放完成回饋。
