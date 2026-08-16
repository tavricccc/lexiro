# Lexiro

Lexiro is a personal vocabulary-learning PWA built around a calm focus canvas. It centers on studying vocabulary, reviewing saved words, and answering practice questions, with AI-assisted capture, FSRS scheduling, progress tracking, local persistence, and optional Firebase sync across desktop and mobile.

## Stack

- Next.js 16, React 19, TypeScript 7
- Tailwind CSS 4 and Radix/shadcn-style primitives
- Zustand, TanStack Query, React Hook Form, Zod
- Motion, Lucide React, Serwist PWA
- Firebase Auth, Firestore, and App Check

## Local development

```bash
npm install
copy .env.example .env.local
npm run dev
```

Firebase is optional for local-only use. Fill in `.env.local` to enable sign-in and cloud sync.

## Verification

```bash
npm run typecheck
npm run lint
npm run test
npm run build
```

## Architecture

See [structure.md](structure.md) for the directory map and [PRODUCT.md](PRODUCT.md) for product decisions. The retained backend/domain implementation is under `src/`; the new Next.js application is under `app/`, `components/`, `lib/`, and `stores/`.
