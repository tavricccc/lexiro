# Lexiro codebase guidelines for AI agents

## Core constraints

- Keep React components below 400 lines. Split feature sections or move reusable logic before a file approaches 350 lines.
- Apply the rule of two: business logic, formatting helpers, and UI patterns used twice must become shared code.
- Preserve strict TypeScript types. Avoid `any`; canonical domain types belong in `src/types/`.
- Do not add legacy Vue/Vite compatibility paths or old-data compatibility layers. Changes to persisted structures require an explicit migration.
- Keep Lexiro's name and icons.

## Architecture

```text
app/             Next.js App Router routes, layouts, PWA files
components/      React feature components and UI primitives
lib/             frontend helpers and Traditional Chinese copy
stores/          Zustand stores
src/constants/   canonical domain constants
src/lib/         domain logic, persistence, Firebase, import/export
src/types/       canonical domain types
tests-next/      Vitest tests
```

- Use Server Components by default and add `"use client"` only where browser state or interaction requires it.
- Use Zustand for local application state and TanStack Query for asynchronous server state.
- Use shared primitives in `components/ui/` and `cn()` from `lib/cn.ts`.
- Style with Tailwind CSS v4 and the design tokens in `app/globals.css`. Sizes must use relative units through Tailwind/rem-based values.
- Desktop and mobile must expose the same capabilities. Their navigation shells may adapt, but neither platform is secondary.
- Library folders use one-level-at-a-time drill-down navigation.
- User-facing copy belongs in `lib/i18n.ts`; do not scatter duplicated strings through components.

## Verification

Before finalizing changes, run:

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
