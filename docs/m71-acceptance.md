# Milestone 7.1 audit and acceptance

Hotel is property/current opinion; Stay is visit history. This is owner-authorized consolidation, not Map/Search or a public cache rewrite. No remote data/infrastructure was changed.

## Performance: measured, inferred, unknown

**Measured locally:** `pnpm exec tsx scripts/public-performance.ts` uses migrated disposable PostgreSQL, actual supabase-js HTTP builders and anonymous RLS. It seeds 12 additional Trips/Hotels; index selection has twelve entries, mostly without photos. Counts include explicit context reads, not browser images/metadata React request-local deduplication. The detail Trip audit excludes the separate Where I Stayed list, so it is a component-query count, not a claim about total production HTTP traffic.

| Path/component | Before requests | After requests |
| --- | ---: | ---: |
| / opening/recent | 8 | 7 |
| /photos selection/context | 7 | 6 |
| /singapore sections (empty SG fixture; standalone opening) | 5 | 5 |
| /trips twelve entries | 16 | 5 |
| /trips/[slug] identity/cover/geography/places/Nice/Record | 19 | 19 |
| /locations/[slug] | 11 | 11 |
| /stays twelve entries | 15 | 4 |
| /stays/[hotelSlug] | 13 | 12 |
| /photos/[id] Hotel detail/context | 6 | 4 |

The after Hotel page also includes the new Hotel-level Record section. A separate automated test populates twelve Hotel covers and asserts at most eight requests, one cover RPC, unchanged eligible gallery content and private-field omission. Local SQL milliseconds vary with fixture warmup and are deliberately not treated as Vercel speedup evidence.

**Inferred:** remote round-trip latency magnifies sequential HTTP reads. Index cover N+1 and the old Stay→Hotel context dependency were likely contributors. Each image still incurs one Supabase authorization plus one R2 GET through Vercel; this dominates image-heavy traffic when network/region/cold-start latency is high. Public pages remain Server Components; no client gallery state/runtime font requests or transforms were added.

**Unknown:** actual Vercel cold/warm TTFB/LCP, Supabase/R2 regional latency, actual JPEG/WebP sizes/entropy and mobile transfer time. A read-only request to https://foundalong.com failed TLS establishment from this environment; it is not proof of a production outage. No authenticated production inspection was performed. Verify actual deployment URL/TLS before interpreting performance.

### Fixes and evidence

| Problem/evidence | Change | Expected effect |
| --- | --- | --- |
| Twelve cover HTTP requests on twelve index entries | Capped invoker/RLS cover-ID RPC + one safe Photo projection; geography parallel | Remove per-entry HTTP fan-out, retain bounded IDs/current visibility |
| Mixed context reads wait for Stay, then Hotel before other parents | Direct Hotel FK; Hotel/Location/Trip requests parallel | Remove visit lookup and two sequential dependency steps |
| Cover completes before unrelated detail reads start | Start geography/history/Record during cover lookup; Nice waits only for exclusion | Shorter critical path; same eligibility/pagination |
| SG fallback requests/attaches an extra Nice page already loaded by Home | Reuse loaded Nice fallback in page composition; standalone fallback fetches one | Avoid duplicate page/context reads when Featured is absent |
| Index receives full review/address/description despite not displaying them | Summary projection excludes editorial bodies | Less JSON/serialization, especially with long reviews |
| CSS index single-column at 740px but sizes at 700px | Match 740px | Correct image resolution at intermediate mobile widths |
| Every contextual grid eagerly promotes first two photos below hero | Contextual grids lazy; only global Photos first two eager | Less competing initial image traffic |
| Portrait detail is height-capped but sizes advertises desktop width | Native ratio + existing 76/85vh bounds in sizes | Avoid selecting unnecessarily large portrait derivatives |

No derivative sizes/quality or import limits changed. Legacy 2400/1600/600/300 and new 3200/1920/960/480 remain accurately advertised, without upscaling/regeneration. Public source.jpg remains rejected. No long-lived/shared image cache, public bucket or optimizer was enabled; withdrawal takes effect on the next request. In-flight/saved bytes cannot be revoked.

