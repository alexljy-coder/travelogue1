Current architecture is §16; earlier milestone sections document their historical state.

# V1 technical plan

Milestones 1–2 implement the foundation and Trip/Location workflow; hosted verification is complete per the owner's instructions. Milestone 3 private photo ingestion has been manually verified locally and on Vercel against hosted Supabase/R2, as confirmed by the owner. Milestone 4 public photography is deployed and manually accepted on Vercel per the owner. Milestone 5 public Trips and Places is deployed and accepted per the owner. Milestone 6 adds the Hotel/Stay branch end-to-end. Product authority: [buildbible.md](./buildbible.md), read in full; only owner-approved M7 superseding rules are updated. Owner resolutions and implementation decisions: [decisions.md](./decisions.md).

## 1. Repository and infrastructure

Initially this repository contained only the Build Bible and Git metadata. Milestone 1 adds a TypeScript Next.js App Router application, a versioned SQL migration, generated database types, security tests and setup documentation. Git checks now use the available bundled Git runtime; no tracked changes to the Build Bible were made.

GitHub/Vercel/Supabase/R2 resources and Milestones 1–5 hosted verification/acceptance are owner-reported. The agent has not modified remote infrastructure. Inspect existing Supabase migration history before applying any new migration. [supabase-setup.md](./supabase-setup.md) describes the foundation; [r2-setup.md](./r2-setup.md) describes Milestone 3 credentials/CORS/migration/manual testing. R2 credentials first become necessary in Milestone 3.

## 2. Review and resolved decisions

No fundamental stack/product conflict was found. Resolutions:

- Photo URLs are `/photos/[id]`; no Photo slug column. Hotel aggregate uses `/stays/[hotelSlug]`, individual visit `/stays/[hotelSlug]/[stayId]`. Those pages are implemented in Milestone 6.
- Required unpublished parents hide stored Published children through RLS; no cascades of publication flags. Future publish actions use database-derived parent snapshots for preflight.
- Featured requires Published + Nice. Trip covers additionally require Travel and that Trip; Hotel/Stay cover photography requires Hotel context and the matching Hotel/Stay. Location covers use matching Travel photos. Foreign keys prevent dangling covers; application selection/preflight enforces editorial eligibility and public queries must resolve effective visibility.
- Optional editorial_order exists on Photos/Trips/Locations/Hotels/Stays; join sequence remains optional. Future public ordering: explicit value first, then captured_at DESC NULLS LAST for photos, then created_at DESC/id for deterministic ties. Admin numeric ordering inputs exist; drag-and-drop is deferred.
- Stay purpose is Business/Leisure/Family/Mixed, optional; Trip also permits Photography.
- stays.internal_notes is private and separate from public review_text. Photo GPS is preserved but excluded from public column grants and all public projections. Public geographic positions come from Locations/Hotels.
- Countries/Cities retain no artificial publication states; only geography reachable from published content is anonymous-readable.
- Trip-City membership remains explicit. Location/Stay association workflows add corresponding trip_cities transactionally, without inventing sequence.
- Dates and EXIF remain optional. No date-containment enforcement, invented timezone, inferred city radius, invented destination, AI captions, Story or Review entity.

Remaining implementation risks, not reasons to alter the product: browser folder traversal/classification fallback; Vercel resources for one-photo derivative processing; map library/tile-provider choice; cache withdrawal semantics. Verify them at their milestones.

## 3. Architecture and actual dependencies

One Next.js application on Vercel contains public routes, /admin, server actions and future bounded route handlers. Supabase holds relational metadata/Auth/RLS; Cloudflare provides DNS/network controls and later private R2 object storage; GitHub versions code/migrations; Lightroom owns photographic masters. No separate backend, ORM, CMS, Redux, GraphQL or microservices.

