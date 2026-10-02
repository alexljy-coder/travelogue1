# Implementation architecture decisions

Product authority: [buildbible.md](./buildbible.md). Owner resolutions below supersede Milestone 0 proposals; the Build Bible now includes the explicitly approved M7 superseding rules.

## Resolved by the owner before Milestone 1

1. **Photo URLs:** `/photos/[id]` uses the Photo UUID. No photo slug in V1.
2. **Stay URLs:** `/stays/[hotelSlug]` is the Hotel aggregate; `/stays/[hotelSlug]/[stayId]` is an individual Stay. Both use normal nested App Router segments; verify the Stay belongs to the Hotel when querying.
3. **Parent publishing:** required unpublished parents hide all dependent public content through RLS/public queries. Application publishing preflight rejects invalid parent states where practical. No cascade of stored publication flags.
4. **Featured/covers:** Featured requires Published + Nice. Trip covers additionally require Travel context and that Trip. Hotel/Stay cover photography requires Published + Nice + Hotel context and the relevant Stay/Hotel. Location covers use published Nice Travel photos of that Location. Public presentation must resolve effective visibility rather than trust a stored cover pointer.
5. **Ordering:** nullable explicit editorial position values are supported where useful; deterministic capture-date/created-at/ID fallbacks. No ordering interaction UI in Milestone 1.
6. **Stay purpose:** optional Business, Leisure, Family or Mixed. Photography remains a valid Trip purpose, not a Stay purpose.
7. **Notes:** private internal notes are separate from public description/review/editorial content and are never exposed publicly.
8. **GPS:** preserve photo EXIF coordinates in the database; never expose them publicly in V1. Public geography uses Location coordinates for Travel and Hotel coordinates for Hotel photos.

## D001 — One application and explicit SQL

TypeScript Next.js App Router on Vercel, supabase-js/@supabase/ssr, SQL migrations and database types in GitHub. No ORM, CMS, separate backend or generalized state architecture. No R2 dependencies or credentials in this milestone.

## D002 — Normalized photo context and historical truth

Hotel photos store only stay_id; derive Trip/Hotel/City/Country through Stay. Travel photos store Trip/Location and no Stay. Draft assignments may be incomplete. CHECK constraints enforce shape and publication requirements; a composite FK enforces Trip–Location membership. Date endpoints independently nullable; compare only when both known. Capture time retains wall time and only a known offset. RESTRICT deletion protects referenced records; no cascade destruction of archive content.

## D003 — Publishing and visibility

Database enforces local invariants, including Featured = Published + Nice and processing readiness. RLS checks required parents independently. Application preflight covers cross-record eligibility; no complicated publish/unpublish triggers. Changing a parent to Draft hides children without mutating their status. Covers are validated on selection/publication, then resolved through RLS on public reads; a stale pointer does not authorize an image.

## D004 — One administrator, fail closed

A private singleton identity row references auth.users. A narrow security-definer is_admin() function returns only whether the validated session belongs to that identity, with fixed search_path and restricted execution. No identity means no administrator. Provision via trusted operator access, disable signup, and never authorize by user-editable metadata/email or authentication alone. No privileged API key is needed for normal app operations.

## D005 — Public row AND column privacy

RLS is not column security. Anonymous SELECT grants explicitly omit photo GPS, filename/storage/hash/import metadata and Stay internal_notes. Authenticated table access is admin-only, not a second public-read policy: unrelated authenticated users receive zero rows and cannot mutate. This permits full-column admin access without leaking private columns to a non-admin session. Public pages use an anonymous cookie-free client even when the browser is logged in. Countries/Cities expose only geography reachable from published content, without invented publication states.

## D006 — Private R2 boundary

The whole bucket stays private. Milestone 3 now implements authenticated upload capabilities, per-photo Node/Sharp work, readiness state and private image delivery (D013–D016). Benchmark on the actual Vercel plan. No public r2.dev or random-key privacy assumption.

## D007 — Implementation extensions

