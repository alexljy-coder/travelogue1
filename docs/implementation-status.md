# Implementation status

Milestones 1–5 and hosted verification/acceptance are complete per the owner. Milestone 6 Hotels and Stays is implemented and locally verified on 2026-10-02; results are recorded below. Applying its new migration and deployment acceptance remain owner steps. Milestone 7 Found Along / archive refinement is also implemented and locally verified; its manual acceptance is recorded below. No hosted migration, Cloudflare change or remote content mutation was performed.

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
- 100 automated tests, including real embedded PostgreSQL RPCs/constraints/grants/RLS, Sharp JPEG/WebP/EXIF processing, authenticated API boundaries and fake-R2 failure/retry/deletion scenarios. No production bucket access.
- Production-server smoke checks against the build's actual configuration, all admin route guards, private image/storage endpoints, unauthorized upload operations, cache/privacy headers, absent registration routes and public Photo/Trip/Location behavior. Missing configuration is separately covered by unit tests.
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

- Owner hosted acceptance of any pending Milestone 6 steps and the new Milestone 7 migration/refinements.

## Not Started

- Interactive Map remains deferred by the owner’s Milestone 7 brief; provider choice is still open.
- Explicit cover selection and drag-and-drop ordering UI.
- Importer refinements, grouping/suggestions and broader browser/performance work. Re-import/replacement remains Phase 2.
- Map, About, final visual design/branding, broader performance/accessibility work and final release checks.

## Known Issues

- Embedded PostgreSQL uses test-only Auth objects; automated ingestion/security tests use fake R2, not destructive production access. Milestones 1–3 hosted verification are owner-reported. Milestone 4 browser/production checks read existing anonymous-visible hosted Photos/derivatives without remote writes. Milestone 4 is deployed/accepted per the owner; Milestone 5 is also deployed/accepted per the owner; Milestone 6 needs hosted acceptance.
- All three existing migrations are applied per the owner. Milestones 4–5 add no migration or environment variables. Milestone 6 adds one unapplied hosted migration; run only that new file. Do not rerun/reset applied migrations.
- Folder picker preserves paths where supported. Loose-file drag/drop requires explicit Nice/Record and Personal-exclusion confirmation; lost classification cannot be inferred. Recursive dropped-directory traversal is deferred. Exact-byte duplicates are reused, not replaced; different exports of the same image are not reconciled.
- Current source limit: ten eligible JPEGs, 25 MiB/file and 80 megapixels; no 4000px restriction, sequential bounded processing. The initial Vercel import proof is owner-verified; future larger-volume CPU/memory/runtime capacity still needs measurement. Export quality/sharpening and untagged source profile are not retrospectively verifiable. No automatic orphan sweeper/background recovery is introduced; hard interruptions retain traceable state for manual cleanup after lease expiry.
- Next's current lint dependencies require ESLint 9/TypeScript <6.1; ESLint 9.39.5 emits an upstream support/deprecation warning. Peer-compatible versions are pinned; review a compatible tooling upgrade when available. This is a development-tooling limitation, not a security bypass.
- Cover relationship eligibility is application-level, with tested helpers but no live mutation workflow. Future admin cover selectors must enforce eligibility; implemented public Trip/Location cover queries resolve anonymous effective Photo visibility and exact context/identity.
- Map/tile selection remains deferred. Public delivery intentionally has no shared cache; it checks visibility per image and streams through Vercel. A later traffic/cost optimization must preserve parent-aware withdrawal. Already authorized/in-flight/downloaded bytes cannot be recalled. No unresolved product conflict was found.
- Canonical-domain/OG image configuration remains deferred. Hotel Photo detail now derives curated Hotel/City/Country geography through its Stay.
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

Milestone 4 has been deployed and manually accepted on Vercel per the owner. Milestone 5 implements the travel layer below.

## Milestone 5 implemented

