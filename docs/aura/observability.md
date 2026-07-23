# Aura observability contract

Date: 2026-07-23

Aura extends the existing OpenCodex request and usage records instead of adding
a second logging pipeline.

Persisted request metadata:

- `requestId`: unique local request identifier.
- `threadKey`: first 16 hex characters of SHA-256 over a supported client
  thread/session header. Raw thread identifiers are never persisted.
- `provider`, `model`, `resolvedModel`, and requested reasoning/speed fields.
- `auraProfile`, `auraRole`, and `auraRouteReason`.
- status, terminal source, close reason, retry attempts, recovery kinds,
  first-output latency, and total latency.
- input, cached input, cache creation, output, reasoning, and total tokens when
  reported; estimates remain explicitly marked.

Privacy boundaries:

- API keys, OAuth tokens, authorization headers, raw prompts, source code, and
  raw tool output are excluded.
- Upstream errors are secret-redacted and capped before persistence.
- Compatibility reports store status, event names, hashes, counts, timings, and
  redacted errors only.

The request ID correlates individual attempts. The hashed thread key groups
requests from Codex, Claude Code, and OpenAI-compatible clients without exposing
their raw session identifiers.