## GPS/privacy audit

- `processJpeg` extracts optional EXIF through exifr; invalid/unpaired coordinates become null, never fabricated. Finalization stores them in photos.latitude/longitude. Both contexts use this pipeline.
- Authenticated singleton admin alone reads exact GPS/source. Anonymous Photo column grants reject latitude/longitude/storage/source fields; unrelated authenticated users get no archive rows or writes.
- All public Photo/Hotel/Stay/geographic selectors are explicit. Hotel page props contain current public review, not private Stay notes/GPS. Public geography uses editorial Location/Hotel, not EXIF positions.
- Real Sharp tests confirm WebPs have no EXIF/XMP/GPS; source hash remains identical. Public route accepts only four variants and re-checks current anonymous RLS before R2, including after Hotel/Photo/Travel-parent withdrawal. Response headers prevent shared caching.
- Browser HTML/serialized payloads are checked with distinctive synthetic private coordinate values. Synthetic previews are used for layout; real WebP stripping and media authorization are separately tested.
- No GPS requirement, manual per-Photo GPS input or public GPS endpoint was added.

For M8, inspect coverage through the trusted Supabase SQL editor **as owner only** (do not turn this into a public API):

```sql
select context, count(*) as total,
       count(*) filter (where latitude is not null and longitude is not null) as with_private_gps,
       count(*) filter (where location_id is not null) as with_editorial_location
from public.photos group by context;

select status, count(*) as locations,
       count(*) filter (where latitude is not null and longitude is not null) as with_representative_coordinates
from public.locations group by status;
```

Exact-GPS coverage of hosted real photographs is unknown here. Travel publication requires editorial Location regardless of GPS. Locations/Hotels already have optional paired representative coordinates; there is no PostGIS/map table. Future M8 must explicitly choose safe precision/representation and retain private GPS, independent publication eligibility, source protection and Hotel/Travel separation. Do not manually populate all coordinates or decide map behavior in M7.1.

## Manual hosted migration

1. Review `supabase/migrations/20261003000100_hotel_archive_refinement.sql`; confirm all M1–M7 migrations are applied. Take your normal backup/export before this intentional column removal.
2. Stop active imports/edits during the cutover. Old application code and new schema are not compatible; keep the cutover window short. Pending import Hotel relationships migrate, but old in-flight requests must finish/expire before switching versions.
3. With a linked/authenticated CLI, run `supabase migration list` and `supabase db push --dry-run`. Review that **only** the M7.1 migration is pending, then personally run `supabase db push`. Do not use hosted reset.
4. Alternatively execute this one whole file once in Supabase SQL Editor. It is transactional and notifies PostgREST to reload. Reconcile CLI migration history before later pushes; do not execute twice.
5. Deploy this commit through the normal GitHub→Vercel workflow. No new environment variables, credentials, CORS or R2 setting changes. Local fresh embedded SQL application/type drift validates the migration; a hosted CLI dry run was not executed by the agent.
6. Existing Hotel rating/recommendations/description and Stay IDs/dates/Trip/private notes/status survive. Stay rating/review/room/purpose are intentionally discarded. Re-enter the current review/rating at Hotel where desired; no review inference/merge. Previously hidden Published Hotel photos are now Draft/unfeatured: review before explicitly republishing. No image object was moved/deleted/regenerated.

## Production acceptance

