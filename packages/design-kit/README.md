# Design kit

The design cc-remote and Novae share, in one place: colour, radius and
elevation tokens, the motion ladder, and the React primitives built on them.
One structure, two palettes: **Strata 朱** (cc-remote, the default) and
**Novae** (optional). Light or dark follows the system.

## Use

```css
/* app.css */
@import "tailwindcss";
@import "design-kit/styles.css";
/* optional: @import "design-kit/themes/novae.css"; */

/* Any token can be retuned after the import: */
:root { --kit-font-sans: "HarmonyOS Sans TC", system-ui, sans-serif; }
:root[data-theme="light"] { --contrast: #2f62d6; --focus-ring: rgb(47 98 214 / 45%); }
```

Inline `design-kit/theme-script.js` in `<head>` so `data-theme` is set before
the first paint, with your palette's light and dark canvas colours.

```tsx
import { DesignKitProvider, hashNavigation, labelsEn } from "design-kit";

<DesignKitProvider navigation={hashNavigation()} labels={labelsEn}>…</DesignKitProvider>
```

### Navigation

Primitives never import a router. `DesignKitProvider` takes a `navigation`:

| Function | Does |
| --- | --- |
| `href(path)` | The address an anchor shows (`/settings` → `#/settings` for hash routing) |
| `navigate(path, { replace })` | Move in place; return `false` to let the browser follow the link |
| `back(parent)` | Optional. Step back to `parent` through history when that is where the user came from |

`hashNavigation()` is cc-remote's routing. For a path router (Novae's React
Router), pass `{ href: (p) => p, navigate: (p, o) => { router.navigate(p, o); return true; } }`.
Without a provider, links are ordinary links. `AppLink` leaves modified clicks
(new tab) and links with a scheme to the browser.

### Words

The few strings primitives say themselves (取消, 關閉, the save bar…) come
from `labels`; Traditional Chinese by default, `labelsEn` provided, any subset
can be overridden.

### Motion

`config/motion.config.json` is the only place durations, curves and travel
distances are stated. `npm run generate:motion` writes the CSS variables and
the TypeScript module from it; JavaScript animations use `timing(rung, curve)`.

### Screens

Each screen has a level: the primary destinations are 0, and every step into
a child (a record, its editor, a settings subpage) adds one. The app keys a
`motion.div` by the path and spreads `routeMotion(routeDirection(from, to))`
on it: deeper pushes in from the right, shallower returns from the left, the
same level cross-fades. Inside a run (a quiz, a game), the next card wears
`card-in`. The dock belongs to level 0 only; it slides away on deeper
screens instead of unmounting, and every deeper screen has a back control
that leads to its parent.

### Preview

`npm run preview` opens every primitive with a palette switch.

## Tokens

| Tailwind name | Use |
| --- | --- |
| `canvas` | The page behind everything; painted as `--canvas-gradient` by a fixed layer |
| `surface` | Panels and floating chrome; solid, never frosted |
| `surface-raised` / `surface-pressed` | Tiles, fields and hover/press states inside a panel |
| `surface-solid` | Opaque layers over the page: sheets, menus, popovers |
| `ink` / `ink-muted` / `ink-faint` | Primary text, secondary text and values, placeholders and chevrons |
| `line` | Hairlines between rows and around fields |
| `contrast` / `on-contrast` | The one emphatic fill and the type on it (orange in Strata, white in Novae) |
| `accent-soft` / `accent-ink` | A quiet tint of the accent and text in it |
| `positive` `caution` `danger` `info` | Status only: chips, errors, destructive actions |

Radii: `rounded-chip` (tags), `rounded-tile` (fields, nested tiles),
`rounded-panel` (panels, sheets), `rounded-icon` (the brand mark where it
stands as the app icon: sign-in and startup), `rounded-full` (buttons, navigation, segmented
controls). Elevation: `shadow-panel`, `shadow-float`.

## Primitives

