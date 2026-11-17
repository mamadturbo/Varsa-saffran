# Varsa storefront

The new [customer portal](docs/customer-portal.md) at `/account` adds verified
mobile login, owned orders, tracking, addresses, favorites, support, cancellation/
return requests and moderated reviews. Customer-service operations are connected
to the admin panel. Real SMS and hosted activation require the server setup in
that guide; the running preview remains an isolated local environment.

The new [admin panel](docs/admin-panel.md) manages the live catalog, stock,
orders, customers, coupons, articles, banners and settings. It replaces the
previous static runtime product source with the API's managed PostgreSQL catalog.
Read its activation steps before deploying: hosted database access is not
configured in this workspace, and the running preview uses an isolated local DB.
Historical restoration notes below describe the prior implementation.

Current local validation and the remaining deployment inputs are recorded in
[FINAL-AUDIT.md](FINAL-AUDIT.md) and [STAGE-26.md](STAGE-26.md). Local success is
not a claim that the hosted database, shipping rules, payment gateway or final
domain are configured.

At the owner's request, the original twelve products and packaging images are
restored. The storefront, API pricing and product metadata now explicitly use
`lib/catalog/src/restored-products.ts` as their shared deployed catalog. See
[restoration status](docs/restored-catalog.md), including the pending hosted DB sync.

At the owner's request, the home Hero has since been restored to its previous
full-width photo backgrounds and overlaid text. Other packaging illustrations
still use the responsive WebP delivery described in the audit.

## Requirements

- Node.js 24 and pnpm (validated with Node 24.19.0 and pnpm 11.25.0).
- Supabase public project URL and anon key for the storefront.
- PostgreSQL and API secrets for order submission and administration.

Commands below work from the repository root in PowerShell and POSIX shells.

## Install and validate

```sh
pnpm install --frozen-lockfile
pnpm run typecheck
pnpm run build
```

The workspace retains Linux x64 and Windows x64 native build dependencies.
Use pnpm; npm and Yarn do not resolve the workspace catalog.

## Order pricing and security tests

The active catalog is the owner's restored twelve-product manifest in
`lib/catalog/src/restored-products.ts`. This is an explicit source selection,
not an outage fallback. Edit that manifest and rebuild/redeploy the frontend and
API together to change products or prices. Supabase product edits currently do
not change the active storefront. The separately exported validated remote reader
still supports fresh DB reads and rejects invalid/unavailable catalogs; its
regression tests remain in place.

Order items send only `productId` and `quantity`. Legacy client prices, names,
images, and `total` fields never set order values. The optional `expectedTotal`
only asserts the amount the customer reviewed; a mismatch returns HTTP 409
without saving an order. Checkout refreshes stale cart details and requests
confirmation again. Old `local-<slug>` cart IDs resolve only while that slug still
exists in the active catalog, and saved orders use its canonical UUID.

Catalog rows need the fields defined by `CatalogProduct` in
`lib/catalog/src/products.ts`; prices are integer toman amounts. Add or edit
the active manifest before rebuilding both services. Public
storefront credentials remain read-only; no admin product editor or write
permission is added by this change. The restored manifest uses the original
owner-requested prices; the hosted products table has not yet been synchronized.

```sh
pnpm --filter @workspace/api-server test
```

These HTTP regression tests exercise the production order handler. Pricing and
validation tests use isolated persistence callbacks; idempotency tests use the
production SQL repository against PGlite's embedded PostgreSQL engine. They do
not require database secrets or write real orders. Run them along with
`pnpm run build` after order changes.

The workflow tests also mount the production `createOrdersRouter` against
embedded PostgreSQL and cover creation, authenticated admin reads/status updates,
filtering, replay and unauthorized requests together. Production still binds
that same router to the configured orders database and restored shared catalog.

## Order retry protection

Each checkout sends a required UUIDv4 `idempotencyKey`. The server stores that
key and a SHA-256 fingerprint of the normalized customer details and requested
items. Repeating the same intent returns the persisted order; reusing its key
with different details returns HTTP 409. The PostgreSQL unique index handles
concurrent requests across API instances. Existing committed orders replay
without consulting current catalog prices. The fingerprint excludes the
optional price assertion and ignores client-supplied prices.