photos.import_batch_id, processing_status, captured_at_offset_minutes and editorial_order support import bookkeeping and safe publication without replacement/version management. Trips/Locations/Hotels/Stays also have optional editorial_order; join sequence remains optional. Hotel/Stay cover eligibility will use the existing associated-photo model, not new cover FK columns until explicitly needed by that UI. stays.internal_notes replaces ambiguous notes; review_text is public editorial content. No photos.slug.

## D008 — Small milestones

Foundation → Trip/Location workflow → private ten-photo import → first public photography experience (owner-requested Milestone 4) → public Trip slice, then Hotel/Stay and editorial breadth. Suggested Bible milestones are subdivided without changing V1 scope. Stop at each requested milestone.

## D009 — Tooling and verification implementation

Manual initialization follows Next.js's documented installation path, using exact-pinned dependencies and the available pnpm runtime rather than the initial npm proposal. Node.js 24 is compatible with Next and Vercel. Production builds use the supported Webpack switch; no custom bundler configuration. Next.js 16.3.6 satisfies the package manager release-age policy; no age guard was disabled. TypeScript 5.9.3/ESLint 9.39.5 satisfy Next lint-plugin peer ranges; ESLint 9's upstream support warning is tracked for a compatible future tooling update.

Database tests use PGlite's embedded PostgreSQL with test-only Supabase roles/Auth stubs, not string assertions over SQL. Types are generated from its migrated catalog and checked for drift. Hosted Auth/JWT/PostgREST/configuration remain separate smoke checks. The production smoke script starts the real built server and checks unauthenticated redirects/cache headers/absent registration routes against its actual build configuration. NEXT_PUBLIC values are embedded at build time, so runtime overrides cannot reliably simulate another configuration. Unit tests cover configuration failure; CI builds without secrets. Typecheck runs `next typegen` first so fresh checkouts do not depend on pre-existing .next route declarations.

## D010 — Admin content transactions

Milestone 2 uses independently authenticated Server Actions and the existing session client. Single-row Trip saves and unreferenced Location deletion use normal table operations under RLS. Seven narrowly scoped PostgreSQL RPCs handle Country/City creation, membership updates, Location saves and Trip deletion atomically. All use invoker rights, an empty search_path, explicit singleton-admin checks and authenticated-only execution grants. No service-role key, bypass policy or separate backend. Migration 20260930000200 adds these functions without editing the applied foundation or changing its tables/RLS. Catalog-generated types now include RPC signatures.

## D011 — Geographic identity and explicit membership

Country code and Country-scoped City slug are existing unique identities. Inline creation reuses a matching identity only when its normalized name also matches; mismatches produce actionable errors. Existing coordinates are never silently overwritten. A new Country and City are created together or rolled back together. Slugs are suggested and editable; names that cannot yield an ASCII slug require an owner-entered URL name. Distinct Cities with the same name may use distinct slugs; no geographic inference or geocoding is introduced.

Adding a Location adds its City to the Trip in the same transaction and preserves an existing City position. Changing a shared Location's City adds the new City to every associated Trip. Old City memberships remain explicit until separately removed; removing a Location does not silently remove a City. City removal is blocked while a Location or Stay in that Trip requires it. Nullable sequence/visited_at remain editorial data, without itinerary or date-containment rules.

## D012 — Safe deletion and minimal editorial forms

Destructive forms require explicit confirmation. Trip deletion removes only that Trip and its City/Location joins, preserving geographic records; any Photo or Stay reference blocks it. Location deletion is blocked by Trip memberships or Photos, using existing RESTRICT foreign keys. No automatic cleanup or archive-content cascades. Forms retain values after validation failures, accept unknown/partial dates and separate inline geography creation from the main save form. Cover fields are deliberately absent until photos exist; saves preserve any stored cover. Status changes affect only the selected record; parent-aware public RLS remains unchanged.

Catalog selectors read bounded pages rather than silently hitting PostgREST's response limit. Lists paginate and use deterministic ordering. Position fields are optional numeric inputs; no drag-and-drop UI. Milestone 2 contains no public content experience or new environment variables.

