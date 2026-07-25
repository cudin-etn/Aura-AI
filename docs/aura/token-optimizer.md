# Aura AI token optimizer

Date: 2026-07-24

## Scope and activation

The optimizer is compiled into Aura profiles and runs only for translated,
routed providers. Native OpenAI passthrough and compaction requests remain
byte-identical. Users can disable the optimizer or either transformation in
`aura.optimizer`.

Routing → Optimization exposes the same controls as three simple presets:

- `Lite` disables deduplication and log reduction and raises role context
  budgets to 150% of the defaults.
- `Full` enables the conservative transformations with default context budgets.
- `Ultra` enables the same protected transformations with role context budgets
  reduced to 60% of defaults. It does not introduce lossy model-output
  compression.

The UI also shows a capability matrix inspired by 9Router. It distinguishes
available endpoints from partial support and planned contracts, so future TTS,
STT, embeddings, and standalone web-fetch work can be added without claiming
support before the provider adapters and response contracts exist.

## Conservative transformations

Aura processes parsed tool-result context before provider translation:

1. a later exact output of at least 256 characters becomes a digest reference
   to the earlier result;
2. structured logs over 12,000 characters retain a 4,000-character head and
   tail;
3. role context budgets can elide older reducible outputs while retaining a
   1,000-character head and tail.

Default tool-result budgets are 80k tokens for orchestrator, 20k explorer, 40k
worker, 60k reviewer, 30k tester, and 20k docs. If protected content alone
exceeds a budget, Aura preserves it and accepts the overage.

## Protected content

No transformation is applied to:

- source or diff-shaped output;
- migrations and schema changes;
- security, credentials, auth, and vulnerability evidence;
- unresolved stack traces;
- encrypted or image output;
- `apply_patch` results.

Focused tests assert byte equality for every protected category.

## Full-output retrieval and security

Reduced output is stored under Aura's local config directory with a
content-derived 20-character handle. Directories use mode `0700` and files use
`0600` where the platform supports POSIX permissions. The management endpoint
accepts only an exact lowercase hexadecimal handle, returns `Cache-Control:
no-store`, and remains behind the existing management API authentication,
loopback-host, and Origin checks. User-supplied paths are never accepted.

## Measurement

Request and persisted usage logs record estimated saved tokens and
transformation count. Insights → Usage shows optimizer status and aggregate
savings beside existing cache and normalized-cost metrics. Route details show
per-request optimizer actions. Saved-token estimates use the same conservative,
CJK-aware estimator as existing usage fallback and are not presented as
provider-billed tokens.