The cart retains its attempt ID across reloads and unsuccessful requests.
Successful submission immediately persists an empty cart. Adding to an empty
cart starts a new attempt. Checkout also prevents simultaneous form submissions
and times out an API request after 20 seconds while retaining the retry key.
Changing the same cart after an uncertain response may return 409; confirm the
existing order before intentionally starting a new cart.

Checkout confirms a receipt only after runtime validation of the API response.
Incomplete successful responses preserve the cart and retry key. Network errors,
timeouts and server errors use uncertainty wording instead of claiming that no
order was saved. The receipt displays the returned order number, status and
server-side item amount; it is a snapshot, not live order tracking. Pending and
cancelled orders have distinct messages. Online payments remain unconfigured,
and shipping costs are not included until the store's rules are provided.

Before deploying this API against an **existing orders database**, configure
the intended `DATABASE_URL`, back up that database, and apply:

```sh
pnpm --filter @workspace/db migrate:orders
```

The repeatable migration adds two nullable columns and a unique index while
preserving historical orders. New databases need the complete orders schema
first. Deploy the matching frontend and API together: old clients lacking a key
receive HTTP 400. The test suite validates this migration in isolated PostgreSQL;
no migration has been applied to a real hosted database in this workspace.

## Phone validation

Checkout and contact forms require an Iranian mobile number. The pure shared
validator in `@workspace/validation` accepts ASCII, Persian, Arabic and mixed
digits, whitespace, ordinary hyphens, and national `09`, international `+98`,
or `0098` prefixes. Valid values become 11 ASCII digits starting with `09`.
It rejects missing digits, letters, other punctuation, foreign prefixes,
landlines, non-string values, and raw input over 64 characters.

Order validation also runs on the server before catalog lookup or persistence;
invalid numbers receive HTTP 400. The contact form and its Supabase submission
function validate and normalize before sending. This does not add a database
constraint to the separately managed Supabase `contact_messages` table.
Validation checks formatting; no OTP or ownership verification is performed.

## Run from source

Copy `artifacts/varsa-shop/.env.example` to `.env` in that same folder and
replace the placeholders with your project's public Supabase configuration.
Keep an existing `.env` file if it is already configured. Never put a
Supabase service-role key in frontend environment variables.

```sh
pnpm run dev
```

Open http://localhost:5173. This runs Vite against `src`, with hot reload.
`PORT` and `BASE_PATH` may override the defaults `5173` and `/`.

## Orders API

Copy `artifacts/api-server/.env.example` to `.env` in that same folder and
configure `DATABASE_URL`, `SESSION_SECRET` and `VARSA_ADMIN_PASSWORD`. The restored order catalog does not require Supabase
credentials. The API start command loads
the storefront's public `.env` as a local-development fallback, then its own
`.env` (which takes priority). Existing process variables take priority over files.
Supabase settings remain necessary for storefront articles and the contact form.
Use a development database for tests. Provision the schema in that database
before testing orders; do not run schema changes against production as part
of the frontend setup.

In a second terminal:

```sh
pnpm run dev:api
```

The API defaults to port 5000. Vite forwards `/api` to
http://127.0.0.1:5000 in development and preview. Set `API_PROXY_TARGET` in
the shell launching Vite to use another backend. Production hosting must
route `/api` to the deployed API separately.

`GET /api/healthz` checks the HTTP service only; it does not validate database
connectivity or the orders schema. Orders require a working database.

## Admin login limits

`POST /api/admin/login` allows five attempts per client IPv4 address or IPv6
/64 network per 15-minute fixed window, plus 100 attempts overall per window.
All checked attempts count, including malformed passwords and successful logins.
Successful login does not reset the allowance. Excess requests receive HTTP 429
with `Retry-After` in seconds; the panel shows a countdown and disables submission
temporarily. A synchronous form guard prevents double-click submissions.

Counters use atomic PostgreSQL upserts in a transaction and survive API restarts
and multiple instances sharing the same database and session secret. Failed or
missing limiter storage returns HTTP 503 without issuing a token. Existing
authenticated sessions remain usable when the login endpoint is throttled.
This global cap also means a distributed attack can temporarily prevent new
admin logins; edge traffic controls remain a separate deployment concern.

Before deploying, configure the intended API `DATABASE_URL` and apply the
repeatable migration (tested locally, not applied to a hosted database):

```sh
pnpm --filter @workspace/db migrate:admin-login
```

The `admin_login_attempts` table stores an HMAC of each client network, never the
password or raw IP. Expired buckets older than one day are deleted on a subsequent
login attempt. No production data is needed by the automated PGlite SQL tests.