## D013 — Bounded private upload transport

Milestone 3 keeps the S3 SDK and reusable credentials on the server. The four required environment variables are R2_ACCOUNT_ID, R2_BUCKET_NAME, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY; optional R2_JURISDICTION selects a restricted bucket endpoint. All use server-side names, never NEXT_PUBLIC_. Only a signed-in singleton administrator with a same-origin request can obtain a two-minute UploadPart capability for one UUID/source, one multipart session and part 1. The URL signs the selected file size. It carries an expiring signature/non-secret credential identifier, never the secret key or general bucket credentials.

This refines the technical plan's direct PUT proposal: Vercel's 4.5 MB body ceiling rules out forwarding full 4000px JPEGs through a single application request. A single-part multipart upload permits direct browser bytes while **server-only completion/abort** prevents old upload URLs from recreating final source objects after cleanup. ListParts validates part count/size before completion. The server downloads/verifies SHA-256 and actual JPEG pixels; no client metadata is trusted for publication. No queue, chunk-resume platform, new backend or public bucket is introduced. Narrow exact-origin PUT CORS is a manual bucket setting.

## D014 — UUID storage and deterministic metadata

The owner's Milestone 3 namespace is `<photo-id>/source.jpg` plus large/medium/thumbnail/tiny WebPs, stored as one UUID prefix. This replaces the earlier example's optional photos/two-character prefix; the Bible's example namespace is not a product identity requirement. Photo IDs, not filenames or slugs, remain stable. Source bytes are preserved unchanged, including private EXIF GPS. Admin-only source streaming is separate from metadata-free derivative previews. Future public delivery must not expose the raw source's GPS.

Sharp auto-orients and creates aspect-preserving, non-upscaled 2400/1600/600/300 long-edge WebPs at quality 85/82/80/75, effort 4, with metadata stripped. EXIF is parsed by exifr without turning wall-time strings into inferred timezone dates. Only a known original offset is stored. Missing/invalid optional tags become null; no invented camera/location/time/caption. Valid RGB JPEGs up to 4000px/16 megapixels and 25 MiB are accepted; source export quality/sharpening and an untagged file's exact source profile are not inferable. Ten eligible files maximum, sequential per-file processing. Optional metadata absence never rejects valid pixels.

## D015 — Durable idempotency and compensating cleanup

New `import_items` stores UUID, batch, filename, SHA-256, size, classification, operational state, multipart ID, lease/token and a safe recovery message. It is a small private operation ledger, not an editorial entity or background queue. RLS grants access only to the singleton administrator. Ten invoker-rights RPCs make reservations/claims/finalization/deletion atomic and keep the original Photo model/grants/RLS unchanged. An active source checksum is unique among managed requests. Exact byte duplicates reuse the existing request/Photo without overwriting classification/editorial data; distinct exports are not reconciled. Deleted request tombstones preserve history; a deliberately reselected deleted file may receive a new UUID.

No Photo row is inserted until source verification and all derivatives succeed; it is created ready, Draft, unfeatured and Travel with no invented assignments. Finalization and import counters commit together. If a DB response is lost, confirm the Photo before removing any bytes; uncertain reads retain the operation rather than guessing failure. Known failures abort multipart sessions and delete/verify all five known keys, then mark failed or cleanup_required. Hard interruptions retain a traceable prefix and lease for manual cleanup. Upload failures can cancel their own uploading token immediately; active processors cannot be cancelled this way. Leases expire after ten minutes for browser upload, five for server operations; route maxDuration is 120 seconds.

Deletion first checks cover references, withdraws publication/Featured/readiness, and claims the operation. It aborts incomplete uploads, deletes all five objects and verifies absence before deleting the Photo row. Failures leave a hidden, non-ready row with retryable deletion status. Lightroom and unrelated records are untouched. Do not delete Photo rows directly in SQL in place of this protocol. General orphan sweeping/replacement is deferred.

