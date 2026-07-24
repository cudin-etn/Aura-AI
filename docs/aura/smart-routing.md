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

## Route trace

Sanitized request/usage logs persist:

- client and protocol;
- hashed thread key;
- Aura profile and inferred role;
- profile match versus manual model override;
- physical attempts, recovery kinds, affinity decision, usage, and cost.

The Logs detail view surfaces the Aura route fields alongside provider/model
and the ordered fallback attempts.

## Still open

Two controls are intentionally not claimed complete:

- automatic escalation needs runtime verification/risk signals, not only prompt
  guidance;
- per-task token/subagent budgets need a task identity and enforcement counter,
  not only the existing process-wide concurrency setting.

Both must be deterministic, observable, and benchmarked before they can affect
model choice.
