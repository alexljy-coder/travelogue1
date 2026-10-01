# Implementation architecture decisions

Product authority: [buildbible.md](./buildbible.md). Owner resolutions below supersede Milestone 0 proposals; the Build Bible itself is unchanged.

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

## D006 — Future R2 remains private and deferred

The whole bucket stays private. Future authenticated scoped PUT signing, per-photo Node/Sharp work, readiness state and visibility-checked image delivery must be benchmarked on the actual Vercel plan. No public r2.dev, random-key privacy assumption, upload implementation or credentials now.

## D007 — Implementation extensions

photos.import_batch_id, processing_status, captured_at_offset_minutes and editorial_order support import bookkeeping and safe publication without replacement/version management. Trips/Locations/Hotels/Stays also have optional editorial_order; join sequence remains optional. Hotel/Stay cover eligibility will use the existing associated-photo model, not new cover FK columns until explicitly needed by that UI. stays.internal_notes replaces ambiguous notes; review_text is public editorial content. No photos.slug.

## D008 — Small milestones

Foundation → Trip/Location workflow → private ten-photo import → publish/public Trip slice, then Hotel/Stay and editorial breadth. Suggested Bible milestones are subdivided without changing V1 scope. Stop at each requested milestone.

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
