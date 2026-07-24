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
  workflows; honor `prefers-reduced-motion`.

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
The sidebar shares the application background while the active page sits on a
rounded, lightly elevated workspace panel. Contextual pages use icon-labelled
pill controls instead of an unstructured row of text links.

## Workspace layouts

- **Focus** constrains the page to a readable 980 px single-column flow.
- **Canvas** expands to 1480 px and lets compatible grids form multiple columns.
- The choice is stored locally and applies immediately.
- Narrow windows collapse both layouts to one column, remove the desktop panel
  radius, keep contextual pills horizontally reachable, and avoid page-level
  horizontal overflow.

The two layouts intentionally share the same components and actions. They are
presentation choices, not divergent product skins.

## Guided visuals

- Setup previews the route from coding client through Aura to model/provider
  and collapses to a compact ready state after successful onboarding.
- Routing profiles show the efficiency, quality, autonomy, concurrency, and
  token-budget consequences of a selection.
- Insights compares tokens before and after optimization and shows the measured
  saving rate.

These visuals explain actual settings and measurements. They do not imply model
quality or savings that have not been benchmarked.

## Localization

Aura ships complete Vietnamese coverage alongside English, German, Japanese,
Korean, Russian, and Chinese. A regression test enforces exact key parity and
placeholder preservation and prevents Vietnamese from silently importing the
English dictionary as a fallback.

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
