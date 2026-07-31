# lexiro Project Structure

lexiro is a Vue 3 + Pinia vocabulary practice app with local persistence, Firestore sync, ZIP backup, and spaced repetition.

## Architecture

- **Frontend**: Vue 3 `<script setup lang="ts">`, Vue Router, Tailwind CSS v4, lucide-vue-next.
- **State**: Pinia setup stores: sets, session, backup, UI.
- **Persistence**: Primary writes to **localStorage** via `saveToStorage`. Loads prefer localStorage, then legacy IndexedDB for migration. Signed-in users sync durable sets and learning progress through Firestore listeners and debounced writes.
- **Study modes**: Flashcards one-card flip + keyboard; quiz/spelling with session-local option shuffle and shared spelling normalization.
- **Import/export**: ZIP worker with local-only import/export.
- **i18n**: `src/locales/zh-TW.ts`.
- **Testing**: Vitest for lib + stores.

Key new modules: `src/lib/spelling.ts`, `src/lib/shuffle.ts`, `src/components/ui/score-ring/ScoreRing.vue`.
