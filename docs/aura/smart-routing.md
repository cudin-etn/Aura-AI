# Aura AI smart routing

Date: 2026-07-24

## Reused safety mechanisms

Aura compiles profiles into the existing OpenCodex routing controls rather than
adding a second dispatch engine:

- the requested parent model remains sticky for the thread;
- Codex account selection has bounded thread affinity, quota-aware rebinding,
  credential quarantine, soft avoidance, and escalating cooldown;
- provider API-key pools retry the same model on another key after 429;
- fallback combos preserve ordered attempts, cool retryable failures, honor
  `Retry-After`, and fail closed for caller/context errors;
- the Codex multi-agent gate owns the process-wide concurrency ceiling.

These mechanisms already have focused and end-to-end regression coverage.

## Universal roles and profiles

Aura defines orchestrator, explorer, worker, reviewer, tester, and docs roles.
Each role has a conservative minimum tier, reasoning level, tool requirement,
and vision requirement. Saver, Balanced, and Quality map those roles onto the
available Luna, Terra, and Sol family without inventing unavailable models.

Applying a profile writes the existing subagent roster, worker injection model,
effort, and deterministic delegation guidance. Explicit per-role choices are
validated against the normalized available-model catalog.

## Smart GPT Router

The Routing workspace exposes three deliberately bounded modes:

- **Manual** preserves the model requested by the client (the default).
- **Auto Safe** selects from the saved eligible GPT catalog at a request
  boundary: economy tier for exploration/docs, balanced tier for parent/work/
  testing, and strongest tier for review.
- **Auto Adaptive** uses that same safe role contract today and is reserved for
  measured latency, price, throughput, and quota-health inputs once the live
  benchmark gate exists. It does not claim live optimisation from a model name.

Aura only considers explicit GPT candidates; it never switches provider family
or changes an in-flight stream. Explicit risk and verification escalation still
take precedence. The selected mode and its human-readable reason are persisted
in the route trace.

## Route trace

Sanitized request/usage logs persist:

- client and protocol;
- hashed thread key;
- Aura profile and inferred role;
- manual choice, Auto Safe/Adaptive selection, or bounded escalation reason;
- physical attempts, recovery kinds, affinity decision, usage, and cost.

The Logs detail view surfaces the Aura route fields alongside provider/model
and the ordered fallback attempts.

## Deterministic escalation

Aura does not spend an extra model call classifying task difficulty. It
escalates to the configured reviewer model only when a client supplies one of
these bounded machine-readable signals:

- `x-aura-risk` (or `aura_risk` in Codex turn metadata) is `security`,
  `concurrency`, `migration`, or `data_loss`;
- `x-aura-verification-failures` (or
  `aura_verification_failures` in turn metadata) is at least two.

The route trace records `risk_escalation` or `verification_escalation`.
Unknown hints and a single failed verification do not switch models.

## Per-task limits

Profiles compile to hard task limits:

| Profile | Concurrent subagents | Reported-token budget |
| --- | ---: | ---: |
| Saver | 2 | 250,000 |
| Balanced | 3 | 500,000 |
| Quality | 4 | 1,000,000 |

The in-memory counter is keyed by the existing sanitized thread identity,
expires after six idle hours, and is bounded to 1,000 tasks. Responses,
Chat Completions, and Claude Messages contribute authoritative reported usage.
When a provider reports no usage, Aura does not invent token consumption.
Requests fail closed with a specific 429 error after the token ceiling or while
the task's concurrent-subagent ceiling is occupied.
