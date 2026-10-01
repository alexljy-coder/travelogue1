# Implementation status

Milestone 1 foundation and hosted verification complete (owner-confirmed 2026-09-30). Milestone 2 implementation and local verification complete on 2026-10-01; its new migration and authenticated browser workflow still require hosted verification. Milestone 3 has not started.

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
- 37 automated tests, including real embedded PostgreSQL constraints/grants/RLS under anon/admin/unrelated-user roles, transactional content workflows and application validation.
- Production-server smoke checks against the build's actual configuration, all admin route guards, cache/privacy headers and absent registration/public Trip routes. Missing configuration is separately covered by unit tests.
- Exact dependency pins/lockfile, Node 24/pnpm tooling, lint/typecheck/build scripts, CI workflow and local Supabase config with signup disabled.
- Setup guide explaining hosted migration/account provisioning and smoke checks. .env.example contains only the two public variable names with empty values; no R2 credentials or secrets added.
- Hosted verification complete, as confirmed by the owner: the Supabase migration was applied successfully, the singleton administrator was provisioned, local authentication was verified, and the Vercel deployment was successfully tested against hosted Supabase.
- Admin Dashboard/Trips/Locations navigation; paginated lists, create/edit forms, optional historical dates, purpose/description/status and optional numeric editorial ordering.
- Inline Country/City creation and existing City selection, editable slug suggestions, optional manual coordinates and matching-identity reuse.
- Trip–City and Trip–Location membership management with optional sequence/visited_at. New Location creation can attach directly to a Trip; shared Location City edits maintain related Trip geography atomically.
- Safe confirmed deletion: Trip/joins only, preserving Countries/Cities/Locations; Photos/Stays block Trip deletion, and references block Location deletion or used membership removal.
- New migration 20260930000200_admin_geography_workflow.sql: seven narrow invoker-rights, authenticated singleton-admin transaction functions. Existing foundation migration and RLS unchanged. Not applied to hosted Supabase by this agent.
- Clear field errors with preserved input, useful empty states and deferred cover selection. No photo/R2/public Trip/Hotel/Stay/Map features added.

Milestone 2 verification run on 2026-10-01:

| Check | Result |
| --- | --- |
| pnpm lint | Pass |
| pnpm typecheck | Pass; generates Next route types first |
| pnpm test | Pass, 37/37 |
| pnpm db:types:check | Pass |
| pnpm build | Pass; public placeholder static, all admin routes dynamic |
| pnpm test:smoke | Pass; configured/no-session local production build, all six new admin routes guarded |
| Build Bible Git diff | No changes |

## In Progress

- Milestone 2 hosted verification: review/apply the new migration, deploy, then complete the authenticated manual workflow below. No remote database writes or authenticated browser CRUD were performed by the agent.

## Not Started

- Milestone 3: private ten-photo import/storage slice (requires R2 setup then).
- Hotel/Stay management, photo publication/review UI, Photos/detail/gallery, Featured/cover controls and drag-and-drop ordering UI.
- R2 integration, derivatives, browser importer, EXIF extraction and import history UI.
- Map, home/About/editorial design, broader responsive/performance/accessibility work and final release checks.

## Known Issues

- Embedded PostgreSQL uses test-only Auth objects. Production smoke checks exercise unauthenticated routes, not hosted PostgREST transactions or authenticated browser forms. Milestone 1 hosted verification is owner-confirmed; Milestone 2 hosted verification remains required.
- Apply 20260930000200_admin_geography_workflow.sql before using the new workflows. It adds functions only; no new environment variables or credentials. Do not reapply/reset the already-applied foundation migration. Review pending migration history using the existing setup process before pushing the new migration; alternatively execute this new SQL file once in the hosted SQL editor and reconcile CLI migration history before future CLI pushes.
- Next's current lint dependencies require ESLint 9/TypeScript <6.1; ESLint 9.39.5 emits an upstream support/deprecation warning. Peer-compatible versions are pinned; review a compatible tooling upgrade when available. This is a development-tooling limitation, not a security bypass.
- Cover relationship eligibility is application-level, with tested helpers but no live mutation workflow. Future cover selectors/public queries must use the helpers and resolve anonymous effective Photo visibility.
- Future importer browser support and Vercel processing resources need empirical testing; map/tile selection remains deferred. There is no new product blocker or Build Bible conflict.

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

## Milestone 2 manual acceptance checks

1. Apply the new migration, deploy and sign in as the singleton administrator. Verify Dashboard, Trips and Locations navigation.
2. Create a Draft Trip with dates/purpose empty; refresh to confirm persistence. Edit a single date endpoint, then try a reversed range and check the error and preserved input. Save a valid edit and Published/Draft changes.
3. Inline-create a Country (name, two-letter code, URL name) and City, then add the selected City to the Trip. Repeat matching creation to verify reuse. Select an existing Country/City; add a second City with optional position.
4. Create a Location from the Trip, using a City and optional paired coordinates. Confirm the Location and City associations persist. Edit Location and Trip fields. A single coordinate should show a validation error.
5. Create another Trip and attach the same Location. Edit the Location's City and verify both Trips gain the new City while old membership remains. Save/clear optional position and visit date; no chronology is required.
6. Try removing a City still used by a Location: it must fail. Remove the Location association, then the unused City association; underlying records remain.
7. Verify Location deletion is blocked while associated. Delete an unreferenced test Location with confirmation. Delete a test Trip with confirmation; its Locations/Cities/Countries remain. Photo/Stay references must block deletion (automated fixture coverage now; browser check when those records exist).
8. Sign out and visit every admin list/new/edit URL directly: redirect to login. An unrelated Auth account must receive forbidden access. No signup route is available.
