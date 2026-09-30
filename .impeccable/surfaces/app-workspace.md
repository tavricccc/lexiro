# Lexiro 固定操作的學習工作區

Mode: Operate. Scope: app shell, today, library, saved set, shared task actions.
User brief: 少捲動、大按鈕與分頁；按鈕不要到處亂跑。

## Direction contract
THESIS: A vocabulary study app with stable navigation, task controls and content regions. Replace the scrolling invitation page with directly operable tasks.
OWN-WORLD: Mist-white content, forest-green selected controls, HarmonyOS Sans TC, compact title bars and full-width 48px segmented tabs. Shared generous corners: 24px controls, 28px groups, 36px outer surfaces; tabs use 24px rails and 21px inner segments. Keep the green brand and existing illustration family; illustration accompanies empty states only within today's workspace.
STORY: Open today, choose study or recent material, start from a fixed bottom action. Open a set and switch words, questions and tools without pushing the content down.
FIRST VIEWPORT: Desktop has a 64px top navigation, an independently scrolling content viewport and a persistent bottom action strip. Phone has a compact title bar, large tabs, content and actions above the bottom navigation. Primary action stays on the right; secondary stays on the left. Saved sets use the same bottom action position.
FORM: User-pinned task workspace, seed c1d23d69. The brief's app affordances govern the direction. Signature interaction: tabs switch the working content while primary controls keep their place. Restrained palette chosen for short phone sessions and desk use in ordinary room light.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Code-led direction; no approved image comp and no new raster assets. Existing SVG illustration provenance remains in the committed asset.
Local verification: material creation and storage, tab switching and entry into practice; 263 existing tests pass. Valid final screenshots: review/mobile.png, review/desktop.png, review/library-mobile.png, review/set-mobile.png and review/mobile-dark.png. Finish review: ship, no material findings. Real Firebase sync and paid AI execution are unverified.
Back controls show the arrow only; accessible labels retain the destination.
