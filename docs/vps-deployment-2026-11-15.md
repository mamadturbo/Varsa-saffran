# VPS deployment — 2026-11-15

- Host: 185.226.118.113; Ubuntu 24.04; storefront https://185.226.118.113.
- Nginx routes HTTPS to static assets and loopback API (5000). HTTP redirects to HTTPS.
- Certificate is self-signed for the IP, expires after 90 days. Browser trust warnings remain; a publicly trusted certificate and renewal remain outstanding.
- PostgreSQL listens on loopback. Migrations ran against a newly created, empty database with the initial twelve-product catalog. Dedicated owner and least-privilege runtime roles are separate.
- API and worker run as `varsa`, with systemd restart/startup, filesystem restrictions, 300 MB memory limits and four database connections per process.
- Private persistent files: /var/lib/varsa/files. Explicit STORAGE_DRIVER=local; STORAGE_LOCAL_ROOT must be an absolute directory. No public filesystem alias exposes private images. Existing authenticated media HTTP handlers still enforce ownership.
- CUSTOMER_SMS_DISABLED=true explicitly disables delivery. Real OTP/customer sign-in and SMS notifications require provider configuration. Development codes stay disabled.
- Runtime credentials: /etc/varsa/api.env; migration owner: /etc/varsa/owner.env; root-only permissions. No credentials are recorded in this report.
- Admin username: owner-admin. Initial password delivered separately in ignored .local/vps-new-admin-password.txt. Owner must enroll their own TOTP on first login. Payment gateway remains unconfigured.
- Daily local database/object backups: varsa-backup.timer, 03:00 UTC, seven-day retention under /var/backups/varsa. Initial dump succeeded. Off-host encrypted backups and a restore drill remain outstanding.
- UFW permits TCP 22, 80 and 443; database/API ports are private.
- Production images were resized/compressed in the release copy for the slow upload link; original repository assets were preserved.
- Fresh empty article catalog initialized explicitly, avoiding requests to an unconfigured legacy Supabase source. No legacy content imported.

Validation: workspace build/typecheck passed before deployment; API typecheck/build passed after local-storage changes; all 267 backend tests passed. Public HTTP returned 200 for home, shop, admin and contact, twelve products loaded, no broken images/JS errors on those routes, and mobile had no horizontal overflow. Readiness passed with the runtime database role and local file access. Browser tests explicitly ignored the self-signed certificate, so they do not prove public certificate trust. Final follow-up results are in ignored .local/vps-new-final-check.json. No live customer order or payment was created by these checks.

Mobile follow-up: carousel controls fit the viewport and remain below actions at 319/390/861/1365 px; phone actions are 52px high, detail cards are 125px tall, heading/paragraph spacing increased, and photo attributions moved to an expandable footer section. Frontend typecheck/build passed. Existing VPS was left untouched; this is a fresh database, not an import of its customer/order data.

## Original image quality restored — 2026-11-15

The earlier deployment copies in .local/vps-public* and varsa-web-fast archives contain undersized image variants and must not be reused for future releases. Source public/photos and public/products were preserved and have now been redeployed verbatim, including PNG fallbacks and all correctly sized WebP variants. Verified server SHA-256 equals the original for the 2000px field photo and 1254px product image. DeliveryImage now appends an explicit release query only to same-origin product/photo assets without custom queries, invalidating browsers' cached low-quality files while preserving responsive srcset selection. Custom uploaded media and remote assets remain untouched. Frontend typecheck and strict production metadata build passed. Browser verification and image metadata evidence: .local/image-quality-check.json.

## Mobile full-screen hero and default dark theme — 2026-11-15

Mobile hero now occupies 100dvh (100svh fallback), including fixed-header clearance and safe-area padding. Previously it subtracted the fixed header height even though the header overlays the page. All three slides fit a single viewport at 319x646, 390x640, 390x844 and 430x932, with copy below the header, controls below actions and no horizontal overflow. Screenshot: .local/hero-night-mobile.png; measured results: .local/hero-night-check.json.

Dark is the first-render and React default, including storage failure. Theme storage moved to varsa-theme-v2 because the old provider automatically wrote the previous light default even without user choice. New explicit light selections still persist across reloads. The early initialization script is versioned to avoid serving a cached light default, and initial theme-color matches dark. Frontend typecheck and strict metadata production build passed; changes deployed without replacing original-quality images.

## Mobile hero typography redesign — 2026-11-15

Applied UI/UX Pro Max typography guidance and frontend-design art direction. No standalone taste-design skill was installed in the available skill/plugin directories. Mobile hero now uses an explicit two-row grid: vertically centered message with header/safe-area clearance, and bottom carousel navigation. Mobile heading uses Vazirmatn at 30–36px with 1.65 line height, bounded measure and clear 24px separation from the description. Description and actions have independent spacing, a 52px primary action, and a quieter secondary editorial link. The badge was simplified to a small label with a short rule; mobile overlay was adjusted for text contrast. Desktop retains its existing composition and calligraphic heading. Content, images, dark default and full-viewport behavior were preserved.

Frontend typecheck and strict production metadata build passed. All three slides passed geometry and overflow checks at 319x646, 390x640, 390x844 and 430x932 locally and on the live domain; dark default and light-choice persistence passed too. Evidence: .local/hero-redesign-live-check.json, .local/hero-redesign-slide-۱.png and .local/hero-redesign-slide-۳.png. Static release deployed to existing Nginx root; readiness remains ready. Previous static code saved on the server in /root/varsa-hero-before-redesign.tar.gz.

## Temporary password-only admin access — 2026-11-15

At the owner's explicit request, ADMIN_PASSWORD_ONLY=true was enabled in the protected production API environment. Existing account passwords and encrypted MFA settings were preserved. Login/security UI follows the server policy. Sessions issued in this mode have a distinct p_ token prefix and are rejected by the resolver when the flag is removed; the default code path still requires MFA/enrollment. No schema migration was required.

Added tests for wrong-password rejection, unconfigured and enrolled admin login, keeping existing MFA data, ignoring client policy overrides, and immediate invalidation when restoring MFA. All 269 backend tests, API/frontend typechecks and production builds passed. Live browser login with username/password alone succeeded and loaded the panel without enrollment. Cookie Secure/HttpOnly flags and logout were verified. Evidence: .local/admin-password-only-live.json. Restoring MFA: remove or set ADMIN_PASSWORD_ONLY=false in /etc/varsa/api.env and restart varsa-api. Backup environment and API bundle are retained on the VPS.
