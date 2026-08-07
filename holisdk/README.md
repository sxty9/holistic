# holisdk

A **project-neutral SDK**: reusable UI components, design tokens, i18n, and a host↔plugin
framework for building service-oriented web applications.

holisdk is **not** bound to any single product. The [Holistic](../README.md) services
landscape is its first consumer, but holisdk is deliberately kept free of Holistic (or any
other instance) specifics so it can serve other projects unchanged. Nothing here may reference
a concrete product, instance, brand, domain, or deployment.

## Packages

| Package | Import | What it is |
|---|---|---|
| `@holisdk/ui` | `@holisdk/ui` | React components, design tokens (`@holisdk/ui/tokens.css`), the Tailwind preset (`@holisdk/ui/tailwind-preset`), i18n engine, and the service-plugin contract. |

The scope (`@holisdk/*`) leaves room for sibling packages (e.g. a platform-neutral core, a
native render layer) without a second extraction.

## The holisdk ↔ host boundary

A building block belongs **in holisdk** as soon as it is project-neutral and reusable beyond
one application. It belongs **in the host application** as soon as it is application-specific —
its brand mark, its own screens, its app-bound wiring.

Host applications and their services consume shared building blocks **exclusively** from
holisdk and never from one another. The host application ships only its own application code;
it never re-exports shared building blocks for its services to import.

## Consuming it

- **Components:** `import { Button, Stack, useT } from '@holisdk/ui'`
- **Design tokens (CSS):** `import '@holisdk/ui/tokens.css'`
- **Tailwind:** `import preset from '@holisdk/ui/tailwind-preset'` → `{ presets: [preset] }`

React 18 is a peer dependency; the host provides a single React instance.

## Extraction

holisdk lives at the repo root as a self-contained tree so it can be split into its own
repository later (`git subtree split -P holisdk`) with full history and published to a registry.
Until then it is consumed in-workspace via `workspace:*`.
