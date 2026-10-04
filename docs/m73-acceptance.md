# M7.3 Hotel simplification amendment

Stay was removed after real-world use demonstrated that individual visit records added maintenance friction without sufficient archival value.

Hotel = persistent property + current opinion + Hotel photography. There is no Stay, Visit, history/date array or Hotel–Trip entity.

## Schema and preservation

New migration: `20261004000100_remove_stays.sql`, after M7.1. Replaces Hotel save (no Trip-City propagation), Trip City removal/deletion and Singapore Travel assignment/geography guards; drops Hotel geography visit trigger, Stay save RPC and Stay table. Table removal also removes its policies, triggers, indexes and Hotel/Trip foreign keys. No CASCADE: unexpected dependencies fail the migration transaction. Earlier migrations are unchanged.

Hotel identity/geography/rating/recommendations/review/cover/status/order/timestamps are unchanged. Photos already reference Hotel directly through M7.1 hotel_id; no new relationship or relational conversion is required. All Hotel/Photo/import fields, active assignments, UUIDs, hashes, private EXIF/GPS, source/derivative keys, profiles and publication flags are preserved exactly by the upgrade test. Migration does not move/delete/regenerate any R2 objects. All Stay rows, dates, notes, status, order and Trip relationships are intentionally discarded; no re-entry is required, though dates can be mentioned in Hotel review naturally. Existing explicit Trip City memberships remain geography, not a reconstructed Hotel relationship.

## Admin and routes

Hotel edit: current opinion → Photos / Add Photos / secure thumbnails → cover selector. Selected cover is labelled in the panel. No suitable cover means deterministic Published Nice fallback or text. Deletion still requires clearing cover references and uses the existing storage-aware Photo workflow. Hotel deletion refuses Photo/pending-import dependencies.

Add Photos opens `/admin/photos/import?hotel=<id>`. Server checks the target exists, browser displays and locks Hotel context/property; no copied IDs or Stay creation. Same ten-JPEG/25 MiB/80MP importer, Personal skip, unchanged source, EXIF/private GPS, checksum/recovery and no-upscale 3200/1920/960/480 WebPs; profile 1 legacy derivatives remain supported. Hotel-specific admin photo pagination retains the Hotel filter. Featured still uses the existing Photo editor; no new Hotel Featured flag.

Canonical public `/hotels` and `/hotels/[hotelSlug]` retain property/current-opinion/galleries and omit history/Trip relationships. Global /photos (Nice and Record) and homepage photographs now explicitly filter Travel; /singapore and normal Trip/Location galleries also exclude Hotel documentation. Hotel photo UUID detail/media remain available within the Hotel gallery, with canonical Hotel cross/back links. Public nav is PHOTOS/TRIPS/SINGAPORE/HOTELS/ABOUT; About remains disabled, Map is omitted.

- `/stays` → 308 `/hotels`.
- `/stays/[hotelSlug]` → 308 `/hotels/[hotelSlug]` only for an anonymously visible Published Hotel.
- `/stays/[hotelSlug]/[stayId]` → same checked Hotel destination; discarded visit identifier is intentionally ignored, including arbitrary/previously Draft visit identifiers.
- Draft/missing/invalid Hotel slug → 404, with no Location redirect. Configuration/provider failure is an unavailable response, not a fabricated redirect.

Redirect responses retain the dynamic/no-store public boundary. A previously followed permanent destination still checks Hotel visibility; old redirects never authorize private content/images.

## Security and performance evidence

RLS and safe anonymous column grants remain unchanged for Hotels/Photos. Image routes still check currently effective Photo/Hotel/Travel-parent visibility before R2; source/unknown variants rejected; no unsafe shared cache/optimizer/public bucket. Exact GPS and storage/private operational fields do not enter public payloads, and WebP metadata stripping remains tested. Unrelated users/anonymous mutations are rejected. No raw GPS/source endpoint is added.

Local disposable PostgreSQL + actual supabase-js query-count audit, not production latency:

