# Confirmed product decisions

Decisions here are product truth unless a later entry supersedes them
explicitly. `PRODUCT.md` states the direction; this file records what was
actually settled, and why.

## Brand

**Forest ink green on mist-white neutral surfaces.**

The implementation is a nine-step ramp (`--brand-50` … `--brand-900`) whose dark
theme inverts the ramp rather than introducing a second palette, so one set of
utilities serves both themes. `--success` is deliberately shifted toward teal so
that a success state cannot be read as ordinary brand chrome, and success and
failure always pair an icon with text rather than relying on colour alone.

Decorative illustration stays monochromatic within the green family. Open
Doodles appears only in unused space, loading, empty and completion states.

See `docs/design-system.md` for the tokens, typography and component rules that
follow from this.

## Typeface

Two faces with a strict division of labour: **HarmonyOS Sans TC** for all
interface text, **Newsreader** for lexical content — page titles, section
headings, headwords, parts of speech, example sentences, and figures meant to be
read as results.

HarmonyOS Sans TC is retained as the interface face by explicit decision; it is
bundled locally rather than fetched.

## AI generation

**Anything a program can decide is not asked of a model.**

Every field a model has to produce is a field it can get wrong, so the model is
asked only for what needs language judgement — a natural sentence, a plausible
distractor, a coherent passage — and the rest is built in code. In practice:

- The model writes complete prose with the target word still in it, and names
  the span that is the answer. **Code cuts the blank.** A model asked to type
  `_____` in the right place will sometimes type two, sometimes leave the answer
  next to the blank, sometimes number them out of order; a model asked for an
  ordinary sentence does none of that.
- The model never returns `answerIndex`. Code places the answer among the
  distractors and reports where it landed.
- The model never returns ids, fingerprints, timestamps, or the link back to the
  source sense. Those are minted from the request.
- Where the learner's own library holds three same-part-of-speech words, the
  distractors come from there rather than from the model — which is also how a
  段考 paper draws them, from the same unit.
- A 詞彙題 whose sense already has an example sentence containing the base form
  is built with **no request at all**: their sentence, their word, their
  distractors.
- An item the model got wrong is dropped and reported, not saved; a batch with
  nothing usable fails so it can be retried.

**Automatic batching is the primary path; the manual path is never removed.**

Not every user has an API key. The interface therefore offers both:

- With AI configured, the primary button generates in one press. Everything in
  scope is selected by default — there is no selection cap and no round of
  ticking boxes before the common case works. The selection is split into
  batches by `splitGenerationBatches` and sent with bounded concurrency by
  `runAiBatches`.
- Without AI configured, the primary button becomes "設定 AI" and the manual
  section — copy prompt, paste the model's response, validate — starts open.
  It remains available, folded away, when AI is configured.

Batch size comes from the format table (`questionBatchSize`), not from one global
constant: a 文意選填 passage absorbs eight words, a 篇章結構 passage four. It is the
size of one request, **not** a limit on how much the user may select.

A failing batch does not discard the run: partial results are kept, the failed
batches are listed, and only those can be retried. Cancelling aborts in-flight
requests and keeps what has already been produced.

## Question formats

**Lexiro generates the formats a Taiwanese senior-high student actually sits.**
Generic "which option means X" multiple choice was replaced, because it does not
appear on any paper they will take.

The catalogue is `src/lib/question-formats.ts`, and it is the only place counts
are written down. It follows the 115 學年度 學測 paper:

| Format | 題型 | Shape |
| --- | --- | --- |
| `vocabulary` | 詞彙題 | one sentence, one blank, four options |
| `grammar` | 文法題 | same shape, tests structure rather than meaning (段考) |
| `cloze` | 綜合測驗 | passage with blanks, each blank its own four options |
| `wordBank` | 文意選填 | passage with blanks, one shared bank, each option used once |
| `discourse` | 篇章結構 | passage with four sentences removed, five sentence options |
| `reading` | 閱讀測驗 | passage with three to five comprehension questions |

