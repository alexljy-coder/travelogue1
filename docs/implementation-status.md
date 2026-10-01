# Implementation status

Milestones 1–2 foundation/content workflows and hosted verification are complete per the owner. Milestone 3 private photo ingestion/admin implementation and local verification complete on 2026-10-01; controlled hosted R2/Supabase/Vercel verification remains pending. Milestone 4 has not started.

## Implemented

- Entire Build Bible read; product source unchanged. Owner's eight resolved decisions recorded before implementation.
- One TypeScript/Next.js App Router application with a minimal public placeholder and dynamic /admin/login + protected /admin shell.
- Supabase environment validation and separate cookie-free public/session server clients. No privileged API key, browser Auth client, signup route or development bypass.
- Password sign-in, validated session + singleton administrator check, sign-out and admin-only session-refresh proxy. HttpOnly/SameSite cookies, Secure in production; private/no-store admin responses. Protected layout/page/action independently enforce authorization.
- One atomic versioned migration: 20260930000100_v1_foundation.sql. Creates all ten archive tables plus private single-admin identity, date/rating/context/assignment/readiness/Featured constraints, RESTRICT relationships, timestamps, indexes, grants and RLS.
- Photo IDs rather than slugs; optional editorial ordering; distinct public review/private internal notes; preserved GPS excluded from public columns.
- Parent-aware anonymous reads and column privacy; authenticated archive access requires the singleton administrator. Unrelated authenticated users receive zero rows and cannot mutate. Private identity cannot be browser-managed.
- Typed publishing/cover eligibility preflight helpers for future photo/Stay workflows; Trip/Location status can now be edited in admin.
- Generated Supabase-compatible table/relationship types from migrated PostgreSQL catalog and drift-check script.
- 58 automated tests, including real embedded PostgreSQL RPCs/constraints/grants/RLS, Sharp JPEG/WebP/EXIF processing, authenticated API boundaries and fake-R2 failure/retry/deletion scenarios. No production bucket access.
- Production-server smoke checks against the build's actual configuration, all admin route guards, private image/storage endpoints, unauthorized upload operations, cache/privacy headers and absent registration/public Photo/Trip routes. Missing configuration is separately covered by unit tests.
- Exact dependency pins/lockfile, Node 24/pnpm tooling, lint/typecheck/build scripts, CI workflow and local Supabase config with signup disabled.
- Setup guides explaining hosted Auth/migrations and private R2 credentials/CORS/controlled testing. .env.example contains empty variable names only; no real credentials committed.
- Hosted verification complete, as confirmed by the owner: the Supabase migration was applied successfully, the singleton administrator was provisioned, local authentication was verified, and the Vercel deployment was successfully tested against hosted Supabase.
- Admin Dashboard/Trips/Locations navigation; paginated lists, create/edit forms, optional historical dates, purpose/description/status and optional numeric editorial ordering.
- Inline Country/City creation and existing City selection, editable slug suggestions, optional manual coordinates and matching-identity reuse.
- Trip–City and Trip–Location membership management with optional sequence/visited_at. New Location creation can attach directly to a Trip; shared Location City edits maintain related Trip geography atomically.
- Safe confirmed deletion: Trip/joins only, preserving Countries/Cities/Locations; Photos/Stays block Trip deletion, and references block Location deletion or used membership removal.
- Milestone 2 migration 20260930000200_admin_geography_workflow.sql: seven narrow invoker-rights transaction functions. Applied and manually verified against hosted Supabase per the owner's Milestone 3 instruction.
- Clear field errors with preserved input, useful empty states and deferred cover selection. No public Trip/Photo, Hotel/Stay or Map features added.
- Private Travel photo browser ingestion: ten eligible JPEGs per batch, folder classification, Personal exclusion before byte reads, explicit loose-file fallback/confirmation, source SHA-256 and per-photo results/retry.
- Server-side S3 SDK/credentials with a two-minute single-part upload capability, server-only multipart completion/abort, source-byte/hash/dimension verification, EXIF extraction and four metadata-free non-upscaled WebPs. UUID storage keys; source retained unchanged.
- Photos admin navigation/list/import/detail/edit, secure no-store previews/source download, private GPS display, Trip/Location assignment and publication/Featured validation using existing parent/membership rules.
- New migration 20261001000100_private_photo_ingestion.sql: admin-only import_items operation/recovery ledger and ten invoker-rights RPCs. Existing Photo model, public privacy/RLS and applied migrations unchanged. This new migration has not been applied remotely by the agent.
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

