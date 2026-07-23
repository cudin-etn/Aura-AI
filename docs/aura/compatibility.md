# Aura compatibility probes

Date: 2026-07-23

Run the sanitized GPT-5.6 suite:

```sh
bun run compat:aura --mode proxy --repeat 1 \
  --provider 9router \
  --proxy-model 9router/cx-gpt-5.6-sol \
  --proxy-base http://127.0.0.1:10101/v1 \
  --out docs/aura/gpt56-9router-compat.json
```

Use `--mode both` for direct-versus-Aura comparison only when the direct
provider endpoint is safe to probe. `--mode proxy` avoids destabilizing a
provider whose native compact endpoint is already known to be broken.

Grades:

- `Native`: required proxy probes pass without translation.
- `Compatible`: required probes pass through a declared compatibility
  translation.
- `Limited`: basic generation works but one or more agent capabilities fail.
- `Failed`: non-streaming or streaming generation fails.

The fixture covers non-streaming, streaming, tool call, tool-result continuation,
reasoning effort, compact/resume, expected validation errors, and client
cancellation.

## GPT-5.6 through 9router 0.5.40

9router's `cx` adapter forces `stream: true` even for its compact route. The
GPT-5.6 compact backend rejects that parameter. Aura therefore supports
`compactMode: "synthetic"` for an OpenAI Responses-compatible provider. In that
mode only compaction is summarized through the provider's Chat Completions
endpoint; normal Responses traffic is unchanged.

The live sanitized report is `docs/aura/gpt56-9router-compat.json`. Its expected
grade is `Compatible`, with `translation_required` as the reason.