篇章結構 is five-options-for-four-blanks, which is the 115 學年度 change from the
previous four-for-four; getting one wrong no longer forces a second one wrong.

Both sentence formats require exactly one blank, because a 詞彙題 without a
blank is not a 詞彙題.

Free-response 中譯英 and 英文作文 are deliberately out of scope: they cannot be
graded automatically, and a wrong auto-grade on a translation teaches the wrong
thing.

## Settings

**Settings save themselves.** The settings page previously mixed three
behaviours — theme applied instantly, daily goals needed a "save goals" button,
AI settings needed another — so whether a change had stuck depended on which row
it was in. Every setting now commits shortly after the last edit and reports it
in one place per section. AI settings are held back only while the configuration
is incomplete (enabled with no API key), which is surfaced as an inline field
error rather than a toast.

## Interface

The selected composition is **Focus Canvas / 專注畫布**. Desktop and mobile carry
the same destinations, capabilities, labels and task order.

Structure is carried by hairlines, margins and typographic hierarchy rather than
by nested cards; at most one orchestrated entrance animation per screen.

**Starting a session asks for a track, then for shape.** Practice used to be a
choice between 背單字 and 做題目, where each branch carried its own hidden filter
row. It is now two steps: 每日複習 or 做題目, then the range and the length —
which both branches share — followed by only what that branch needs. 每日複習
asks how the words FSRS has scheduled should come at you (單字卡, 拼字, or both
mixed); 做題目 asks which of the six exam formats to include, as checkboxes with
counts, because choosing three of six was never something one dropdown could
say. A session is a queue of entries rather than a mode, so the entry under the
cursor decides what the screen asks and a passage keeps its items together.

**A saved set is read before it is edited.** `/sets/[setId]` shows the set;
`/sets/[setId]/edit` changes it. An earlier decision merged the two to remove a
duplicate address, which made every visit to a set an encounter with input
fields. The questions built from a set live in a tab beside its words rather
than in a section below them.

## Cloud sync

**A deletion is something the cloud says, not something it fails to mention.**
Sync used to publish the Library as one packed snapshot and decide, per sync,
whether the local or the cloud copy won. That model has no way to express "this
was deleted": an absent record is indistinguishable from one the other device
has not seen yet, so the cloud copy came back on the next sync and deleting
something took several attempts. Each record now has its own document, and
deleting one writes a tombstone rather than removing it.

**Records sync one at a time.** Two devices that touch different words no longer
conflict at all, and a device that renamed one set sends one document instead of
the whole Library. Reads are a change feed ordered by the server's timestamp, so
a sync costs a query for what changed rather than a download of everything. The
packed model needed a write lock to keep its manifest consistent; that lock had
a five minute lease, and a tab closed mid-publish wedged every other device
until it expired. Independent records need no lock, so there is none.

**A merge repairs, it never refuses.** Two devices can each make a change that
is valid alone and invalid together — the same new folder name on both, or a
question whose set the other device deleted. Rejecting such a pair would leave
the account permanently unable to sync with nothing the user could do about it,
so `repairLibraryState` resolves every conflict to something: a duplicate name
gets a suffix, a reference to something that is gone is dropped.

**The AI setup syncs; the API key never does.** Provider, endpoint, model,
protocol and every generation limit are configuration a user got right once and
should not have to get right again on their next device, so they travel with the
account like everything else. The API key does not: it is a credential, and the
Firestore rule for the settings document lists the fields it will accept without
it, so a client that tried to upload one would be refused rather than trusted.
A device that already holds a key for the endpoint that arrived keeps it, and
one whose key belongs to somewhere else drops it — the same judgement an
imported backup goes through.

Nothing about the setup is merged. Half of one setup and half of another is not
a setup any request could be made with, so the device holding unsent changes
wins whole and every other device takes the account's copy whole.

**The workspace opens on local data.** Startup waited for the first cloud
reconciliation before showing anything, which put a network round trip — and
every retry of it — in front of the app. The data on the device is the data the
user was working with; sync catches it up underneath.
