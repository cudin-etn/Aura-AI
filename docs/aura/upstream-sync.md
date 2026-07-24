# Upstream sync

Aura keeps OpenCodex as `upstream` and develops on `codex/aura-ai`.

```bash
git fetch upstream --tags
git switch codex/aura-ai
git merge --no-ff upstream/main
bun install --frozen-lockfile
(cd gui && bun install --frozen-lockfile)
bun run typecheck
bun run lint:gui
bun test --parallel=1
bun run privacy:scan
bun run build:gui
```

Resolve upstream compatibility changes separately from Aura product changes
when practical. Never publish a synced branch until the complete gate above
passes.
