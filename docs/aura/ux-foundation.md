# Aura AI UX foundation

Date: 2026-07-24

## Product personality

Aura is a calm, capable control plane for AI coding clients. It should feel
clear and deliberate rather than infrastructure-heavy: strong hierarchy,
generous whitespace, restrained surfaces, and vivid color only where it
communicates identity or state.

The visual reference is the Kreators brand language supplied by the product
owner. Aura adapts its bold black typography, soft rounded geometry, and
pink-purple-blue gradient to a desktop control surface. It does not reproduce
the mobile advertisement layout.

## Design dials

- Mood: confident, calm, precise.
- Lightness: light-first with a fully supported dark mode.
- Density: medium; dense data tables remain available inside focused views.
- Shape: soft corners, simple borders, low-shadow surfaces.
- Typography: strong geometric headings, highly legible UI text, monospace
  reserved for model ids, metrics, logs, and commands.
- Motion: short, functional transitions; no decorative motion in data-heavy
  workflows.

## Information architecture

Aura exposes five primary areas. Existing hashes remain stable so bookmarks
and deep links continue to work.

| Area | Pages |
| --- | --- |
| Home | Dashboard |
| Setup | Overview, Providers, Accounts, Models, Clients |
| Routing | Profiles and roles, fallback combos |
| Insights | Usage, request logs and debug |
| Settings | Startup safety, storage, API access |

The sidebar shows only the five areas. A contextual navigation row exposes the
pages inside the active area. This keeps advanced controls discoverable without
turning the global navigation into a long inventory of implementation details.

## Visual tokens

- Aura gradient: pink `#f36fbc` through violet `#7867f2` to sky `#70b7f5`.
- Primary ink: near-black in light mode and near-white in dark mode.
- Accent use: active navigation, primary actions, selected profiles, quota and
  optimization highlights.
- Surfaces: neutral by default. Avoid applying gradients to every card.
- Status colors remain semantic and must not be replaced by the brand gradient.

## Migration rules

- Preserve every current page and management action during shell migration.
- Preserve legacy hashes and provider workspace deep links.
- Keep mobile navigation keyboard-accessible and focus-contained.
- Do not combine unrelated server state in a new client-side store.
- New visible copy must exist in every supported locale.