## D016 — Classification, private media and publication UI

Folder selection preserves webkitRelativePath where supported. Personal segments override all other classification and are skipped **before** byte reads, hashes or network uploads. Nice/Record folders classify deterministically; conflicting classifications block import. Loose-file drag/drop and file selection require an explicit fallback and confirmation that Personal files were excluded. The application cannot infer a lost folder or identify Personal content from pixels. Recursive drag/drop folder traversal is deferred; the folder picker is the supported path-preserving option.

Photos list/import/detail/edit stay under protected /admin. Private preview/source routes independently validate Auth + singleton identity and use private/no-store responses. Next Image is unoptimized for these local authenticated routes, preventing a shared optimizer from retrieving private images. GPS is shown only in admin; public safe-column grants remain unchanged. No public Photo/media routes are added.

Travel edit actions verify database-derived Trip/Location membership even for a complete Draft assignment and run existing publication preflight against required parents. Published requires ready source/derivatives, actual membership and Published Trip/Location; Featured also requires Nice. RLS independently hides children if a parent changes after validation. Covers remain deferred. Hotel schema compatibility remains intact; no Hotel photo UI or artificial Stays/Locations.

## D017 — Dependency and test boundaries

Pinned AWS SDK 3.1130.0, Sharp 0.35.5 and exifr 7.1.3 implement the pipeline without a framework/ORM change. SDK release-age checks remain enabled; the September 10 SDK release is used rather than accepting newly published packages. Tests use real Sharp JPEG/WebP/EXIF processing, embedded PostgreSQL RPC/RLS/constraints and a fake object/multipart store. No production bucket access is required. Production smoke tests prove private route rejection and absence of public Photo pages; the actual Lightroom/CORS/R2/Vercel performance proof remains an explicit owner test.

## D018 — First public photography scope and Record selection

The owner's Milestone 4 request brings home/Photos/UUID detail forward before public Trip pages. Nice remains the default main Photos archive and the only homepage classification. Record is explicitly selectable at `/photos?view=record`, satisfying the requested support for both without changing the default. It is not mixed into the homepage or silently promoted. No tags/categories or new editorial model. Existing position/capture/created/UUID ordering is deterministic; bounded pagination avoids downloading the whole archive. Disabled Trips/Stays/Map/About nav labels retain the V1 navigation without broken links or premature placeholder experiences. System typography/native proportions/light scoped styles leave admin presentation separate.

## D019 — Public derivative authorization, no shared cache

Private R2 stays unchanged. A Node route at `/photos/[id]/image/[variant]` checks cookie-free anonymous Supabase RLS visibility before constructing the R2 read. Only four hard-coded metadata-free WebPs are accepted; source and arbitrary keys are rejected before DB/storage access. RLS already checks ready Published Photo plus required published parents, so no migration/new public grant is needed. Public HTML queries use a narrower typed projection, related name-only geography/Trip projections, no exact GPS, storage keys or notes. Being logged into admin never changes public visibility. No public signed source/derivative GET URLs.

Stream existing bytes with no reprocessing. Native responsive srcSet uses actual width per aspect ratio, no-upscale duplicate elimination, larger opening/detail sizes and smaller lazy gallery representations. Local Next optimizer access is disabled globally because all current admin/public images are already generated/unoptimized; otherwise a guessed optimizer URL could retain an independently cached derivative after unpublication. Public HTML/data/media remain dynamic/no-store, including CDN-specific media headers. Request-local React deduplication does not create a shared content cache. Each new read observes publication changes; already authorized/in-flight/downloaded images cannot be recalled. Accepted tradeoff is per-image Supabase lookups and Vercel byte delivery, appropriate for this initial archive. Edge/CDN optimization requires explicit parent-aware withdrawal tests later.

## D020 — Public metadata and deferred context