Pinned dependencies: Next.js 16.3.6, React 19.3.0, supabase-js 2.117.2, @supabase/ssr 0.12.7, Zod 4.6.5; Milestone 3 adds AWS S3 SDK/request presigner 3.1130.0, Sharp 0.35.5 and exifr 7.1.3. Node.js 24, pnpm 11.19.0 and pnpm-lock.yaml replace the initial npm proposal because the available local runtime supplies pnpm. Next was initialized manually using its documented installation path, avoiding generator boilerplate/unrequested UI. TypeScript 5.9.3 and ESLint 9.39.5 match the current Next lint-plugin peer ranges. ESLint 9 emits an upstream support/deprecation notice; compatibility is recorded rather than ignored. Reassess when Next's lint dependency stack supports ESLint 10. Dependencies are exact-pinned; release-age checks remain enabled, using the September 10 SDK release. Native test/lint installation scripts are explicitly allowed in pnpm-workspace.yaml.

Use server components for public rendering, server-side form actions for login/logout and a small client login form for pending/error state. No browser Auth client is needed now: auth cookies are HttpOnly, Secure in production, SameSite=Lax. The importer uses same-origin authenticated server endpoints; revisit cookie strategy explicitly before adding client-side Auth. No privileged service key in the application.

Public database clients never inherit administrator cookies and fetch no-store. Admin clients use validated session cookies and no-store requests. Next.js 16 proxy refreshes sessions only under /admin; protected page/layout and sign-out independently call requireAdmin. getUser validates identity with Auth; is_admin RPC independently verifies the private singleton. An unconfigured project fails closed; public indices show a quiet unavailable state and still build without secrets. Default Server Action origin checks remain intact; no wildcard origins configured.

Public pages and derivative routes remain dynamic/no-store in Milestone 4. Each image request checks anonymous effective visibility; no shared HTML/image cache can outlive unpublication. React cache only deduplicates detail metadata/page reads within a request. Shared caching needs a separately verified parent-aware invalidation design; it is not necessary for this small first experience. Never cache authenticated data or draft previews.

## 4. Implemented schema specification

Milestone 6 adds [20261001000200_hotels_stays_workflow.sql](../supabase/migrations/20261001000200_hotels_stays_workflow.sql), locally verified and not applied remotely. It includes a PostgREST schema reload notification.

The foundation is [20260930000100_v1_foundation.sql](../supabase/migrations/20260930000100_v1_foundation.sql), followed by [Milestone 2 transactions](../supabase/migrations/20260930000200_admin_geography_workflow.sql). Both are applied/verified per the owner. [20261001000100_private_photo_ingestion.sql](../supabase/migrations/20261001000100_private_photo_ingestion.sql) has been applied and verified per the owner. Applied migrations are unchanged.

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
| import_items | Milestone 3 private per-file UUID/hash/size/classification, batch, multipart ID, state/error and claim/lease; bounded idempotency and cleanup, no job queue |
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

Generated src/types/database.ts comes from the freshly migrated PostgreSQL catalog and includes FK relationships and RPC signatures/JSON types. A committed generator and drift check avoid needing Docker or hosted secrets; the owner's hosted migration history remains a separate verification step. The Photo hash index remains non-unique; a partial unique hash on active import_items prevents managed exact-byte duplicates without altering historical Photo rows.

## 5. Publishing enforcement

Database constraints guarantee valid row shapes, assignment requirements, Trip–Location membership, enums, ranges and readiness. Milestone 3's Travel Photo edit action runs publication preflight using database-derived parent/membership snapshots. Published Trip + Location and ready source/derivatives are required; Featured also requires Nice. Trip/Location status controls already exist. Hotel/Stay and both Photo contexts now have publication workflows; explicit cover selection remains deferred. No parent status is trusted from browser input.

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
| import_items | No access |

Policies form a one-way dependency graph, avoiding recursive RLS: base Trip/Location/Hotel → Stay → Photo; joins → base parents; City → Location/Hotel/trip_cities; Country → City. Parent base policies do not query geography. Anonymous column grants omit exact photo GPS, offsets, source names/keys/hashes/import metadata/processing state and Stay internal_notes. There are no owner-bypassing public views. Explicit public projection constants support future reads; SELECT * intentionally fails for anonymously restricted tables.

Embedded PostgreSQL tests exercise actual grants/RLS/constraints as owner-admin, unrelated authenticated user and anon, including direct lookups, joins, parent unpublish, private-column attempts and mutations. The test Auth schema is only a harness; hosted JWT verification, PostgREST, login/session refresh and signup configuration still require remote smoke checks. No development bypass exists.

## 7. Application structure

Implemented:

```text
src/app/layout.tsx, globals.css
src/app/(public)/{layout,page,error,not-found}.tsx, public.css
src/app/(public)/photos/{page,[id]/page}.tsx
src/app/(public)/photos/[id]/image/[variant]/route.ts
src/components/public/photograph.tsx
src/lib/data/{public-photos,public-archive}.ts
src/lib/photos/public-image.ts
src/app/admin/login/{page,login-form}.tsx # private sign-in
src/app/admin/login/actions.ts
src/app/admin/(protected)/{layout,page}.tsx
src/app/admin/(protected)/actions.ts     # independently guarded sign-out
src/app/admin/(protected)/content-actions.ts
src/app/admin/(protected)/{trips,locations}/{page,new/page,[id]/page}.tsx
src/app/admin/(protected)/photos/{page,import/page,[id]/page}.tsx
src/app/admin/(protected)/photos/actions.ts
src/app/admin/(protected)/photos/api/[operation]/route.ts
src/app/admin/(protected)/photos/[id]/image/[variant]/route.ts
src/app/admin/(protected)/photos/storage/route.ts
src/components/admin/                   # forms, navigation, importer/recovery
src/proxy.ts                            # admin-only session refresh/no-store
src/lib/supabase/{env,public,server}.ts
src/lib/auth/{check-admin,require-admin}.ts
src/lib/validation/{login,publishing}.ts
src/lib/data/public-columns.ts
src/lib/{admin,photos,r2}/
src/types/database.ts
supabase/{config.toml,migrations/,tests/}
tests/, scripts/, docs/
.github/workflows/checks.yml
```

Photos and UUID detail are implemented. Trips/[slug] and Locations/[slug] now use their established database slugs. Stays/[hotelSlug]/[stayId] and Hotel/Stay admin sections are implemented in Milestone 6. Map and About remain disabled without broken links or invented content. Image processing/media routes use Node.js/Sharp, not Edge runtime, within this application. Choose a map library/tile provider at its milestone. Branding/domain remain replaceable configuration.

## 8. Milestone 3 private importer/R2 architecture

All remote bucket/token/CORS/migration changes are manual. See [r2-setup.md](./r2-setup.md). The implemented pipeline:

1. Browser scans file metadata/retained paths. Personal is skipped before reading bytes; known folders map to Nice/Record. Unclassified loose files require an explicit choice and Personal-exclusion confirmation. Folder picker preserves paths where supported; drag/drop handles loose files only. Ten eligible JPEGs maximum, 25 MiB each.
2. Browser hashes only eligible JPEGs. An authenticated same-origin JSON request creates a batch and reserves a stable per-file UUID/hash. Active exact-byte duplicates reuse existing data without replacement.
3. Server creates a **single-part multipart upload** and signs part 1 for two minutes, including its length. The browser PUTs bytes directly to R2; only the server uses the SDK/reusable credentials and can complete/abort the upload. This avoids Vercel's 4.5 MB request limit. Unlike a reusable source PUT, an aborted/completed multipart session cannot be recreated by an old part URL. Exact-origin PUT CORS is required; no public bucket is needed.
4. Server claims completion, lists/checks part count/size, completes the source, downloads at most 25 MiB, verifies SHA-256 and validates actual JPEG dimensions/format. Source bytes are retained untouched. Sharp normalizes orientation in derivatives; exifr reads optional EXIF with no invented timezone/coordinates.
5. One Node request generates sequential, non-upscaled WebP long edges 2400/1600/600/300. Quality 85/82/80/75, effort 4. Strip metadata (especially GPS) and preserve aspect ratio. Use `<photo-id>/source.jpg`, large.webp, medium.webp, thumbnail.webp, tiny.webp; store `<photo-id>/` as one prefix. These exact UUID keys follow the owner's current milestone instructions rather than the earlier example prefix.
6. Only after all objects exist does finalization create a ready Draft Photo and update batch counters atomically. Milestone 6 extends the reservation with explicit Travel/Hotel context and optional Hotel Stay; assignments can be edited afterward. No auto-publication or importer intelligence is added.
7. Known failures abort incomplete sessions and delete/verify known objects. Durable import_items retain failed/cleanup_required state. Uncertain commit responses are checked before destructive compensation; uncertain reads remain recoverable. Per-file leases prevent concurrent work. An interrupted process can be cleaned after its lease expires, without introducing a queue/sweeper. Successful deletions preserve import history.
8. Admin media routes validate Auth + singleton identity separately and stream only ready Photos with private/no-store. Raw sources may contain GPS and remain administrator-only. Next Image uses unoptimized authenticated local routes. Photo editing validates actual parent/membership/Featured requirements; RLS remains the final public privacy boundary.
9. Photo deletion rejects cover references, hides the row before touching bytes, aborts incomplete sessions, deletes/verifies all five keys and then removes the Photo. Partial failures retain a hidden retryable row. No silent archive cascades or Lightroom changes.

