# Lexiro design system

Lexiro 是固定操作的個人單字學習工作區。森林綠標示主要行動與選取，中性色承載
閱讀、整理與作答；緊湊分頁切換內容，桌機操作位於黏附頁首，手機操作保留底部
位置。插畫輔助空狀態，完成回饋保留墨綠與春綠。

`DESIGN.md` 記錄可重用的視覺 token 與規範；本文件補充元件、互動和實作規則。

## Colour

The palette is forest ink green on mist-white neutrals, per `PRODUCT.md`.

Text inputs, textareas and boxed selects share one focused border and a soft
outer halo. Grouped list inputs highlight their row and underline the value;
they do not draw the global outline around the inline text area. Invalid
focused controls use the destructive token. Keyboard focus remains visible.

`app/globals.css` defines a nine-step brand ramp as `--brand-50` … `--brand-900`
and registers it in `@theme inline`, so `bg-brand-50`, `text-brand-600` and the
rest are real Tailwind utilities.

The dark theme **inverts the ramp** rather than adding a second one: `--brand-50`
is the palest tint in light mode and the deepest green in dark mode, and
`--brand-600` is the primary in both. A component written as `bg-brand-50` with
`text-brand-600` therefore works in both themes with no `dark:` variant. Reach
for `dark:` only where the ramp genuinely cannot express the intent.

The pale end of the light ramp remains a visible sage (`--brand-50`), used for
selected surfaces. Check selected navigation and progress tracks against the
page ground in both themes.

完成區使用 `--study-ink`、`--study-paper`、`--study-soft` 與 `--study-lime` 勾選；
這組顏色在深色模式保留相同值。首頁任務表面使用 `--card`，空狀態閱讀插畫與
主要行動使用 `--primary`。工作區使用 `--surface-stage`，桌機側欄使用 `--card`。

Semantic tokens (`--primary`, `--muted`, `--border`, `--destructive`, …) all
resolve to the ramp or to green-tinted neutrals; borders are green-tinted
translucent black rather than pure black, which is what keeps large hairline
areas from looking grey against the mist-white ground.

`--success` sits deliberately in teal, away from the brand green, so a success
state cannot be mistaken for ordinary brand chrome. Success and failure always
pair an icon with text — colour is never the only signal.

Surfaces: `--background` is the page ground, `--card` is a raised surface,
`--surface-stage` is the app frame, and `--surface-inset` is a recessed panel —
the inline forms in the folder toolbar, the settings toggle row, the track behind
a proportion bar.

**Never hard-code a colour.** Hover states use `--primary-hover`,
`--secondary-hover` and `--surface-hover`; error text uses `text-destructive`,
never `text-red-700`.

## Typography

One face. **HarmonyOS Sans TC** (`--font-sans`, bundled locally) sets the whole
product: labels, buttons, navigation, body copy, headings, headwords, example
sentences and every large figure.

There used to be a second, lexical face on `--font-lexical`, meant to make a
screen read as a dictionary rather than as an app. It never actually loaded a
second family — the token pointed back at `--font-sans` — so `font-lexical`
marked some text as special while rendering it identically to everything around
it. What separates the study material from the interface is size, weight,
measure and the entry classes below, not a face that was never there.

Dictionary entries have their own classes in `globals.css`: `.entry-headword`,
`.entry-pos`, `.entry-citation`, and `.entry-senses` / `.entry-sense`, whose CSS
counter numbers senses — and, via `:has(.entry-sense:only-child)`, suppresses the
number when there is only one sense. A single-sense word should never be labelled
"1".

## The type scale

Every heading in the product is on one scale, defined in `globals.css`:
`.type-page` for a page title, `.type-section` and `.type-subsection` beneath it,
`.type-lead` for the measured sentence that explains a heading, `.type-hint` for
a quieter aside, and `.type-label` for a control label. The gap between a
heading and the sentence under it belongs to the pairing and is set by the
scale, so no caller guesses it.

工作區在 `workspace.css` 收斂字級：頁面標題為 1.25rem、行高 1.35；首頁任務
標題為 1.125rem、行高 1.4；首頁說明為 0.8125rem、行高 1.65、行長最多 45ch。
任務資料列標籤 14px，勾選圖示表面 32px。
共用分組與教材資料列繼續沿用既有 scale，不把首頁說明字級套到單字內容。