Photo URLs remain UUIDs. Detail shows only real optional editorial/EXIF metadata, retaining the captured calendar date without inferring a timezone. Geography is derived from assigned Location/City/Country, never photo GPS. Trip title is text until public Trip pages exist. All public-visible Photo contexts can use the common image/detail shell under existing RLS, but Hotel/Stay context/UI is deferred. OG titles/descriptions are safe public text; canonical-domain and OG imagery are deferred rather than inventing branding/domain configuration. No new environment variables or R2/CORS settings are required.

Milestone 3 hosted/local proof is complete per the owner's Milestone 4 instruction. No remote infrastructure was modified by the agent.

## D021 — Existing Trip/Location slug routes and visibility

Milestone 5 implements `/trips`, `/trips/[slug]` and `/locations/[slug]` using existing unique slug columns and Bible section 11. No UUID/human-slug alternative or schema change. City/Country remain supporting labels, not destination guides. Published Location is independently eligible; unpublished related Trips and their required-child photos are hidden by existing RLS. Cookie-free anonymous clients query explicit minimal projections only; no privileged credentials, public GPS or notes.

## D022 — Public cover fallback and contextual photography

Resolve stored cover pointers under anonymous RLS, additionally filtering Nice + Travel and the exact Trip/Location identity. Invalid/stale/invisible pointers fall back to the first eligible public photo using existing deterministic ordering. No eligible image means text-only presentation, with no placeholder/Featured mutation. The cover is excluded from subsequent Nice pages. Trips show Nice prominently and Record in a separate The Record section; Hotel photography remains separate, not derived through Stay into a Trip gallery. Locations show Nice and links to visible related Trips. Dates remain optional/partial; no fabricated historical interval or itinerary logic.

## D023 — Cross-navigation and bounded public reads

Photo context now includes only the publicly resolved Trip/Location slug, enabling real Photo → Trip/Location links. Trip → Places → Location → Trips creates contextual navigation without new City/Country pages or duplicated Photo URLs. Trips nav becomes active; other future nav labels remain disabled. Public styles/components/derivative delivery extend Milestone 4 without redesign. All reads/media retain dynamic/no-store and the optimizer block.

Index uses twelve Trips plus lookahead, batched supporting geography/cover context and at most three concurrent one-photo cover queries. Detail galleries each use 24 photos plus lookahead; independent simple section pages preserve context. Trip Places and Location Trip relationships are also paged at 24. Supporting City joins are chunked at 200, geographic IDs at 100. Offset pages can shift if content changes concurrently; no queues/cursors/search infrastructure. No migration/new environment/configuration is required. Admin cover selection and Hotel/Stay UI remain deferred.

Milestone 4 is deployed and manually accepted on Vercel per the owner's Milestone 5 instruction.

## D024 — Hotel identity, visit records and existing recommendation ownership

Milestone 5 is deployed and manually accepted on Vercel per the owner. Milestone 6 implements `/admin/hotels` and `/admin/stays`, `/stays` (one published Hotel per entry), `/stays/[hotelSlug]` and `/stays/[hotelSlug]/[stayId]`. The individual lookup verifies Hotel membership; wrong-Hotel, Draft and missing visits return 404. Hotel remains independent of Location and persists across repeated visits. Every Stay belongs to a Trip; dates, room type, purpose, rating and review are optional. Dates are not constrained to an entered Trip interval. Ratings are independent whole 1–5 values, never averages.

Bible sections 5.3/10.7/49 put Family, Business and Personal / Leisure recommendations on Hotel, not Stay. The existing three Hotel flags are edited there and displayed in each Stay's context. No duplicate recommendation columns or new Stay-level product decision are invented. Stay rating/review remain specific to that visit. Public `review_text` and private `internal_notes` stay separate; public projections and anonymous grants omit notes/GPS. Reviews are plain text, not a top-level entity or CMS.

## D025 — Atomic Hotel/Stay geography and safe deletion