Keep all objects private. Milestone 4 adds the separate effective-visibility derivative route described below. Raw GPS-bearing sources must not become public; no public signed GETs, CDN or shared caching exists now. Automated tests use fake R2 and real embedded PostgreSQL/Sharp. Hosted CORS, credentials, SDK transport and the controlled ten-photo proof were verified by the owner; no remote resources have been modified.

Required server names: R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY. Optional R2_JURISDICTION supports restricted endpoints. Empty names are now in .env.example. No real credentials or public-prefixed R2 values are committed.

## 9. Implementation milestones

| Milestone | Scope | Acceptance gate |
| --- | --- | --- |
| 0 — Complete | Review/planning | Bible unchanged; open decisions explicitly recorded |
| 1 — Complete, owner-verified hosted | Shell, schema/constraints/RLS, single-admin login/shell, security tests/types/CI | Local checks and owner hosted verification complete |
| 2 — Complete, owner-verified hosted | Country/City selection, Trip and Location CRUD, transactional joins, optional dates/status | Undated Trip/Location/memberships; safe deletion; Drafts private |
| 3 — Complete, owner-verified hosted | Private R2 capabilities, derivatives/EXIF, Draft import/history, Travel edit/publication, secure admin previews/deletion | Controlled ~10 JPEGs; Personal zero-byte reads/uploads; orientation/GPS/aspect/unknown EXIF; retry/failure/deletion privacy |
| 4 — First public photography experience | Photography-led home, Nice gallery/explicit Record view, UUID detail, private-R2 public derivatives | Effective-public reads, private-field omission, parent withdrawal, responsive native aspect ratios; no public Trips yet |
| 5 — Public Trips and Places | Published Trip index/slug detail, Location slug detail, Photo context links, safe covers and bounded contextual galleries | Optional dates, correct geography/joins, Nice and separate The Record; hidden parents/Drafts/private fields excluded |
| 6 — Hotels and Stays | Hotel/Stay admin CRUD, Hotel photo ingestion/assignment and public property/visit pages | Repeated visits, optional dates/reviews, ratings, private notes, Hotel-only photography, public parent withdrawal |
| 7 — Found Along / archive refinement | Found Along identity, Singapore Home, full-resolution JPEGs and compatible larger WebPs | Singapore-only Trip exceptions; no privacy regressions; responsive existing public routes |
| 8 — Editorial completion | About and restrained homepage/context refinements | Real owner editorial content; no fake data; existing public visibility/visual language |
| 9 — V1 refinement | Responsive/accessibility/performance pass and existing archive workflow refinements | Native proportions; privacy/cache withdrawal; no Phase 2 scope |
| 10 — Release verification | Accessibility/security/performance/backup/recovery | No draft leaks via API/images/caches; deployed slice; verified backup/forward migration procedure |

Stop after the requested milestone. Meaningful tests focus on security/constraints/privacy/import recovery/end-to-end behavior, not trivial presentation snapshots. Synthetic fixtures never run on production. Do not reset existing remote data or deploy unreviewed migrations.

## 10. Primary technical references

