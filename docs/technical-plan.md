# V1 technical plan

Milestone 1 implements the local application, database and authentication foundation. Hosted setup remains an explicit operator step. Product authority: [buildbible.md](./buildbible.md), read in full; it is unchanged. Owner resolutions and implementation decisions: [decisions.md](./decisions.md).

## 1. Repository and infrastructure

Initially this repository contained only the Build Bible and Git metadata. Milestone 1 adds a TypeScript Next.js App Router application, a versioned SQL migration, generated database types, security tests and setup documentation. Git checks now use the available bundled Git runtime; no tracked changes to the Build Bible were made.

GitHub/Vercel/Supabase/R2 resources are user-reported. No hosted database, Auth settings, account, Vercel deployment or R2 configuration has been inspected or changed: no project connection is available. Inspect existing Supabase objects/history before applying the migration. [supabase-setup.md](./supabase-setup.md) gives exact steps. No R2 credentials are needed in Milestones 0–2.

## 2. Review and resolved decisions

No fundamental stack/product conflict was found. Resolutions:

- Photo URLs are `/photos/[id]`; no Photo slug column. Hotel aggregate uses `/stays/[hotelSlug]`, individual visit `/stays/[hotelSlug]/[stayId]`. Those pages are deferred.
- Required unpublished parents hide stored Published children through RLS; no cascades of publication flags. Future publish actions use database-derived parent snapshots for preflight.
- Featured requires Published + Nice. Trip covers additionally require Travel and that Trip; Hotel/Stay cover photography requires Hotel context and the matching Hotel/Stay. Location covers use matching Travel photos. Foreign keys prevent dangling covers; application selection/preflight enforces editorial eligibility and public queries must resolve effective visibility.
- Optional editorial_order exists on Photos/Trips/Locations/Hotels/Stays; join sequence remains optional. Future ordering: explicit value first, then captured_at DESC NULLS LAST for photos, then created_at DESC/id for deterministic ties. No ordering UI now.
- Stay purpose is Business/Leisure/Family/Mixed, optional; Trip also permits Photography.
- stays.internal_notes is private and separate from public review_text. Photo GPS is preserved but excluded from public column grants and all public projections. Public geographic positions come from Locations/Hotels.
- Countries/Cities retain no artificial publication states; only geography reachable from published content is anonymous-readable.
- Trip-City membership remains explicit. Future Location/Stay association workflows must add corresponding trip_cities transactionally, without inventing sequence.
- Dates and EXIF remain optional. No date-containment enforcement, invented timezone, inferred city radius, invented destination, AI captions, Story or Review entity.

Remaining implementation risks, not reasons to alter the product: browser folder traversal/classification fallback; Vercel resources for one-photo derivative processing; map library/tile-provider choice; cache withdrawal semantics. Verify them at their milestones.

## 3. Architecture and actual dependencies

One Next.js application on Vercel contains public routes, /admin, server actions and future bounded route handlers. Supabase holds relational metadata/Auth/RLS; Cloudflare provides DNS/network controls and later private R2 object storage; GitHub versions code/migrations; Lightroom owns photographic masters. No separate backend, ORM, CMS, Redux, GraphQL or microservices.

Pinned dependencies: Next.js 16.3.6, React 19.3.0, supabase-js 2.117.2, @supabase/ssr 0.12.7, Zod 4.6.5. Node.js 24, pnpm 11.19.0 and pnpm-lock.yaml replace the initial npm proposal because the available local runtime supplies pnpm. Next was initialized manually using its documented installation path, avoiding generator boilerplate/unrequested UI. TypeScript 5.9.3 and ESLint 9.39.5 match the current Next lint-plugin peer ranges. ESLint 9 emits an upstream support/deprecation notice; compatibility is recorded rather than ignored. Reassess when Next's lint dependency stack supports ESLint 10. Dependencies are exact-pinned; no release-age checks were disabled. Native test/lint installation scripts are explicitly allowed in pnpm-workspace.yaml.

Use server components for public rendering, server-side form actions for login/logout and a small client login form for pending/error state. No browser Auth client is needed now: auth cookies are HttpOnly, Secure in production, SameSite=Lax. A future importer uses same-origin authenticated server endpoints; revisit cookie strategy explicitly before adding client-side Auth. No privileged service key in the application.

Public database clients never inherit administrator cookies and fetch no-store. Admin clients use validated session cookies and no-store requests. Next.js 16 proxy refreshes sessions only under /admin; protected page/layout and sign-out independently call requireAdmin. getUser validates identity with Auth; is_admin RPC independently verifies the private singleton. An unconfigured project fails closed, while the public placeholder still builds without secrets. Default Server Action origin checks remain intact; no wildcard origins configured.

