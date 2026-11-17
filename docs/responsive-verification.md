# Responsive verification

Date: 2026-11-09. Status: passed in local Chrome/Playwright.

## Changes

- Compact header with reachable actions at 320px. Full navigation begins at 1280px; mobile and tablet navigation use dialog focus handling.
- Gutters scale from 16px to 32px and 48px and account for device safe areas.
- Fluid hero heading and spacing; featured cards stay in two columns on landscape tablets, expanding to four at 1280px.
- Product cards fill their grid rows. Category filters and footer links have larger touch targets.
- Product details use a single column on tablets and two columns on large screens. Product, cart and checkout panels fit the dynamic viewport, including landscape.
- Mobile and touch form controls use readable input sizes. Checkout totals, coupon actions and article headings reflow with content.
- Account sheets, forms, narrow order rows and favorites adapt to available width.
- Management navigation uses the shared accessible dialog, closes on desktop resize and restores focus. Dense tables and charts scroll inside their own regions. Small-screen money tiles use one column.
- Reduced-motion preference reveals all content without scroll animation. Ordinary motion still reveals sections as they enter the viewport.

## Verification

| Check | Result |
| --- | --- |
| Frontend TypeScript | Passed |
| Production build | Passed |
| Full storefront matrix | 296 assertions passed |
| Final narrow/landscape regression | 60 assertions passed |
| Customer and management panels | 116 assertions passed |
| Browser runtime errors | 0 in completed suites |
| Normal-motion interactions | Passed |

Total: **472 assertions**, including repeated regression checks. Normal-motion checks additionally covered carousel pause, menu focus trap, Escape, focus restoration, desktop resize and scrolling through all reveal sections.

Storefront viewports: 320×740, 375×812, 390×844, 600×960, 768×1024, 820×1180, 1024×768, 1280×800, 1440×900, 844×390. Both light and dark themes were checked. Account/admin viewports: 320×740, 390×844, 768×1024, 1024×768, 844×390, 1440×900.

Public pages covered: home, shop, buying guide, about, contact, journal, article, account login, admin login and 404; plus product details, comparison table, cart and checkout. Customer tabs and management sections were exercised with isolated browser response fixtures, including address/product editors and management-menu dismissal/focus restoration. Test requests block data writes; the storefront suite allows the read-only order quote calculation. Article fixtures supply content when the local article catalog is empty.

Initial screenshots used the available web fonts. Final regression scripts intentionally block Google Fonts to verify fallback layout and avoid depending on an external font service. Assertions check page width, dialog bounds, reachable actions and JavaScript errors.

## Repeat the checks

Start the project with `pnpm dev`. Use a Node-accessible Playwright installation and Chrome. The scripts can use an existing Playwright module through `PLAYWRIGHT_MODULE`; no application dependency was added for QA.

```powershell
node scripts/qa/responsive-storefront.cjs
node scripts/qa/responsive-accounts.cjs
```

If Playwright is outside project module resolution, set `PLAYWRIGHT_MODULE` to its absolute module directory first. Optional settings: `QA_BASE_URL`, `PLAYWRIGHT_CHANNEL` (default `chrome`), `QA_VIEWPORTS` as a JSON array such as `[[320,740],[768,1024]]`; the storefront script also accepts `QA_THEMES=light,dark`.

Generated screenshots, detailed results and source backups are under `.local/responsive/`. The compact summary is in [responsive-verification.json](responsive-verification.json).

## Limits

Validation used browser viewport emulation. Physical iOS/Android devices and Safari were not tested, including their actual keyboards and safe areas. No actual checkout was submitted.

The production build succeeds with warnings about missing public catalog/article metadata snapshots and unset `VITE_SITE_URL` in the local build configuration. Rollup also removes two upstream Zod comment annotations. Deployment needs its normal metadata/domain configuration.

The local preview is at `http://127.0.0.1:5173/`.
