# AI generation

Lexiro calls providers directly from the browser using the learner's local API key. Settings and exports use version 2; the explicit v1 migration retains existing models, custom URLs and segment sizes. Keys are never exported.

## Flow

`tasks.ts` creates a stable context, global source references, JSON schema, and independently verifiable steps. `runner.ts` executes exactly one turn at a time. `session.ts` owns a settings snapshot and the last committed native response ID or client-side history. Only validated results advance the task. An invalid partial segment can retain its valid entries and target the remainder. Paragraph-based question packs are atomic.

The React hook guards asynchronous updates with generation IDs. Pause retains results and pending steps in memory; resume does not regenerate committed steps. Regenerate starts a new preview. Additional question rounds keep existing results and reject duplicate fingerprints. Preview results are only saved when the learner applies them. Refreshing the page ends the in-memory task.

Known models use documented limits; unknown models can override the protocol, schema support, context capacity and output cap. Context planning uses a conservative byte-based estimate, not billed token counts. Large tasks are partitioned serially as necessary. The API response supplies actual usage; absent fields remain unknown.

## Protocols and sources

Official documentation checked September 12, 2026:

- [OpenAI models](https://developers.openai.com/api/docs/models), [conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Responses uses `previous_response_id`, `text.format`, and model-specific caching. GPT-5.6+ single-turn requests use explicit caching without breakpoints to avoid cache writes.
- [Claude models](https://platform.claude.com/docs/en/models/overview), [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Messages replays client-managed history, marks a stable system prefix with `cache_control`, and uses `output_config.format`.
- [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [REST reference](https://ai.google.dev/api/interactions-api), [caching](https://ai.google.dev/gemini-api/docs/caching), [structured output](https://ai.google.dev/gemini-api/docs/structured-output). Interactions uses `previous_interaction_id`, `response_format`, and implicit caching. generateContent remains an explicitly selectable custom protocol.

Native continuation enables provider-side response storage; it does not make previous input free or guarantee cache hits. UI usage includes all reported attempts, including truncated replies. Network failures without provider usage cannot be counted.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Tests cover protocol construction, streamed completion, cancellation, sequential commits, partial recovery, context rebuilding and migration.

For deterministic visual QA, run `node tests-next/fixtures/ai-preview-server.mjs` alongside the development app on port 3001. In that local app, select Responses with endpoint `http://localhost:4011/v1/responses` and any fake test key. The fixture runs only on loopback, accepts CORS only from localhost:3001, never logs keys and simulates delayed word generation. It is not an external-provider integration test.

Real-provider browser CORS, account access and billing behavior require the user's own credentials and remain separate from fixture and contract tests.
