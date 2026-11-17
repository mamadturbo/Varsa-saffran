# Domain setup — 2026-11-15

Domain: varsasaffron.ir; origin VPS: 185.226.118.113.

The signed-in IRNIC account now shows b.ns.arvancdn.ir and w.ns.arvancdn.ir instead of the old ParsPack nameservers. The owner entered their security answer and submitted the change themselves. Arvan base PAYG plan selected (zero base price, excess usage can still be billed); @ and www A records point to the origin, TTL 120s, cloud proxy disabled. Other domains were untouched. Arvan terms were explicitly approved by the owner before continuing.

Public delegation still reported the old nameservers at the last check. DNS was SERVFAIL even before the change. Arvan warns propagation may take up to 24 hours. The domain is not yet verified publicly live and no trusted certificate has been issued yet.

HTTP ACME challenge route is installed on Nginx. Initial domain activation is provisioned as /usr/local/sbin/varsa-domain-activate, with systemd varsa-domain-activate.service retrying every 300 seconds until public A lookups for both names through both Cloudflare and Google match the origin. It then requests a Let's Encrypt certificate, installs /root/varsa-domain-final.conf, changes PUBLIC_ORIGIN and allowed origins without removing IP access, restarts API/worker, verifies HTTPS readiness and disables its own startup activation. The certbot renewal timer is enabled and Nginx reload hook installed. DNS preflight avoids contacting the CA before DNS resolves correctly. Logs: journalctl -u varsa-domain-activate. No provider API token was created or stored.

Frontend was built with VITE_SITE_URL=https://varsasaffron.ir, live metadata via an authenticated SSH tunnel, and SEO_REQUIRE_COMPLETE=1. Product-specific HTML, canonical URLs and sitemap were deployed. Existing optimized images were preserved. This strict frontend build passed.

The IP storefront and readiness remain available while propagation is pending. Trusted public HTTPS and domain-origin login still need the activation service to complete and a final external verification.

## Completed HTTPS activation — 2026-11-15 15:28 Asia/Tehran

Public delegation reached Arvan. The initial resolver gate was changed from Cloudflare (which returned SERVFAIL from the origin network) to Arvan authoritative DNS plus Google DNS. Let's Encrypt staging issuance succeeded, then the production certificate was issued for apex and www, valid until 2027-02-13. The activation service installed the final Nginx configuration, set PUBLIC_ORIGIN to the canonical domain, restarted API/worker, verified readiness and disabled itself successfully.

External verification without bypassing certificate validation: HTTP apex => 301 to https://varsasaffron.ir/; HTTPS apex => 200; HTTPS www => 301 to apex. Browser verification with certificate errors enabled found no JS or failed HTTP responses, articles 200, readiness ready, and admin password accepted with TOTP enrollment required. Evidence: .local/domain-final-check.json. The temporary HTTP redirect to the IP was removed.
