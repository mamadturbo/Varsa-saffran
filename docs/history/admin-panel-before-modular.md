# Varsa administration

The Persian, RTL admin at `/admin` now manages products, stock, orders, customer
history, coupons, articles, home banners, public contact details and shipping.
The existing single-manager login and database-backed login limits are retained.
There are no embedded production credentials and no online payment integration.

## Production activation

This workspace has no configured `DATABASE_URL`. Hosted activation has **not**
been performed. The browser preview uses an isolated local embedded PostgreSQL
database under `.local/admin-preview-db`; it is not the hosted store.

1. Configure the API's existing `DATABASE_URL`, `SESSION_SECRET` and
   `VARSA_ADMIN_PASSWORD` in the host's environment. Keep secrets off the frontend.
2. On the intended API database, apply the existing order and login migrations,
   then the additive management migration:

   ```sh
   pnpm --filter @workspace/db migrate:orders
   pnpm --filter @workspace/db migrate:admin-login
   pnpm --filter @workspace/db migrate:management
   ```

3. Deploy the API and frontend together, forwarding `/api/*` (including image
   uploads and `/api/media/*`) to Express. Allow a 6 MB JSON request body at the
   reverse proxy. An image itself is limited to 4 MB.
4. Enter initial stock counts in Products. A blank count explicitly means
   untracked stock, not zero; zero is sold out. Existing counts are never guessed.
5. Configure contact/shipping settings in the panel. Shipping stays explicitly
   unconfigured until enabled. For free shipping, the threshold applies to the
   merchandise subtotal **after discount**.
6. Existing articles can be imported with the journal's import button, using
   `SUPABASE_URL` / `SUPABASE_ANON_KEY` (or the existing `VITE_SUPABASE_*` public
   configuration). Import only reads the old source; it does not delete it.
   New managed articles can be written without completing that import.
7. Set `VITE_SITE_URL` for canonical metadata and `METADATA_API_URL` to the
   accessible API origin when building metadata snapshots. Rebuild snapshots
   after changing product/article slugs or data on a static host. Browser
   metadata and the storefront read current managed data at runtime.

## Persistence and checkout rules

- `store_management` holds the catalog and management configuration in a JSONB
  aggregate. It is initialized once from the owner's restored twelve products,
  preserving IDs, prices and images. After that, runtime reads never fall back
  to the old product manifest, including during outages or an empty catalog.
- `store_media` stores validated PNG, JPEG and WebP bytes in the same PostgreSQL
  database. Include both tables in backups. Uploaded media URLs are immutable.
  The migration enables row-level security and revokes access from public,
  Supabase `anon`, and `authenticated` roles. The API database role must own
  these tables (or have an explicitly provisioned privileged server policy).
- Every management write and order inventory operation takes a PostgreSQL row
  lock on the aggregate. This intentionally serializes writes for this small
  single-owner store. A revision check prevents stale editors overwriting stock
  or another saved edit. Larger catalogs/order volume should move the aggregate
  into indexed per-entity tables.
- Checkout quotes and creation both calculate prices, a single coupon, and
  shipping on the server. Creation rechecks them within the inventory lock.
  The client supplies an expected total only as a consistency assertion.
- Creating a new order reserves stock and consumes coupon usage atomically with
  insertion. The existing UUID retry key and request fingerprint prevent double
  reservation and double consumption. Changing a coupon changes the fingerprint.
- Cancelling an order returns only the units actually reserved, once. Reopening
  reserves again and rejects insufficient stock. Legacy orders have no inventory
  reservation and cannot create stock through cancellation. Coupon use is not
  refunded on cancellation; this keeps a capped promotion from being recycled.
- Historical order prices/discount/shipping snapshots do not change when a
  product, coupon or shipping policy is edited. Reports label amounts as order
  amounts, not paid revenue. Order printouts are not payment receipts.
- Customers are grouped from orders by the normalized mobile number. There is
  no customer authentication or new SMS service.
- Articles are plain text with Markdown headings, rendered as React text.
  Drafts are excluded from the public API. Until import is completed, published
  managed articles can coexist with the legacy journal. If its remote source is
  unavailable, available managed articles remain readable.
- Public endpoints expose active products, public settings, active banners and
  published articles only; customer/order data and coupon definitions require
  the admin token. Hiding a product preserves historical orders.

## Local development and verification

The ordinary production API still uses PostgreSQL from `DATABASE_URL`. For an
isolated local preview, set **local-only** `VARSA_ADMIN_PASSWORD` and
`SESSION_SECRET`, then run this from `artifacts/api-server`:

```sh
node --env-file-if-exists=../varsa-shop/.env --import tsx scripts/preview-management.ts
```

Run `pnpm dev` from the workspace root for the storefront. The preview helper
binds its API to loopback and never reads `DATABASE_URL`. Its persisted test data
is separate from production. The browser preview for this task uses the local
test password `varsa-local-preview`; never configure that password on a host.

Checks: `pnpm run typecheck`, `pnpm run build`, and
`pnpm --filter @workspace/api-server test`. The management HTTP tests use embedded
PostgreSQL to check authorization, persistence, revisions, overselling, retries,
cancel/reopen stock, legacy orders, discounts, shipping, drafts and media bytes.