Proxy trust defaults to **off**. If the API is behind a reverse proxy, set
`TRUSTED_PROXY_IPS` to the actual proxy addresses, comma-separated. Boolean trust,
hop counts, subnet ranges and blanket network aliases are rejected. Restrict
backend access to those proxies and have them overwrite forwarded headers.
Untrusted incoming forwarding headers cannot change the login bucket. Local Vite
proxy requests share the loopback allowance. Configuration follows the
[Express proxy documentation](https://expressjs.com/en/guide/behind-proxies/);
the atomic limiter uses
[PostgreSQL ON CONFLICT](https://www.postgresql.org/docs/current/sql-insert.html).

## Preview the latest production build

```sh
pnpm run build
pnpm run preview
```

Preview defaults to port 5173. Stop the development server before previewing,
or use another `PORT`. The mockup sandbox uses port 5174 by default and is
included in the workspace typecheck and build.

## Browser routes and hosting

The storefront uses Wouter and native links for navigation. Routes are `/`,
`/shop`, `/journal`, `/journal/:slug`, `/products/:slug`, `/about`, `/contact`
and `/admin`. Article and product slugs are URL-encoded; Persian slugs work on
direct navigation and reload. Product links load the current catalog row and
open its detail panel; closing it returns to `/shop`. The cart survives route
changes. Unknown paths and missing products/articles show distinct messages.
Browser back/forward changes the page; page changes start at the top.

`BASE_PATH=/store/` sets the Vite base and router base; set it at build time
for deployment to a subfolder. All internal page links include this base.
The API remains at `/api` and needs its own server route. Catalog image URLs
are prefixed with the deployment base by the restored catalog loader.

The production host must serve `index.html` for frontend history routes so
opening `/shop` or refreshing an article works. Preserve real static files,
route `/api` to Express first, and do not turn API errors into frontend HTML.
Vite dev and preview provide this history fallback and were tested locally;
no external hosting configuration was changed. The client renders a not-found
screen for unknown routes; a static SPA fallback itself returns HTTP 200.
Server-rendered HTTP 404 responses require a hosting/SSR solution separately.

The shop filter lives in `/shop?category=...`. Footer category links select the
matching category, and filter links retain the selection across reload and
browser history. Product detail links carry the filter query and return to the
same selection when closed. Clearing the category preserves unrelated query
parameters. Filter options still come from the current catalog; an unknown or
removed category stays selected with zero results rather than displaying all
products. The active source is the explicitly restored twelve-product manifest.

The shop also filters by `weight` and `unit` query parameters. Weight choices come
from the selected category's current catalog rows. Invalid or removed choices
stay explicit with zero results; clearing the weight keeps the category and
unrelated parameters. Product and comparison links preserve these filters.

The expandable comparison table shows pack amounts alongside recorded weights.
Cards and details show the approximate pack amount per one recorded mass unit;
the calculation never converts between grams, kilograms, milligrams or mesghal.
Gift packs omit mass pricing because their amount includes other contents.
The table has a keyboard-focusable horizontal scroll region on small screens.
Product details link to the other real products in the same category, with each
name, weight and amount shown. No product-family/variant relationship is assumed;
following a choice loads its actual ID, description, image and price, and adding
to the cart uses that product. A category with one product has no extra choices.

## Public business contact channels

Configure owner-confirmed contact details with the optional `VITE_CONTACT_PHONE`,
`VITE_CONTACT_EMAIL`, `VITE_CONTACT_ADDRESS`, `VITE_INSTAGRAM_URL` and
`VITE_TELEGRAM_URL` variables. All are public build inputs. Blank or unsupported
values stay absent, and the contact form route remains available. The former
sample phone/email/address and generic social-platform links are removed.
Phone and email use `tel:` / encoded `mailto:` destinations; social links require
a supported direct HTTPS profile path. Parsing checks syntax, not account
ownership, existence or reachability. See [contact channel setup](docs/contact-channels.md).

## Storefront dialogs and keyboard focus

The mobile menu, cart, product details and checkout use the installed Radix
Dialog primitive through `StoreDialog`. Closed dialogs unmount, open dialogs
have a visible title and `aria-modal`, and keyboard focus stays in the active
layer. Lower dialogs are also made inert so a cart quantity live region cannot
keep the cart accessible behind checkout. Closing the upper layer restores the
previous layer and its focus; scroll locking is owned by the primitive.

Product card/comparison links remember their invoking link before route
navigation unmounts it. A recreated shop card receives focus once catalog loading
finishes, unless focus has moved elsewhere. Direct product URLs have a page-title
fallback. Menu navigation focuses the new page title; resizing to desktop closes
the menu. Focusing the home title pauses its changing slide text.

Checkout keeps its existing submission guard: Escape, backdrop dismissal and the
close button do not interrupt a pending request. Focus remains in the waiting
dialog, and error/receipt transitions focus their new title. Tests for these
states use the local embedded PostgreSQL fixture, never real customer orders.

## Buying guide

`/guide` compares the current catalog categories, recorded weights and pack-price
ranges. `?mode=types`, `?mode=price` and `?mode=gift` preserve the selected view
across reload and browser history. The price view orders categories by the lowest
amount payable for one pack; different weights are explicitly disclosed, so this
is not a per-gram or quality ranking. The gift view only includes catalog
categories whose label contains the Persian word for gift.

Home, shop and footer links lead to the guide. Each guide category leads to the
matching shop filter. Catalog failures show retry, and empty results remain empty;
no fallback catalog, price, weight conversion or quality certification is invented.
General cut descriptions link their sources and the SVGs are labelled schematics.

## Page metadata and share previews

Each route has a title, description, Open Graph and Twitter metadata. Products
and articles use their current public catalog row; admin and missing/error
pages use `noindex`. Navigation updates the managed head tags without duplicates.
Product and article names are escaped before HTML generation, and image URLs
must be HTTP(S). No customer/order data is used for public metadata.

Set `VITE_SITE_URL` to the actual public **origin**, such as
`https://shop.example.com`, in the storefront environment before publishing.
Do not include a path, query, credentials or fragment. `BASE_PATH` supplies any
subfolder. When the domain is unset, static output intentionally omits canonical
URLs and relative share-image URLs; the browser can use its current origin.
No production domain has been assumed in this workspace.

Build emits HTML snapshots at `shop/index.html`, `products/<slug>/index.html`,
`journal/<slug>/index.html` and the other public routes, so crawlers can read the
head without executing JavaScript. These contain the app shell and metadata,
not a server-rendered page body. Keep the emitted directories when deploying.
The host must resolve a real route's `index.html` **before** applying a generic
SPA fallback, or it will serve the homepage metadata for every URL. Configure
`404.html` for unknown paths and preserve `/api` routing separately.

Snapshots reflect the catalog at build time: rebuild after changing article or
product names, descriptions, images, prices, adding products, or deleting records. The
browser and local dev/preview read current public data. Static category query
links share the shop's general metadata/canonical; tracking parameters are
excluded. No crawler or social-network cache refresh is guaranteed by a build.

`dist/public/metadata-snapshots.json` lists generated pages and any missing
domain/catalog warnings. For a release, configure the domain and public catalog
access and set `SEO_REQUIRE_COMPLETE=1` in the environment before `pnpm run build`.
That gate fails the build on incomplete snapshots or missing domain configuration.
Tests validate static HTML over HTTP independently of JavaScript and validate
live metadata changes in the browser.

## Product structured data

Product detail pages include one managed JSON-LD `Product` with its catalog
name, SKU (database ID), description, category, brand and image. A positive
weight with a recognized mass unit is preserved as a `QuantitativeValue`; no
mesghal-to-gram conversion is assumed. Canonical product/offer URLs and `@id`
use the configured public domain. Non-product, missing and unavailable pages
have no Product schema, and route changes remove the previous script.

The catalog/checkout unit remains conventional **toman**. Only the JSON-LD
`Offer` price is converted to rial (`price × 10`, currency `IRR`), with ASCII
digits and no thousands separator. Cart prices and order totals are untouched.
Stock availability, ratings/reviews, GTIN, condition, price expiry, shipping and
return policies are omitted because no trusted source for them is configured.
The JSON-LD serializer escapes script-breaking characters before HTML output.

Snapshots contain the price **at build time**. Rebuild and redeploy them when
prices change; there is no automatic external hosting rebuild hook configured.
The browser and dev/preview metadata resolve fresh catalog data. Public-domain
Rich Results/URL Inspection validation remains a deployment check; local JSON
parsing and HTTP tests do not guarantee a Google rich-result appearance.
