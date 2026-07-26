# Aura Token Saver

Aura's Token Saver is an independent implementation inspired by publicly
documented 9Router/RTK behavior. The reference describes automatic tool-output
classification for git diff/status, grep, find, ls, tree, log deduplication,
smart truncation, and a fail-open rule when compression fails or grows output:

- https://github.com/decolua/9router
- https://github.com/decolua/9router/blob/master/docs/ARCHITECTURE.md

Aura keeps the useful product behavior while preserving its own implementation,
protected-content rules, local retrieval handles, and usage accounting. Aura
never copies 9Router source, branding, credentials, or private provider logic.

## Modes

- **Off** — no optimizer mutation.
- **Safe** — bounded log reduction only; deduplication is disabled and protected
  source, patches, migrations, security evidence, images, encrypted content, and
  unresolved errors remain byte-identical.
- **Full** — bounded log reduction, repeated-output references, and role budgets.
- **Ultra** — Full behavior with tighter role budgets.

The legacy **Lite** preset remains accepted for config compatibility and maps to
the least invasive existing behavior.

## Downstream optimizer protection

If a provider or local gateway already applies 9Router RTK, set
`downstreamOptimizer` to `9router-rtk` in Aura. Aura then skips its own optimizer
for that request path so content is not reduced twice. `none` is the default;
`unknown` is retained as diagnostic metadata and does not claim measured savings.

Every transformation stores the original output locally and usage logs record
the estimated saved tokens and action count. These estimates are not benchmark
claims until the real benchmark gates are run.
