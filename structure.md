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
public/          Lexiro icons and Open Doodles illustration
```

The workspace shell is shared by desktop and mobile. Desktop uses a compact sidebar; mobile uses the same routes through a bottom navigation bar. Library folders use a drill-down model, similar to Windows File Explorer, instead of an always-expanded tree.

The client persists local data through IndexedDB and can sync canonical records through Firebase. Memory review uses FSRS; question practice supports multiple choice, fill-in-the-blank, and reading comprehension.
