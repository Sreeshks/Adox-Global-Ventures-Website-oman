# Adox Global Ventures website with content admin

The 16-page Oman website now has a server-backed editor at `/admin/`. The existing design, original logo, country links and WhatsApp contact remain in place.

## What the owner can edit

- Page headings, paragraphs, service descriptions, article copy, and page titles/search descriptions.
- Shared footer and Adox Kochi / regional presence wording.
- Phone, email, location, and India/Dubai destination links.
- Save changes immediately to server storage, export content JSON, and restore one of the last 20 saved versions shown in the editor.

Edits are plain text. The editor does not change page structure, add pages, upload images, manage accounts, or deliver enquiry forms. It does not store edits in browser local storage. Enquiry forms still prepare email drafts rather than submitting to a backend.

## Owner access

The current private Sites deployment uses its existing ChatGPT sign-in. Every admin read/write checks the authenticated ID and the allowlisted owner email. Signing in alone does not grant editing access. There is no separate password, first-user signup, public admin registration, or service-token write bypass.

The owner account for this deployment is `shinoypallath16@gmail.com`. The Google Drive account holding the source package is separate; a Drive account is not an admin role. No developer or other editor has been added.

## Server requirements

This version is **not static-only**. It uses the supplied Vinext/React server on Cloudflare Workers with a persistent D1 database binding named `DB`. Node.js >=22.13 is required for development/builds, not as a conventional always-running production Node server. The platform provisions D1 and applies the checked-in schema migrations when deployed through Sites.

- Install: `npm ci`
- Tests: `npm test`
- Build: `npm run build`
- Local dev: `npm run dev`

See `HOSTING_GUIDE.md` before deploying anywhere else. Identity-header checks are secure only behind the trusted Sites authentication boundary. Admin routes fail closed on an unconfigured new host.

## Source organization

- `app/admin/`: responsive content editor and protected server-rendered page.
- `cms/content.mjs`: authorization, request validation, escaping, D1 reads/writes, revisions and rendering.
- `cms/schema.json`, `cms/templates.json`: editable field definitions and marketing templates.
- `cms/generate-content.py`: regenerates definitions/templates from `legacy-site/`.
- `public/`: original marketing CSS/JS and brand assets.
- `db/schema.ts`, `drizzle/`: database schema and immutable migrations.
- `worker/index.ts`: request routing, trusted-host guard and response controls.
- `tests/cms.test.mjs`: authorization, CSRF, escaping, size limits, concurrency, rollback and persistence tests with SQLite.
- `build_site.py`, `legacy-site/`: original content/design source. `build_site.py` now writes `legacy-site`, not server build output.

Do not casually regenerate field IDs after users start editing: existing saved overrides refer to these IDs. Structural changes need a content migration preserving or deliberately remapping IDs. Export content before such work.