1. Edit a Hotel's current whole-star rating, recommendations and review; reject half/out-of-range ratings. Confirm public Hotel shows it once.
2. Add two visits using Hotel + dates (or unknown dates). Singapore may omit Trip; overseas must select one. Try reversed dates; confirm errors preserve values. No visit review/rating form. Delete an unreferenced visit: Hotel opinion/photos remain.
3. Import one Hotel JPEG, select Hotel directly, assign/publicize under Published Hotel. Check unchanged source hash/five objects/profile, private EXIF/GPS and Nice/Record. Repeat exact bytes: no duplication/replacement. Personal/oversized files remain excluded. Then try a full-resolution file under 25 MiB/80MP.
4. Choose a Published Nice Hotel cover. Record/unrelated/Draft covers must be unavailable/rejected. Unpublish cover: fallback or text, never stale image authorization. Clear cover before storage-aware Photo deletion; verify all five objects removed and failure remains retryable. Hotel deletion is blocked by visits/photos/pending imports.
5. Signed out, check /stays, Hotel, Hotel Photo and Trip→Hotel links. Visit a previously public Stay URL: redirect to Hotel. Draft/missing/wrong-Hotel Stay URL: 404. Hotel photos stay absent from /singapore and Trip Travel galleries.
6. Unpublish Hotel/Photo: subsequent detail and derivative requests fail. Unpublish a Stay/Trip: relevant visit history hides; independent Hotel gallery remains. Travel parent withdrawal remains effective. Source variant/anonymous admin source always denied.
7. At 1440/768/390/320px inspect Hotel review/history, nav, mixed-aspect photography, no overflow/fake content. In Network verify WebP responsive variants, lazy below-fold requests and no exact GPS/private notes/source URLs in HTML/JSON.
8. On actual Vercel, record three cold/warm navigation runs for all nine representative paths. Capture TTFB/LCP, image variant/transferred bytes/rendered width/DPR and image endpoint duration. Separate data waits from R2 transfer; do not add shared caching to improve numbers. Compare with this local query-count audit, not its SQL timings.

M8 remains deferred. First apply/accept this consolidation, re-enter current Hotel opinions, verify real imports/withdrawal and gather production performance/GPS coverage. Then decide Map precision and provider explicitly.

## Material file manifest

- `docs/buildbible.md`
- `docs/decisions.md`
- `docs/implementation-status.md`
- `docs/m71-acceptance.md`
- `docs/r2-setup.md`
- `docs/technical-plan.md`
- `scripts/generate-database-types.ts`
- `scripts/preview-fixture.ts`
- `scripts/public-performance.ts`
- `src/app/(public)/photos/page.tsx`
- `src/app/(public)/stays/[hotelSlug]/[stayId]/page.tsx`
- `src/app/(public)/stays/[hotelSlug]/page.tsx`
- `src/app/(public)/stays/page.tsx`
- `src/app/admin/(protected)/hotels/[id]/page.tsx`
- `src/app/admin/(protected)/photos/[id]/page.tsx`
- `src/app/admin/(protected)/photos/actions.ts`
- `src/app/admin/(protected)/photos/import/page.tsx`
- `src/app/admin/(protected)/stay-actions.ts`
- `src/app/admin/(protected)/stays/[id]/page.tsx`
- `src/components/admin/hotel-form.tsx`
- `src/components/admin/photo-form.tsx`
- `src/components/admin/photo-importer.tsx`
- `src/components/admin/stay-form.tsx`
- `src/components/public/journey.tsx`
- `src/components/public/photograph.tsx`
- `src/components/public/stay.tsx`
- `src/lib/admin/queries.ts`
- `src/lib/data/public-columns.ts`
- `src/lib/data/public-home.ts`
- `src/lib/data/public-journeys.ts`
- `src/lib/data/public-photos.ts`
- `src/lib/data/public-places.ts`
- `src/lib/data/public-singapore.ts`
- `src/lib/data/public-stays.ts`
- `src/lib/photos/model.ts`
- `src/lib/photos/repository.ts`
- `src/lib/validation/content.ts`
- `src/lib/validation/photo.ts`
- `src/lib/validation/publishing.ts`
- `src/types/database.ts`
- `supabase/migrations/20261003000100_hotel_archive_refinement.sql`
- `supabase/tests/fixtures.sql`
- `tests/database.test.ts`
- `tests/database.ts`
- `tests/fixtures/m71-legacy.sql`
- `tests/ingestion.test.ts`
- `tests/public-client.ts`
- `tests/public.test.ts`
- `tests/publishing.test.ts`
- `tests/refinement.test.ts`
- `tests/singapore.test.ts`
- `tests/stays.test.ts`