- **Panel / Tile / SectionTitle** — content groups. A panel is the only card; a tile is a grey block *inside* a panel, never a card on the canvas.
- **Chip** — a short verb or state set in front of a line of text ("審核", "處理中").
- **Button** — `primary` (the emphatic pill), `secondary` (solid surface), `ghost`, `danger`; every button is a pill.
- **Segmented** — mutually exclusive views; the pill slides between options. An option may carry an `icon` (a folder rail shows a folder glyph on each folder).
- **Pane** — the content behind a Segmented control or any row of sibling views (feed views and categories, admin sections and tabs). A view further along slides in from the right, one before it from the left; nothing is remounted, so a view keeps its draft.
- **PrimaryNav** — the primary destinations: a floating `dock` on phones, a `rail` in the sidebar from `md` up. The current one wears the pill and its icon fills.
- **ListGroup / ListRow** — settings-style rows: link, action, or label with a trailing control.
- **Field / Input / Textarea / Switch / Avatar** — form controls and identity.
- **Sheet** — bottom sheet on phones, centred panel from `md` up (`size="screen"` for records and composers: 86% of the screen's width and height, so it keeps the screen's proportions); every exit goes through `onOpenChange`, and `onClosed` fires once the exit has finished.
- **Dialog / ConfirmDialog / DecisionSheet** — a centred question, an irreversible confirmation, and one recorded decision with its reason.
- **Select / Menu / Popover / Tooltip** — a choice, the actions on a thing, a small form, and a label for an icon-only control on real pointers.
- **PageHeader** — the large title scrolls away and a small centred title takes its place; the back button is sticky and stays beside it.
- **EmptyState / ErrorState / LoadingList / SaveBar** — page furniture and the one explicit-save bar.
- **Spinner / Skeleton / ProgressBar / Toaster / AnimatedNumber** — loading, progress and feedback.
- **DecodedImage / ImageGrid / ImageTile / ImageLightbox** — attachments: fitted tiles that decode before they show, and the lightbox they open.

## Rules

- Icons are Phosphor (`@phosphor-icons/react/ssr`): `regular` at rest, `fill` for the selected state, `bold` for small glyphs such as chevrons.
- Colour comes from tokens only. Emphasis comes from the contrast pill, not from hue.
- Status colours describe state; they never become a control's theme.
- Motion durations and curves come from the motion ladder; no raw `duration-*`, springs or inline easing.
- Nothing appears or leaves on a single frame. Content that replaces a placeholder or joins a list wears `content-in`, a message that appears under a control wears `message-in`, a proportion bar wears `bar-in`, and a block that can also leave uses `Reveal` inside `AnimatePresence`. Switching between sibling views moves sideways through `Pane`, never up from below. Each falls back to a plain fade under reduced motion.
- Hover styles go through the `hover:` variant, which is gated to real pointers.
- Primitives in `src/ui` import no app code: routing and words come through `DesignKitProvider`.
- A scrolling edge is never a hard cut: `PageHeader` sticks to the top over an `edge-top` blur, the shell fades content under the dock or window bottom with `edge-bottom`, and scrolling areas inside layers use `edge-fade`.
- Check every screen at phone width (375px) and desktop, with safe areas and reduced motion.

## Pitfalls

Lessons from apps built on the kit; each one shipped once and was undone.

- **No frosted glass.** Floating chrome, controls and scrims are solid. The only blur is `EdgeBlur`, the progressive edge where content passes under the status bar or dock.
- **Translucent status bar, no band.** Use `apple-mobile-web-app-status-bar-style: black-translucent` and let a top `EdgeBlur` (about `safe-top + 5rem`) soften content beneath it. A solid strip under the status bar looks pasted on. An installed PWA keeps the status bar style it was installed with: reinstall before judging a change.
- **The window is the scroller.** Stop the root bounce with `overscroll-behavior: none` on `html, body` (the kit sets it) and let inner areas use `overscroll-contain`. Moving page scrolling into a fixed inner container breaks `window.scrollY` restoration, the `scroll(root)` timeline that fades the top blur in, and iOS's own status-bar tap to scroll.
- **Restore scroll per screen.** Remember `window.scrollY` per path and put it back when the screen returns; a new screen starts at the top.
- **Do not double-animate a screen.** When the route transition moves the screen, its contents must not also wear `content-in`.
- **Cards on the canvas are panels.** A `Tile` reads as a grey disabled block when it sits straight on the page.
- **No emoji** in copy or UI; icons come from Phosphor.
