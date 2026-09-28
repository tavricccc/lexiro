---
name: Lexiro
description: 帶有個性與玩心的個人單字學習空間
colors:
  primary: "#2f5d4a"
  primary-dark: "#8ecdab"
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
  display:
    fontFamily: '"HarmonyOS Sans TC", "PingFang TC", "Microsoft JhengHei", ui-sans-serif, system-ui, sans-serif'
    fontSize: "2.5rem"
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: "-0.025em"
  page:
    fontSize: "1.75rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  section:
    fontSize: "1.125rem"
    fontWeight: 500
    lineHeight: 1.45
    letterSpacing: "-0.005em"
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
rounded:
  control: "0.625rem"
  card: "0.875rem"
  stage: "1.25rem"
  study-action: "0.75rem"
  study-surface: "1rem 1rem 3rem 1rem"
spacing:
  page-gutter: "clamp(1rem, 2vw, 1.5rem)"
  page-header-gap: "0.5rem"
  page-content-gap: "1.25rem"
  section-gap: "1.5rem"
  block-gap: "1rem"
  row-gutter: "1.25rem"
components:
  study-action:
    backgroundColor: "{colors.study-lime}"
    textColor: "{colors.study-ink}"
    rounded: "{rounded.study-action}"
    padding: "0.8rem 1.25rem"
  study-action-hover:
    backgroundColor: "{colors.study-paper}"
    textColor: "{colors.study-ink}"
  study-surface:
    backgroundColor: "{colors.study-ink}"
    textColor: "{colors.study-paper}"
    rounded: "{rounded.study-surface}"
---

# Design System: Lexiro

## Overview

**Creative North Star:「個人的單字遊樂場」**

延續 HarmonyOS Sans TC、墨綠與 Open Doodles，把學習入口做得有個性、願意讓人回來。
深色邀請、明亮行動與手繪人物提供活力；閱讀、設定與整理教材仍以清楚的文字與留白為主。
工作區以實際任務建立辨識，不靠永久側欄或每頁左上角重複 logo。

**Key Characteristics:**

- 墨綠學習表面與春綠行動形成清楚主次。
- 安靜的分組資料列，搭配少量有表情的不對稱學習容器。
- 進度與完成回饋對應已儲存的學習成果。

## Colors

主色來自帶灰的森林綠；中性色略帶綠，學習區用更深的墨綠與春綠呈現精神。

### Primary

`primary` 用於一般行動、選取與進度；`study-ink` 是學習邀請與完成區的底色，
`study-lime` 用於其主要行動與 Open Doodles 閱讀插畫。學習區文字分為
`study-paper` 與較安靜的 `study-soft`。

### Neutral

`surface-stage` 是殼層，`background` 是頁面底色，`card` 承載分組，
`surface-inset` 用於內嵌區與進度軌道。次要文字使用 `muted-foreground`。

深色模式由 `app/globals.css` 的 `.dark` 覆寫語意色與品牌色階；frontmatter 中
`-dark` 項目記錄這些對應值。`study-*` 保持相同值。元件使用 CSS 變數，不自行選擇
亮暗色。錯誤、警告、成功沿用既有語意 token，並配合圖示與文字。

## Typography

所有介面、中英文教材與數字共用 display 中的字體堆疊，以字級、字重和行長分工。
page 對應頁面標題，section 是段落標題，lead 為說明，row 為列表內容，hint 為輔助文字。
lead 行長最多 56ch；不要為同一層標題另造字級。

display 用於學習邀請；手機改為 1.875rem，保留相同字重和行高。首頁的特殊標題
尺度不應套在密集表單。中文字距只輕微收緊，避免擠壓字形。

## Layout

內容寬度基準為 `--content-max`（64rem）。桌機從 48rem 起使用水平導覽；手機在
主要頁面使用底部導覽，並預留安全區及內容底部空間。專注練習收起導覽。各尺寸保留
相同目的地與順序，殼層不重複放 logo。

frontmatter 的間距是手機基準；48rem 起，標題、內容、區段與內部區塊間距依序為
0.75rem、1.5rem、2rem、1.5rem。手機頁邊與資料列 gutter 為 1rem。

首頁的雙欄邀請、手機標題旁小插畫與全寬行動，以及下方進度或三步引導，依
`.impeccable/surfaces/components-home-focus-canvas-tsx.md` 維護，毋須套到所有頁面。

## Elevation & Depth

以色面、留白和細線分層。分組列表沒有陰影；普通浮起表面及彈出層各用既有 card、
floating 陰影，完整值收在 sidecar。細線由 `--hairline` 控制，高像素密度螢幕縮細。
不要同時以多層卡片、邊線與陰影重複分組。

## Shapes

控制項、群組、外層表面使用 control、card、stage 尺度。學習邀請與完成區使用
study-surface 的不對稱輪廓；手機邀請區的右下角為 2rem。study-action 專供春綠
學習按鈕。這些特殊形狀不擴散到每個設定列。

## Components

### Buttons

一般按鈕使用共用元件與語意色。春綠學習行動至少高 3.25rem，文字與前進圖示分居
兩側；hover 轉為 study-paper，鍵盤焦點以清楚外框呈現。手機橫跨邀請區可用寬度。

### Lists and Fields

以一個群組容納同層資料列，細線分隔同組內容。每列至少高 52px，整列可操作。
一般文字欄位聚焦時使用一條邊框與柔和外光；行內欄位使用整列底色及值的底線。
錯誤使用 destructive 色。保留共用元件的鍵盤、標籤與停用行為。

### Navigation

水平及底部導覽共用 LiquidNav 的選取表面與目的地；新頁提交後才切換目前項目。
手機子頁與專注練習的顯示規則依 AppShell，不另造常駐導航。

### Learning feedback

進度列同時呈現數量、目標、比例與提示文字；達標後，播放圖示換為勾選。
完成區延續墨綠與春綠，只有儲存成功才能宣布完成。動畫輔助狀態辨識，沒有裝飾性
入場等待；減少動態效果設定保留最終數值與狀態。

共用動態使用 generated motion ladder；學習 CTA 的 160ms 與進度條的 180ms
是本輪局部例外，詳見 `docs/design-system.md` 與 sidecar，不作為新的全域尺度。

插畫沿用既有 Open Doodles SVG 與來源紀錄；閱讀人物以 CSS mask 套色並隱藏於
輔助技術。這次沒有新增點陣圖片。Highlights 維持同一綠色系，不能妨礙閱讀或作答。

## Do's and Don'ts

### Do:

- **Do** 用既有 token、共用字級與元件保持一致，讓學習內容成為畫面主角。
- **Do** 用文字、數值與圖示共同表達進度和錯誤，保留鍵盤焦點與減少動態效果。
- **Do** 在手機、桌機和深色模式確認主要行動與狀態可讀。

### Don't:

- **Don't** 回到永久 SaaS 側欄或每頁重複 logo 的版型。
- **Don't** 把學習邀請的特殊輪廓與強色套滿密集表單。
- **Don't** 在資料尚未儲存成功前播放完成回饋。
