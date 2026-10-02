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
- New vocabulary is entered manually or organized by AI; validated generated results are reviewed and added explicitly, with completed output retained for recovery.
- Questions may be authored manually or generated with AI; generated questions are reviewed with their target senses before they are added to the Library.
- Study includes multiple-choice, fill-in-the-blank multiple-choice, reading comprehension, and FSRS review.
- The application is expected to remain useful offline and synchronize later when signed in.
- Learning goals and AI model changes save locally with inline progress and retry. Unfinished changes survive leaving the screen; returning offers applying them or keeping the current settings, within the original account.

## Capabilities and Constraints

- Preserve the Lexiro name and current application icon.
- The frontend uses Next.js 16, React 19, TypeScript, Tailwind CSS 4, and shared Radix-based UI primitives; the Vue/Vite migration is complete.
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
- Keep HarmonyOS Sans TC as the shared interface and learning-content typeface. A spring-green accent may brighten learning actions and Open Doodles within the green family.
- No existing layout, color palette, component style, navigation pattern, or interaction habit is binding.

## Interface Direction

- The selected direction is **固定操作的學習工作區**: fewer scrolling steps, compact controls, and tabs that change content while task actions remain reachable.
- Today separates daily tasks and recent material into tabs. A compact neutral task surface presents the next study action and daily review/question progress; an empty library presents the three-step introduction with the existing Open Doodles reading illustration.
- Saved sets separate words, questions, and tools into tabs. Desktop task controls stay in the sticky page header; mobile controls stay at the bottom, with the primary action on the right and the secondary action on the left.
- Desktop uses a 208px sidebar, an independently scrolling content region, and compact 36px controls at the right of the sticky page header. The sidebar remains during practice. Mobile uses the Novae-style 62px bottom navigation capsule, 44px actions and tabs, and a separate action surface above navigation. Both keep the same destinations, capabilities, labels, and task order. Mobile child pages and focused practice hide bottom navigation.
- Desktop Today uses two task columns and shows existing recent material and unfinished practice below when available; mobile keeps these in the recent tab. Saved word and question lists use two columns from 1280px viewport width. Mobile remains one column. Page titles are 20px; Today task headings are 18px and descriptions are 13px.
- Forest-green selection and action controls, mist-white content, compact title bars, and generous shared corners keep the workspace personal and directly operable. Buttons, tabs, forms, lists, and overlays share the larger radius scale. Ink-green and spring-green surfaces remain in completion feedback.
- Back controls show only an arrow; their accessible labels retain the return destination.
- Progress pairs counts and bars with text; reaching a goal changes the play mark to a check. Completion feedback must follow successful storage rather than an optimistic visual result.
- Open Doodles may accompany empty, loading, and completion states without competing with learning content. Highlights uses the same forest-green family for semantic emphasis. This revision retains the committed SVG assets and adds no raster artwork.

## Evidence on Hand

- Confirmed product and data decisions: `docs/product-decisions.md`.
- Visual tokens and reusable visual rules: `DESIGN.md`; component and icon implementation rules: `docs/design-system.md`.
- Current implementation and tests document the working capability set.
- Historical workspace verification recorded 266 tests plus lint, typecheck, and build. That count belongs to that revision; current verification is reported per change. Real Firebase synchronization and paid AI execution require separate live evidence.
- Current compact desktop and mobile Today screenshots are `.impeccable/review/compact-desktop.png` and `compact-mobile.png`; earlier Library, saved set, and dark Today captures remain as supporting evidence for those states.
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
