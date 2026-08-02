# lexiro Project Structure

lexiro is a Vue 3 + Pinia vocabulary practice app with a canonical word/sense library, Firestore sync, ZIP backup, and spaced repetition.

## Architecture

- **Frontend**: Vue 3 `<script setup lang="ts">`, Vue Router, Tailwind CSS v4, lucide-vue-next.
- **State**: Pinia setup stores for the canonical library, set workflows, sessions, learning/FSRS, backup, account, cloud sync, and UI.
- **Domain model**: `library.words` stores one `WordEntry` per normalized word; senses, memberships, folders, and questions are shared records. Every saved word is reachable through a set membership.
- **Persistence**: Application data uses the namespaced IndexedDB repository in `src/lib/persist.ts`; API keys remain device-local. Cloud sync uses a record-level outbox and Cloud-first reconciliation.
- **Study modes**: Memory review uses FSRS `Again`/`Good`; formal questions are multiple choice, fill-blank, and reading comprehension. Sessions are local transient state and are not synced.
- **Import/export**: Canonical word/question JSON flows through strict parsers; ZIP worker handles set sharing and complete backups without API keys or rebuildable caches.
- **Seed preparation**: `scripts/prepare-library-data.mjs` is an offline one-way conversion from the external source into canonical `output/` bundles; it is not part of runtime import or compatibility handling.
- **i18n**: `src/locales/zh-TW.ts`.
- **Testing**: Vitest for lib + stores.

Key domain modules: `src/lib/library.ts`, `src/lib/library-import.ts`, `src/lib/fsrs.ts`, `src/lib/sync-outbox.ts`, `src/lib/cloud-sync-remote.ts`, `src/lib/cloud-sync-reconcile.ts`, `src/lib/daily-question-selection.ts`, and `src/lib/share.ts`.
