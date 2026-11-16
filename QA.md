# Verification

15 November 2026

- 16 static content pages generated. Internal pages, local assets, anchors and ARIA references checked.
- Exact owner-supplied Ventures JPG retained byte-for-byte.
- Desktop homepage and 390px phone / 730px tablet layouts reviewed in browser.
- Phone homepage and contact page have no horizontal overflow.
- Mobile navigation opens and follows Contact correctly. Escape state-label defect corrected.
- Carousel tabs and pause control tested. Keyboard navigation and reduced-motion handling implemented.
- Country selector tested: India opens https://www.adoxglobal.com/; Dubai, UAE opens https://www.adoxglobal.com/ae. Browser back resets selector to Oman.
- FAQ accordion tested.
- Both review and project enquiry forms prepare an email draft to info@adoxglobal.om. No email was sent in tests. Synthetic example.com details were used locally only.
- Editing a form invalidates the prior prepared email. Disabled fieldsets prevent accidental native submission when JavaScript is unavailable; direct contact fallback is provided.
- All actionable code-review findings corrected, including low-contrast labels and orange service-tab text.
- No real-domain changes, no public sharing, no Indian courses/careers/staff/testimonials, no invented results or business hours.
- Full-page screenshot API timed out; viewport screenshots were used for visual review. No application JavaScript errors observed; browser extension metadata warnings were unrelated to the site.

## Regional wording update
- Added the owner-requested Oman extension relationship to Adox Global, Kochi, India, on Home, About and the shared footer.
- Added presence in India, UAE, Oman and Bahrain without asserting office locations or legal ownership.
- Existing three-option country selector retained; no Bahrain URL introduced.
- Rechecked all 16 pages, original logo, local links/assets and JavaScript syntax. Browser-verified the exact About paragraph and footer presence line.

## WhatsApp floating contact update
- Added an accessible WhatsApp link to all 16 pages: https://wa.me/96896967420, using the owner-confirmed Oman number.
- Desktop contact rail includes phone, WhatsApp and email. Mobile presents one green 52px circular WhatsApp button.
- Mobile position adjusts above interactive controls and hides while an enquiry form has focus. Browser check at 375px content width found no horizontal overflow or overlapping controls.
- Link opens a new tab with noopener/noreferrer. Browser click reached an unsupported native-app handoff, so WhatsApp account status was not inspected; no message was sent.
- All static checks and JavaScript syntax checks passed.

## Admin update
- Added a server-backed plain-text editor for 16 pages, page metadata, shared company/footer copy and contact/country links.
- D1 schema migrations hold current content and immutable revision snapshots. Save uses optimistic revision checks and an atomic state/history write; restore creates another revision.
- Fourteen automated tests pass, including anonymous/nonowner rejection, same-origin checks, bounded content, unsafe protocol rejection, XSS escaping, mailto encoding, stale-write conflicts, restore, rollback and SQLite persistence after reopening the database.
- TypeScript and full production build pass. The admin client was checked on desktop and at 375px phone content width. Search, mobile navigation, dirty/save state, discard confirmation and unauthenticated save-error handling work. No horizontal overflow was found.
- A default-content-only local UI fixture was used for visual testing and removed before packaging. It did not grant authentication or write access. No test route is included in the release.
- The actual admin page correctly shows the owner sign-in requirement without identity. This browser does not have the owner's hosted authenticated session; a hosted owner save/reload was not performed. Server persistence was verified in automated SQLite tests. A direct local HTTP integration check was unavailable because the managed preview network is separate from the command executor.
- Admin/API routes require the Sites-only runtime trust opt-in and the current hosted origin in production, then verify the owner identity server-side. The exported source omits runtime configuration and requires a verified auth adapter before other hosting.
- No public launch, DNS change, new administrator or external sharing was performed.
