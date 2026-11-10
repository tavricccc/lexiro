# Screenshot review follow-up

Branch: `feature/product-redesign`. No push, deployment or PR. Worker/backend endpoint contracts unchanged.

## Item results

| Item | Status | Change |
| --- | --- | --- |
| A1 | Fixed | Rail, dock and settings navigation use `--fill-hover`, ink text and accent icons. |
| A2 | Fixed | Save actions use the sticky frosted savebar without halo/ring. Swatches contain a check; selects and focused inputs use fills. |
| A3 | Fixed | Removed the listed saved/availability/word-count/review/shared captions, shortened confirmations and authorization copy, removed confirmation icon tiles; install dismissal closes directly. |
| A4 | Fixed | Authorization and agent rows have meaningful icons; admin statistics consistently omit icons. Backup actions are normal navigation rows; add/search/disable actions are secondary buttons. |
| A5 | Fixed | Shared empty-state component and empty home use the unboxed illustration, title and action pattern. |
| B6 | Fixed | Phone dock exists only on the four root destinations. Child pages retain return controls; roots have bottom clearance. |
| B7 | Fixed | Settings panes share width and padding; embedded page headers are hidden; the MCP URL wraps in full. |
| B8 | Fixed | Desktop result occupies up to 880px, with the ring summary and statistics alongside one another. |
| B9 | Fixed | Passage practice uses two balanced centered columns and single-column options. Desktop hides mobile passage controls; prompt/option sizes and kind chip are corrected. |
| B10 | Fixed | Game has one close control, preserving the host end confirmation. Lobby buttons use on-forest styling; join-code cells use surface fills. |
| B11 | Fixed | Editors use a sticky full-width frosted savebar with a right-aligned action. |
| B12 | Fixed | Heat map uses 16px square cells, 4px gaps and 5px radii; the phone shows whole columns aligned right. |
| B13 | Fixed | Set cover uses a large percentage ring (56px phone); only compact words/questions tabs remain, next to search on desktop. |
| B14 | Fixed | Demo familiarity differs by set, with amber/sky/mint rings and sense levels 0–3. |
| B15 | Fixed | Add-set tile sits in the grid at card size; the folder list starts with 全部. |
| C16 | Fixed | Launch, practice route and room use the same SetupBody: mode cards, kind/scope chips, count segments and one start action. Difficulty and one-sense controls retain their behavior. |
| C17 | Fixed | Resume is a small overlay dialog; unreadable drafts silently restart. |
| C18 | Fixed | Shared sets show their cover/appearance, normal word rows and the primary 加入我的單字 action. |
| C19 | Fixed | Editor labels sit above fields. The duplicate metadata toggle is removed; correct options use a filled check beside identical inputs. |
| C20 | Fixed | Question rows contain kind chip and first line only, in one phone/two desktop columns. |
| C21 | Fixed | Feedback retains result, answer and explanation; other-option notes are collapsed by default. |

## Commits

- `c4ad17b5` fix(ui): remove navigation pills, action halos and explanatory copy
- `f671669f` fix(layout): adapt navigation, focus screens and library for both sizes
- `f9ea4bae` fix(ux): unify setup sheets and rebuild editor, resume and shared-set flows
- `5cb48f16` fix(review): compact set tabs and stack question field labels
- `bc992ca7` fix(review): preserve host end action and shared-set appearance

- `7948a8d5` test: verify compact search tabs and document unified settings flows
- `63207c7f` fix(review): remove legacy focus halos and keep settings captures aligned

- `06e33546` test: bound font waits for reliable exhaustive Edge captures

- `59eea97c` fix(review): right-align every editor save action and pin setup start

## Verification

- `npm run typecheck`: exit 0, `tsc --noEmit`, no errors. [Log](followup-typecheck.log).
- `npm run lint`: exit 0, 0 warnings / 0 errors across 320 files. [Log](followup-lint.log).
- `npm test`: exit 0, 66 files / 365 tests passed, using the package script and jsdom configuration. The runner also prints the existing jsdom document-navigation notice. [Log](followup-test.log).
- `node design/verify-app.mjs`: seven browser flows passed, no page errors. Covers goal persistence, set/word/colour persistence, icon persistence, exactly-once answer count with reload, resume, room answer and shared-set copy. [Results](verification.json), [log](followup-browser.log).

Production build and the final capture audit follow after the run completes.
