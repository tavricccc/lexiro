# Lexiro project structure

Lexiro is a Next.js App Router vocabulary-learning PWA. The UI is React; the existing canonical vocabulary domain and Firebase backend live under `src/`.

```text
app/             routes, layouts, manifest, service worker
components/      feature components and shared React UI
lib/             frontend helpers and Traditional Chinese copy
stores/          Zustand application stores
src/constants/   shared domain constants
src/lib/         domain logic, persistence, Firebase, import/export
src/types/       canonical domain types
tests-next/      Vitest unit and integrity tests
docs/            design system, product decisions, deployment
public/          Lexiro icons and Open Doodles illustration
```

Shared UI primitives live in `components/ui/` and are the only definition of a
control's markup: `Field`/`FieldRow`, `SelectField`, `PageHeader`, the
`LoadingState`/`EmptyState`/`ErrorState` trio, `Markdown`, and the `Icons`
concept map. Feature components compose these rather than hand-rolling labels,
native `<select>` elements or their own empty states, and they take icons from
`Icons` rather than importing from `lucide-react`. Design tokens and the brand
ramp live in `app/globals.css`; the rules that go with them are in
`docs/design-system.md`.

The workspace shell is shared by desktop and mobile. Desktop uses a compact sidebar; mobile uses the same routes through a bottom navigation bar. Library folders use a drill-down model, similar to Windows File Explorer, instead of an always-expanded tree.

Generated questions follow the Taiwanese senior-high formats. `src/lib/question-formats.ts`
is the catalogue; `question-prompts.ts` asks a model only for prose and answer
spans; `question-assembly.ts` cuts the blanks, orders the options and links each
item back to its sense; and `question-builders.ts` builds what needs no model at
all. `docs/product-decisions.md` explains why the split falls there.

The client persists local data through IndexedDB and can sync canonical records through Firebase. Memory review uses FSRS; question practice supports multiple choice, fill-in-the-blank, and reading comprehension.
