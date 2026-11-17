# VPS deployment — 2026-11-11

- Host: 95.38.165.46; Ubuntu 24.04; storefront https://95.38.165.46.
- Nginx routes HTTPS to static assets and loopback API (5000). HTTP redirects to HTTPS.
- Certificate is self-signed for the IP, expires after 90 days. Browser trust warnings remain; a publicly trusted certificate and renewal remain outstanding.
- PostgreSQL listens on loopback. Migrations ran against a newly created, empty database with the initial twelve-product catalog. Dedicated owner and least-privilege runtime roles are separate.
- API and worker run as `varsa`, with systemd restart/startup, filesystem restrictions, 300 MB memory limits and four database connections per process.
- Private persistent files: /var/lib/varsa/files. Explicit STORAGE_DRIVER=local; STORAGE_LOCAL_ROOT must be an absolute directory. No public filesystem alias exposes private images. Existing authenticated media HTTP handlers still enforce ownership.
- CUSTOMER_SMS_DISABLED=true explicitly disables delivery. Real OTP/customer sign-in and SMS notifications require provider configuration. Development codes stay disabled.
- Runtime credentials: /etc/varsa/api.env; migration owner: /etc/varsa/owner.env; root-only permissions. No credentials are recorded in this report.
- Admin username: owner-admin. Initial password delivered separately in ignored .local/vps-admin-password.txt. Owner must enroll their own TOTP on first login. Payment gateway remains unconfigured.
- Daily local database/object backups: varsa-backup.timer, 03:00 UTC, seven-day retention under /var/backups/varsa. Initial dump succeeded. Off-host encrypted backups and a restore drill remain outstanding.
- UFW permits TCP 22, 80 and 443; database/API ports are private.
- Production images were resized/compressed in the release copy for the slow upload link; original repository assets were preserved.
- Fresh empty article catalog initialized explicitly, avoiding requests to an unconfigured legacy Supabase source. No legacy content imported.

Validation: workspace build/typecheck passed before deployment; API typecheck/build passed after local-storage changes; all 267 backend tests passed. Public HTTP returned 200 for home, shop, admin and contact, twelve products loaded, no broken images/JS errors on those routes, and mobile had no horizontal overflow. Readiness passed with the runtime database role and local file access. Browser tests explicitly ignored the self-signed certificate, so they do not prove public certificate trust. Final follow-up results are in ignored .local/vps-final-check.json. No live customer order or payment was created by these checks.