| Component | M7.1 | M7.3 |
| --- | ---: | ---: |
| Homepage selection/context | 7 | 6 |
| Normal Photos selection/context | 6 | 5 |
| Twelve-entry Trips index | 5 | 5 |
| Twelve-entry Hotel index | 4 | 4 |
| Hotel detail | 12 | 9 |
| Hotel Photo detail/context | 4 | 4 |

Hotel detail loses three visit/history/context requests; ordinary photography no longer fetches Hotel context. Bounded invoker cover RPC, batched geography, parallel independent queries, lazy contextual grids and accurate responsive derivative sizes remain. Audit fixture has sparse covers; separate twelve-populated-cover test guards against HTTP N+1. Trip detail audit counts its identity/photo/place component, not a historical visit section. No derivative size/quality/limits or image caching architecture changed. Production TTFB/LCP/bytes/region costs remain unknown; per-image Supabase authorization and Vercel/R2 streaming remain known tradeoffs.

## Verification

101 automated tests pass. Obsolete Stay tests removed/updated; meaningful Hotel CRUD/opinion/geography/publication/import/duplicate/failure/deletion/cover/privacy/bounded-gallery tests retained. New upgrade test compares full Hotel/Photo/import rows before/after removal. Collection separation and Hotel-context Add Photos rendering added. Historical M7→M7.1 upgrade test remains, using its historical fixture only.

Lint, typecheck, catalog type-drift and production build pass. Production smoke uses isolated missing configuration; it verifies canonical Hotels shell/old index redirect, invalid slugs, private guards, source rejection and no registration. Populated route checks use a disposable SQL/Auth fixture and synthetic WebP previews, not production Auth/R2: 28 checks across public Hotels/index/detail, normal Photos, Singapore, Hotel Photo detail, admin Hotel and Hotel-targeted import at 1440/768/390/320px. No horizontal overflow. Legacy 308 and Draft/missing Hotel 404 verified with real local Next responses. No upload was sent to R2; real JPEG processing and fake-R2 recovery remain automated tests. Local fixture processes stopped after verification.

## Manual hosted rollout

1. Review migration history. Confirm M7.1 and all predecessors are applied. Back up as normal; Stay data loss is deliberate. Never run test fixtures against hosted Supabase.
2. Pause imports/edits and plan a short coordinated code/schema cutover. Old application code still queries Stay and is incompatible after removal.
3. With the linked CLI, personally run `supabase migration list` and `supabase db push --dry-run`; review that only `20261004000100_remove_stays.sql` is pending. If prior migrations are pending, resolve that history first.
4. Personally run `supabase db push`, or execute this whole transaction once in SQL Editor and reconcile CLI history before future pushes. No hosted reset or old migration edits. PostgREST reload notification is included.
5. Deploy matching code through GitHub→Vercel promptly. No environment variables, credentials, bucket/CORS or Cloudflare changes. Agent performed local fresh/upgrade validation only, no hosted dry run/apply/deployment.

## Manual production acceptance

1. Sign in → Hotels → existing property. Confirm current rating/review/recommendations/geography and photos persisted; no Stay nav/history/actions or Trip lodging section.
2. Click Add Photos. Confirm current property and Hotel context are already selected/locked. Import Nice/Record JPEGs; new records remain Draft and have hotel_id, no Trip/Location. Check source hash, four derivatives, EXIF and private GPS; Personal/oversized exclusions and exact-byte retry still work.
3. Publish a valid Nice Hotel photo and set cover. Draft/Record/unrelated cover cannot be selected/saved. Clear/unpublish cover to verify safe fallback. Use existing Photo editor for Featured.
4. Signed out, inspect /hotels and property review/gallery at desktop/tablet/390/320px. Hotel UUID photo detail links back correctly. Hotel photos absent from /photos, /singapore and Trip/Location galleries.
5. Test all three legacy URL shapes: expected 308 for public Hotel, 404 for Draft/missing Hotel regardless of former visit ID. Confirm no private fields/GPS/source paths in HTML/JSON.
6. Unpublish Hotel or Photo; fresh detail/derivative reads fail immediately. Public source access always fails. Restore intended states. Hotel/Photo deletion retains existing RESTRICT and storage-aware failure handling.
7. Measure actual Vercel TTFB/LCP/transfer before considering more performance work. No broad caching change or Map/Search here.