- Milestone 3 hosted verification: owner creates scoped R2 credentials/CORS, applies only the new migration, configures local/Vercel variables and performs the controlled approximately-ten-photo procedure in r2-setup.md. No remote mutations or real Lightroom imports were performed by the agent.

## Not Started

- Milestone 4: first public Trip vertical slice with effective-visible derivative delivery, Nice/Record separation and unpublish/privacy verification.
- Public Photos/detail/gallery, Hotel/Stay management, cover selection and drag-and-drop ordering UI.
- Importer refinements, grouping/suggestions and broader browser/performance work. Re-import/replacement remains Phase 2.
- Map, home/About/editorial design, broader responsive/performance/accessibility work and final release checks.

## Known Issues

- Embedded PostgreSQL uses test-only Auth objects; R2 storage is faked in automated pipeline tests. Production smoke checks reject unauthenticated requests but do not prove hosted PostgREST/CORS/SDK transport or authenticated browser import. Milestones 1–2 hosted verification are owner-reported; Milestone 3's hosted proof is pending.
- Apply only 20261001000100_private_photo_ingestion.sql and configure R2 before import. Do not rerun/reset the applied foundation or geography migration. If using the SQL editor, execute the new file once and reconcile CLI history before future CLI pushes.
- Folder picker preserves paths where supported. Loose-file drag/drop requires explicit Nice/Record and Personal-exclusion confirmation; lost classification cannot be inferred. Recursive dropped-directory traversal is deferred. Exact-byte duplicates are reused, not replaced; different exports of the same image are not reconciled.
- Source limit: ten eligible JPEGs, 25 MiB/file, 4000px/16 megapixels, sequential bounded processing. The actual Vercel plan's CPU/memory/runtime and authenticated source streaming need empirical verification. Export quality/sharpening and untagged source profile are not retrospectively verifiable. No automatic orphan sweeper/background recovery is introduced; hard interruptions retain traceable state for manual cleanup after lease expiry.
- Next's current lint dependencies require ESLint 9/TypeScript <6.1; ESLint 9.39.5 emits an upstream support/deprecation warning. Peer-compatible versions are pinned; review a compatible tooling upgrade when available. This is a development-tooling limitation, not a security bypass.
- Cover relationship eligibility is application-level, with tested helpers but no live mutation workflow. Future cover selectors/public queries must use the helpers and resolve anonymous effective Photo visibility.
- Map/tile selection and public media/cache withdrawal remain deferred. No unresolved product decision or Build Bible conflict was found.

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

Recommend Milestone 4 only after the controlled hosted proof succeeds. Milestone 4 has not begun.

## Milestone 2 manual acceptance checks

1. Apply the new migration, deploy and sign in as the singleton administrator. Verify Dashboard, Trips and Locations navigation.
2. Create a Draft Trip with dates/purpose empty; refresh to confirm persistence. Edit a single date endpoint, then try a reversed range and check the error and preserved input. Save a valid edit and Published/Draft changes.
3. Inline-create a Country (name, two-letter code, URL name) and City, then add the selected City to the Trip. Repeat matching creation to verify reuse. Select an existing Country/City; add a second City with optional position.
4. Create a Location from the Trip, using a City and optional paired coordinates. Confirm the Location and City associations persist. Edit Location and Trip fields. A single coordinate should show a validation error.
5. Create another Trip and attach the same Location. Edit the Location's City and verify both Trips gain the new City while old membership remains. Save/clear optional position and visit date; no chronology is required.
6. Try removing a City still used by a Location: it must fail. Remove the Location association, then the unused City association; underlying records remain.
7. Verify Location deletion is blocked while associated. Delete an unreferenced test Location with confirmation. Delete a test Trip with confirmation; its Locations/Cities/Countries remain. Photo/Stay references must block deletion (automated fixture coverage now; browser check when those records exist).
8. Sign out and visit every admin list/new/edit URL directly: redirect to login. An unrelated Auth account must receive forbidden access. No signup route is available.
