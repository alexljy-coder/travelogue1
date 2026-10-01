# Implementation status

Milestones 1–3 and their hosted verification are complete per the owner. Milestone 4 first public photography experience is implemented and verified locally on 2026-10-01 against existing published hosted Supabase/R2 content. Deployment acceptance of this new milestone remains an owner step; no hosted migration, Cloudflare change or remote content mutation was performed.

## Implemented

- Entire Build Bible read; product source unchanged. Owner's eight resolved decisions recorded before implementation.
- One TypeScript/Next.js App Router application with public photography pages and dynamic /admin/login + protected /admin shell.
- Supabase environment validation and separate cookie-free public/session server clients. No privileged API key, browser Auth client, signup route or development bypass.
- Password sign-in, validated session + singleton administrator check, sign-out and admin-only session-refresh proxy. HttpOnly/SameSite cookies, Secure in production; private/no-store admin responses. Protected layout/page/action independently enforce authorization.
- One atomic versioned migration: 20260930000100_v1_foundation.sql. Creates all ten archive tables plus private single-admin identity, date/rating/context/assignment/readiness/Featured constraints, RESTRICT relationships, timestamps, indexes, grants and RLS.
- Photo IDs rather than slugs; optional editorial ordering; distinct public review/private internal notes; preserved GPS excluded from public columns.
- Parent-aware anonymous reads and column privacy; authenticated archive access requires the singleton administrator. Unrelated authenticated users receive zero rows and cannot mutate. Private identity cannot be browser-managed.
- Typed publishing/cover eligibility preflight helpers for future photo/Stay workflows; Trip/Location status can now be edited in admin.
- Generated Supabase-compatible table/relationship types from migrated PostgreSQL catalog and drift-check script.
- 66 automated tests, including real embedded PostgreSQL RPCs/constraints/grants/RLS, Sharp JPEG/WebP/EXIF processing, authenticated API boundaries and fake-R2 failure/retry/deletion scenarios. No production bucket access.
- Production-server smoke checks against the build's actual configuration, all admin route guards, private image/storage endpoints, unauthorized upload operations, cache/privacy headers and absent registration/public Trip routes. Missing configuration is separately covered by unit tests.
- Exact dependency pins/lockfile, Node 24/pnpm tooling, lint/typecheck/build scripts, CI workflow and local Supabase config with signup disabled.
- Setup guides explaining hosted Auth/migrations and private R2 credentials/CORS/controlled testing. .env.example contains empty variable names only; no real credentials committed.
- Hosted verification complete, as confirmed by the owner: the Supabase migration was applied successfully, the singleton administrator was provisioned, local authentication was verified, and the Vercel deployment was successfully tested against hosted Supabase.
- Admin Dashboard/Trips/Locations navigation; paginated lists, create/edit forms, optional historical dates, purpose/description/status and optional numeric editorial ordering.
- Inline Country/City creation and existing City selection, editable slug suggestions, optional manual coordinates and matching-identity reuse.
- Trip–City and Trip–Location membership management with optional sequence/visited_at. New Location creation can attach directly to a Trip; shared Location City edits maintain related Trip geography atomically.
- Safe confirmed deletion: Trip/joins only, preserving Countries/Cities/Locations; Photos/Stays block Trip deletion, and references block Location deletion or used membership removal.
- Milestone 2 migration 20260930000200_admin_geography_workflow.sql: seven narrow invoker-rights transaction functions. Applied and manually verified against hosted Supabase per the owner's Milestone 3 instruction.
- Clear field errors with preserved input, useful empty states and deferred cover selection. Milestone 2 added no public Trip/Photo, Hotel/Stay or Map features.
- Private Travel photo browser ingestion: ten eligible JPEGs per batch, folder classification, Personal exclusion before byte reads, explicit loose-file fallback/confirmation, source SHA-256 and per-photo results/retry.
- Server-side S3 SDK/credentials with a two-minute single-part upload capability, server-only multipart completion/abort, source-byte/hash/dimension verification, EXIF extraction and four metadata-free non-upscaled WebPs. UUID storage keys; source retained unchanged.
- Photos admin navigation/list/import/detail/edit, secure no-store previews/source download, private GPS display, Trip/Location assignment and publication/Featured validation using existing parent/membership rules.
- New migration 20261001000100_private_photo_ingestion.sql: admin-only import_items operation/recovery ledger and ten invoker-rights RPCs. Existing Photo model, public privacy/RLS and applied migrations unchanged. Applied and manually verified by the owner before Milestone 4; never applied remotely by the agent.
- Durable checksum/request idempotency, claims/leases, prompt upload cancellation, compensating cleanup with uncertain-commit protection, recoverable failures and safe storage-aware deletion. Deletion withdraws visibility and verifies all five objects gone before deleting the Photo row.
- Required server R2 environment names plus optional jurisdiction configuration; detailed owner setup and ten-photo manual procedure in r2-setup.md. No remote Cloudflare changes.

