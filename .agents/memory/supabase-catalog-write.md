---
name: Catalog write access
description: Supabase products are authoritative for storefront and server order pricing after stage 2.
---

The public Supabase key can read product rows but cannot insert or update them.
After the user's stage 2 fix, Supabase `products` is the authoritative runtime
catalog for both storefront and order API. Do not restore local-over-remote merging
or a local price fallback. New rows and edits are read on the next load/order.

**Why:** The former merge hid database edits and excluded new/deleted products.
The shared reader in `lib/catalog/src/products.ts` validates remote rows and fails
closed on outages. Historical local products were moved into API test fixtures.

**How to apply:** Manage rows using the trusted Supabase dashboard or a privileged
server, not the public browser key. Never expose a service-role credential.
Frontend `VITE_SUPABASE_*` and backend `SUPABASE_*` must use the same public view.
Checkout reconciles stale carts; old `local-<slug>` IDs are accepted only when
that slug exists remotely, and saved orders use the database ID. `expectedTotal`
detects price changes (409) but never supplies a trusted price. Catalog failures
return 503. Order database persistence remains unverified without DATABASE_URL.


## Superseded 2026-10-27
The owner explicitly requested migration away from direct Supabase access. Runtime
catalog and pricing now use normalized product_variants/inventory via the API.
See docs/backend-architecture.md and docs/backend-operations.md. The old
store_management document is retained for migration only. No runtime seed or
price fallback is permitted.
