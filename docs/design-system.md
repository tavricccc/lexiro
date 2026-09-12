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

Tracking is negative only where the type is large enough for the default spacing
to look loose, and never enough to crowd Chinese, which is set on a square body
and has no side bearings to give back. The classes live in `@layer components`,
so a caller that narrows a lead's measure with a utility still wins.

Screens do not invent a weight, tracking or leading for a rank of heading they
already have. That drift — five pages each styling the same rank differently —
is what made titles stop reading as titles.

## Radius encodes hierarchy

The further out a surface sits, the softer it is:

| Token             | Value     | Used for                            |
| ----------------- | --------- | ----------------------------------- |
| `--radius-control`| 0.75rem   | buttons, inputs, selects            |
| `--radius-card`   | 1.25rem   | panels, inline forms, list surfaces |
| `--radius-stage`  | 1.875rem  | the focus canvas, sticky action bars|

The scale is deliberately generous. A tight corner reads as a form control a
browser drew, and this product is meant to feel like something made for a
phone; when a corner is in doubt, round it more. Nothing hard-codes a radius —
every surface takes one of these three, or the Tailwind utility mapped onto it.

Tailwind's `rounded-md` / `rounded-xl` / `rounded-3xl` are mapped onto these, so
existing utilities keep working while the scale stays deliberate.

## The grouped list

A phone reads a setting, a choice, or a fact as one line: what it is on the
left, what it is set to on the right. `components/ui/list.tsx` is that shape and
every screen that asks for something uses it.

- `ListSection` is a group: a quiet header above it, the rows in a `.rule-card
  .rule-list`, and a footer sentence below explaining what changing the group
  does. The footer is where explanation goes, never a paragraph between rows.
- `ListRow` reports, `ListNavRow` leads somewhere (chevron, or a rotated one
  when it opens its options in place), `ListChoiceRow` is one option with a
  check, `ListPicker` is a row that unfolds its options underneath instead of
  opening a dropdown, `ListSwitchRow` is on/off, `ListStepperRow` is a small
  whole number, `ListInputRow` is a value you type on the line that names it
  (`block` puts the label above for a sentence), and `ListActionRow` is a
  centred, tinted row that does something now.
- A dropdown belongs in a toolbar, where it filters what is on screen. Inside a
  form or a settings group it is a `ListPicker`: a menu that covers the screen
  you are choosing for is the wrong shape on a phone.
- A screen the reader is working through — a study card, a step of a flow — is
  a full-height column with its action at the bottom, where a thumb already is.
  The action is in the flow at the end of the column, never a bar floating over
  the page.
- Rows are at least 44px tall and the whole row is the target, never the
  chevron or the label alone.

**A choice between options is a list, never a row of buttons.** Two buttons
side by side mean 取消 and 確認 — a decision and its escape — so that shape
tells the reader the wrong thing about a choice. A row also has room for the
number that decides it: what the tier costs, how much is due, how many
questions are waiting. A screen that asks for one thing ends in one full-width
primary button; everything else it can do is a `ListActionRow` under it.

Type for rows is set by `.type-row` (17px, the platform's reading size),
`.type-row-detail`, `.type-row-value`, `.type-list-header` and
`.type-list-footer`.

## Separation

Three ways to separate, and only three: a **card** groups the things that sit at
the same level, a **hairline** divides the rows inside one card, and **space**
divides the sections of a page. Nothing is separated twice, which is why a card
has no outer rules and a divided row has no border of its own.

- `.rule-card` is the surface: a hairline border, the card radius, the card
  background, the card shadow, and the row gutter. Anything that is a set of
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

`--section-gap` (2rem) and `--block-gap` (1.25rem) back the `.section-gap` and
`.block-gap` utilities. Use `.section-gap` between the major sections of a page
instead of picking a fresh `mt-8` / `mt-10` / `mt-12` each time — the reason the
old pages drifted is that every screen invented its own rhythm.

## Motion

Every duration and curve in the product is a rung of one ladder, generated from
`config/motion.config.json` into `src/generated/motion-ladder.css` (custom
properties) and `src/generated/motion-tokens.ts` (the same rungs in seconds, for
animations driven from JavaScript). Regenerate with `npm run generate:motion`;
never edit the generated files, and never write a literal duration or
`cubic-bezier` anywhere else. A recipe picks a rung by what the motion *means*,
not by feel — if an interaction does not fit a rung, the ladder is wrong.

The pacing is iOS's. A touch is acknowledged in `--motion-touch` (100ms), a
control settles in `--motion-control` (250ms), moving to another place takes
`--motion-nav` (460ms), and a layer presented over the current place takes
`--motion-sheet` (560ms) because it travels furthest. Leaving is always quicker
than arriving, which is what `--motion-control-exit` and `--motion-sheet-exit`
are for. Arrivals decelerate (`--ease-arrive`), dismissals accelerate
(`--ease-depart`), travel between two known positions is symmetric
(`--ease-move`), routes use the iOS navigation curve (`--ease-nav`),
and exactly one curve is allowed to overshoot (`--ease-bounce`).

JavaScript reaches the ladder through `timing(rung, curve)` in
`lib/motion-timing.ts`, which is also what `MotionConfig` is given, so Motion and
CSS cannot drift apart.

**Route reveals.** A route change animates one thing: the page that arrives, in
the live document. Capturing the document instead — a view transition — buys the
page being left a parallax, and costs a full rasterisation of both pages at the
moment the browser is already fetching, parsing and rendering the route that was
asked for; it also suspends hit testing for the length of the animation, which
is what swallowed taps on the dock. The page that leaves is simply gone, so a
full-width slide would uncover nothing but the shell: the travel is short
(`--motion-route-travel`) and the fade carries the rest. A child arrives from
the trailing edge, its parent from the leading one, and a route that is neither
simply appears. Direction is derived in `lib/navigation-memory.ts` — an explicit
`markRouteDirection` wins, otherwise it is inferred from where the two URLs sit
in the hierarchy — and written onto the arriving page as `data-route-direction`,
which is what the recipe in `motion.css` keys off.

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
in place uses `StateTransition` + `ContentTransition`; it holds its own height,
so the container grows into the change instead of jumping to it.

Height animation is opt-in: `ResizeMotion` only observes elements marked
`data-resize-motion`, because observing every card makes viewport reflow look
like content motion.

Data visuals still animate once on mount: `.dashboard-bar` grows a proportion bar
from its leading edge (`--dashboard-bar` carries the ratio), `.dashboard-column`
grows a chart column up from the baseline.

Everything above is disabled under `prefers-reduced-motion`.

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
  slots and a HarmonyOS Sans TC page title. The shell keeps stable brand identity.
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