Milestone 3 verification run on 2026-10-01:

| Check | Result |
| --- | --- |
| pnpm lint | Pass |
| pnpm typecheck | Pass; generates Next route types first |
| pnpm test | Pass, 58/58 |
| pnpm db:types:check | Pass |
| pnpm build | Pass; public placeholder static, all admin routes dynamic |
| pnpm test:smoke | Pass; configured/no-session local production build, Photo pages/private media/storage and all import operations rejected without authentication |
| Build Bible Git diff | No changes |
| Applied migrations Git diff | No changes |

## In Progress

- Owner deployment acceptance for Milestone 4: verify the new public pages/media and withdrawal behavior on Vercel using the manual plan below. Implementation and local checks are complete; Milestone 5 has not begun.

## Not Started

- Milestone 5 (recommended): first public Trip index/detail slice with existing geographic/Photo context and separate Nice/The Record presentation.
- Public Trip/Location pages, Hotel/Stay management/public context, cover selection and drag-and-drop ordering UI.
- Importer refinements, grouping/suggestions and broader browser/performance work. Re-import/replacement remains Phase 2.
- Map, About, final visual design/branding, broader performance/accessibility work and final release checks.

## Known Issues

- Embedded PostgreSQL uses test-only Auth objects; automated ingestion/security tests use fake R2, not destructive production access. Milestones 1–3 hosted verification are owner-reported. Milestone 4 browser/production checks read existing anonymous-visible hosted Photos/derivatives without remote writes. New Vercel deployment withdrawal/cache behavior still needs the owner acceptance check.
- All three existing migrations are applied per the owner. Milestone 4 adds no migration or environment variables. Do not rerun/reset applied migrations.
- Folder picker preserves paths where supported. Loose-file drag/drop requires explicit Nice/Record and Personal-exclusion confirmation; lost classification cannot be inferred. Recursive dropped-directory traversal is deferred. Exact-byte duplicates are reused, not replaced; different exports of the same image are not reconciled.
- Source limit: ten eligible JPEGs, 25 MiB/file, 4000px/16 megapixels, sequential bounded processing. The initial Vercel import proof is owner-verified; future larger-volume CPU/memory/runtime capacity still needs measurement. Export quality/sharpening and untagged source profile are not retrospectively verifiable. No automatic orphan sweeper/background recovery is introduced; hard interruptions retain traceable state for manual cleanup after lease expiry.
- Next's current lint dependencies require ESLint 9/TypeScript <6.1; ESLint 9.39.5 emits an upstream support/deprecation warning. Peer-compatible versions are pinned; review a compatible tooling upgrade when available. This is a development-tooling limitation, not a security bypass.
- Cover relationship eligibility is application-level, with tested helpers but no live mutation workflow. Future cover selectors/public queries must use the helpers and resolve anonymous effective Photo visibility.
- Map/tile selection remains deferred. Public delivery intentionally has no shared cache; it checks visibility per image and streams through Vercel. A later traffic/cost optimization must preserve parent-aware withdrawal. Already authorized/in-flight/downloaded bytes cannot be recalled. No unresolved product conflict was found.
- Canonical-domain/OG image configuration and Hotel/Stay public geographic context remain deferred. Public Photo detail can use the common shell for any RLS-visible Photo; current Travel imports show assigned Location geography.
- The local Turbopack persistence cache failed during preview startup. Responsive verification used `pnpm dev --webpack`; the established Webpack production build passed. Next dev generated AGENTS.md/CLAUDE.md with its version-specific documentation guidance.

## Architecture Decisions Made During Development

See decisions.md and technical-plan.md for rationale:

- Authenticated rows are admin-only; anonymous safe-column grants prevent private GPS/notes from leaking to another authenticated user.
- Cookie-free public clients and validated HttpOnly server-side Auth keep public and admin access separate.
- Singleton database identity replaces any public roles/metadata authorization. is_admin exposes only a boolean.
- Atomic migration lands schema/grants/RLS together and revokes schema creation from browser-facing roles.
- Manual minimal Next initialization uses pnpm with exact dependency pins; supported Webpack production build, no custom bundler setup.
- PGlite provides real PostgreSQL security tests/type generation without Docker or production secrets. Test migration discovery excludes macOS AppleDouble files.
- Typecheck generates Next declarations first so CI/fresh checkouts do not require an existing build.
- Independently guarded Server Actions plus small invoker-rights RPCs handle multi-row content transactions under unchanged RLS.
- Explicit City membership is maintained on Location attachment/City edits; no automatic historical City removal.
- Country/City identities are reused without overwriting metadata; confirmed deletion never cascades archive records.
- Production smoke checks respect Next's build-time public environment configuration; catalog-derived database types include RPC signatures.
- Single-part multipart transport avoids Vercel's request-body ceiling while keeping finalization/abort and reusable R2 credentials server-side.
- UUID object prefixes follow the owner's Milestone 3 instructions. Original GPS-bearing JPEGs stay admin-only; derivatives strip metadata.
- Durable per-file state/leases and exact-byte checksum identity provide bounded recovery, not a job queue/replacement system.
- Missing Photo visibility alone is not proof of deletion; completion requires a readable deleted tombstone to avoid mistaking authorization loss for success.

## Milestone 3 files and manual acceptance

See r2-setup.md for exact Cloudflare permissions, variables, CORS, migration and controlled test steps. New/materially changed files:

- `.env.example`, `package.json`, `pnpm-lock.yaml`.
- `supabase/migrations/20261001000100_private_photo_ingestion.sql`, generated `src/types/database.ts`.
- `src/lib/photos/{model,image,ingestion,repository,api-boundary}.ts`, `src/lib/r2/{config,storage}.ts`, `src/lib/validation/photo.ts`.
- `src/app/admin/(protected)/photos/{page,import/page,[id]/page}.tsx`, `photos/actions.ts`, `photos/api/[operation]/route.ts`, `photos/storage/route.ts`, `photos/[id]/image/[variant]/route.ts`.
- `src/components/admin/{photo-importer,photo-form,import-recovery,navigation,trip-form}.tsx` (Trip cover deferral text clarified), `src/app/globals.css`.
- `scripts/generate-database-types.ts`, `scripts/smoke-production.ts`, `tests/{photos,ingestion,database,workflow}.test.ts`.
- `docs/{r2-setup,decisions,technical-plan,implementation-status}.md`.

Milestone 3 hosted proof is complete per the owner. The following Milestone 4 work builds on it.

## Milestone 2 manual acceptance checks

1. Apply the new migration, deploy and sign in as the singleton administrator. Verify Dashboard, Trips and Locations navigation.
2. Create a Draft Trip with dates/purpose empty; refresh to confirm persistence. Edit a single date endpoint, then try a reversed range and check the error and preserved input. Save a valid edit and Published/Draft changes.
3. Inline-create a Country (name, two-letter code, URL name) and City, then add the selected City to the Trip. Repeat matching creation to verify reuse. Select an existing Country/City; add a second City with optional position.
4. Create a Location from the Trip, using a City and optional paired coordinates. Confirm the Location and City associations persist. Edit Location and Trip fields. A single coordinate should show a validation error.
5. Create another Trip and attach the same Location. Edit the Location's City and verify both Trips gain the new City while old membership remains. Save/clear optional position and visit date; no chronology is required.
6. Try removing a City still used by a Location: it must fail. Remove the Location association, then the unused City association; underlying records remain.
7. Verify Location deletion is blocked while associated. Delete an unreferenced test Location with confirmation. Delete a test Trip with confirmation; its Locations/Cities/Countries remain. Photo/Stay references must block deletion (automated fixture coverage now; browser check when those records exist).
8. Sign out and visit every admin list/new/edit URL directly: redirect to login. An unrelated Auth account must receive forbidden access. No signup route is available.

## Milestone 4 implemented

