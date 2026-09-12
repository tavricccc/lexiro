# Prompt evaluation cases

These are synthetic source words and captured baseline prompts. Fixture `response`
and `review` fields were drafted by planning agents whose runtime model identity
was not verified. They are design examples, **not** evidence of Luna performance.

`node scripts/evaluate-ai-prompts.mjs --run final` makes actual requests through
the installed, authenticated Codex CLI with `gpt-5.6-luna` and medium reasoning.
It verifies those settings in the CLI receipt, applies the current app parser,
and saves requests, responses and results under `artifacts/prompt-eval/`.
The CLI entry point can be supplied with `CODEX_PROMPT_EVAL_CLI`.

`baseline` replays the captured original prompts; `optimized` and `final` capture
current production prompts before starting. Optional last argument filters case
IDs. Runs consume account usage. No API keys are read or recorded by the script.

The harness replays prior turns as transcript data and constrains JSON output.
It evaluates content and parsing, not provider HTTP transport, native response
IDs, latency comparisons or cache/billing behavior. One sampled result per case
is diagnostic evidence, not a statistically reliable quality benchmark.
