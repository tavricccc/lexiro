# Agent notes

Lexiro is a client-only single-page app: Vite 8, React 19 and React Router 8 (data mode). There is no server rendering.

- Routes: `app/routes.tsx`; the screens under `/app` are lazy routes in `components/app-views.tsx`.
- Navigation inside components goes through `components/ui/app-link.tsx` and `lib/use-app-router.ts`.
- Browser configuration is read as `process.env.NEXT_PUBLIC_*`; `vite.config.ts` writes the values into the bundle.
- `vercel.json` owns the Firebase `/__/` proxy, the legacy redirects (kept equal to `lib/legacy-redirects.ts` by a test) and the SPA fallback.
- Before pushing: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

- Run the tests with `npm test`. It uses `vitest.next.config.ts` (jsdom and `tests-next/setup.ts`); a bare `npx vitest run` has no DOM and fails over a hundred tests for no real reason.
- After `git pull`, run `npm ci` before any check; a `node_modules` left from before a dependency change fails in ways unrelated to your edit.
- `src/lib`, `src/types` and the platform-free parts of `lib` and `components/practice` are mirrored into `../lexiro-app/src/core` (`scripts/sync-core.mjs` there). A change to them goes into both repos.
- A sense `description` holds one point per line with no typed bullets; read it with `descriptionPoints()` and render it with `components/library/description-points.tsx`. `meaningZh` is only the Chinese meaning, shown as an answer option.
- Tests check behavior a user or caller can observe: rendered text and roles, stored state, returned data. One behavior per `it`, titled with that behavior. No wall-clock budgets, no assertions on framework internals (history markers, private router state) and no tests that only check a render does not throw.

Read `docs/architecture.md` for the system overview.
