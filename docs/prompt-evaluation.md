# Prompt evaluation

Prompt sources, schemas, synthetic input fixtures and evaluation scripts are maintained in the private `lexiro-worker` repository. Public frontend tests cover parsing, assembly, serial execution, partial recovery and request boundaries.

The private evaluator uses the production frontend parsers through a local frontend checkout. Its real-model runs consume Codex account usage. Revalidating saved responses does not call a model. A successful parser result is not a complete educational-quality or production API test.
