# Varsa storefront

A single-vendor saffron store with the existing Persian storefront, admin panel
and customer account UI. The backend is a TypeScript/Express modular monolith,
with Drizzle/PostgreSQL, S3-compatible files and a separate durable worker.

The live runtime reads normalized tables through `/api`. The shared
`store_management` JSON document and Base64 rows are retained for migration and
compatibility; they are not checkout storage. The browser has no Supabase
client, credentials, article fallback or contact write dependency.

- [Architecture decision](docs/backend-architecture.md)
- [Data model and sources of truth](docs/backend-data-model.md)
- [Local setup, Iran deployment, backup/restore and rollback](docs/backend-operations.md)
- [Verification evidence](docs/backend-verification.md)
- [Built deployment smoke report](docs/backend-deployment-smoke.json)
- [Security findings and implemented controls](docs/security/findings.md)
- [Threat model](docs/security/varsassafra-threat-model.md)
- [Secure deployment, admin bootstrap and MFA recovery](docs/security/deployment.md)
- [Security verification](docs/security/verification.md)

```sh
pnpm install --frozen-lockfile
pnpm run build
pnpm --filter @workspace/api-server test
pnpm --filter @workspace/api-server verify:deployment
```

Copy the API `.env.example`, configure a development PostgreSQL database and S3
bucket, and follow the operations guide for the explicit migration command.
`--seed-empty` is only for intentionally creating a fresh database. Never run
migrations on a production connection without separate approval.

Run the frontend with `pnpm dev`, the API with `pnpm dev:api`, and the built worker
with `pnpm --filter @workspace/api-server worker`. `/api` uses the frontend dev
proxy locally and the same domain reverse proxy in deployment.

No online payment gateway, wholesale integration or accounting service is active.
Optional card transfer with private receipt upload and operator approval in Bale
is implemented but disabled until configured; see [activation guide](docs/card-transfer.md).
Manual orders start unpaid. Real SMS, final hosting/domain, credentials and
production cutover are operator activation steps, not completed deployments.

Admin access now requires an individual Argon2id account, server-side cookie
session and confirmed TOTP. The shared `VARSA_ADMIN_PASSWORD` and browser bearer
tokens are retired. Every mutation, including login, uses CSRF protection.
Use the security deployment guide for the offline account command before rollout.
`node scripts/security-audit.mjs` checks the lockfile against advisories with
exact, expiring exceptions for loopback-only test tools.

There is no Git repository in this checkout. Original source files and hashes
were saved under `.local/architecture-baseline-20261027/`; no repository was
created. Historical implementation reports remain in STAGE files and
`docs/history/`, including the previous README. They are not current setup
instructions. UI redesign and a full SSR/SSG migration remain outside scope.
