# Customer workspace redesign

Implemented using UI/UX Pro Max navigation, fixed-navigation clearance, readable forms and keyboard-navigation guidance.

- Desktop (1024px and above): persistent 264px rail at the right edge, directly below the storefront header. Content and footer leave space for the rail; the rail scrolls independently when needed.
- Mobile/tablet: account sections open in an accessible drawer with focus containment, Escape dismissal and focus restoration. Selecting a section closes the drawer. Resizing to desktop also dismisses it.
- Every account section has a contextual title and explanatory subtitle. Orders, addresses, favorites, support, reviews, notifications and profile share consistent spacing, headings and controls.
- Refined overview cards, readable labels, narrow-screen order rows, responsive favorites, profile forms and login presentation. Account sheets retain sticky headings and close controls while scrolling.

Validation: frontend TypeScript and production build passed. Browser fixtures exercised all eight account sections and the address editor at 320, 390, 768, 844 (landscape), 1024 and 1440px: 58 checks passed. A further 10 checks at 320px passed after refining the order amount/status layout. Desktop checks assert the rail meets the right edge and remains stationary during scrolling. Mobile checks assert dialog bounds, keyboard focus containment and restoration. No browser runtime errors were observed.

These checks use isolated customer data in browser responses and do not change real customer records. Physical-device/Safari validation remains outside the completed browser checks. Existing local production-build warnings about metadata snapshot configuration remain as documented in responsive-verification.md.

Source backups and execution logs: `.local/account-redesign/`. Repeat checks using `scripts/qa/responsive-accounts.cjs` with `QA_SCOPE=customer` and a Node-accessible Playwright installation (`PLAYWRIGHT_MODULE` may point to an existing module).
