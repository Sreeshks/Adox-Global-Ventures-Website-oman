# Hosting and migration guide

## Existing private deployment

The website and admin remain private to the owner. The current Sites host provides authentication; D1 stores saved content and revision history across reloads and deployments. The existing runtime setting enables the Sites-specific authentication adapter only in that hosted environment. It is not a password or a substitute for authentication.

Owner access: open `/admin/` and sign in with the website owner's ChatGPT account. Saving updates the server content without editing files or redeploying. The owner can export content JSON for backup. A restore creates a new revision rather than deleting history.

## Important change from the earlier source ZIP

The earlier ZIP was static HTML. **This admin-enabled version requires a server runtime, database and trusted authentication.** Uploading only HTML/CSS files to basic static hosting will not provide an admin panel or persistent edits. The older static package can still render the earlier copy but will not receive admin changes.

## Developer requirements

- Node.js >=22.13 and npm for installation, development and build. The included SQLite test runner uses `node:sqlite`, available in the required Node series; a newer supported Node release is preferable for tests.
- Cloudflare Worker-compatible runtime, with D1 database binding `DB`, for this implementation.
- Apply the checked-in Drizzle SQL migrations exactly once, in order. Do not seed user content through schema migrations or alter already applied migrations.
- Preserve the existing `sites()` build integration for managed Sites deployment.
- Serve marketing routes dynamically through the Worker. Static assets are under `public/`; generated deployment output is under `dist/` after building.
- No form-delivery service, email credentials, billing account, analytics service or image uploader is configured by this source.

## Authentication on another production host

The current adapter trusts identity headers inserted by Sites dispatch. **Never trust identity headers supplied directly by an ordinary browser or client.** A generic server can receive forged Host and identity headers; simply copying the owner email check is not secure authentication.

The code deliberately refuses admin/API requests outside the exact current Sites origin and without the Sites-only runtime opt-in. The developer handover excludes runtime settings, credentials and sessions. Do not copy or enable the Sites trust flag on a generic host to get around this guard.

For a custom domain or another host, implement and test a real server-side authentication adapter first: verified OIDC/session claims, secure HttpOnly session cookies where appropriate, a fixed owner allowlist/role model, CSRF checks, and no public self-service admin registration. Strip untrusted identity headers at the edge. Replace the Sites-specific adapter only after these controls are in place and the owner has approved the account/access model. Preserve the distinction between public page readers and authenticated editors.

No extra admin accounts or third-party persistent access have been granted. Adding a developer/editor later is a separate permissions decision.

## Content persistence and migration

`cms_state` holds the current document and revision; `cms_history` holds saved snapshots. Writes use parameterized SQL and an atomic batch. A revision conflict returns 409 rather than silently overwriting another edit. On an uncertain network outcome, reload the latest saved revision before retrying.

Use **Export content** in the admin before migration. The source ZIP contains default content and schema, not the production database or future edits. Migrate the current content and history separately into the approved target database and validate rendered pages there. Do not expose exports or database backups in a public document root. The UI shows the latest 20 history entries; older database history is not automatically deleted.

For local D1 development: build once, then apply pending SQL with the included Wrangler CLI and local config:

```
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_messy_blazing_skull.sql
```

This command changes only local preview storage. Hosted schema migrations are applied by the platform's deployment workflow. Do not run this file repeatedly against an already migrated database.

## Original website launch considerations

- The site remains rooted at `/` with directory-style page routes.
- `public/robots.txt` currently blocks crawling. Enable public indexing only when the owner approves launch; add final-domain canonical URLs and a sitemap if required.
- The host's private access gate is not contained in HTML. Publicly deploying the marketing pages may make them visible even while admin remains protected; review both settings.
- The enquiry forms only prepare mailto drafts. They do not automatically send/store enquiries. A backend form service would be separate work, with updated privacy text and appropriate validation/spam protection.
- Raleway loads from Google Fonts. Review final-host logging, WhatsApp links, analytics and any future form processing in the privacy notice.
- Verify phone/email and the actual WhatsApp account, country destinations, branding rights, services and relationship/presence wording before public launch.
- No DNS, real business domain, public sharing or developer access was changed as part of this update.
