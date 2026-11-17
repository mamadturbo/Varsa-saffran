# Backend architecture decision — 2026-10-27

Target: one TypeScript/Express application, Drizzle and PostgreSQL, with catalog,
inventory, orders, customers, content, support and notifications as modules.
HTTP remains `/api` on the storefront domain. No UI redesign, microservices,
Redis, Kubernetes, CQRS or framework replacement is required.

## Observed baseline

No Git repository exists in this checkout. Pre-change file hashes, timestamps,
source archive and the baseline test output are in
`.local/architecture-baseline-20261027/`. The original 237 tests pass.
The active management store locks one JSON document for checkout, coupons,
inventory and administrative changes. Public and private media contain Base64
bytes in PostgreSQL. Articles and contact forms call Supabase from the browser.
SMS processing is triggered in HTTP and can leave rows in `sending` after death.

## Data ownership and compatibility

Products describe product identity; variants describe sellable packaging. Existing
public IDs and slugs identify variants and must stay stable. Migration creates
an explicit product per legacy sellable item where there is no reliable parent
identity; it must not guess that similar names represent the same product.
Variants may subsequently share a product. Currency is integer **IRT (toman)**;
a future gateway adapter converts IRT to IRR at its boundary using checked multiplication
(the existing Product JSON-LD also expresses prices in IRR).
Weights use integer milligrams, with an explicit 4608 mg Iranian mithqal mapping;
the original display amount/unit is preserved. Unsupported units abort migration.

Inventory stores available units; reservations and movements provide lifecycle
and audit history. `null` stock means deliberately untracked, not zero. Orders
retain immutable line, address and pricing snapshots. Payment starts `unpaid`
with method `manual`; order, payment and fulfillment states are independent.
Payment attempts are an extension point, not a claim of an implemented gateway.

Structured tables own runtime catalog, coupons, content and order metadata.
The old management document and Base64 records remain migration evidence, not
runtime truth. Customer profile metadata and case subject/resolution remain JSON;
addresses, favorites and conversation messages have independent tables.
Access stays behind authenticated API handlers.
Files use S3-compatible storage, with ownership metadata in PostgreSQL and old
URLs retained as compatibility routes. Public and private keys are disjoint.

## Concurrency and jobs

Checkout uses a unique idempotency key and locks only requested variant/inventory
rows in sorted ID order, then the selected coupon. Reservation, redemption,
order and outbox insert commit together. Cancellation/expiry serialize on the
order and transition reservations only once. Administrative edits use an
optimistic revision and detect concurrent stock changes instead of overwriting.
External calls occur outside transactions. A separate PostgreSQL outbox worker
claims leases with SKIP LOCKED, bounded retries/backoff, stale lease recovery,
and stable provider request IDs. External exactly-once delivery is not promised.

## Migration and release phases

1. Take and restore-test a database backup and copy objects. Stop writes for
   cutover; never run this process against production without explicit approval.
2. Apply additive migrations on both a blank database and an isolated copy.
   Backfill with conflict protection and record counts, IDs, amounts and hashes.
   Stop on mismatch; do not silently seed a populated but inconsistent database.
3. Copy bytes to S3, read them back and compare SHA-256 before inserting mapping.
   Keep original bytes. Import legacy articles via the server and reconcile.
4. Switch application and independent worker together after all verification.
   Keep old sources read-only through an agreed retention period.
5. Before accepting new writes, rollback is restoration of old app/config and
   original database. After new writes, restore would lose orders: pause writes,
   export/reconcile new records and objects first. Additive schema is retained;
   destructive down migrations are deliberately not automated.

Deployment, tested evidence and remaining activation requirements are documented
separately as implementation progresses. SSR/SSG is outside this change.
