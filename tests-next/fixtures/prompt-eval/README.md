# Prompt evaluation cases

These are synthetic source words and captured baseline prompts. Fixture `response`
and `review` fields were drafted by planning agents whose runtime model identity
was not verified. They are design examples, **not** evidence of Luna performance.

`node scripts/evaluate-ai-prompts.mjs --run final` makes actual requests through
the installed, authenticated Codex CLI with `gpt-6-luna` and low reasoning.
It verifies those settings in the CLI receipt, applies the current app parser,
and saves requests, responses and results under the private sibling directory
`../lexiro-prompt-eval-private/<phase>/`, with a timestamped copy in `runs/`.
The CLI entry point can be supplied with `CODEX_PROMPT_EVAL_CLI`.

`baseline` replays the captured original prompts; `optimized`, `final`, and `highschool-v5` capture
current production prompts before starting. Optional last argument filters case
IDs. Runs consume account usage. No API keys are read or recorded by the script.

For the v5 high-school calibration, run only the two diagnostic cases:

```powershell
node scripts/evaluate-ai-prompts.mjs --run highschool-v5 vocabulary-two-turn
node scripts/evaluate-ai-prompts.mjs --run highschool-v5 reading-difficulty-2
node scripts/validate-prompt-eval.mjs highschool-v5
```

Revalidation reads saved replies without a new model request and writes
`../lexiro-prompt-eval-private/highschool-v5/validation.json`.

The harness replays prior turns as transcript data and constrains JSON output.
It evaluates content and parsing, not provider HTTP transport, native response
IDs, latency comparisons or cache/billing behavior. One sampled result per case
is diagnostic evidence, not a statistically reliable quality benchmark.
