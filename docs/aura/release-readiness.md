# Aura AI release readiness

Date: 2026-07-24

## Local evidence

- complete TypeScript and GUI typecheck;
- full Bun test suite;
- GUI lint and seven-locale parity, including complete Vietnamese coverage;
- production GUI/package preparation;
- credential/privacy scan;
- npm package dry-run;
- macOS source runtime and browser smoke verification.

## Cross-platform gates

The repository already runs CI on `ubuntu-latest`, `macos-latest`, and
`windows-latest`. Service lifecycle jobs separately verify systemd, launchd,
and Windows Scheduled Tasks, including uninstall cleanup. The release helper
requires successful CI and service-lifecycle runs for the exact immutable
release SHA before dispatch.

Local macOS success is not evidence of Windows runtime success. `REL-001` and
`REL-004` remain open until an Aura commit is pushed to a public origin and the
exact SHA has green cross-platform CI/service runs.

## Naming policy

The GUI product name is **Aura AI**. The public source origin is
`https://github.com/cudin-etn/Aura-AI`. The package is
`@tungninh/aura-ai`; the legacy OpenCodex package remains a migration source,
not the Aura release target.
The package exposes only `aura`. Legacy OpenCodex identifiers are left to the
older package so a global npm upgrade cannot collide with `opencodex.cmd` or
`ocx.cmd`, particularly on Windows.

Before the first independent Aura release:

1. run clean install and upgrade from the OpenCodex-compatible package;
2. verify that an existing OpenCodex global install can coexist with Aura
   without npm bin collisions.

## External release blockers

- `EVAL-003`: no repeated live always-Sol/Saver/Balanced/Quality result set;
- `REL-001`/`REL-004`: no exact-SHA public CI evidence;
- npm package identity is reserved; publish remains gated by benchmark and
  cross-platform release evidence.
