# Aura AI security and privacy review

Date: 2026-07-24

## Trust boundaries

| Boundary | Principal risk | Control |
| --- | --- | --- |
| Provider credentials | disclosure through config, logs, errors, or GUI | credential stores and env references; safe DTOs; redaction; privacy scan |
| Local management API | hostile web origin, DNS rebinding, remote access | loopback Host/Origin validation; admission token required off loopback; CORS allowlist |
| Provider responses | prompt injection, oversized bodies, malformed streams | provider content remains untrusted; bounded reads; protocol parsing; no provider-directed local actions |
| Client config writes | corruption or overwrite of later user edits | preview; backup; atomic write; verification; rollback; hash-guarded restore |
| OAuth callbacks | code/state theft and callback confusion | state verification; loopback callback; bounded manual-code fallback; provider-specific policy |
| Logs and usage | request bodies, identifiers, or secrets persisted | no request-body logging; hashed thread IDs; capped/redacted errors; privacy scan |
| Aura full-output store | raw tool logs can contain private data | local-only config directory; digest handles; `0700`/`0600`; authenticated no-store retrieval; no arbitrary paths |
| Routing/optimizer | silent model switch or lossy evidence removal | deterministic route reasons; manual override; protected-content rules; measured transforms |
| Release automation | publishing unaudited code or mutable workflow dependencies | exact-SHA CI/service gates; branch/channel checks; dry-run default; security review required |

## Optimizer-specific review

The optimizer never runs on native passthrough or compaction requests. Source,
diffs, migrations, security/auth evidence, stack traces, encrypted content,
images, and patch results are protected before deduplication or reduction.
Full output is written locally before a retrieval handle is emitted.

The retrieval route accepts only `[a-f0-9]{20}` and cannot resolve a user path.
It inherits management authentication, Host, Origin, and CORS checks and sends
`Cache-Control: no-store`.

## Verification evidence

The security gate includes:

- management authentication, Origin, Host, and non-loopback tests;
- secret/error redaction and privacy scan;
- OAuth callback/state tests;
- atomic config, backup, rollback, and guarded restore tests;

M7 adds explicit coverage for client discovery and guided setup: Aura only
writes schemas for clients with a tested adapter, treats unknown client paths as
manual guidance, validates model identifiers as non-empty strings, keeps local
endpoint credentials out of previews and logs, and skips its optimizer when a
downstream RTK-compatible optimizer is declared. Claude Desktop restore is
hash-guarded and refuses to overwrite edits made after Aura applied its file.
- Windows secret ACL and cross-platform path tests;
- full-output path traversal and protected-content tests;
- release workflow exact-SHA and permissions tests.

No production release should proceed unless the full test suite and
`bun run privacy:scan` pass on the release commit.