- [Vercel Node.js versions](https://vercel.com/docs/functions/runtimes/node-js/node-js-versions) confirms Node.js 24 support.
- [Next.js manual installation](https://nextjs.org/docs/app/getting-started/installation) and [Next.js 16 proxy](https://nextjs.org/docs/app/getting-started/proxy).
- [Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client) and [SSR cache safety](https://supabase.com/docs/guides/auth/server-side/advanced-guide).
- [Supabase RLS](https://supabase.com/docs/guides/database/postgres/row-level-security).
- [Supabase security-invoker views](https://supabase.com/docs/guides/database/views), should views later be needed.
- [R2 presigned URLs](https://developers.cloudflare.com/r2/api/s3/presigned-urls/), [public bucket exposure](https://developers.cloudflare.com/r2/buckets/public-buckets/) and [CORS](https://developers.cloudflare.com/r2/buckets/cors/).

## 11. Milestone 4 public photography and delivery

Homepage selects up to nine effectively visible Nice photos: Featured first, then other Nice photos, deduplicated. The first photograph leads, with a masonry selection when more exist. `/photos` defaults to Nice; the owner's Milestone 4 request makes Record available through an explicit `?view=record` selection, never mixed into the default gallery/home. Galleries use 24-item pages plus one lookahead, explicit editorial_order first, then capture time/created time/ID. Zero/one/few photos and absent editorial/EXIF values require no fabricated content.

Public Server Components always use the cookie-free anonymous Supabase client. The new query projection deliberately omits GPS, internal notes, filenames, source keys/hash, import state and administrative publication state. Related Location/City/Country and Trip names use explicit anonymous projections. All supported Photo contexts retain existing RLS eligibility; current imported Travel photos receive geographical context. Hotel/Stay contextual presentation is deferred without weakening Hotel parent visibility. No public Trip links are emitted before those pages exist.

`GET /photos/[id]/image/[variant]` permits only tiny/thumbnail/medium/large. It validates UUID/variant, performs an anonymous ID lookup under existing RLS, and only then reads the UUID derivative using the server-only S3 client. Hidden/nonexistent records and invalid/source variants return 404; infrastructure errors return a generic 503, never provider details. The original source is still confined to the independently authenticated admin route. The bucket remains private; no signed public GET capability, public hostname, Worker or Cloudflare change is required.

Responses stream the existing metadata-free WebP unchanged. Native img srcSet advertises actual derivative **widths**, calculated from the native aspect ratio and no-upscale rule (portrait widths are smaller than long edges). All four derivatives are candidates; small duplicated widths are omitted. Gallery sizes follow 1/2/3-column breakpoints; opening/detail use larger viewport sizes. Visible opening photography is eager/high priority, later imagery lazy. CSS constrains viewport height without cropping/stretching. This avoids a second transform/recompression and does not load every large image. Next local image optimization is explicitly disallowed (`images.localPatterns: []`), so visitors cannot use `/_next/image` to create an independent shared cached copy.

Public HTML/data and image routes use no-store; media also sets CDN/Vercel-CDN no-store. An unpublish/parent change is effective on the next server request, with no purge process. A request already authorized/in flight can finish, and bytes already downloaded or saved cannot be revoked. This favors withdrawal correctness over CDN efficiency: each image uses a Supabase visibility lookup and Vercel streams R2 bytes. Traffic/cost/latency may justify a later explicitly tested authorization-aware edge/cache design; do not simply enable public bucket access or a TTL that leaks unpublished images.

Titles/descriptions/OG text use only public editorial/geographic fields. OG image URLs and canonical-domain configuration are deferred while branding/domain are undecided. Public UI uses local system sans/Georgia fonts, scoped light editorial styles, semantic navigation and visible focus. Unimplemented nav labels are disabled; mobile wraps in a readable two-row header without requiring JS. CSS columns produce a native-proportion masonry layout whose keyboard/reading order follows DOM column order. There is no search, taxonomy, client gallery state or animation.

References checked for this implementation: [Next no-store fetch](https://nextjs.org/docs/app/api-reference/functions/fetch), [Next cache behavior](https://nextjs.org/docs/app/guides/caching-without-cache-components), [R2 S3 API](https://developers.cloudflare.com/r2/api/s3/api/).

## 12. Milestone 5 public Trips and Places

Routes use the already-required unique `trips.slug` and `locations.slug`: `/trips`, `/trips/[slug]`, `/locations/[slug]`. Location routing was already specified by Bible section 11 and the technical plan; no new URL/product decision is needed. Photo URLs remain `/photos/[id]`. Photos and Trips navigation is active; Stays/Map/About retain disabled labels. No Country/City index/detail or Location primary-navigation section is introduced.

New pure typed query functions in `public-places.ts` are exercised through actual supabase-js queries against anonymous embedded PostgreSQL. Server-only `public-journeys.ts` supplies the cookie-free anonymous client and request-local metadata/identity deduplication. Published Trip/Location status is checked explicitly and existing RLS is authoritative. `trip_cities` and `trip_locations` keep their existing visibility policies; only visible Locations/Trips are resolved. A published Location is independently visible, even if all associated Trips are Draft, but those Trip names and their photographs disappear. Travel photography filters context plus Trip/Location identity; Hotel photographs are never pulled through a Stay into Trip galleries. Private coordinates, source keys, notes, hashes, operational fields and administrative status are omitted from projections.

Trip identity includes actual optional dates, description and explicitly associated City/Country names. Null dates render no date label; partial ranges say From/Until only for the known endpoint. Places use optional membership sequence with deterministic UUID ties, not forced chronology or an itinerary. Location pages show real geographic names/optional existing description, Nice photography and visible associated Trip links, without external POI content. Trip pages feature Nice photography first and a separate The Record section. Locations keep Nice-only galleries; documentary Record photography remains available through the associated Trip.

Covers resolve the stored Photo pointer anonymously and additionally require Nice + Travel + the matching Trip/Location. RLS guarantees ready Published Photo and required published parents. A Draft, Record, Hotel, wrong-parent or stale/invisible pointer cannot authorize media; fall back to the first visible eligible Nice photograph by existing editorial/capture/created/UUID ordering. If none exists, use text rather than fake imagery. Cover selection does not mutate stored pointers or Featured flags. No admin cover-selector feature is added.

Performance bounds: twelve Trips per index page plus one lookahead; only one eligible cover candidate per Trip, at most three simultaneous cover lookups. Index geography and cover contexts are batched, not read separately per photograph. Detail photography loads 24 Nice and 24 Record rows (each with one lookahead) plus a cover, never the entire photo archive. The cover is excluded from the Nice list before offset pagination, preventing duplicates without skipping a photograph. Trip Places and Location related Trips each use 24-row pagination. Independent query parameters preserve the other sections' page positions and anchor the selected section. City memberships read in 200-row chunks and geographic ID lookups in chunks of 100, avoiding PostgREST truncation/oversized URLs. These supporting names may grow with an unusually large Trip; query latency should be measured before optimizing further.

All photographs reuse Milestone 4 native-aspect components, responsive metadata-free WebP delivery, lazy loading and derivative-only visibility checks. Public HTML/data/media remain dynamic/no-store and local Next optimization remains blocked. No migration, dependency, environment/CORS or remote R2 change. Offset pages may shift during concurrent editorial changes; no snapshot/cursor/infinite-scroll system is warranted yet.

Photo detail obtains public Trip/Location slugs with its existing anonymous context query and offers links only when the parent resolves publicly. Trip Places → Location; Location → visible Trips; opening/contextual photos → the canonical UUID Photo route. Back-to-Photos remains classification-aware. Location and Trip 404 views use appropriate nouns. No invented Country/City routes, public Stay routes, Map/Search or fake navigation targets.

## 13. Milestone 6 Hotel/Stay branch

The owner expanded Milestone 6 to include both admin and public lodging. The core schema already supports it; no new editorial entity/table is necessary. Hotel is persistent property identity; Stay is a visit belonging to Hotel and Trip. `/stays` lists Hotels once; `/stays/[hotelSlug]` combines property editorial data, eligible cover, Nice photographs across visits and paged Stays. `/stays/[hotelSlug]/[stayId]` verifies membership and shows real dates or “Dates not recorded”, Trip, room/purpose/rating/review and separate Nice/Record photography. Hotels remain independent of Locations. Published Hotel without a public Stay is valid and uses an intentional sparse presentation.

Bible recommendations remain the three existing Hotel booleans (Family, Business, Personal / Leisure); displayed in visit context without copying them to Stay. Hotel general rating and each Stay rating remain independent whole stars 1–5. `review_text` is public plain editorial text; `internal_notes` is private. Missing dates/review/EXIF/photos require no invented fields or placeholder imagery.

`20261001000200_hotels_stays_workflow.sql` adds three invoker/admin-only functions, two private import-ledger columns/context constraint/index, and replaces finalization/failure/deletion functions to handle those columns. Save Hotel/Stay transactions keep Trip–City membership consistent, protect geography from duplicate records, and validate parent publication. Existing three migrations, public grants/RLS and content table model remain unchanged. Apply only the new migration manually before using these writes/imports. There are no environment/dependency/R2/CORS changes.

Admin reuses the existing session client, independently guarded Server Actions, inline City/Country selector, preserved validation input, optional numeric order and confirmation/dependency-based deletion. Stay/Hotel removal never cascades photos or R2 bytes. Trip has an Add Stay entry and bounded Stay list. Source/derivative deletion stays in the shared Photo workflow.

The importer chooses Travel/Hotel explicitly and can target a Stay; `import_items` keeps that choice across retries. New Photo stays Draft even when assigned to a published Stay. Draft Hotel photos may lack a Stay. Published Hotel photos require Stay only; Trip/geography derive through it. Hotel assignments have null direct Trip/Location. Source checksum duplicates preserve the existing Photo and reject conflicting requested context/Stay. Same five UUID objects, unchanged JPEG, stripped GPS in WebPs, same dimensions/quality/failure recovery and private bucket.

`public-stays.ts` exposes narrow anonymous Hotel/Stay selectors and indexed Photo→Stay inner joins. Anonymous RLS enforces Hotel + Trip + Stay before any Hotel photo is returned. No notes/photo GPS/source keys enter public payloads. A Hotel slug and wrong Stay UUID never resolves a different property's visit. Hotel/Stay covers deterministically choose visible Nice Hotel photography for that exact parent; no stored cover additions or admin selection. Trip galleries still select Travel only; Where I Stayed links visits separately. Hotel/Stay/Trip links are attached to Hotel Photo detail via anonymous context reads.

Twelve Hotels plus lookahead per index, batched geography/cover context and at most three cover reads concurrently. Hotel Nice gallery, Stay Nice/Record galleries, Hotel Stay list and Trip Stay list use 24 + lookahead; exclude hero before paging. Hotel gallery/cover filtering uses the existing Stay FK under PostgREST inner joins, not unbounded UUID lists. Queries/images stay dynamic/no-store; derivative delivery is unchanged and sources stay private. Responsive public headings explicitly avoid the admin's global flex-header styling. Offset movement, uncached delivery cost and absent admin cover selector remain known tradeoffs.


## 14. Milestone 7 approved architecture refinement

The owner approved the assessment and narrow Singapore Stay exception before changes. Found Along identity and Home context supersede the earlier Map-first milestone recommendation. Map/Search remain deferred. Existing M1–M6 entities, route identities, singleton administrator and storage/recovery workflow remain authoritative except these explicit refinements.

`20261002000100_found_along_home.sql` is required by existing publication constraints/RLS. Travel publication requires a visible Location and either a visible assigned Trip or trip-less SG geography. Stay Trip becomes optional only for SG Hotel geography. Any assigned Trip still gates visibility. Hotel photos require visible Stay/Hotel and any assigned Trip; never mix into the Home Travel view. The invoker `city_is_singapore` helper derives Country code SG. Row guards block overseas trip-less writes; geography guards reject moves that invalidate home assignments; RLS remains the independent current-state visibility boundary. No recursive parent publication cascade, new editorial entity, flag, seeded destination or privileged public client. Supplied Trip/Location membership remains FK-protected. Existing records stay valid; safe grants remain narrow. Apply only this new migration manually after confirming M6 history.

`public-singapore.ts` uses actual FK inner joins under anonymous RLS; explicitly hint `photos_location_id_fkey` because the inverse cover FK is another relationship. Nice/Record/Places have independent 24-row pages plus lookahead. A bounded Featured Nice opening falls back to eligible Nice; zero/one-photo states omit fabricated content. Existing Photo detail links back to Singapore only for normal SG Travel context. All global Photo queries continue including home photographs; Hotel photos remain globally eligible through their own workflow. Home Place counts and additional filters are deliberately deferred.

JPEG source processing now accepts full resolution within 25 MiB and 80MP, retaining ten sequential files, checksum/source-byte preservation, EXIF handling, Personal exclusion and recovery. New WebP targets are 3200/1920/960/480 at existing qualities 85/82/80/75, effort 4 and no enlargement. Reuse encoded buffers when target dimensions collapse; all five deterministic UUID objects remain. Profile 1 on existing rows means 2400/1600/600/300; profile 2 is persisted by new finalization. This single technical representation column prevents inaccurate srcSet widths without rewriting old objects or querying R2 metadata for every gallery item. Source delivery stays admin-only. No runtime font dependency: checked-in licensed fonts use next/font/local, scoped to public UI. No dependency/environment/CORS or remote changes.

Dynamic HTML, cookie-free anonymous no-store queries and per-request derivative authorization remain intact, including CDN no-store headers and the optimizer block. Only request-local React deduplication is used. Shared/public caches are intentionally excluded. Test coverage uses real embedded SQL/Sharp and fake object storage; actual full-resolution Lightroom memory/time on Vercel remains manual acceptance. The synthetic 60MP test demonstrates valid dimensions, not worst-case resource capacity.


## 15. Milestone 7.1 consolidation (historical; superseded by §16)

This section supersedes historical M6/M7 descriptions of Stay reviews/photo ownership. Hotel is persistent identity/current opinion: existing rating and recommendation flags plus review_text/cover_photo_id. Stay is Hotel/dates/Trip/private note plus publication/internal ordering/identity timestamps. Overseas requires Trip; Singapore can omit it. Photo and pending import target Hotel directly; published Hotel photos require visible Hotel, independent of a visit. All old R2 bytes/UUIDs/profiles and import byte/pixel/batch limits remain unchanged.

New forward migration `20261003000100_hotel_archive_refinement.sql` derives relational Hotel references, withdraws formerly hidden Published Hotel photos, removes obsolete columns, updates admin/import RPCs, adds safe grants/indexes/cover FK and a bounded invoker cover-ID RPC. Prior applied migrations are immutable. No hosted execution or infrastructure changes. No new environment variables.

Public Hotel is `/stays/[hotelSlug]`; old visit route validates public membership then redirects (307/no-store). Hotel gallery Nice plus separate Record, review and understated history retain 24-row sections. Index remains 12 + lookahead. Cross-links now target Hotel; actual visit Trip relationships remain visible only under existing parent RLS. Admin Hotel combines opinion, cover, photos and visits; Photo importer/editor targets Hotel and uses the one existing private pipeline.

Query-count findings, bounded fixes, GPS audit, unknown production timing and manual migration/acceptance are documented in [m71-acceptance.md](./m71-acceptance.md). Per-request media authorization/no-store remains unchanged; no broad caching, Map/Search, source replacement, coordinate precision decision or unrelated redesign.


## 16. M7.3 current Hotel-only architecture

Hotel owns persistent identity/geography/current rating/recommendation flags/review/cover. Photo and pending import reference Hotel directly via existing hotel_id; no Visit/Stay or Hotel–Trip entity. New 20261004000100_remove_stays.sql replaces only dependent save/Trip/Singapore guard functions, removes the obsolete Hotel geography trigger and Stay RPC/table (including its policies/indexes/triggers). It performs no Hotel/Photo/import row changes and no R2 operations. Keep former migrations unchanged; manual coordinated schema/code rollout only.

Public /hotels index remains twelve + lookahead, bounded invoker cover-ID RPC and safe batched geography; Hotel detail Nice/Record sections remain 24 + lookahead, parallel reads and safe cover exclusion/fallback. No history reads. Canonical links and metadata use Hotels. Legacy Stays routes are 308, with per-request anonymous Published Hotel resolution for property/visit URLs; no visit lookup. Normal /photos/home explicitly select Travel, while Hotel UUID detail/media stay usable within Hotel gallery. No shared cache, public bucket or source delivery change.

Admin Hotel Photos panel/Add Photos/cover makes the existing importer discoverable. Hotel-targeted imports validate existing UUID, lock context/property, preserve secure server operations and avoid manual ID copying. Hotel deletion still refuses Photo/import references; Photo storage-aware deletion is unchanged. No environment/dependency/CORS configuration changes. See m73-acceptance.md for validation, migration loss/preservation, redirects and rollout.
