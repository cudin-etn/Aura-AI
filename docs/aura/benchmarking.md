# Aura AI benchmark contract

Date: 2026-07-24

## Corpus

`benchmarks/aura/corpus.json` contains 12 deterministic fixtures covering:

- trivial edits;
- routine provider and client work;
- stateful debugging;
- architecture and routing;
- security boundaries;
- cross-cutting large-repository changes.

Every task declares exact verification checks. Security, migrations, source,
and unresolved stack traces are tagged as protected content for optimizer
tests.

## Scoring

`bun run benchmark:aura score --results <path>` validates complete strategy
coverage and reports:

- verified task success and check-pass rate;
- total and cached tokens;
- normalized cost and cost per successful task;
- median latency;
- escalation and subagent counts.

Incomplete or duplicate strategy results fail instead of producing a
misleading comparison.

## Optimizer baseline

`bun run benchmark:aura baseline` measures the corpus with all transformations
disabled. The committed result is `docs/aura/optimizer-baseline.json`:

- 12/12 fixtures remain byte-identical;
- 1,470 characters and 373 estimated tokens enter and leave unchanged;
- saved tokens are exactly zero.

This baseline freezes the pre-optimization input. Repeated-output
deduplication, log reduction, unchanged-content elision, and context budgets
must compare against it and must preserve every protected fixture.

## Live strategy evaluation

The scorer is ready for always-Sol, Saver, Balanced, and Quality result sets.
Those live runs remain a release gate because they require configured provider
accounts, quota, and repeat sampling. Aura makes no cost-saving claim until
`EVAL-003` passes the PLAN.md success thresholds.

