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
