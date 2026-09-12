# AI generation

The browser sends Firebase-authenticated, data-only requests to `NEXT_PUBLIC_AI_WORKER_URL`. The private Worker owns provider credentials, prompts, output schemas, tier settings and billing. There are no browser API keys, provider settings or manual prompt panels. Token usage and cost are shown to administrators only.

`src/lib/ai/tasks.ts` splits source data into verifiable steps. `runner.ts` executes them serially and retains valid partial results. `session.ts` stores a random session identifier, selected tier and last accepted response cursor. Pausing retains pending work in memory; refreshing the page ends that in-memory task. Applying the preview writes it to the library.

`lib/managed-client.ts` refreshes the Firebase token once on HTTP 401, rejects results after account changes, consumes Responses text events, and adds each turn's reported tokens onto the session. UI shows Lite, Thinking and Pro with point estimates. An administrator is never charged: the Worker skips reservation entirely for them, so they see 無限額度 and, after a run, the tokens it used and what the provider will charge, priced from `MODEL_PRICES` in `packages/ai-contract` (published USD rates per million tokens). The backend independently validates requests and computes charges; client estimates are not an authorization boundary.

`packages/ai-contract` contains public source parsing, request types and pricing arithmetic. Private prompts and evaluation tooling live in the separate `lexiro-worker` repository. Prompt evaluation is described there; stored parser passes do not prove educational quality, production connectivity or Workers CPU cost.

Full backups now use version 2. Importing version 1 preserves library and learning data while dropping retired AI settings. Sync journal version 3 preserves pending records, deletions and cursor while removing the AI settings dirty flag and local credentials. Existing Firestore learning-data shapes remain version 6.