Public caching is deferred until publishing/UI exists and privacy checks pass. Adopt the pinned Next release's documented cache APIs then; invalidate related parent/detail/index/map/media paths after changes. Never cache authenticated data or draft previews. Initially visibility-checked media responses also avoid shared caching. No custom caching system.

## 4. Implemented schema specification

The authoritative executable implementation is [20260930000100_v1_foundation.sql](../supabase/migrations/20260930000100_v1_foundation.sql). It creates schema, constraints, grants and RLS atomically, rather than exposing a partially secured schema between migrations. It has not been applied remotely.

| Table | Representation |
| --- | --- |
| countries | UUID, required nonblank name, unique uppercase two-letter code and URL-safe slug, created_at |
| cities | Required Country; required name; slug unique within Country; nullable representative latitude/longitude; created_at |
| locations | Required City; name and globally unique slug; optional coordinates/description/cover Photo; Draft/Published; optional editorial_order; timestamps |
| trips | Required title and globally unique slug; optional independent start/end dates, purpose, description, cover Photo; Draft/Published; editorial_order; timestamps |
| trip_cities | Composite primary key Trip/City; nullable nonnegative sequence |
| trip_locations | Composite primary key Trip/Location; nullable sequence and visited_at calendar date |
| hotels | Independent persistent property, never a Location; required City/name/unique slug; optional brand/address/coordinates/description/whole rating; recommendation flags; status/order/timestamps |
| stays | Required Hotel and Trip; optional independent check-in/out dates, room type, purpose, whole rating, public review_text and private internal_notes; status/order/timestamps; repeated Hotel/Trip pair allowed |
| photos | UUID URL identity; required source filename/storage prefix/SHA-256 hash/dimensions/byte size/classification/context; caption/description; Featured/status/order; optional assignments; optional EXIF; import-batch link; processing readiness; timestamps. No slug |
| import_batches | Simple private import counts/history and pending/processing/completed/failed state; no reconciliation/version management |
| private.admin_identity | Singleton row with FK to auth.users; no exposed schema or browser-editable identity |

UUIDs default to gen_random_uuid(). created_at defaults to now(); mutable entities use a small shared updated_at trigger. Human-readable entity slugs are lowercase hyphenated text; no sequential public IDs. Finite state values use text CHECK constraints. Whole ratings are smallint 1–5. Optional dates compare only when both present; either endpoint may be null. A known Stay date outside entered Trip dates is not forbidden. Coordinates are paired or both null and range checked. Photo focal length/aperture/ISO are positive if supplied. captured_at is an offset-free local timestamp; captured_at_offset_minutes records only a known offset (-840..840). Shutter fractions are text. Hashes are indexed, not unique: no duplicate reconciliation feature.

Photo shape is constrained even for Draft rows:

- Travel has no Stay. Trip/Location may be incomplete while Draft.
- Hotel has no direct Trip or Location; derive through its Stay. Stay may be missing while Draft.
- Published Travel requires Trip + Location; Published Hotel requires Stay.
- Composite FK (trip_id,location_id) references trip_locations. MATCH SIMPLE permits incomplete Draft assignment, but a supplied pair must be a real membership.
- Published requires processing_status = ready; pending/ready/failed is technical readiness, distinct from editorial status.
- Featured requires Published + Nice. Demotion must clear Featured in the same update.
- Personal is not a valid database classification. Future importer must exclude Personal before reading/uploading bytes; the schema alone cannot recognize photographic content.

RESTRICT FKs protect entities, joins and covered Photos from accidental deletion. Explicit dependency handling is required; unpublish is preferred to destructive removal. No deletion touches Lightroom. Nullable Trip/Location cover FKs are added after Photos to resolve creation-order cycles. Hotel/Stay cover photography will be selected from eligible associated Photos; no extra cover columns are invented now.

FK/reverse join indexes support relationships. Composite photo indexes cover Trip/Location/Stay plus status/classification; Stay indexes cover Hotel/Trip plus status. No manually persisted travel counts/days/review totals. Hotel rating is independent of Stay ratings; no auto-average. No PostGIS or separate map database.

Generated src/types/database.ts comes from the freshly migrated PostgreSQL catalog and includes FK relationship types. A committed generator and drift check avoid needing Docker or hosted secrets; deployed-schema comparison remains a later setup verification.

## 5. Publishing enforcement

Database constraints guarantee valid row shapes, assignment requirements, Trip–Location membership, enums, ranges and readiness. Small application validation helpers provide parent preflight and Trip/Location/Hotel/Stay cover eligibility, with tests. No publishing endpoint/UI exists yet, so these helpers are preparation rather than a claimed live publishing workflow. Later callers must fetch statuses/relationships from the database, not accept them from browser input.

