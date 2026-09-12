# Lexiro project structure

Lexiro is a Next.js App Router vocabulary-learning PWA. The UI is React; the existing canonical vocabulary domain and Firebase backend live under `src/`.

```text
app/             routes, layouts, manifest, service worker
components/      feature components and shared React UI
components/motion/ the route surface and the shared motion behaviours
config/          generator input: the motion ladder
scripts/         code generators (`npm run generate:motion`)
src/generated/   generated output; never edited by hand
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
`docs/design-system.md`. Every duration and easing in the product comes from one
ladder in `config/motion.config.json`, generated into `src/generated/` for both
CSS and JavaScript, so nothing states a literal duration of its own.

The workspace shell is shared by desktop and mobile. Desktop uses a compact sidebar; mobile uses the same routes through a bottom navigation bar. Brand identity stays in the shell, while `components/ui/page-header.tsx` owns each page's title, actions and back control, and `components/ui/back-control.tsx` is that back control: every screen beneath a destination uses it, so none of them can be built without a way out. Library folders use a drill-down model, similar to Windows File Explorer, instead of an always-expanded tree.

- `components/liquid-nav.tsx` — committed-path selection and Next Link pending feedback with a shared moving selection; the dock is live throughout a navigation — nothing is captured, so it never leaves the hit-test tree — and it animates nothing of its own: it belongs to the route, and the route change already covers it or uncovers it.
- `components/ui/liquid-tabs.tsx` — controlled segmented selection with the same shared-layout motion, without pointerdown speculation, measurement loops or reset timers.
- `lib/navigation-memory.ts` — the primary destination table, route/history direction, and adopted parents; home, library, progress and account are peers, while practice, sets/questions and sync belong to their respective primary destination. The table is what decides whether a route reveals in place and whether the floating navigation bar belongs on it, so the shell only supplies each destination's label and icon.
- `tests-next/navigation.test.tsx` — cancelled touches, modified clicks, controlled selection and primary/child route relationships.

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
SHA-256 truncated to 128 bits. Sense ids, question fingerprints, cloud record
ids and every stored checksum use it, so `firestore.rules` expects a record id
of the form `<type>-` followed by 32 hex characters.

## Cloud sync

The unit of synchronization is the record, not the Library. `src/lib/cloud-records.ts`
turns the Library into one document per folder, set, membership, word and
question and back again; `src/lib/cloud-sync.ts` reads the account's change feed
(`where('writtenAt', '>', cursor)`, ordered by the server's own timestamp) and
writes what changed in batches. A deleted record keeps its document and sets
`deleted`, so a deletion is a fact the cloud states rather than an absence the
next device has to interpret.

`src/lib/cloud-account.ts` holds the two documents that are not records —
review schedules and statistics — and merges each field by field, so answering
the same word on two devices does not cost one of them its history. AI settings
are not synchronized at all: which endpoint and model a user points the app at
stays on the device, and dropping the API key from it would not make the rest
worth uploading. They still travel in a full backup, which the user exports
deliberately.

`src/lib/sync-journal.ts` holds what this device has changed and not yet sent.
It is a sidecar: domain records carry no synchronization fields. The list of
dirty records comes free from `LibraryRepository.commit`, which already diffs
each commit against the previous generation, so no mutation in
`stores/library-store.ts` has to know that sync exists. Every entry is stamped
with a local version and a push clears only the version it sent, so an edit made
while a request was in flight stays queued.

Merging happens per record, newest `updatedAt` wins, and the result goes through
`repairLibraryState` in `src/lib/library-repair.ts` rather than through
validation: two devices can each make a legal change that is illegal together —
the same set name, a question whose set the other device deleted — and a merge
that could fail would strand the account. Learning progress merges card by card
so neither device's reviews are lost.

Learning progress and statistics are one debounced blob per account, flushed
when the page is hidden. Question statistics are sparse — a format/difficulty
row exists only once it has been practised — and `dailyHistory` is pruned to
`DAILY_HISTORY_RETENTION_DAYS`, because progress and stats are each a single
Firestore document and Firestore rejects anything past one mebibyte.

Persisted schema versions, all independent of one another:

| Data | Version | Defined in |
| --- | --- | --- |
| Library repository (IndexedDB) | 2 | `src/lib/library-repository.ts` |
| Sync journal (IndexedDB) | 1 | `src/lib/sync-journal.ts` |
| Cloud documents (Firestore) | 6 | `src/constants/cloud.ts` |
| Practice session snapshot | 2 | `src/types/session.ts` |
| Backup and share files | 1 | `src/types/backup.ts` |
