# Customer portal

`/account` now provides mobile-code login, account details, saved addresses,
favorites, orders, tracking codes, order claims, reordering, support threads,
cancellation/return requests, product reviews and in-panel notifications.
`/admin?section=service` provides customer accounts, ticket/request processing,
review moderation and notification SMS retry. Existing order administration and
inventory rules remain in use. No payment gateway or automatic refund is added.

## Hosted activation (not performed)

This workspace still has no production `DATABASE_URL`. Local preview has its own
embedded PostgreSQL database and does not send actual SMS. To activate on the
existing host, deploy the frontend and API together and configure the API's
database/administrator secrets using the host's environment, as described in
`admin-panel.md`. After the previous migrations, run:

```sh
pnpm --filter @workspace/db migrate:customers
```

The additive migration creates separate customer, hashed-session, OTP, rate,
order-link, case, review, notification and private-media tables. It enables RLS
and denies PUBLIC, Supabase `anon`, and `authenticated` access. The API must use
the owning database role or an explicitly provisioned privileged server role.
Back up these tables with orders and store management. It does not edit or delete
existing orders or attach guest history merely because a phone number matches.

### SMS gateway contract

No SMS provider was selected during the interview. The server supports a
configurable **HTTPS gateway adapter** rather than claiming a working connection
to an unspecified provider. Configure these server-only environment variables:

- `CUSTOMER_AUTH_SECRET`: a long random OTP hashing secret; falls back to the
  existing `SESSION_SECRET` when omitted.
- `CUSTOMER_SMS_URL`: HTTPS URL of your SMS gateway/adapter.
- `CUSTOMER_SMS_TOKEN`: gateway authorization token, never a `VITE_*` variable.
- `NODE_ENV=production`: forces secure customer cookies and disables development
  OTP responses, even if someone accidentally sets the development flag.
- `CUSTOMER_ALLOWED_ORIGINS`: optional comma-separated exact frontend origins
  when needed behind a proxy. Same-origin `/api/*` routing is recommended. Configure
  trusted proxy IPs as described in the existing API documentation.

The gateway receives JSON with `Authorization: Bearer <token>`:

```json
{"phone":"09...","message":"...","purpose":"otp","code":"six digits"}
```

For status notifications it receives `purpose: "notification"` and a stable
`eventId` instead of `code`. Your gateway must map these fields to the chosen SMS
provider/template and return 2xx **only when accepted by the provider**. A 2xx
acknowledgment does not prove handset delivery. Provider-specific API formats
should be adapted at that gateway; raw credentials are never requested in chat.
OTP calls time out after ten seconds; failures stay explicit and never yield a
production bypass code. Missing gateway configuration returns HTTP 503.

Transactional notification SMS requires **both** the store's enable switch and
the customer's consent in Account details. In-panel notifications are always
stored. A persisted outbox records pending/sending/accepted/failed attempts;
order changes and admin replies trigger a bounded background drain. Failures and
interrupted sends older than ten minutes can be retried from the admin panel.
Use `eventId` to deduplicate at the gateway if it accepts a send before a network
failure prevents acknowledgment. There is no marketing SMS or scheduled job.

## Customer rules

- OTP: random six digits, two-minute expiry, one use, five verification attempts;
  resend after 60 seconds. Per-phone, per-network and global database-backed
  limits prevent unrestricted guessing/sending across API instances. Rate keys
  and OTPs use HMACs; OTP values never enter logs or production responses.
- Sessions: random 256-bit tokens in HttpOnly, SameSite=Lax cookies, Secure in
  production, with a 30-day server expiry. Only token hashes are stored. Logout
  revokes the server session. Customer cookies and administrator bearer tokens
  cannot substitute for one another. Mutations validate the request origin.
- Guest checkout remains available. A signed-in order must use that customer's
  verified phone; order ownership is assigned server-side inside the same
  transaction as inventory reservation. Client customer IDs are ignored.
- A guest order is claimed only with its exact order number and the currently
  verified matching phone. Claims are rate limited. A customer cannot read,
  modify, claim, cancel or review another customer's order.
- Up to ten saved addresses, one default. Addresses include recipient/mobile,
  province, city and ten-digit postal code. Editing saved addresses never changes
  historical order snapshots. The checkout can fill a saved address and keeps
  the account phone fixed for ownership.
- Favorites work locally for guests and persist to the account after login.
  Up to 100 products are stored. Reordering explicitly previews today's prices,
  quantities and availability before adding selected products to the current cart.
- Cancellation is a request for admin review before shipment. Approval updates
  the existing order and returns reserved inventory once, in one transaction.
  If the order ships before approval, approval is rejected.
- Returns require a delivered, owned order and the configured window (default
  seven days after delivery; adjustable in Settings). The request records a
  reason and up to three optional photos. Approval does not mark a refund paid
  or restock goods before the owner separately handles receipt/inspection.
- Tickets and requests support text replies and up to three images per message.
  Images are private, bounded to 4 MB PNG/JPEG/WebP, and accessible only to their
  owner or an authenticated administrator. Admin rendering fetches them through
  authenticated requests, without placing bearer tokens in URLs. Final approved
  or rejected requests cannot be edited; a new support ticket can follow up.
- One review per customer/product after an owned order is delivered. Ratings
  range from 1 to 5. New and edited reviews require admin approval. Public
  responses omit customer IDs and phone numbers; the displayed name is the
  first part of the customer's name or a generic buyer label. Text is rendered
  as text, not executable HTML.
- Notifications and order data refresh on account navigation, refresh, or window
  focus. The panel does not claim a continuous live connection. Order totals
  remain distinct from proof of payment; online payment remains unconfigured.
- Profile phone changes/account recovery go through support; this implementation
  does not permit an unverified phone change.

## Local QA

The existing `artifacts/api-server/scripts/preview-management.ts` now applies the
customer migration and enables development codes **only in the isolated local
preview**. It refuses `NODE_ENV=production`. After requesting a code on the local
login screen, a clearly labeled preview-only code appears. No phone receives SMS.
The example account used for browser QA is `09123456789` and contains an explicitly
labeled local support test. Do not use this preview database or dev flag on a host.

The API tests cover OTP expiry/single-use/throttling, independent auth boundaries,
origin checks, ownership, guest claims, default addresses, favorites, private media,
ticket round trips, atomic cancellation, return deadlines, moderated reviews,
notification consent and retry. Run:

```sh
pnpm --filter @workspace/api-server test
pnpm run build
```

Hosted delivery, an actual SMS provider and live database migrations remain
unverified until the environment above is configured. Canonical metadata still
requires the real `VITE_SITE_URL`, as before.
