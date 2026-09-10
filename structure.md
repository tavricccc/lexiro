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
docs/            design system, product decisions, deployment
public/          Lexiro icons and Open Doodles illustration
```

Shared UI primitives live in `components/ui/` and are the only definition of a
control's markup: `Field`/`FieldRow`, `SelectField`, `PageHeader`, the
`LoadingState`/`EmptyState`/`ErrorState` trio, `Markdown`, and the `Icons`
concept map. Feature components compose these rather than hand-rolling labels,
native `<select>` elements or their own empty states, and they take icons from
`Icons` rather than importing from `lucide-react`. Design tokens and the brand
ramp live in `app/globals.css`; the rules that go with them are in
`docs/design-system.md`.

The workspace shell is shared by desktop and mobile. Desktop uses a compact sidebar; mobile uses the same routes through a bottom navigation bar. Library folders use a drill-down model, similar to Windows File Explorer, instead of an always-expanded tree.

Generated questions follow the Taiwanese senior-high formats. `src/lib/question-formats.ts`
is the catalogue; `question-prompts.ts` asks a model only for prose and answer
spans; `question-assembly.ts` cuts the blanks, orders the options and links each
item back to its sense; and `question-builders.ts` builds what needs no model at
all. `docs/product-decisions.md` explains why the split falls there.

The client persists local data through IndexedDB and can sync canonical records
through Firebase. Memory review uses FSRS; question practice supports multiple
choice, fill-in-the-blank, and reading comprehension.

## Storage model

`src/lib/library-repository.ts` is the only writer of the Library. It stores
each record — folder, set, membership, word, question — under the hash of its
own content, so saving rewrites only the records that actually changed. A
manifest maps every record id in one generation to its content hash, and a head
pointer names the live manifest; publishing that pointer is what makes a commit
visible, so an interrupted write leaves the previous generation intact. The
previous generation is retained and everything older is collected after each
commit, which keeps IndexedDB flat instead of accumulating one full copy of the
Library per save. `stores/library-store.ts` holds the assembled `LibraryState`
and hands a complete state back on every mutation; the repository works out the
difference.

Identity and integrity both come from `canonicalHash` in `src/lib/hash.ts`:
SHA-256 truncated to 128 bits. Sense ids, question fingerprints, cloud chunk
ids and every stored checksum use it, so `firestore.rules` expects chunk ids of
the form `chunk-` followed by 32 hex characters.

Learning progress and statistics are one debounced blob per account, flushed
when the page is hidden. Question statistics are sparse — a format/difficulty
row exists only once it has been practised — and `dailyHistory` is pruned to
`DAILY_HISTORY_RETENTION_DAYS`, because progress and stats are each a single
Firestore document and Firestore rejects anything past one mebibyte.

Persisted schema versions, all independent of one another:

| Data | Version | Defined in |
| --- | --- | --- |
| Library repository (IndexedDB) | 2 | `src/lib/library-repository.ts` |
| Cloud documents (Firestore) | 5 | `src/constants/cloud.ts` |
| Practice session snapshot | 2 | `src/types/session.ts` |
| Backup and share files | 1 | `src/types/backup.ts` |