RLS independently prevents publication races or direct API writes from exposing children below Draft required parents. Unpublishing a Trip hides its Travel photos and Stays/Hotel photos. Unpublishing a Hotel or Stay hides the corresponding Hotel photos. Unpublishing a Location hides its Travel photos. Stored child flags remain unchanged. A stale cover pointer never grants Photo visibility: public resolution must query through anonymous RLS.

Future gallery predicates:

- Main Photos: effectively visible Nice, with editorial ordering.
- Trip/Location galleries: Travel + Nice for the matching relationships.
- Trip The Record: Travel + Record. Hotel photos remain in Stay/Hotel records, not the Trip gallery.
- Hotel/Stay photography: Hotel context through Stay; Record may appear in relevant records.
- Featured additionally requires effective visibility; status alone never bypasses parent privacy.
- Counts and related links include only effectively visible records.

## 6. Authentication, privileges and RLS

Hosted signup must be disabled and one administrator deliberately provisioned. Local supabase/config.toml disables signup, but is not a hosted settings change. No signup UI, public accounts, role hierarchy or service-role CRUD. Setup instructions describe remote Auth/password/redirect configuration and identity provisioning.

private.admin_identity permits one true singleton row with an actual auth.users UUID. No rows means no admin. public.is_admin() is a narrow security-definer boolean helper with empty search_path and qualified relations; default PUBLIC/anon execution is revoked, authenticated execution allowed. Browser users cannot edit the identity table. No editable metadata or email-based authorization.

Every archive table has RLS enabled, default PUBLIC/anon/authenticated privileges revoked, explicit anonymous safe-column SELECT grants, and separate authenticated admin SELECT/INSERT/UPDATE/DELETE policies. INSERT uses WITH CHECK, UPDATE both USING/WITH CHECK, DELETE USING. Unrelated authenticated sessions receive **zero archive rows**, not a public row policy with full-column privileges. This intentionally refines the initial “at most public reads” proposal to prevent GPS/internal-note leaks. Public pages use an anonymous client regardless of browser sign-in.

| Anonymous table visibility | Rule |
| --- | --- |
| trips, locations, hotels | Own status Published |
| stays | Published + visible Trip + visible Hotel |
| photos | Published + ready + visible Trip/Location for Travel, or visible Stay for Hotel |
| trip_locations | Visible Trip and Location |
| trip_cities | Visible Trip |
| cities | Reachable from visible Location/Hotel/trip_cities |
| countries | Reachable from visible City |
| import_batches | No access |

Policies form a one-way dependency graph, avoiding recursive RLS: base Trip/Location/Hotel → Stay → Photo; joins → base parents; City → Location/Hotel/trip_cities; Country → City. Parent base policies do not query geography. Anonymous column grants omit exact photo GPS, offsets, source names/keys/hashes/import metadata/processing state and Stay internal_notes. There are no owner-bypassing public views. Explicit public projection constants support future reads; SELECT * intentionally fails for anonymously restricted tables.

Embedded PostgreSQL tests exercise actual grants/RLS/constraints as owner-admin, unrelated authenticated user and anon, including direct lookups, joins, parent unpublish, private-column attempts and mutations. The test Auth schema is only a harness; hosted JWT verification, PostgREST, login/session refresh and signup configuration still require remote smoke checks. No development bypass exists.

## 7. Application structure

Implemented:

```text
src/app/layout.tsx, globals.css
src/app/(public)/page.tsx                 # minimal placeholder only
src/app/admin/login/{page,login-form}.tsx # private sign-in
src/app/admin/login/actions.ts
src/app/admin/(protected)/{layout,page}.tsx
src/app/admin/(protected)/actions.ts     # independently guarded sign-out
src/proxy.ts                            # admin-only session refresh/no-store
src/lib/supabase/{env,public,server}.ts
src/lib/auth/{check-admin,require-admin}.ts
src/lib/validation/{login,publishing}.ts
src/lib/data/public-columns.ts
src/types/database.ts
supabase/{config.toml,migrations/,tests/}
tests/, scripts/, docs/
.github/workflows/checks.yml
```

Future routes remain unimplemented: Photos/[id], Trips/[slug], Locations/[slug], Stays/[hotelSlug]/[stayId], Map, About and content-management admin sections. Do not create unused placeholder feature trees. Future importer/media handlers stay inside this application. Future image processing uses Node.js/Sharp, not Edge runtime. Choose a map library/tile provider at the map milestone, considering attribution, cost and privacy. Branding/domain remain replaceable configuration.

## 8. Future importer/R2 — deferred

No credentials, SDKs, CORS configuration, bucket changes, uploads or derivatives now. Later:

