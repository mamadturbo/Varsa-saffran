---
name: Varsa theme migration
description: Tailwind version compatibility note for the Varsa storefront frontend.
---

The Varsa storefront was uploaded as a standalone Bolt/Vite frontend with Tailwind v3 conventions, while the Replit web artifact uses Tailwind v4. Custom semantic colors and animations must be declared in the artifact stylesheet's `@theme` block; v3 `@apply` expressions that reference custom helper classes with opacity modifiers may fail the v4 compiler.

**Why:** The artifact compiler does not automatically consume the uploaded Tailwind configuration, and it rejects unknown custom utility candidates during CSS generation.

**How to apply:** When adding new Varsa UI styles, prefer the existing CSS variables and declared `@theme` utilities, and use direct CSS for custom helper backgrounds instead of `@apply` with arbitrary opacity syntax.