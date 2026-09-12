# AI generation

Lexiro calls providers directly from the browser using the learner's local API key. Settings and exports use version 3; the explicit v1 and v2 migrations retain existing models, custom URLs, segment sizes and reasoning effort. Keys are never exported.

## Flow

`tasks.ts` creates a stable context, global source references, JSON schema, and independently verifiable steps. `runner.ts` executes exactly one turn at a time. `session.ts` owns a settings snapshot and the last committed native response ID or client-side history. Only validated results advance the task. An invalid partial segment can retain its valid entries and target the remainder. Paragraph-based question packs are atomic.

The React hook guards asynchronous updates with generation IDs. Pause retains results and pending steps in memory; resume does not regenerate committed steps. Regenerate starts a new preview. Additional question rounds keep existing results and reject duplicate fingerprints. Preview results are only saved when the learner applies them. Refreshing the page ends the in-memory task.

Known models use documented limits; unknown models can override the protocol, schema support, context capacity and output cap. Context planning uses a conservative byte-based estimate, not billed token counts. Large tasks are partitioned serially as necessary. The API response supplies actual usage; absent fields remain unknown.

## Protocols and sources

Official documentation checked September 12, 2026:

- [OpenAI models](https://developers.openai.com/api/docs/models), [conversation state](https://developers.openai.com/api/docs/guides/conversation-state), [prompt caching](https://developers.openai.com/api/docs/guides/prompt-caching), [structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs). Responses uses `previous_response_id`, `text.format`, and model-specific caching. GPT-5.6+ single-turn requests use explicit caching without breakpoints to avoid cache writes.
- [Claude models](https://platform.claude.com/docs/en/models/overview), [prompt caching](https://platform.claude.com/docs/en/build-with-claude/prompt-caching), [structured outputs](https://platform.claude.com/docs/en/build-with-claude/structured-outputs). Messages replays client-managed history, marks a stable system prefix and the last block with `cache_control`, and uses `output_config.format`.
- [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [REST reference](https://ai.google.dev/api/interactions-api), [caching](https://ai.google.dev/gemini-api/docs/caching), [structured output](https://ai.google.dev/gemini-api/docs/structured-output). Interactions uses `previous_interaction_id`, `response_format`, and implicit caching. generateContent remains an explicitly selectable custom protocol.

Native continuation enables provider-side response storage; it does not make previous input free or guarantee cache hits. UI usage includes all reported attempts, including truncated replies. Network failures without provider usage cannot be counted.

## Caching

A task's instructions are the whole source list and never change between its
segments, so the prefix a run repeats is long and identical. What each provider
does with that differs, and the differences are the reason the request builder
is not uniform:

- **OpenAI.** Nothing below 1,024 rendered input tokens is cached at all. A
  write costs 1.25x and a read 0.1x, so caching pays for itself on the second
  request sharing a prefix and loses 25% on a prefix used once — which is why a
  session with nothing to reuse asks for explicit breakpoints and gives none.
  `previous_response_id` keeps the history on the server, so a turn never
  resends it. `prompt_cache_key` names the run's prefix and routes its turns to
  the node holding it.
- **Anthropic.** The minimum is per model — 512 on Opus 5 and Fable 5.1, 1,024
  on Sonnet 5, and 4,096 on Haiku 4.5, which the instructions alone rarely
  reach. The whole conversation is replayed on every turn, so the breakpoint on
  the system prefix is not enough: a second one on the last block lets each turn
  read everything before it and write only what it added. Both stay at the
  default five minutes; the hour-long TTL doubles the write and a run's segments
  are seconds apart. The cached order is tools, then system, then messages, and
  changing the reasoning effort invalidates the message-level cache.
- **Gemini.** Caching is implicit and needs 4,096 tokens on every model the
  catalogue lists, which a typical run does not reach, so cache reads of zero
  there are the provider's floor rather than a defect. The Interactions API
  supports no explicit cache. Stable content already comes first, which is the
  only lever available.

Segment size is the larger lever and it is bounded because of that: a segment
replays every segment before it, so ten words per segment sends roughly twice
the input of twenty for the same run, and the difference is larger than
everything caching recovers. `SEGMENT_SIZE` in `catalog.ts` holds the range,
15 to 30 with a default of 20 — below fifteen a run pays for its own history,
above thirty a single reply is long enough to be truncated often. A truncated
segment is still halved by the runner, which is a reduction of one turn rather
than a setting.

Across runs and across features the shared prefix is the prompt template alone,
a few hundred tokens — under every threshold above. Padding it to reach one
would cost those tokens on every request forever, so nothing tries to. Two runs
over the same sources do share a prefix, and that is what regenerating and
adding another round hit.

## Verification

Run `npm run typecheck`, `npm run lint`, `npm run test`, and `npm run build`. Tests cover protocol construction, streamed completion, cancellation, sequential commits, partial recovery, context rebuilding and migration.

For deterministic visual QA, run `node tests-next/fixtures/ai-preview-server.mjs` alongside the development app on port 3001. In that local app, select Responses with endpoint `http://localhost:4011/v1/responses` and any fake test key. The fixture runs only on loopback, accepts CORS only from localhost:3001, never logs keys and simulates delayed word generation. It is not an external-provider integration test.

Real-provider browser CORS, account access and billing behavior require the user's own credentials and remain separate from fixture and contract tests.