Tracking is negative only where the type is large enough for the default spacing
to look loose, and never enough to crowd Chinese, which is set on a square body
and has no side bearings to give back. The classes live in `@layer components`,
so a caller that narrows a lead's measure with a utility still wins.

Screens do not invent a weight, tracking or leading for a rank of heading they
already have. That drift — five pages each styling the same rank differently —
is what made titles stop reading as titles.

## Radius encodes hierarchy

全站以大圓角保持一致：控制項、內容群組、外層表面依序放大。

| Token             | Value     | Used for                            |
| ----------------- | --------- | ----------------------------------- |
| `--radius-control`| 1.5rem    | buttons, inputs, selects, tab rails |
| `--radius-card`   | 1.75rem   | panels, inline forms, list surfaces |
| `--radius-stage`  | 2.25rem   | sheets and completion surfaces     |
| `--radius-segment`| 1.3125rem | tab selection inside a 3px rail     |

按鈕、分頁、表單、列表與彈出層共用語意尺度，不另造小圓角。手機根頁操作 dock
外角為 `calc(var(--radius-control) + 0.625rem)`（34px），對應 10px 內距與內部
24px 按鈕。完成區使用對稱 stage 圓角；手機導覽維持膠囊。

Tailwind's `rounded-md` / `rounded-xl` / `rounded-3xl` are mapped onto these, so
existing utilities keep working while the scale stays deliberate.

## The grouped list

A phone reads a setting, a choice, or a fact as one line: what it is on the
left, what it is set to on the right. `components/ui/list.tsx` is that shape and
every screen that asks for something uses it.

- `ListSection` is a group: a quiet header above it, the rows in a `.rule-card
  .rule-list`, and a footer sentence below explaining what changing the group
  does. The footer is where explanation goes, never a paragraph between rows.
- `ListRow` reports, `ListNavRow` leads somewhere (chevron), `ListChoiceGroup` is
  a labelled Radix radio group with checkmarked rows and arrow-key navigation, `ListPicker` uses the shared select popover instead
  of unfolding options into the current page, `ListSwitchRow` is on/off,
  `ListStepperRow` is a small
  whole number, `ListInputRow` is a value you type on the line that names it
  (`block` puts the label above for a sentence), and `ListActionRow` is a
  centred, tinted row that does something now.
- A choice within a form or settings group uses `ListPicker`, whose shared select
  popover keeps the page layout stable. A task with its own consequence or more
  than a handful of choices belongs on its own page.
- A study card or flow step keeps its advancing action on shared `StepActions`:
  desktop uses the sticky page header; mobile uses the safe bottom edge and
  reserves matching space. The learner need not scroll to the end to continue.
- Rows are at least 52px tall and the whole row is the target, never the
  chevron or the label alone.

表單選項使用列表或 ListPicker；工作內容切換使用 LiquidTabs。底部雙欄按鈕是
任務操作，不充當選項：次要在左、主要在右。只需一個操作的流程可使用全寬主要
按鈕，其餘同層選項維持分組資料列。

