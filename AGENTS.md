# Agent notes

Lexiro is a client-only single-page app: Vite 8, React 19 and React Router 8 (data mode). There is no server rendering.

- Routes: `app/routes.tsx`; the screens under `/app` are lazy routes in `components/app-views.tsx`.
- Navigation inside components goes through `components/ui/app-link.tsx` and `lib/use-app-router.ts`.
- Browser configuration is read as `process.env.NEXT_PUBLIC_*`; `vite.config.ts` writes the values into the bundle.
- `vercel.json` owns the Firebase `/__/` proxy, the legacy redirects (kept equal to `lib/legacy-redirects.ts` by a test) and the SPA fallback.
- Before pushing: `npm run typecheck`, `npm run lint`, `npm run test`, `npm run build`.

Read `docs/architecture.md` for the system overview.
