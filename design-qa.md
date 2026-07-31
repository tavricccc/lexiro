# Settings Entry Design QA

## Source visual truth

- Source: `C:/Users/tavri/AppData/Local/Temp/codex-clipboard-cb03e2f0-c7b1-4d81-b9e1-21e05ce6ff5e.png`
- Source pixels: 367 × 88
- Intended state: desktop settings entry with avatar, account label, and gear; Pro label intentionally removed.

## Implementation evidence

- Desktop screenshot: `C:/Users/tavri/projects/lexiro/design-qa-settings-desktop.png`
- Mobile screenshot: `C:/Users/tavri/projects/lexiro/design-qa-settings-mobile.png`
- Desktop viewport: 1280 × 720 CSS px
- Mobile viewport: 390 × 844 CSS px
- Auth state: local mode; the desktop account label falls back to 設定. A signed-in account label and photo are populated by the delayed Cloud sync initialization.

## Comparison

- Full view: desktop navigation keeps the settings entry anchored at the bottom; mobile navigation keeps the avatar and 設定 label aligned inside the active pill.
- Focused region: avatar is left-aligned, desktop gear is right-aligned, and the Pro line is absent. Mobile uses the same avatar treatment with 設定 as the label.
- Fonts/typography: existing lexiro HarmonyOS Sans TC tokens retained; label uses the existing compact navigation weight.
- Spacing/layout: existing sidebar and bottom-tab spacing retained; no new overflow introduced.
- Colors/tokens: avatar fallback and active state use existing ink surface tokens and shadows.
- Image/assets: signed-in photo uses the existing Firebase profile photo; local mode uses the existing Lucide fallback icon.
- Copy/content: Pro is removed; mobile copy is 設定.

## Primary interactions tested

- Desktop settings entry navigates to `/settings`.
- Mobile settings entry navigates to `/settings` and remains the active tab.
- Desktop collapsed sidebar retains an avatar-only settings target.

## Findings

No actionable P0/P1/P2 differences remain. The account name/photo are intentionally state-dependent and are not shown while the app is in local mode.

## Final result

passed
