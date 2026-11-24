# Public contact channels

Set only owner-confirmed public business details in the storefront environment:

| Variable | Supported value |
| --- | --- |
| `VITE_CONTACT_PHONE` | Iranian national landline/mobile, or an international number with `+` / `00` country prefix |
| `VITE_CONTACT_EMAIL` | One conventional email mailbox |
| `VITE_CONTACT_ADDRESS` | The actual public business address as plain text |
| `VITE_INSTAGRAM_URL` | Direct HTTPS public profile on `instagram.com` or `www.instagram.com` |
| `VITE_TELEGRAM_URL` | Direct HTTPS public username/channel on `t.me` or `telegram.me` |

The storefront uses the phone confirmed by the owner on 20 November 2026 when
store settings do not supply a valid public phone. Page metadata and visible
contact details resolve the same configuration.

All configured values are public inputs. Leave an unavailable or unconfirmed field
blank. The old telephone, email, address and platform-root URLs were placeholders
and have been removed. No contact value has been invented to replace them.

The shared configuration feeds the contact page, footer and mobile menu. Phone
numbers become a canonical `tel:` link; the email is encoded as one `mailto:`
mailbox. Address text does not imply a map destination. Social links accept the
supported profile path shape, reject root/action/post links, drop tracking
queries/fragments, and use `noopener noreferrer` in a new tab. The parser checks
the supported syntax; it cannot establish ownership, account existence or a
working telephone/mailbox. Confirm those separately with the owner.

When direct details are missing, the UI displays a short availability message
and retains the route to the contact form. No blank/dead social icons or links to
platform homepages are shown. This does not change contact-message storage,
shipping promises, privacy policy or order tracking; those have separate stages.

After adding confirmed values, restart the local development server or rebuild
and redeploy the production bundle. Check every visible `href`, the displayed
details and matching values across the three locations. Browser tests use
`example.test` and explicitly named local test accounts only; those values must
never be copied into the actual storefront environment.
