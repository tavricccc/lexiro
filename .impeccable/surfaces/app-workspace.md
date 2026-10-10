# Lexiro 固定操作的學習工作區

Mode: Operate. Scope: app shell, today, library, saved set, shared task actions.
User brief: 少捲動、分頁與穩定操作；桌機回側欄、主要操作在頁首隨捲動保持可見；桌機與手機控制縮小，大圓角保留。

## Direction contract
THESIS: A vocabulary study app with stable navigation, task controls and content regions. Replace the scrolling invitation page with directly operable tasks.
OWN-WORLD: Mist-white content, forest-green selected controls, HarmonyOS Sans TC, 20px page titles, 18px home task headings and 13px home descriptions. Tabs and phone actions are 44px; desktop actions are 36px. Shared generous corners remain: 24px controls, 28px groups, 36px outer surfaces; tabs use 24px rails and 21px inner segments. Keep the green brand and existing illustration family.
STORY: Open today, choose study or recent material, start from the desktop sticky header or phone bottom action. Open a set and switch words, questions and tools without pushing the content down.
DESKTOP CONTENT: Existing recent material and unfinished practice appear below Today's tasks in two columns when available; phone retains the recent tab. No fabricated entries.
FIRST VIEWPORT: Desktop has a 208px sidebar that remains during practice, independently scrolling content and compact actions in the sticky page header. No desktop bottom action strip or spacer. Today tasks use two columns; saved word/question lists use two columns from 1280px. Phone has one content column, compact tabs, 44px actions above the Novae bottom capsule. Primary action stays right; secondary stays left.
FORM: User-pinned task workspace, seed c1d23d69. The brief's app affordances govern the direction. Signature interaction: tabs switch the working content while primary controls keep their place. Restrained palette chosen for short phone sessions and desk use in ordinary room light.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Code-led direction; no approved image comp and no new raster assets. Existing SVG illustration provenance remains in the committed asset.
Local verification: material creation and storage, tab switching and entry into practice; 266 tests, lint, typecheck and build pass. Current compact screenshots: review/compact-desktop.png and review/compact-mobile.png. Earlier Library, saved-set and dark Today captures support those states. Real Firebase sync and paid AI execution are unverified.
Back controls show the arrow only; accessible labels retain the destination.
整理文字／照片沿用 GenerationControls、ListPicker 與 TaskProgress；Pro 固定 Sol/low，TPS 為前 500ms、每 100ms 更新的輸出估計。管理員用量與診斷共用既有元件，所有人可選模型與檔位。
本輪元件行為與靜態設計檢查通過；未做瀏覽器視覺驗收。

2026-10-10 內容隔離延續此方向：單字集與題庫共用清空控制，明確區分本集／全庫，確認保存後才顯示重新生成入口。控制維持手機 44px、桌機 36px；編輯固定來源集，無法重綁的生成、補義與練習草稿在原工作區保留成果並提供恢復選擇。
本次 finish review 以元件互動測試、既有 token／元件來源與靜態檢查核對；沒有新圖像、版型或配色。瀏覽器視覺與真實 Firebase 多裝置驗收仍未執行。

2026-10-10 Agent 連線為普通延伸：單字集增加 scoped URL，並提供 MCP OAuth 同意與連線管理；沿用既有入口、浮層、列表、語意 token 與本地化文案，無新圖像或視覺世界變更。
本次獨立 finish review 為 ship，範圍限定訪客桌機／手機截圖與指定 Agent 元件及入口，detector JSON 為 []；三項元件測試涵蓋登入前不建集、同步失敗重試保留已建集與公開 OAuth 初始化／錯誤。登入後視覺、正式 Firestore／ChatGPT 連線、鍵盤循環、computed contrast 與深色模式未實測，完整證據見 docs/agent-ui-review.md。
