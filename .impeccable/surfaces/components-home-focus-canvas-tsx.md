---
version: 1
slug: "components-home-focus-canvas-tsx"
primary_target: "components/home/focus-canvas.tsx"
related_targets: ["components/app-shell.tsx","components/ui/step-actions.tsx","app/styles/workspace.css","app/styles/study.css"]
---

# Lexiro 今日任務工作區

Mode: Operate. The owner studies on a phone between activities, and at a desk in ordinary room lighting. Preserve the green family, HarmonyOS Sans TC, real vocabulary, and the existing Open Doodles asset.

## Direction contract
THESIS: Directly operable daily tasks with a desktop sidebar and sticky-header actions, plus phone bottom navigation and actions.
OWN-WORLD: Mist-white content, forest-green controls and HarmonyOS Sans TC. Page titles 20px, home task headings 18px, descriptions 13px; tabs and phone actions 44px, desktop actions 36px. Corners remain 24px controls, 28px groups, 36px outer surfaces and 21px tab segments; phone action dock outer corners remain 34px. Keep the existing green illustration family in empty states.
STORY: Bring words from real life, save them, practise them, return to the exact unfinished work. Progress and errors tell the truth about what reached storage.
DESKTOP CONTENT: Show existing LearningRows recent material and unfinished practice below Today's tasks in two columns when available; phone retains the recent tab.
FIRST VIEWPORT: A 208px desktop sidebar retained during practice, independently scrolling content and actions in the sticky page header; desktop Today uses two content columns. Phone uses the Novae-style 62px bottom navigation capsule with the action panel 12px above it. Today's tasks and recent material switch in compact tabs. Primary action stays right, secondary stays left. Empty state uses the reading illustration; populated state shows daily progress.
FORM: User-pinned task workspace, seed c1d23d69, governed by the app-workspace contract. Signature interaction: tabs change content while task controls keep their place. Completion turns play into check only after durable storage; no decorative entrance delay.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Code-led direction with no approved image comp or new raster assets. Existing reading illustration remains an SVG from the committed Open Doodles family. Current screenshots are .impeccable/review/compact-desktop.png and compact-mobile.png; earlier Library, saved-set and dark Today captures support those states. Local creation/storage, tab switching and practice entry are verified; 266 tests, lint, typecheck and build pass. Real paid AI and remote Firebase execution are outside local verification.
