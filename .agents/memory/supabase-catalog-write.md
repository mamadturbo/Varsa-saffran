---
name: Catalog write access
description: The Varsa storefront's Supabase client permissions and product catalog fallback.
---

The storefront's public Supabase key can read product rows but cannot insert or update them. Product additions therefore need to be represented by the versioned local catalog and merged with remote rows at read time; matching slugs in the local catalog intentionally override remote values.

**Why:** A direct catalog upsert through the configured public client returned 401, while reads work. Keeping the new catalog local preserves the storefront, cart, and checkout flows without exposing a service-role credential.

**How to apply:** Add new static product assets under `artifacts/varsa-shop/public/products`, define their records in `src/lib/catalog.ts`, and keep slug-based merging in `src/lib/api.ts`. Do not put a service-role key in the browser bundle.