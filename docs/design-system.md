# Lexiro design system

Lexiro is a dictionary you study from. Every visual decision below follows from
that: the interface should feel like well-set reference material, not like a
productivity dashboard. Cards, drop shadows and coloured status chips are the
default look of the latter, so they are used sparingly here; hairlines, margins
and typographic hierarchy carry the structure instead.

## Colour

The palette is forest ink green on mist-white neutrals, per `PRODUCT.md`.

`app/globals.css` defines a nine-step brand ramp as `--brand-50` … `--brand-900`
and registers it in `@theme inline`, so `bg-brand-50`, `text-brand-600` and the
rest are real Tailwind utilities.

The dark theme **inverts the ramp** rather than adding a second one: `--brand-50`
is the palest tint in light mode and the deepest green in dark mode, and
`--brand-600` is the primary in both. A component written as `bg-brand-50` with
`text-brand-600` therefore works in both themes with no `dark:` variant. Reach
for `dark:` only where the ramp genuinely cannot express the intent.

The pale end of the light ramp is deliberately a real sage (`--brand-50`
`#e7f0ea`) rather than an off-white. An earlier draft sat within two percent of
the page ground, which meant the "pale sage learning canvas" the product
promises rendered as grey and the app carried no visible brand at all. Anything
that is meant to read as branded — the focus canvas, an active navigation item,
the track behind a progress bar — must be checked against the page ground in a
browser, not just picked from the ramp.

The frame recedes and the content comes forward: the sidebar and the app frame
share `--surface-stage`, page content sits on `--background`, and
`--surface-canvas` is the one hero tint, used by the focus canvas.

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

Two faces, with a strict division of labour:

- **HarmonyOS Sans TC** (`--font-sans`, bundled locally) is the interface: labels,
  buttons, navigation, body copy, everything chrome.
- **Newsreader** (`--font-lexical`, via `next/font` as `--font-newsreader`) is the
  lexical voice: page titles, section headings, headwords, parts of speech,
  example sentences, and every large figure.

The serif is what makes a screen feel like a dictionary rather than an app, so it
is applied to page-level `h1`/`h2` and to numerals that are meant to be read as
results (`font-lexical … tabular-nums`), not sprinkled on body text.

Dictionary entries have their own classes in `globals.css`: `.entry-headword`,
`.entry-pos`, `.entry-citation`, and `.entry-senses` / `.entry-sense`, whose CSS
counter numbers senses — and, via `:has(.entry-sense:only-child)`, suppresses the
number when there is only one sense. A single-sense word should never be labelled
"1".

## Radius encodes hierarchy

The further out a surface sits, the softer it is:

| Token             | Value     | Used for                            |
| ----------------- | --------- | ----------------------------------- |
| `--radius-control`| 0.5rem    | buttons, inputs, selects            |
| `--radius-card`   | 0.875rem  | panels, inline forms, list surfaces |
| `--radius-stage`  | 1.5rem    | the focus canvas, sticky action bars|

Tailwind's `rounded-md` / `rounded-xl` / `rounded-3xl` are mapped onto these, so
existing utilities keep working while the scale stays deliberate.

## Spacing

`--section-gap` (2.75rem) and `--block-gap` (1.25rem) back the `.section-gap` and
`.block-gap` utilities. Use `.section-gap` between the major sections of a page
instead of picking a fresh `mt-8` / `mt-10` / `mt-12` each time — the reason the
old pages drifted is that every screen invented its own rhythm.

## Motion

One orchestrated entrance per screen at most. The home focus canvas animates in;
everything else stays still, because a page where each section fades and slides
up in sequence reads as a template rather than as a considered arrangement.

Data visuals animate once on mount: `.dashboard-bar` grows a proportion bar from
its leading edge (`--dashboard-bar` carries the ratio), `.dashboard-column` grows
a chart column up from the baseline. Both are disabled under
`prefers-reduced-motion`.

Durations and easings come from `app/styles/motion.css` (`--motion-quick`,
`--ease-smooth-out`, …), never from literal values.

## Components

Shared primitives live in `components/ui/` and are the only place a control's
markup is defined:

- **`Field` / `FieldRow`** — the one label-and-control pairing. `layout="stacked"`
  for editors, `layout="row"` for settings lists. There is no second Field.
- **`SelectField`** — every select in the app. Call sites pass
  `options: {label, value}[]`; nobody hand-rolls a trigger and content, and
  nobody writes a native `<select>`. Radix rejects an empty option value, so a
  "none" choice needs a sentinel (see `ROOT_VALUE` in the folder toolbar).
- **`PageHeader`** — the single page header, with optional `back` and `actions`
  slots. Titles render in the lexical serif.
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

All user-facing strings live in `lib/i18n.ts` and are reached through `t()`. The
key union is derived from the object, so a missing key is a type error rather
than a string that leaks to the screen.
