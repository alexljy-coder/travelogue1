# Implementation status

Milestone 1: local project foundation and hosted verification complete. Hosted verification was confirmed by the owner on 2026-09-30. Milestone 2 has not started.

## Implemented

- Entire Build Bible read; product source unchanged. Owner's eight resolved decisions recorded before implementation.
- One TypeScript/Next.js App Router application with a minimal public placeholder and dynamic /admin/login + protected /admin shell.
- Supabase environment validation and separate cookie-free public/session server clients. No privileged API key, browser Auth client, signup route or development bypass.
- Password sign-in, validated session + singleton administrator check, sign-out and admin-only session-refresh proxy. HttpOnly/SameSite cookies, Secure in production; private/no-store admin responses. Protected layout/page/action independently enforce authorization.
- One atomic versioned migration: 20260930000100_v1_foundation.sql. Creates all ten archive tables plus private single-admin identity, date/rating/context/assignment/readiness/Featured constraints, RESTRICT relationships, timestamps, indexes, grants and RLS.
- Photo IDs rather than slugs; optional editorial ordering; distinct public review/private internal notes; preserved GPS excluded from public columns.
- Parent-aware anonymous reads and column privacy; authenticated archive access requires the singleton administrator. Unrelated authenticated users receive zero rows and cannot mutate. Private identity cannot be browser-managed.
- Typed publishing/cover eligibility preflight helpers for future workflows; no publishing endpoint or UI yet.
- Generated Supabase-compatible table/relationship types from migrated PostgreSQL catalog and drift-check script.
- 24 automated tests, including real embedded PostgreSQL constraints/grants/RLS under anon/admin/unrelated-user roles and app authorization/validation behavior.
- Production-server smoke checks with missing/synthetic configuration, admin redirects, cache/privacy headers and absent signup/register routes.
- Exact dependency pins/lockfile, Node 24/pnpm tooling, lint/typecheck/build scripts, CI workflow and local Supabase config with signup disabled.
- Setup guide explaining hosted migration/account provisioning and smoke checks. .env.example contains only the two public variable names with empty values; no R2 credentials or secrets added.
- Hosted verification complete, as confirmed by the owner: the Supabase migration was applied successfully, the singleton administrator was provisioned, local authentication was verified, and the Vercel deployment was successfully tested against hosted Supabase.

Verification run on 2026-09-30:

| Check | Result |
| --- | --- |
| pnpm lint | Pass |
| pnpm typecheck | Pass; generates Next route types first |
| pnpm test | Pass, 24/24 |
| pnpm db:types:check | Pass |
| pnpm peers check | Pass, no peer dependency issues |
| pnpm build | Pass; / static, /admin and /admin/login dynamic |
| pnpm test:smoke | Pass; both missing-config and configured/no-session scenarios |
| Build Bible Git diff | No changes |

## In Progress

- None. Milestone 1 is complete; Milestone 2 has not started.

## Not Started

- Milestone 2: Trip/City/Location workflow, CRUD and transactional membership handling.
- Hotel/Stay management, publishing UI, Photos/detail/gallery, Featured/cover controls and ordering UI.
- R2 integration, derivatives, browser importer, EXIF extraction and import history UI.
- Map, home/About/editorial design, broader responsive/performance/accessibility work and final release checks.

## Known Issues

- Embedded PostgreSQL uses test-only Auth objects, and automated production smoke tests use synthetic configuration. Hosted verification completion is recorded from the owner's confirmation; no additional remote checks were performed during this status update.
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