1. Scan retained folder paths; skip Personal before reading image bytes/EXIF/hashes. Unclassified bare files need explicit Nice/Record assignment. Use a folder-picker fallback where needed.
2. Extract eligible JPEG metadata. Suggestions prioritize existing Locations/GPS proximity/date/time/selected Trip; never auto-decide Hotel context, invent destinations or publish automatically.
3. Authenticated server generates UUID/object namespace and short-lived object-scoped PUT signature; browser uploads directly to private R2. Server-scoped credentials and narrow bucket permissions never enter browser/Git. CORS restricts actual approved origins/methods; it is not authorization.
4. Verify actual JPEG bytes/type/size/dimensions/orientation/hash, not just client metadata. Export target is 4000px long-edge sRGB JPEG, quality 88; Lightroom retains RAW/masters. Handle incompatible files explicitly rather than rewriting photographic truth.
5. Process one photo per bounded idempotent Node/Sharp request. Produce aspect-preserving WebP long edges approximately 2400/1600/600/300, without upscaling. Prefix photos/<uuid-first-two>/<uuid>/ derives source.jpg, large.webp, medium.webp, thumbnail.webp and tiny.webp; store one prefix, not five URLs.
6. Mark ready only after validated source/all derivatives exist; imports remain Draft until reviewed. Processing retries are technical recovery, not photo version/replacement reconciliation. Conservative explicit orphan cleanup.
7. Verify ten-photo batch on actual Vercel plan. If single-photo processing cannot fit runtime/memory limits, document a real technical conflict before adding a processing service.

Keep sources and derivatives private, including Drafts. Same-app media delivery looks up effective visibility before streaming server-authenticated R2 bytes. Draft previews require admin and no-store. Short-lived signed GETs have expiry/withdrawal tradeoffs; streaming is the initial preference. No public r2.dev or random-key privacy scheme. No shared media caching until explicit withdrawal/cache tests exist; downloaded images cannot be recalled. Responsive delivery uses existing derivatives, avoiding redundant on-demand transformations.

Future R2 environment names are documented only: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Add empty .env.example entries when that milestone begins, not now.

## 9. Implementation milestones

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| 0 — Complete | Review/planning | Bible unchanged; open decisions explicitly recorded |
| 1 — Local foundation implemented | Shell, schema/constraints/RLS, single-admin login/shell, security tests/types/CI | Lint/typecheck/tests/build; fresh migration and privacy tests. Hosted migration/account/signups/preview smoke steps separately required |
| 2 — Trip/Location workflow | Country/City selection, Trip and Location CRUD, transactional joins, optional dates/status | Create undated Trip and Location, associate/edit; rejected unsafe deletion; Drafts private. No R2 |
| 3 — Ten-photo import/storage | Connect R2 then, eligible folder scanning, private uploads, derivatives, Draft assignment/history | ~10 JPEGs; Personal zero-byte reads/uploads; orientation/aspect/unknown EXIF; retry/failure privacy |
| 4 — First meaningful vertical slice | Review/publish + minimal public Trip | Create Trip → Location → associate → import ~10 JPEGs → assign → publish → public Trip. Nice/Record/Personal and anon/API/media/unpublish tests |
| 5 — Hotel/Stay workflows | Repeat Stays, optional reviews/dates, Hotel photos, public aggregate/detail | Two Stays on one Hotel; no artificial Location or Hotel images in Trip galleries; privacy/correct counts |
| 6 — Importer refinement | Existing-Location suggestions/grouping/batch exceptions | No invented context/entity/publication; uncertain assignments Draft; browser compatibility |
| 7 — Photography/geographic discovery | Photos/detail/Location, editorial masonry, Featured/covers/responsive delivery | Record excluded from main Photos; native proportions; context navigation; privacy/cache invalidation |
| 8 — Remaining V1 site | Indices/refinements, home/About, Map V1, responsive visual direction | Published pins/clustering; no Phase 2; approved branding/typography |
| 9 — Release verification | Accessibility/security/performance/backup/recovery | No draft leaks via API/images/caches; deployed slice; verified backup/forward migration procedure |

Stop after the requested milestone. Meaningful tests focus on security/constraints/privacy/import recovery/end-to-end behavior, not trivial presentation snapshots. Synthetic fixtures never run on production. Do not reset existing remote data or deploy unreviewed migrations.

## 10. Primary technical references

- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) confirms Node.js 24 support.
- [Next.js manual installation](https://nextjs.org/docs/app/getting-started/installation) and [Next.js 16 proxy](https://nextjs.org/docs/app/getting-started/proxy).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [SSR cache safety](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase security-invoker views](https://supabase.com/docs/guides/database/views), should views later be needed.
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [public bucket exposure](https://developers.cloudflare.com/r2/buckets/public-buckets/) and [CORS](https://developers.cloudflare.com/r2/buckets/cors/).
