# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Lexiro primarily serves its owner as a personal English vocabulary and practice workspace. It must work naturally on both mobile and desktop; existing navigation habits are not commitments and may be replaced when a clearer workflow exists.

## Product Purpose

Lexiro turns personally collected vocabulary senses and examples into an offline-capable study system. Its three core jobs are studying vocabulary, reviewing saved words, and answering practice questions. It also supports AI-assisted capture and question generation, scheduled review, progress statistics, backup, and optional cloud sync. Success means the owner can capture material quickly and move into useful practice without maintaining duplicate or ambiguous data.

## Positioning

Lexiro treats a vocabulary sense—not a loose word string or a copy inside each set—as the durable unit shared by organization, questions, review scheduling, and statistics. Sets are views over shared learning material rather than isolated copies.

## Operating Context

- Vocabulary is collected and organized into folders and sets.
- A word may contain multiple Chinese meanings, parts of speech, and shared examples.
- New vocabulary is entered manually or organized by AI, then reviewed before it enters personal data.
- Questions may be authored manually or generated with AI, then reviewed before saving.
- Study includes multiple-choice, fill-in-the-blank multiple-choice, reading comprehension, and FSRS review.
- The application is expected to remain useful offline and synchronize later when signed in.

## Capabilities and Constraints

- Preserve the Lexiro name and current application icon.
- Replace the Vue/Vite frontend with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and shadcn/ui.
- Zustand, TanStack Query, React Hook Form with Zod, Motion, Lucide React, and Serwist PWA may be used where they improve the product rather than as mandatory decoration.
- Firebase authentication and Firestore may be retained as the remote backend.
- Existing local and cloud user data must be migrated once into the new canonical schema. Do not keep a permanent legacy compatibility path or two competing data models.
- Preserve valuable existing capabilities, but remove redundant controls, legacy concepts, and awkward workflows when the same user goal is covered more clearly.
- Product decisions recorded in `docs/product-decisions.md` remain product truth unless superseded explicitly.
- The application language is Traditional Chinese; learning material is primarily English with Chinese meanings.

## Brand Commitments

- Product name: Lexiro.
- Preserve the current Lexiro icon assets under `public/icons/`.
- Use Open Doodles as the character illustration family and Highlights as the supporting hand-drawn mark family; both may be recolored and adapted to Lexiro.
- Brand color direction: forest ink green on mist-white neutral surfaces. Decorative illustration and highlight marks remain monochromatic within this green family; additional colors are reserved for semantic states.
- No existing layout, color palette, component style, navigation pattern, or interaction habit is binding.

## Interface Direction

- The selected composition is **Focus Canvas / 專注畫布**.
- Today opens with one generous pale-sage learning canvas that combines due review and daily questions, presents one recommended next action, and keeps the alternate action nearby.
- Resumable work and recent sets appear below as calm, borderless rows rather than nested dashboard cards.
- Desktop uses a persistent side navigation and mobile uses a bottom navigation, with the same destinations, capabilities, labels, and task order on both.
- Open Doodles belongs only in unused space, loading, empty, and completion states. Highlights uses the same forest-green family for semantic emphasis; neither may compete with learning content.

## Evidence on Hand

- Confirmed product and data decisions: `docs/product-decisions.md`.
- Current implementation and tests document the working capability set.
- Current icon assets: `public/icons/lexiro.png` and `public/icons/apple-touch-icon.png`.
- Existing generated vocabulary and question fixtures under `output/` may inform content style, but not legacy schema compatibility.
- No testimonials, public customer claims, pricing, or benchmark evidence is available and none may be fabricated.

## Product Principles

1. Optimize for one person's daily learning flow, not administrative completeness.
2. Keep one canonical sense-centered data model across sets, questions, review, and statistics.
3. Make capture lightweight and consequential edits explicit, previewable, and reversible where practical.
4. Remain trustworthy offline; migration and synchronization must never silently discard learning data.
5. Prefer a smaller number of coherent workflows over parallel legacy paths and duplicated settings.

## Accessibility & Inclusion

Keyboard operation, visible focus, reduced-motion support, semantic controls, sufficient contrast, and responsive layouts are required. Traditional Chinese interface copy must remain legible at mobile sizes and must not be hardcoded outside the localization layer.
