---
version: 1
slug: "components-home-focus-canvas-tsx"
primary_target: "components/home/focus-canvas.tsx"
related_targets: ["components/app-shell.tsx","components/ui/step-actions.tsx","app/styles/workspace.css","app/styles/study.css"]
---

# Lexiro 今日任務工作區

Mode: Operate. The owner studies on a phone between activities, and at a desk in ordinary room lighting. Preserve the green family, HarmonyOS Sans TC, real vocabulary, and the existing Open Doodles asset.

## Direction contract
THESIS: Directly operable daily tasks with stable navigation and bottom actions; avoid a permanent SaaS dashboard sidebar and repeated logo.
OWN-WORLD: Mist-white content, forest-green primary and selected controls, HarmonyOS Sans TC, compact title bars and large full-width tabs. Controls use 24px corners, groups 28px, outer surfaces 36px; tab rails use 24px and inner segments 21px. Phone action dock uses 34px outer corners around 24px buttons. Keep the existing green illustration family in empty states.
STORY: Bring words from real life, save them, practise them, return to the exact unfinished work. Progress and errors tell the truth about what reached storage.
FIRST VIEWPORT: A 64px desktop navigation, independently scrolling content and fixed bottom actions. Phone uses the Novae-style 62px bottom navigation capsule with the action panel 12px above it. Today's tasks and recent material switch in large tabs. Primary action stays right, secondary stays left. Empty state uses the reading illustration; populated state shows daily progress.
FORM: User-pinned task workspace, seed c1d23d69, governed by the app-workspace contract. Signature interaction: tabs change content while task controls keep their place. Completion turns play into check only after durable storage; no decorative entrance delay.
FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

Code-led direction with no approved image comp or new raster assets. Existing reading illustration remains an SVG from the committed Open Doodles family. Final screenshots under .impeccable/review cover populated desktop and phone Today, phone Library, phone saved set and dark phone Today. Finish review: ship, no material findings. Local material creation/storage, tab switching and entry into practice are verified; 263 existing tests pass. Real paid AI and remote Firebase execution are outside local verification.
