# lexiro Project Structure

lexiro is a Vue 3 + Pinia vocabulary practice app with local persistence, ZIP backup, and optional Google Drive backup.

## Architecture

- **Frontend**: Vue 3 `<script setup lang="ts">`, Vue Router, Tailwind CSS v4, lucide-vue-next.
- **State**: Pinia setup stores: sets, session, backup, UI.
- **Persistence**: Primary writes to **localStorage** via `saveToStorage`. Loads prefer localStorage, then legacy IndexedDB for migration. Session drafts use debounced saves; navigation/visibility/finish flush immediately.
- **Study modes**: Flashcards one-card flip + keyboard; quiz/spelling with session-local option shuffle and shared spelling normalization.
- **Import/export**: ZIP worker + optional Google Drive.
- **i18n**: `src/locales/zh-TW.ts`.
- **Testing**: Vitest for lib + stores.

Key new modules: `src/lib/spelling.ts`, `src/lib/shuffle.ts`, `src/components/ui/score-ring/ScoreRing.vue`.