Remaining limits: offset pagination may move during edits; selected covers must be cleared before deleting Photo; admin lists/catalogs use existing bounded/chunked strategies. Production Auth/R2/full-resolution resource capacity and production latency require owner acceptance. No M8 work was begun.

## Material file manifest (includes removed files)

- `README.md`
- `docs/buildbible.md`
- `docs/decisions.md`
- `docs/implementation-status.md`
- `docs/m71-acceptance.md`
- `docs/m73-acceptance.md`
- `docs/r2-setup.md`
- `docs/technical-plan.md`
- `scripts/preview-fixture.ts`
- `scripts/public-performance.ts`
- `scripts/smoke-production.ts`
- `src/app/(public)/hotels/[hotelSlug]/not-found.tsx`
- `src/app/(public)/hotels/[hotelSlug]/page.tsx`
- `src/app/(public)/hotels/page.tsx`
- `src/app/(public)/layout.tsx`
- `src/app/(public)/page.tsx`
- `src/app/(public)/photos/[id]/page.tsx`
- `src/app/(public)/public.css`
- `src/app/(public)/stays/[hotelSlug]/[stayId]/page.tsx`
- `src/app/(public)/stays/[hotelSlug]/not-found.tsx`
- `src/app/(public)/stays/[hotelSlug]/page.tsx`
- `src/app/(public)/stays/page.tsx`
- `src/app/(public)/trips/[slug]/page.tsx`
- `src/app/admin/(protected)/hotel-actions.ts`
- `src/app/admin/(protected)/hotels/[id]/page.tsx`
- `src/app/admin/(protected)/photos/[id]/page.tsx`
- `src/app/admin/(protected)/photos/import/page.tsx`
- `src/app/admin/(protected)/photos/page.tsx`
- `src/app/admin/(protected)/stay-actions.ts`
- `src/app/admin/(protected)/stays/[id]/page.tsx`
- `src/app/admin/(protected)/stays/new/page.tsx`
- `src/app/admin/(protected)/stays/page.tsx`
- `src/app/admin/(protected)/trips/[id]/page.tsx`
- `src/app/globals.css`
- `src/components/admin/hotel-form.tsx`
- `src/components/admin/hotel-photos.tsx`
- `src/components/admin/navigation.tsx`
- `src/components/admin/photo-form.tsx`
- `src/components/admin/photo-importer.tsx`
- `src/components/admin/stay-form.tsx`
- `src/components/admin/trip-associations.tsx`
- `src/components/admin/trip-stays.tsx`
- `src/components/public/hotel.tsx`
- `src/components/public/journey.tsx`
- `src/components/public/stay.tsx`
- `src/lib/admin/catalog.ts`
- `src/lib/admin/form-state.ts`
- `src/lib/admin/queries.ts`
- `src/lib/data/public-archive.ts`
- `src/lib/data/public-columns.ts`
- `src/lib/data/public-hotels.ts`
- `src/lib/data/public-journeys.ts`
- `src/lib/data/public-lodging.ts`
- `src/lib/data/public-photos.ts`
- `src/lib/data/public-stays.ts`
- `src/lib/photos/repository.ts`
- `src/lib/validation/content.ts`
- `src/lib/validation/publishing.ts`
- `src/types/database.ts`
- `supabase/migrations/20261004000100_remove_stays.sql`
- `supabase/tests/fixtures.sql`
- `tests/database.test.ts`
- `tests/fixtures/m73-legacy.sql`
- `tests/hotel-simplification.test.ts`
- `tests/hotels.test.ts`
- `tests/ingestion.test.ts`
- `tests/places.test.ts`
- `tests/public-client.ts`
- `tests/public.test.ts`
- `tests/publishing.test.ts`
- `tests/refinement.test.ts`
- `tests/singapore.test.ts`
- `tests/stays.test.ts`
- `tests/workflow.test.ts`