- `/trips`: published-only, photography-led summaries using existing Trip slugs, optional real dates and explicit City/Country membership. Twelve Trips per page; safe cover or intentional text-only presentation.
- `/trips/[slug]`: real identity/description/geography, large opening photograph, linked Places, contextual Nice photography and distinct The Record. Unknown dates remain absent; no itinerary/guide/timeline fields.
- `/locations/[slug]`: already-established Location slug route; curated City/Country labels, optional existing description, Nice photography and visible related Trips. Location remains independently Published when related Trips become Draft; those Trips/photos are hidden.
- Safe cover resolution: effectively visible Published Nice Travel photo for the exact Trip/Location, else deterministic eligible fallback, else text. Wrong-parent/Record/Hotel/Draft/stale pointers never authorize imagery. No stored pointer/Featured changes or admin cover UI.
- Photo detail now links to anonymously resolved Trip/Location slugs. Trip Places and Location Trip links complete contextual navigation; canonical Photo URLs remain UUIDs. Trips nav is active; Stays/Map/About remain disabled. City/Country remain labels, not guides.
- Reused native-aspect Milestone 4 components and scoped light visual language; responsive WebPs/no source, no new transform, no-store public delivery and optimizer block retained.
- Explicit public projections omit GPS, notes, source/hash/import/administrative fields. Existing parent-aware RLS and singleton administration remain unchanged; no privileged public client.
- Bounded contextual lists: 24 Nice + 24 Record + cover maximum per Trip page; cover excluded before Nice pagination. Independent section pages preserve other positions; Trip Places and Location Trips use 24 rows. Supporting City joins/IDs chunked to avoid silent PostgREST truncation; index cover reads cap concurrency at three.
- Nine new automated tests against actual anonymous PostgreSQL query/grant/RLS behavior, date presentation, cover selection, cross-link rendering, 50-photo pagination and supporting geography exceeding 200 records. Shared anonymous test transport now serializes role switching safely.

### Milestone 5 verification

| Check | Result |
| --- | --- |
| pnpm lint | Pass |
| pnpm typecheck | Pass |
| pnpm test | Pass, 75/75 |
| pnpm db:types:check | Pass, no schema/type changes |
| pnpm build | Pass; all new public content routes dynamic |
| pnpm test:smoke | Pass; published Trip/Location/Photo routes, missing routes 404, derivative bytes and private-route rejection |
| Browser verification | Pass 1440px desktop, 768px tablet, 390px mobile, 320px narrow: public Trip index/detail, Location/detail, Photo cross-links, loaded native-aspect derivatives, no overflow; missing routes 404 |
| Build Bible/applied migrations | Unchanged |

### Milestone 5 files

Created:

- `src/lib/data/{public-places,public-journeys}.ts`.
- `src/components/public/journey.tsx`.
- `src/app/(public)/trips/page.tsx`, `trips/[slug]/{page,not-found}.tsx`.
- `src/app/(public)/locations/[slug]/{page,not-found}.tsx`.
- `tests/{places.test,public-client}.ts`.

Materially changed:

- `src/lib/data/public-photos.ts`: public parent slugs.
- `src/app/(public)/{layout.tsx,public.css}`, `photos/[id]/page.tsx`.
- `scripts/smoke-production.ts`, `tests/public.test.ts`.
- `docs/{technical-plan,decisions,implementation-status}.md`.

No migrations, dependency/lockfile, environment example, R2 configuration or Build Bible changes.

### Milestone 5 manual acceptance

1. Deploy normally through GitHub/Vercel. Keep existing variables; no SQL/Cloudflare/CORS change.
2. Signed out, open `/trips`, then a Trip. Verify title, actual dates or intentional omission, City/Country context, valid cover/fallback, Places and photographs. A Trip with no suitable Nice photo must use text, never fake imagery.
3. Follow Trip → Location → related Trip and Photo → Trip/Location. Confirm only Photos/Trips nav is active and all Photo links keep `/photos/[id]`.
4. Check Nice vs The Record separation, missing description/EXIF, one-photo/undated Trips and section pagination on larger records. Photo/relationship pages preserve the other section parameters.
5. Check desktop/tablet/mobile native proportions, readable text/focus and no overflow. Confirm network delivery is existing WebP derivatives, not source JPEGs.
6. Use a Draft Trip/Location slug: 404 even while signed into admin. Unpublish a test Location: remove its public Places link and required-child photos/derivatives; unpublish a Trip: remove its index/detail and child photos. A reusable Published Location may remain, showing only other visible Trips/photos. Restore the intended test states.
7. Inspect public payloads for absence of GPS, notes, credentials/source storage keys and operational fields. Private admin/mutations remain protected. Changes are observed on new requests; downloaded/in-flight imagery cannot be recalled.

Limitations: no admin cover selector yet; offset pages can move during concurrent edits; supporting geography can grow for unusually large Trips; no shared CDN cache means database/read-stream cost remains. Hotel/Stay context, Map, Search, canonical-domain/OG imagery remain deferred. No unresolved product conflict or new schema decision.

