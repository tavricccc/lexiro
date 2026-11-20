# Design kit

Lexiro 的設計系統：色彩、圓角、高度 token、動態階梯，以及建在 [ui-sdk](https://ui-sdk.dev) 上的 React 元件。ui-sdk 負責鍵盤、焦點、ARIA、彈出層與手機底部面板，這裡只負責外觀。

## 使用

```css
/* app.css */
@layer ui-sdk;
@import "tailwindcss";
@import "design-kit/styles.css";
```

`<head>` 內嵌 `design-kit/theme-script.js`，第一次繪製前就設好 `data-theme`。

`DesignKitProvider` 接收 `navigation`（`href`、`navigate`、選用的 `back(parent)`）與 `labels`，元件本身不 import router。

## 視覺語言

活潑、有觸感的遊戲風格：

- 主色 grape 紫（`contrast`）只給主要動作；`highlight` 陽光黃給連續天數、獎勵；`positive`、`danger` 只代表答對、答錯。
- 可按的東西底下有一條較深的邊（`--contrast-edge`、`--line-strong`、`--danger-edge` …），按下時表面往下壓進去。
- 卡片是白底加 2px 邊框和底邊；浮動的列（dock、操作列）用 `glass-float`。
- 數字、單字用 `font-latin`（Albert Sans），字重偏粗（bold、extrabold）。

## Token

| Tailwind 名稱 | 用途 |
| --- | --- |
| `canvas` | 最底層頁面，用 `--canvas-gradient` 畫在 root |
| `surface` / `surface-hover` | 卡片與浮動列 |
| `surface-raised` / `surface-pressed` | 卡片內的區塊、hover、按下、軌道 |
| `surface-solid` | 蓋在頁面上的層：sheet、選單、對話框 |
| `ink` / `ink-muted` / `ink-faint` | 主要文字、次要文字、提示 |
| `line` / `line-strong` | 邊框、卡片底邊 |
| `contrast` / `contrast-edge` / `on-contrast` | 主要動作 |
| `accent-soft` / `accent-ink` | 主色的淡底與其上的文字 |
| `highlight` / `on-highlight` | 連續天數、獎勵 |
| `positive` `danger` `caution` `info` | 狀態 |
| `hue-*` | 單字集的五種顏色 |

## 元件

- **Button**：`primary`、`secondary`、`ghost`、`danger`，`asChild` 透過 `Slot` 把樣式交給子元素。
- **Panel / Tile / SectionTitle**：內容群組；`interactive` 讓整張卡可按。
- **Segmented**（ui-sdk SegmentedControl）：指示器彈性滑到選取項。
- **Select / Menu**（ui-sdk）：電腦上是彈出層，手機上自動變成可滑掉的底部面板。
- **Sheet**（ui-sdk Dialog `presentation="auto"`）：手機是底部面板，其餘是置中面板。
- **Dialog / ConfirmDialog**（ui-sdk Dialog / AlertDialog）。
- **Switch / Avatar / Tooltip**（ui-sdk）。
- **PrimaryNav**：手機的 `dock`、桌面的 `rail`。
- **PageHeader / ListGroup / ListRow / Field / Input / Textarea / Chip**。
- **EmptyState / ErrorState / LoadingList / Spinner / Skeleton / ProgressBar / Toaster / AnimatedNumber**。

## 動態

時間與曲線只寫在 `config/motion.config.json`，`npm run generate:motion` 產生 CSS 變數與 TS 模組。只有 `--ease-bounce` 會回彈，用在獎勵、選取指示器、彈出。

動畫 class：`content-in`、`message-in`、`bar-in`、`card-in`、`pop-in`（答對、獎勵）、`shake`（答錯）、`wiggle`（連續天數火焰）。減少動態時都會退成淡入或停用。

## 規則

- 圖示用 Phosphor：平常 `bold`，選取時 `fill`。
- 顏色只用 token，不寫死色碼。
- 不用 emoji。
- 在 375px 手機寬度和桌面都要檢查，含安全區與減少動態。