Type for rows is set by `.type-row` (17px, the platform's reading size),
`.type-row-detail`, `.type-row-value`, `.type-list-header` and
`.type-list-footer`.

## Separation

Three ways to separate, and only three: a **card** groups the things that sit at
the same level, a **hairline** divides the rows inside one card, and **space**
divides the sections of a page. Nothing is separated twice, which is why a card
has no outer rules and a divided row has no border of its own.

- `.rule-card` is the surface: a hairline border, the card radius, the card
  background, no shadow, and the row gutter. Anything that is a set of
  peers — a listing, a stat strip, an empty state standing in for a list —
  is one card.
- `.rule-list` adds the rules between its children. A card only takes it when
  its children really are a stack of rows: a card holding a grid of figures is
  one block, not four.
- `.rule-t` / `.rule-b` divide two halves of the same page or panel, where a
  card would wrongly claim the halves are two separate things.

A hairline is the thinnest line the display can draw, not a whole CSS pixel:
`--hairline` is `1px` and drops to `0.5px` above 1.5dppx. A 1px rule is two
device pixels on a 2x screen, and that weight is what makes a divided list read
as an unstyled table.

The gutter (`--row-gutter`) belongs to the card, not to each row, so every row
in every list lines up on the same two edges whatever it is made of. The rules
are inset by that gutter and the press tint from `.t-row` is not: the tint is
the row being touched, so it reaches the card's edges, while a rule that ran
into the card's own border would draw the same corner twice.

## Spacing

The mobile rhythm is intentionally compact: `--page-header-gap` is 0.5rem
between the back row, title row and optional progress row;
`--page-content-gap` is 1.25rem from that header to the first task;
`--section-gap` is 1.5rem between major sections; `--block-gap` is 1rem inside
one task. From tablet width, those values grow to 0.75rem, 1.5rem, 2rem and
1.5rem respectively. `PageHeader` owns the first two; `.section-gap` and
`.block-gap` cover the others. Keep the safe-area inset in the app shell so
phone content starts below the status bar without an extra page-level offset.

### Practice results and AI explanations

`ResultPanel` keeps the saved result, AI explanation and `StepActions` spacer in
that reading order. The spacer is the last child, including after an explanation
arrives. On mobile it reserves the measured height of the fixed action panel;
placing it before the explanation creates a blank gap and leaves the last lines
behind the buttons. Desktop actions stay in the sticky header and need no spacer.

The result uses normal document flow instead of a viewport-height centered
column. Mobile section spacing is 1.5rem, with 1.5rem of padding above the
explanation heading. The existing page and list gutters remain unchanged.

Card results use 「單字介紹」 and 「再複習未記熟單字」. Their AI content introduces
the supplied meaning, example, usage and memory cues. Question results retain
「錯題解析」 and 「重做錯題」; mixed results use 「學習解析」 and
「再練習待加強內容」. Memory self-ratings do not establish an answer mistake.

Local verification on 2026-10-01 used synthetic introduction text at 393×852 and
1366×900. The mobile final line remained above the fixed footer after scrolling
to the end, and desktop actions stayed in the header without horizontal overflow.
This verifies layout, not live paid AI output or cache hit rates.

## Motion

Every duration and curve in the product is a rung of one ladder, generated from
`config/motion.config.json` into `src/generated/motion-ladder.css` (custom
properties) and `src/generated/motion-tokens.ts` (the same rungs in seconds, for
animations driven from JavaScript). Regenerate with `npm run generate:motion`;
never edit the generated files. Except for the study-surface interactions
documented below, use this ladder rather than literal durations or curves.
A recipe picks a rung by what the motion *means*,
not by feel — if an interaction does not fit a rung, the ladder is wrong.

The pacing is iOS's. A touch is acknowledged in `--motion-touch` (100ms), a
control settles in `--motion-control` (250ms), moving to another place takes
`--motion-nav` (460ms), and a layer presented over the current place takes
`--motion-sheet` (560ms) because it travels furthest. Leaving is always quicker
than arriving, which is what `--motion-control-exit` and `--motion-sheet-exit`
are for. Arrivals decelerate (`--ease-arrive`), dismissals accelerate
(`--ease-depart`), travel between two known positions is symmetric
(`--ease-move`), routes use the iOS navigation curve (`--ease-nav`),
and success feedback uses the same settled arrival curve rather than overshooting.

JavaScript reaches the ladder through `timing(rung, curve)` in
`lib/motion-timing.ts`, which is also what `MotionConfig` is given, so Motion and
CSS cannot drift apart.

**Route reveals.** Navigation retains the current page while the server prepares
the destination; there is no route-wide instant skeleton boundary. `RouteSurface`
starts its reveal when the destination commits, including any remaining local
loading state. Ready content fades within the surface at 180ms instead of replaying
the entire slide. Forward navigation travels 56px from the
trailing edge; returning travels from the leading edge. Peer destinations fade
and rise 12px. These reveals use the Web Animations API at 320ms with the arrival
curve, and respect reduced motion. They animate only the incoming live surface;
navigation and pinned actions remain usable.

`lib/navigation-memory.ts` derives route direction from the hierarchy and browser
history. Back links explicitly mark a return, including practice-to-set links
whose URL depth increases. An in-place back control marks `markViewDirection("back")`; changing the
screen marker replays the return reveal even when the URL stays the same. Page
headers and practice session/result surfaces share this mechanism. Home and set
tabs crossfade their content through `ContentTransition`, retaining fixed actions.

Grouped study tasks draw their separator on an independent straight pseudo-element,
so large control corners cannot bend the divider into an arc.

**Press.** One press vocabulary, applied by the stylesheet to every interactive
role at once: the surface sinks a pixel and gives up two percent. Components do
not add their own `active:` scale. A card takes a smaller share (`.t-card`), and
a row in a divided list answers with a rounded tint that bleeds past the row
rather than travelling (`.t-row`), because a row that moved would tear the
hairlines it shares with its neighbours.

**Navigation feedback.** Primary navigation reads Next Link's pending state and
keeps the current route selected until the new page commits. Segmented controls
likewise follow their controlled value; cancelled touches cannot move either
selection. Both share a moving selection surface. `NavigationFeedback` answers
other taps on a destination
before the destination commits: the control that was tapped wears
`data-navigating`, and a progress line crawls at the top of the window. It is
reserved for navigation — an ordinary button is already answered by the press
state, and echoing it doubles the feedback without adding meaning.

**Entrances.** Furniture that arrived with its route does not animate; the route
transition already delivered it. `.t-panel-reveal` is for a panel that is
genuinely new on a screen the user is already looking at. Lists hand over
through `StaggerList` / `StaggerItem`, which never animate the rows they were
born with and never delay a row by its index. A container whose state changes
in place uses `StateTransition` + `ContentTransition`; the content crossfades
without animating layout properties or observing the document for reflow.

Data visuals still animate once on mount: `.dashboard-bar` grows a proportion bar
from its leading edge (`--dashboard-bar` carries the ratio), `.dashboard-column`
grows a chart column up from the baseline.

Everything above is disabled under `prefers-reduced-motion`. Proportion bars
retain their final scale without animation, so reduced motion never changes the
reported value. Keyboard focus uses the primary colour and an inset outline in
clipped list surfaces. Touch controls have a minimum 2.75rem target.

`PageHeader` owns the sticky top material. 工作區標題與分頁使用不透明的
`--surface-stage`，關閉共用 header 的 backdrop blur，避免疊加模糊層。

`app/styles/study.css` 的進度條 transform 使用 180ms transition，在
`prefers-reduced-motion` 下停用。這不是新的全域 motion ladder；底部按鈕沿用共用動態。

## Workspace navigation and learning feedback

殼層高 `100dvh`、不捲動；`workspace-body` 是獨立內容捲動區。桌機從 `48rem`
起使用寬 `13rem` 的側欄，包含練習時也保留；內容使用剩餘寬度。
手機主要頁面使用 Novae 同型的膠囊底部導覽，高 `3.875rem`，底距為
`max(1.125rem, var(--safe-bottom))`。子頁與專注練習收起手機導覽。
桌機側欄顯示 Lexiro 名稱；頁面標題直接說明目前任務。

工作區 LiquidTabs 等分且高 `2.75rem`，手機橫跨可用寬度，桌機最大寬度 `25rem`。
首頁切換今日任務與最近教材；教材頁切換單字、題目與工具。已有教材時顯示單字
與題目的每日進度；尚無教材時顯示三步引導與小型閱讀插畫。
進度以數字、進度條與提示文字共同表達，達標才把播放圖示換成勾選。
完成畫面必須等學習紀錄儲存成功才呈現；儲存失敗要保留可重試的工作。

StepActions 在桌機將操作 portal 到 PageHeader 右側的 `data-page-actions-host`，
頁首 sticky `top:0`。桌機操作高 `2.25rem`、字級 `0.8125rem`，依內容寬度排列，
沒有底部固定列與佔位。手機將操作 portal 到 body，量測高度並預留底部空間，操作
高 `2.75rem`、兩欄比例 `1:1.3`；主要在右、次要在左，間距 `0.5rem`。
手機根頁操作列位於導覽上方 `0.75rem`，子頁位於安全底邊。
輸入聚焦時隱藏手機導覽與其上方操作列，避免與軟鍵盤競爭。

首頁桌機任務內容左右兩欄，保存的單字與題目列表從 `80rem` 起使用兩欄；手機一欄。
桌機今日任務下方在有內容時直接呈現既有 LearningRows 的最近教材與未完練習，
兩欄排列；手機維持最近分頁，不建立虛構教材或練習。

返回控制是手機 44px、桌機 36px 箭頭按鈕，只顯示圖示，保留 `aria-label` 提供完整返回目的地。

全站含公開頁、工作區與 portal 彈出層預設使用 `user-select: none`、
`-webkit-user-select: none` 與 `-webkit-touch-callout: none`。
英文題幹、文章標題與正文用 `question-text` 明確恢復 `user-select: text` 和
`-webkit-touch-callout: default`，讓系統選字／翻譯可用；作答按鈕及操作區維持停用。
欄位仍可打字、貼上、移動游標，沿用主綠 caret 與鍵盤焦點。

閱讀插畫沿用 `public/illustrations/open-doodles-reading.svg`，以 CSS mask 套用
主綠。保留原 SVG 來源紀錄；這次沒有新增 raster 素材。插畫是輔助內容，使用
`aria-hidden`，不能取代操作標籤或狀態文字。

2026-10-01 的本機驗證範圍涵蓋新增與儲存教材、分頁切換、進入練習，以及手機／桌機／手機深色
畫面。266 tests、lint、typecheck、build 通過；當前精簡殼層圖為
`.impeccable/review/compact-desktop.png` 與 `compact-mobile.png`。
真實 Firebase 同步與付費 AI 執行不在本機驗證範圍。

## 題目與文章工作區

2026-10-03 改版沿用原 token 與固定操作。`QuestionWorkspace`／`QuestionCard` 的畫布
最大寬度 72rem，從 64rem 起文章與當前小題並列，更窄時由 LiquidTabs 切換。
文章字級手機 1rem、從 40rem 起 1.0625rem，行高 1.9；校對選項與解說使用
1rem、行高 1.75。完整錯項文字與理由上下排列，不能使用不可收縮的長文字欄。

`QuestionPager` 切換題目及空格，答案鍵可以定位原文。共用 bank 只編輯一次，
`OptionReasons` 以選項文字維護理由；`DistractorReasonsEditor` 提供逐項校對。
分頁連到實際 panel，文章支援鍵盤捲動；同篇下一題保留閱讀位置。

專注答題的頁首把返回、題數／題型、保存圖示、稍後複習與跳過放在同一列，
下面只留進度條；次要圖示按鈕保留手機 44px 目標及完整無障礙名稱。
保存成功以勾選圖示呈現，完整狀態供輔助技術與桌機 title 讀取；失敗展開就地文字。
題幹直接接在頁首後，不再另占保存與標記操作兩列。
每題完成保存後，答對與答錯都顯示正解、解說及依目前選項順序排列的全部已有錯項解析。
文章只顯示當前小題的解析，未作答或仍保存中的題目維持不揭答。

2026-10-08 的 headless Chromium 檢查使用真正 App 與獨立合成教材，涵蓋
390×844、320×740 深色與 1366×900。手機頁首高 68px、桌機 52px，題幹距頁首
12px；三種尺寸沒有橫向溢出，完整解析可捲至固定操作列上方。
英文題幹可實際拖選；操作按鈕維持不可選取，搜尋欄位可正常輸入。
11 個練習／共用無障礙測試、typecheck 與 lint 通過。畫面與量測保存於
`.impeccable/review/practice-compact-*.png`、`practice-feedback-*.png` 與 `practice-ui-qa.json`。
實體 iPhone 的系統長按翻譯尚未驗證；本輪沒有新增翻譯 API。

這次真正 App 的合成教材檢查範圍為 1366×900、390×844 的編輯、閱讀、作答及
長理由排版；修改選項與理由後，實際保存並重新開啟確認。獨立複核發現的長理由
排版及選項／理由關聯兩項均修正後判為 resolved。未用模型產出的圖片或臨時 mock 路由
當驗收畫面。深色、200% zoom、真實雲端與登入生成不在這批畫面證據中。

前一輪靜態 detector 僅回報既有鍵盤提示 11px 的字級 advisory；不將它擴成新的正文尺度。

本輪手機收斂新增 `QuestionMetadata`：標題／難度預設收合，必填錯誤自動展開，
等展開完成才聚焦。練習選項統一 16px／24px，十選項在手機單欄，640px 起雙欄。
共用答案顯示所用格號並停用，重新開啟仍保留。文章有一鍵回題目；短橫向專注練習
收起側欄並保留閱讀區至少 12rem。

確認範圍包含 320×740、390×844、844×390 與 1366×900，使用真正 App 的合成教材，
涵蓋英選中、出題配置、題庫、校對保存、必填錯誤、空格定位、作答、草稿接續及深色長解析。
窄手機最後解析仍位於固定儲存列上方；正文與作答列未溢出。列表分隔線向列外框延伸是既有樣式。
這是受控瀏覽器的手機尺寸驗證，尚未使用實體 iPhone／Android 驗證虛擬鍵盤或系統安全區；
生成配置未呼叫正式 AI，雲端生成、帳單及 cache hit 不在本輪驗收範圍。

## Components

Shared primitives live in `components/ui/` and are the only place a control's
markup is defined:

- **`Field` / `FieldRow`** — the one label-and-control pairing. `layout="stacked"`
  for editors, `layout="row"` for settings lists. There is no second Field.
- **`SelectField`** — every select in the app. Call sites pass
  `options: {label, value}[]`; nobody hand-rolls a trigger and content, and
  nobody writes a native `<select>`. Radix rejects an empty option value, so a
  "none" choice needs a sentinel (see `ROOT_VALUE` in the folder toolbar).
- **`PageHeader`** — the single content header, with optional `back` and `actions`
  slots and a HarmonyOS Sans TC page title. Brand identity comes from the shared
  typography, green palette, and illustration rather than a repeated shell logo.
- **`LoadingState` / `EmptyState` / `ErrorState`** — no page writes its own. The
  `empty` variant of `EmptyState` can show a ghost dictionary entry via
  `headword` / `pos`, so an empty screen shows the shape of what belongs there;
  the `filtered` variant is for a query that matched nothing, where the fix is to
  change the query rather than to create anything.
- **`Markdown`** — model output is rendered through this, never through
  `whitespace-pre-wrap`. The prompts ask for markdown, so users would otherwise
  see raw `###`.
- **`AnswerOptions`** — the four choices with the correct one marked in place,
  shared by the question editor and each sub-question of a reading pack.

Option lists that are shown on more than one screen live in
`lib/question-options.ts` (`difficultyOptions`, `questionStyleOptions`,
`generatorKindOptions`), so a difficulty never appears as "難度 2" on one screen
and "中等" on the next.

## Icons

`components/ui/icons.ts` maps concepts to lucide glyphs and is the only place a
feature component gets an icon from. The rules live beside the map:

- One glyph per concept, everywhere. Add a concept to the map rather than
  importing from `lucide-react` in a feature file.
- Every action button carries its icon. A row of buttons is all icons or none —
  a mixed row reads as an accident, which is exactly how the questions page used
  to look.
- Icon-only buttons are allowed for secondary and destructive actions inside list
  rows and toolbars, and always need an `aria-label`.
- Icons inherit colour from the text beside them. The same concept is never
  tinted differently in two places.

## Copy

App 更新位於「我的」分組列表，沿用既有資料列與行動列。檢查、等待本機儲存、
重新啟動各有明確文字與忙碌狀態；錯誤留在該組並用 alert 宣告，不另開彈窗。
其他畫面的工作不因恢復連線或其他分頁更新而被重整。同步尚有 pending 時，
所有入口統一顯示等待同步，完成回饋必須與實際狀態一致。

備份操作在原按鈕顯示「正在讀取備份」／「正在準備備份」，等待期間停用重複
操作。匯入確認的數量隨目前資料更新，執行中固定閱讀內容；失敗保留同一檔案
供重試。部分儲存成功時要說明已合併的教材與未完成的學習紀錄，帳號變動則
提供重新選檔。完成回饋只在教材與學習紀錄都儲存後出現。

All user-facing strings live in `lib/i18n.ts` and are reached through `t()`. The
key union is derived from the object, so a missing key is a type error rather
than a string that leaks to the screen.