- Photography-led homepage with effectively visible Featured Nice opening/selection and deterministic other-Nice fallback; no fabricated content/statistics or marketing hero.
- `/photos`: native-aspect editorial masonry, responsive 1/2/3 columns, small one/two-photo layouts, 24-item pagination, Nice default and explicit Record selection. Clear empty/unavailable states.
- `/photos/[id]`: large responsive derivative, real optional caption/description/EXIF, assigned Location/City/Country and Trip names, contextual back link, 404 for hidden/nonexistent UUIDs. Missing metadata is omitted rather than invented.
- Restrained scoped light public styles distinct from admin; semantic main/navigation, skip link, visible keyboard focus, accessible image labels and baseline titles/descriptions/OG text. Photos active; Trips/Stays/Map/About remain disabled labels without broken routes.
- Separate public derivative-only route checks cookie-free anonymous RLS on every request before touching R2. Source/unknown representations blocked; existing private source/admin delivery unchanged. Raw GPS, notes, source keys, hashes and operational fields absent from typed public queries.
- Existing metadata-free WebPs streamed unchanged; native srcSet uses real derivative widths including portrait/no-upscale cases, priority opening/detail and lazy gallery loading. No recompression, forced crops or public bucket exposure.
- Dynamic/no-store public HTML/data/images plus CDN-specific media no-store headers. Local Next optimizer disallowed to prevent its shared cache from retaining unpublished imagery. No new dependencies, migration, environment variable, credentials or remote configuration.
- Eight new tests exercise the actual supabase-js query builder against anonymous PostgreSQL RLS, safe projections, parent withdrawal, detail missing/Draft behavior, Nice/Record/empty selections, Featured fallback and derivative authorization/sizes/error handling.

### Verification on 2026-10-01

| Check | Result |
| --- | --- |
| pnpm lint | Pass |
| pnpm typecheck | Pass |
| pnpm test | Pass, 66/66 |
| pnpm db:types:check | Pass, no schema/type change |
| pnpm build | Pass, all public content/media and admin routes dynamic |
| pnpm test:smoke | Pass; public Nice/Record pages, actual published detail/WebP bytes, source/missing rejection, optimizer block and private route guards |
| Responsive Chrome checks | Pass at 1440px desktop, 768px tablet, 390px mobile and 320px narrow; hosted public home/gallery/detail load, no broken images/overflow/distortion |
| Mixed-aspect isolated layout fixtures | Pass desktop/tablet/mobile: landscape, portrait, panorama preserve composition; no production fixtures created |
| Build Bible/applied migration diff | No changes |

### New/materially changed files

- `src/app/(public)/{layout,page,error,not-found}.tsx`, `public.css`.
- `src/app/(public)/photos/page.tsx`, `photos/[id]/page.tsx`, `photos/[id]/image/[variant]/route.ts`.
- `src/components/public/photograph.tsx`.
- `src/lib/data/{public-photos,public-archive}.ts`, `src/lib/photos/public-image.ts`.
- `next.config.ts`, `scripts/smoke-production.ts`, `tests/public.test.ts`.
- `docs/{technical-plan,decisions,implementation-status}.md`.
- `AGENTS.md`, `CLAUDE.md`: Next dev-generated documentation guidance, no product behavior.

### Short manual acceptance plan

1. Deploy normally through GitHub/Vercel; keep existing Supabase/R2 variables. No SQL or Cloudflare change is required.
2. In a signed-out/private browser, visit `/`, `/photos`, `/photos?view=record` and a published photo. Check homepage Featured preference and fallback; Nice default excludes Record. Check zero/one/few-photo states using existing test content as appropriate, without inventing archive records.
3. At desktop/tablet/mobile widths, check landscape/portrait/panorama proportions, readable metadata, keyboard focus/skip link, usable navigation and no horizontal overflow. In network tools, confirm responsive WebP derivatives rather than source JPEGs.
4. Copy a Draft Photo UUID from admin. Public detail and `/photos/<id>/image/large` must return 404, even in an admin-signed-in browser. Unknown IDs and `/image/source` must also return 404. Private admin previews/source still require singleton authentication.
5. Unpublish a test Photo or its required Trip/Location in admin. In a fresh request/hard reload, verify it disappears from home/gallery/detail and all four derivative endpoints return 404. Restore only the intended test states; no publication cascade should occur.
6. Inspect public HTML/network payloads for absence of exact EXIF GPS, internal notes, source storage keys and credentials. Check photo responses' no-store headers and that `/_next/image` cannot optimize local image routes. Already downloaded images cannot be revoked.

Recommended Milestone 5: the minimal public Trip experience using existing Trip–City–Location–Photo relationships, optional historical dates, Nice photography and a distinct The Record section. Milestone 5 has not started.