The owner accepted Milestone 5 and expanded Milestone 6 to the end-to-end Hotel/Stay branch below.

## Milestone 6 implemented

- Protected Hotel and Stay list/new/edit/delete routes and navigation; inline Country/City infrastructure, optional coordinates/order, Hotel slug, required Stay Trip/Hotel, unknown historical dates, whole-star ratings and optional review/private notes. Existing Hotel recommendations retained; no separate Review or artificial Location.
- Trip → Stay creation/edit navigation. Shared Hotel City edits and Stay saves preserve explicit Trip Cities atomically. Duplicate normalized Hotel name in City is blocked; unique slug remains identity.
- Importer Travel/Hotel selector and optional Stay target, both-context Photo editor, parent-aware publication/Featured preflight, unchanged private previews/source and safe R2-aware Photo deletion. Hotel photos do not require Location.
- `/stays` lists each published Hotel once; property slug and visit UUID detail pages, Nice Hotel gallery across visits, separate Stay The Record, genuine optional editorial/context fields, deterministic eligible cover or text fallback.
- Public Photo → Hotel/Stay/Trip and Trip → Where I Stayed cross-links. Hotel photographs remain excluded from Trip Travel galleries. STAYS navigation active; MAP/ABOUT deferred.
- Explicit anonymous-safe queries retain existing RLS and private-note/GPS/source restrictions; same derivative-only private-R2 delivery/no-store/optimizer protection. No new environment variables/dependencies/external infrastructure.
- New migration `20261001000200_hotels_stays_workflow.sql`; no applied migration edits. Generated database types updated. Temporary import context/Stay assignment survives retries, completed/deleted/cleaned-failed operations release the temporary Stay FK; conflicting duplicate bytes never replace existing content.
- Seventeen additional tests: actual PostgreSQL admin CRUD/security/transactions, optional dates/ratings/categories, Hotel-photo fake-R2 failure/retry/deletion, anonymous public queries/relationships/covers, Hotel gallery pagination, private-field denial and cross-links. Existing tests retained.

### Milestone 6 verification (2026-10-02)

| Check | Result |
| --- | --- |
| pnpm lint | Pass, no warnings |
| pnpm typecheck | Pass; production build also checks TypeScript |
| pnpm test | Pass, 92/92 |
| pnpm db:types:check | Pass |
| pnpm build | Pass, new public/admin content routes dynamic |
| pnpm test:smoke | Pass; Hotel/Stay admin guards, public Stays/index/missing routes, existing published Trip/Photo and WebP reads, no signup/private-source access |
| Chrome responsive checks | Pass at 1440, 768, 390 and 320px: Hotel index/detail, Stay, Photo and Trip cross-navigation, readable headings/review, native aspect and no overflow |
| Isolated admin browser workflow | Pass: synthetic login, Hotel create/edit/delete, undated Stay create/edit/reversed-date errors with retained input/delete, Hotel import target and Hotel Photo edit |
| Build Bible/applied migrations/dependencies/env | Unchanged |

Browser populated-page checks used an isolated migrated PostgreSQL/Auth HTTP fixture and synthetic WebP responses, with no hosted mutations or bucket writes. Production smoke used the normal build configuration and read existing anonymous-visible hosted content only. Live Hotel/Stay PostgREST/R2 acceptance remains the manual owner step below. Local fixture servers were stopped after verification.

### Milestone 6 files

Created:

- `supabase/migrations/20261001000200_hotels_stays_workflow.sql`.
- `src/app/admin/(protected)/stay-actions.ts`, `hotels/{page,new/page,[id]/page}.tsx`, `stays/{page,new/page,[id]/page}.tsx`.
- `src/components/admin/{hotel-form,stay-form,trip-stays}.tsx`.
- `src/app/(public)/stays/page.tsx`, `stays/[hotelSlug]/{page,not-found}.tsx`, `stays/[hotelSlug]/[stayId]/page.tsx`.
- `src/components/public/stay.tsx`, `src/lib/data/{public-stays,public-lodging}.ts`, `tests/stays.test.ts`.

Materially changed:

- `src/types/database.ts`, `src/lib/validation/{content,photo}.ts`, `src/lib/admin/{catalog,queries,form-state}.ts`.
- `src/lib/photos/{model,repository}.ts`; storage/processing/ingestion engine unchanged.
- `src/components/admin/{navigation,photo-form,photo-importer}.tsx`.
- `src/app/admin/(protected)/photos/{page,import/page,[id]/page}.tsx`, `photos/actions.ts`, `trips/[id]/page.tsx`.
- `src/lib/data/{public-photos,public-places,public-journeys}.ts`, `src/components/public/{journey,photograph}.tsx`.
- `src/app/(public)/{layout.tsx,public.css}`, `photos/[id]/page.tsx`, `trips/[slug]/page.tsx`.
- `scripts/smoke-production.ts`, `tests/{public-client,public.test,ingestion.test,workflow.test}.ts`.
- `docs/{technical-plan,decisions,implementation-status}.md`.

### Milestone 6 manual hosted acceptance

1. Back up/inspect Supabase migration history. In SQL Editor, run **only** `20261001000200_hotels_stays_workflow.sql` in full, once. It changes no public privacy policies and creates no new content entity. Do not rerun the three applied migrations. The migration sends a PostgREST schema reload notification. If the schema cache is temporarily stale, wait briefly and retry. Deploy normally through GitHub/Vercel; keep all existing environment variables/R2/CORS settings.
2. Sign in. Create a Hotel with an existing/inline-created City; save optional brand/address/paired coordinates, general whole-star rating and Family/Business/Personal-Leisure recommendations. Verify duplicate detection and edits. Publish the Hotel when appropriate.
3. Create two Stays at that Hotel under a Trip. Leave dates/review empty for one; fill real optional fields for another. Try reversed dates, half stars and publishing under Draft Hotel/Trip: reject with preserved input. Confirm review and private notes are separate, and Hotel City is present in Trip Cities.
4. Import a small Nice/Record Hotel JPEG batch using Hotel context and a Stay. Verify Draft state, five existing R2 objects, private previews, exact-byte retry handling and Personal exclusion. Assign an existing Draft photo to Hotel/Stay in its editor. Publish only with Published Stay/Hotel/Trip; no Location needed. Test Featured restriction.
5. Signed out, visit `/stays`, Hotel, each Stay, Hotel Photo detail and Trip. Confirm Hotel appears once, dates/ratings/reviews are accurate, cover/Nice/Record separation and cross-links work. Hotel photos stay outside Trip Travel galleries. Empty/no-review/undated visits work without fake content.
6. Check desktop/tablet/mobile/320px, native image proportions, readable review/metadata, keyboard navigation and no horizontal overflow. Inspect network/HTML for no GPS/private notes/source paths; all normal public images are existing WebPs.
7. Try Draft Hotel/Stay and a wrong-Hotel Stay UUID: 404. Unpublish test Hotel, Stay or Trip and reload: dependent Stays/photos/image endpoints disappear; no cascade of stored flags. Restore intended states.
8. Delete an unreferenced test Stay/Hotel with confirmation; ensure parent/geography records remain. References block deletion. Delete a test Hotel Photo through Photos and confirm all five R2 objects disappear before its row; retry any surfaced partial failure. Pending imports must be resolved before deleting their Stay.

Limitations: recommendation ownership stays at Hotel as specified by the Bible; per-Stay recommendations would require an explicit later product decision. No explicit cover selector; covers use safe deterministic fallback. Offset pages can move during edits; images are uncached and already downloaded bytes cannot be revoked. Active/cleanup-required import assignments deliberately block Stay deletion until completed or successfully cleaned. Hosted migration/Auth/PostgREST/R2 acceptance is an owner step; local browser tests use synthetic database/Auth/image fixtures rather than real new Hotel data. No unresolved technical/product conflict.

The owner superseded the prior Map-first recommendation with Milestone 7 archive refinement below. Map has not begun.


## Milestone 7 — Found Along / archive refinement

Implemented locally after owner approval of the architecture assessment:

- FOUND ALONG identity, Photography and places by Alex Lim, licensed self-hosted Newsreader/Geist via next/font/local, FA utility icon, shared editorial type/spacing/rules across public routes, photography-first homepage and Trips/Singapore/Stays entry points. Admin styling remains separate. MAP/ABOUT retain existing disabled treatment.
- `/singapore`: ordinary code-SG geography, Featured/fallback Nice opening, paged Nice photography, published Places and distinct The Record. Travel-only filtering excludes Hotel photographs; no fake Trips, geographic seed records or new Home entity/flag. Global Photos and real Trip associations remain valid.
- Singapore Travel photos can publish without Trip. Singapore Hotel Stays can omit Trip; overseas equivalents still require it. Supplied Trip remains a publication parent. Row/geography guards, matching RLS and server-derived preflight preserve privacy. Nullable Trip links/selectors/queries handled throughout Photo/Stay context.
- Full-resolution JPEG ingestion up to 25 MiB / 80MP; tested 9520×6336. New non-upscaled WebPs 3200/1920/960/480, unchanged qualities and stripped metadata. Identical output dimensions reuse encoded bytes. Five UUID objects, source/checksum, Personal skip, duplicate protection and recoverable cleanup/deletion preserved.
- Technical derivative profile keeps older 2400/1600/600/300 objects accurately described; no old R2 object regeneration. Private sources and per-request public-image visibility/no-store/optimizer protection unchanged.
- New migration `20261002000100_found_along_home.sql`; existing migrations untouched. No hosted SQL, Cloudflare configuration, credentials or remote content writes performed. No new environment variables or package dependencies.

### Verification (2026-10-02)

| Check | Result |
| --- | --- |
| lint | Pass |
| typecheck | Pass |
| automated tests | Pass, 100/100 |
| database type-drift | Pass |
| production build | Pass; public content remains dynamic |
| production route smoke | Pass; includes Singapore, private guards/source rejection and no-store |
| responsive Chrome | Pass across ten populated public routes at 1440/768/390/320px, no overflow; Singapore empty state, keyboard skip link and isolated landscape/portrait/panorama proportions |

Browser verification uses disposable local migrated PostgreSQL and synthetic WebP responses. It does not prove hosted PostgREST/R2 deployment or real photographic Vercel resource capacity. Actual hosted M7 acceptance remains the owner step. The 60MP synthetic Sharp test verifies dimensions/metadata/derivatives without production bucket access.

### Material files

- New migration; generated `src/types/database.ts`; updated type generator to include the geography boolean RPC.
- `src/lib/data/public-{singapore,home}.ts` and `(public)/singapore/page.tsx`.
- Public layout/home/styles/metadata, `src/app/fonts.ts`, licensed font assets and `src/app/icon.svg`, shared Photograph/context-link components.
- Photo processing/model/ingestion messaging; public Photo/Stay/Recent query projections and nullable Trip handling.
- Photo server action/publication/schema validation; Photo/Stay admin forms/selectors/detail/list; safe validation messages.
- `tests/singapore.test.ts`, existing database/Photo/import regression assertions and anonymous transport adapter; production smoke script.
- Bible explicitly superseded rules, decisions/technical plan/status/R2 setup and README.

### Manual acceptance

1. Confirm M1–M6 migration history. Review/apply only `20261002000100_found_along_home.sql` manually, then deploy through GitHub/Vercel. Keep existing variables/bucket/CORS. Never run synthetic fixtures against hosted Supabase.
2. Create/select ordinary Country Singapore (code SG), City and real Locations. Publish a Travel Nice photo at a Published SG Location with no Trip; check `/singapore`, global Photos, Location and UUID detail. Add a real Published Trip/membership: it should appear in both contexts. A supplied Draft Trip must hide it.
3. Try publishing an overseas Location photo without Trip: reject. Test Draft Location/Photo exclusion and Featured + Record rejection. Unpublish a required parent; fresh public detail/image reads must return 404.
4. Create a Singapore Hotel Stay without Trip, publish only through Published Hotel/Stay and assign Hotel photography. Check Stays/Hotel/Photo routes and absence from `/singapore`. Overseas trip-less Stay must fail. Geography moves that invalidate existing home assignments must show an actionable error.
5. Import one genuine full-resolution JPEG under 25 MiB/80MP before a small batch. Compare source hash, four derivative dimensions/orientation/GPS removal, profile 2 and previews. Check old Photos still work at legacy profile 1. Oversized/Personal files must never upload. Exercise existing retry/deletion checks.
6. Inspect desktop/tablet/mobile/320px masthead, nav, portrait/landscape/panorama, metadata and review text. Check keyboard navigation, no overflow and no GPS/private notes/source/credential leakage.

Known limits: real high-entropy full-resolution processing on the actual Vercel plan still requires measurement; JPEGs above 25 MiB remain rejected. Older derivatives are retained rather than silently regenerated. Location counts, explicit cover selection, Map, Search and About content remain deferred. Offset pagination/no shared cache remain existing tradeoffs. No additional unresolved product decision. Recommend next: owner acceptance and bounded performance/accessibility refinement before selecting the next discovery feature; do not automatically start Map/Search.