New migration `20261001000200_hotels_stays_workflow.sql` adds narrow invoker-rights, fixed-search-path, authenticated-admin-only `admin_save_hotel` and `admin_save_stay` functions. JSON arguments contain explicitly mapped existing columns; no dynamic SQL/privileged backend. Stay publication checks locked actual Hotel/Trip statuses; existing parent-aware RLS independently hides content after parent withdrawal. Stay saves add Hotel City to Trip Cities atomically. Hotel City edits add the City to all associated Trips, preserving explicit old memberships/order. Hotel names normalized by case/edge whitespace are checked within City alongside unique slugs; this is practical duplicate protection, not external property reconciliation.

Confirmed deletion uses existing RESTRICT FKs. Hotels with Stays and Stays with Photos/pending import assignments cannot be deleted. No cascading archive/image deletion or automatic unpublication. Photo deletion continues through the storage-aware recovery protocol. Completed/deleted/cleaned-failed import ledgers clear their temporary Stay assignment so an old operation does not indefinitely block a later unreferenced Stay deletion. Active/cleanup-required assignments remain traceable and block deletion until resolved. Successful storage cleanup clears the temporary Stay FK; retry validates and reattaches the selected Stay.

## D026 — One photo pipeline, durable context selection

Importer explicitly chooses Travel or Hotel; optional Hotel Stay may be assigned at import or afterward. Personal exclusion, Nice/Record, source verification, EXIF privacy, five UUID objects, WebP settings, multipart capabilities, leases/rollback, checksum duplicates and recoverable deletion remain the same. No second bucket/derivative/delivery system.

The new migration adds private `import_items.context` (Travel default for existing operations) and nullable `stay_id`, context CHECK/FK/index. `admin_reserve_context_photo_import` wraps the existing reservation under the batch lock and keeps context/Stay consistent across retries. Finalization creates the selected ready **Draft** context and optional Stay atomically; it never publishes. Duplicate bytes with conflicting context/Stay produce an actionable error, not replacement. Edit the existing Photo deliberately instead. Existing applied migrations are untouched; three existing finalization/failure/deletion functions are replaced only in the new migration, preserving their privileges and recovery semantics.

Photo editor supports both contexts. Travel keeps actual Trip–Location membership and no Stay; Hotel keeps only Stay and derives Trip/Hotel/geography, without artificial Locations. Ready Published Hotel photos require a Published Stay plus Published Hotel/Trip. Featured still requires Published Nice. Parent snapshots are loaded by the authenticated server action; no browser-supplied status is trusted. Anonymous RLS remains unchanged.

## D027 — Public lodging photography, navigation and bounds

Cookie-free anonymous clients query explicit safe Hotel/Stay/Photo projections. Hotel is visible by its own Published status; its dependent Stays/photos require published parents. A published Hotel can remain text-only when no Stay is public. Property general rating/recommendations do not aggregate visit ratings. Each visit exposes only actual optional public editorial fields.

Hotel/Stay covers are the first effectively visible Nice Hotel photo associated through the appropriate Stay/Hotel, ordered by position/capture/created/UUID. No explicit cover selector or new FK columns; no eligible photo means text. Hotel gallery aggregates Nice photography across visible Stays using the existing indexed Photo→Stay FK and a PostgREST inner relationship under RLS. Stay pages have Nice photography and separate The Record; Hotel photos never enter Trip Travel galleries.

Photo → Hotel/Stay/Trip, Stay → Hotel/Trip, Hotel → Stays, and Trip → Where I Stayed use real public links; Photo UUID URLs are unchanged. STAYS is active; MAP/ABOUT remain disabled. Public image routes reuse the existing derivative-only visibility check, private R2 and no-store behavior, with no new credentials/configuration.

Twelve Hotels per index; covers resolved at most three at a time with batched geography/photo contexts. Detail/relationship lists and Nice/Record galleries use 24 rows plus lookahead, independent page parameters and hero exclusion. Indexed relationship reads do not fetch all Hotel photograph IDs. Offset pages may shift during edits. Shared CDN caching, admin cover selection, broad importer reconciliation and Map/Search remain outside this milestone.


## D028 — Found Along and ordinary Singapore home geography

The owner approved the M7 assessment before implementation. Public identity is FOUND ALONG, with Photography and places by Alex Lim. Self-hosted variable Newsreader and Geist use next/font/local; checked-in font files include their SIL Open Font licenses ([Newsreader source](https://github.com/google/fonts/tree/main/ofl/newsreader), [Geist source](https://github.com/google/fonts/tree/main/ofl/geist)). Fonts are scoped to public presentation; no runtime font provider, pictorial logo or admin redesign. A restrained FA SVG is the utility icon. Existing editorial pages share type/space/rules; homepage leads with masthead, Featured Nice opening, recent Nice photography and real Trips/Singapore/Stays links. Existing MAP/ABOUT disabled labels remain; no fake pages.

Singapore is identified by unique countries.code = SG through ordinary City/Location relationships. `/singapore` uses bounded anonymous Travel-only inner joins with an explicit Photo→Location FK hint (the cover FK makes an unqualified relationship ambiguous). Nice photographs lead; Record has a separate paged section. Published Places link to existing slug routes. No Home table, flag, hard-coded destination rows or separate Photo system. Singapore photography remains in global Photos and can belong to a real Trip. Hotel photography never joins this Home view. Counts are deferred rather than adding per-Place aggregate queries.

## D029 — Singapore-only optional Trip and publication safety

M7 explicitly supersedes the prior every-Travel-Photo/every-Stay Trip requirement. Published Travel requires Location; Trip may be absent only if its Location is in SG. Every Stay requires Hotel; Trip may be absent only for an SG Hotel, including historical Draft Stays. Any assigned Trip must remain Published for public visibility. A Singapore photo with a Draft Trip is hidden until that relationship is deliberately removed or its Trip is Published. Existing Trip–Location membership FK remains intact for supplied pairs. Overseas trip-less publication is rejected.

Migration 20261002000100_found_along_home.sql adjusts row constraints, nullable Stay Trip and anonymous Photo/Stay policies; adds an invoker-only geography boolean and narrow assignment/geography guards; updates Hotel/Stay save transactions to skip absent Trip memberships. Guards reject geography edits that would invalidate trip-less home records, without cascading publication flags. RLS independently re-checks current geography and required parents; safe column grants and singleton administrator mutation policies remain. No owner-bypassing public view or service credential. Server preflight derives SG from the database, not submitted flags. Nullable Trip queries/selectors/links omit absent context. Hotel remains distinct from Location.

## D030 — Full-resolution source and compatible derivative profiles

Remove 4000px/16MP restrictions; retain ten sequential JPEGs, 25 MiB per file and add an 80MP decoder ceiling. A real 9520×6336 (~60MP) synthetic JPEG is tested. This is correctness coverage, not proof of worst-case photographic CPU/memory on Vercel. Files above 25 MiB remain explicitly rejected; no source recompression or dimension-based rejection at 4000px. Lightroom remains master. Source SHA-256/unchanged bytes, EXIF/GPS privacy, Personal pre-upload exclusion, duplicate/recovery/deletion protocols remain unchanged.

New WebP targets: 3200/1920/960/480, qualities 85/82/80/75, effort 4, native aspect and withoutEnlargement. When targets collapse to the same source dimensions, reuse the first higher-quality encoded buffer, retaining all four deterministic object names for existing finalization/deletion contracts. Responsive srcSet deduplicates identical widths. Source is still private and never a public delivery variant.

The same migration adds a technical photos.derivative_profile smallint (1 legacy; 2 M7), safe for public projection. Existing Photos default to 1; finalization writes the processing result profile. This is representation metadata, not source replacement/version history or a product entity. Responsive widths use the correct profile, avoiding falsely advertising older R2 bytes at new dimensions. No existing object is rewritten; deleted/reselected exports retain existing duplicate semantics. Public routes still check anonymous visibility on every read and stream unchanged WebPs with private/CDN no-store; optimizer remains blocked. No new environment variables, bucket configuration, CDN or shared caching.
