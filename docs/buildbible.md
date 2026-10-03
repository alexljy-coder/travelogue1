# Personal Travel Archive
## V1 Build Bible

**Status:** V1 Architecture & Product Specification  
**Purpose:** Source of truth for implementation by Codex, Claude Code, or another coding agent.

---

# 1. Product Definition

## 1.1 What this product is

A **personal visual travel archive that connects photography, trips, places and hotel stays through an interactive geographic record.**

The primary purpose is to preserve and explore the owner's own travel history.

The secondary purpose is to make that archive useful and interesting to other people.

Photography is the primary visual language, but **travel experiences are the subject**.

The system should eventually support a broader personal brand/business ecosystem, but V1 should remain focused on building an excellent archive.

## 1.2 What this is NOT

The product must not become:

- Flickr or Instagram
- TripAdvisor or Booking.com
- A generic travel blog
- An SEO content farm
- A social network
- A multi-author CMS
- A generic hotel review site
- A photography portfolio disconnected from travel

## 1.3 Product principles

1. **Archive first**
2. **Photography first, but not photography-only**
3. **Structure underneath, simplicity on top**
4. **Never force long-form writing**
5. **Personal perspective**
6. **Work travel is real travel**
7. **Do not become a social network**
8. **Do not become a generic travel SEO site**
9. **Incomplete historical information is valid**
10. **The database should make the photography more interesting, not make the website look like a database**

---

# 2. Core Conceptual Model

The core entities are:

- Country
- City
- Location
- Trip
- Hotel
- Stay
- Photo

There is no separate Story entity in V1.

There is no separate Review entity in V1.

A review is the current personal opinion attached to a Hotel, not a separate entity.

## 2.1 Geography

```text
COUNTRY
   ↓
CITY
   ↓
LOCATION
```

### Country

A geographic grouping.

Example:

> China

### City

A geographic grouping.

Example:

> Beijing

City coordinates are representative points only. They are **not city boundaries or radius calculations**.

### Location

A meaningful physical destination actually visited, experienced or photographed.

Examples:

- Forbidden City
- Mutianyu Great Wall
- Gardens by the Bay
- Longmen Grottoes
- Matsumoto Castle
- Pulau Ubin

A Location belongs to one City but may appear in multiple Trips.

A Location is not the same thing as a Hotel.

---

# 3. Trip Model

A Trip is:

> A distinct journey or outing the owner considers a meaningful travel experience worth recording.

A Trip has a time period and may contain Cities, Locations, photographs and Hotel Stays.

It does not require a formal itinerary or long-form story.

Examples:

- China Winter 2026
- Weekend Bangkok
- Photography Day — Pulau Ubin
- Singapore Staycation — August 2026
- 2 Hours in Ho Chi Minh City Between Meetings

## 3.1 Trip fields

- ID
- Title — required
- Slug — required
- Start date — optional
- End date — optional
- Purpose — optional:
  - Leisure
  - Business
  - Family
  - Photography
  - Mixed
- Description — optional
- Cover photo — optional
- Status:
  - Draft
  - Published
- Created timestamp
- Updated timestamp

### Historical data rule

Dates are genuinely optional.

If an old trip's dates are unknown, store them as unknown.

Never invent dates simply to make the record complete.

---

# 4. Trip Relationships

A Trip can contain many Cities.

A Trip can contain many Locations.

A City or Location can appear in many Trips.

## 4.1 Trip → City

Use a join table:

`trip_cities`

Fields:

- `trip_id`
- `city_id`
- `sequence` — optional

`trip_id + city_id` must be unique.

Sequence preserves geographic order where known without forcing the public site to behave like a rigid itinerary.

## 4.2 Trip → Location

Use:

`trip_locations`

Fields:

- `trip_id`
- `location_id`
- `sequence` — optional
- `visited_at` — optional

`trip_id + location_id` must be unique.

`visited_at` preserves chronology when known.

The public site may show chronology, but does not need to present the Trip as a formal itinerary.

---

# 5. Hotel and Stay Model

## 5.1 Hotel

A Hotel is a persistent property and the owner's current opinion of it. Hotel owns the optional whole-star rating (1–5), current public review, Family / Business / Personal-Leisure recommendations, Hotel photography and optional cover. Revisiting a Hotel does not create a new review or gallery. Edit Hotel when the current opinion changes; no historical rating versions.

Hotel fields: ID, required name/slug/City, optional brand/address/paired representative coordinates/description/rating/review_text/cover_photo_id/editorial position, existing recommendation flags, Draft/Published and timestamps. Hotel is not a Location.

## 5.2 Stay

A Stay is a lightweight visit record: Hotel, optional check-in/out dates, Trip, private internal note, publication status, ID/timestamps and retained internal display position. Room type, purpose, per-visit rating and review are removed in M7.1. Multiple Stays can reference one Hotel. Dates remain unknown when unknown; compare only when both are known.

Trip remains required outside Singapore. Singapore Hotels (Hotel → City → Country code SG) can have Stays without Trip. Any assigned Trip must be Published for public visit history. Hotel photography no longer depends on an individual Stay/Trip.

## 5.3 Current opinion and history

Record another visit without re-entering rating, review or photographs. Hotel opinion and gallery persist when a visit is edited/deleted. Visit history is understated; private notes never appear publicly. No separate Review entity.

---

# 6. Crucial Hotel/Trip Content Separation

A Hotel Stay can belong to a Trip without becoming part of the Trip's photographic story.

The relationship is historical/contextual.

It does not imply content nesting.

Therefore:

```text
TRIP
 ├── Travel Photos
 └── Stays

HOTEL
 ├── Current opinion
 ├── Hotel Photos
 └── Stays (visits)
```

Hotel photographs do **not** automatically appear in Trip galleries.

---

# 7. Photo Model

Photography is central to the product.

Lightroom remains the photographic source of truth.

The website is the publishing/archive layer.

## 7.1 Lightroom folder model

The owner's Lightroom workflow is:

```text
01 Nice
02 Record Shots
03 Personal
```

Meaning:

- Nice = editorial/publishing-quality photography
- Record Shots = useful historical record
- Personal = never uploaded

The website must respect this classification.

## 7.2 Publication rules

### Nice

Automatically eligible for:

- Main Photos page
- Location galleries
- Trip galleries
- Hotel/Stay photography where applicable

Can optionally be Featured.

### Record

Does not appear on the main Photos page by default.

It does appear within the relevant Trip's **The Record** section.

A Record photo can be manually promoted to Nice.

### Personal

Never imported.

The importer skips Personal automatically.

---

# 8. Photo Context

A Photo has one primary context:

- Travel
- Hotel

## 8.1 Travel Photo

```text
Photo
 ├── Trip
 └── Location
       └── City
             └── Country
```

For a published Travel photo:

- Location is required
- Trip is required outside Singapore
- Singapore Location photography may omit Trip
- Singapore photography may also belong to a real Trip
- Any assigned Trip and the Location must be Published for public visibility

Singapore is home, derived through Location → City → Country (code SG). It is not a fake Trip, new table, flag or Photo context. Hotel photography remains separate and does not automatically enter the Singapore photographic view.

## 8.2 Hotel Photo

```text
Photo → Hotel → City → Country
```

Published Hotel photography requires Hotel. It does not require Stay, Trip or Location. Hotel gallery accumulates photographs across visits without duplicating R2 objects. Hotel must be Published for public visibility. Hotel photography stays separate from normal Travel/Singapore photography.

---

# 9. Photo Fields

## Identity / storage

- ID
- Filename
- Storage key
- File hash
- Width
- Height
- File size

## Editorial

- Classification:
  - Nice
  - Record
- Context:
  - Travel
  - Hotel
- Featured — boolean
- Caption — optional
- Description — optional
- Status:
  - Draft
  - Published

No AI-generated captions or descriptions.

## Relationships

- Trip ID — required for published Travel photos outside Singapore; optional for Singapore Locations
- Location ID — required for published Travel photos
- Hotel ID — required for published Hotel photos

Invalid combinations should be prevented by application/database validation.

## EXIF

All optional:

- Captured at
- Latitude
- Longitude
- Camera make
- Camera model
- Lens
- Focal length
- Aperture
- Shutter speed
- ISO

EXIF GPS and Location are different concepts.

**EXIF GPS** = where the camera physically was.

**Location** = meaningful destination to which the photograph belongs.

The system should not infer a Location purely from city radius.

---

# 10. Supabase Database Schema

Core tables:

```text
countries
cities
locations

trips
trip_cities
trip_locations

hotels
stays

photos
import_batches
```

## 10.1 Countries

```text
id
name
code
slug
created_at
```

`code` and `slug` unique.

## 10.2 Cities

```text
id
country_id
name
slug
latitude
longitude
created_at
```

## 10.3 Locations

```text
id
city_id
name
slug
latitude
longitude
description
cover_photo_id
status
created_at
updated_at
```

## 10.4 Trips

```text
id
title
slug
start_date
end_date
purpose
description
cover_photo_id
status
created_at
updated_at
```

## 10.5 Trip Cities

```text
trip_id
city_id
sequence
```

## 10.6 Trip Locations

```text
trip_id
location_id
sequence
visited_at
```

## 10.7 Hotels

```text
id
name
slug
brand
city_id
address
latitude
longitude
description
review_text
cover_photo_id
rating
recommended_family
recommended_business
recommended_leisure
status
created_at
updated_at
```

## 10.8 Stays

```text
id
hotel_id
trip_id
check_in
check_out
internal_notes
status
created_at
updated_at
```

## 10.9 Photos

```text
id
filename
storage_key
file_hash
width
height
file_size

classification
context
featured
caption
description
status

trip_id
location_id
hotel_id

captured_at
latitude
longitude
camera_make
camera_model
lens
focal_length
aperture
shutter_speed
iso

created_at
updated_at
```

## 10.10 Import batches

V1 keeps import history deliberately simple.

```text
id
created_at
source_name
total_files
eligible_files
skipped_personal
imported
status
```

This is **not** a re-import/version-management system.

---

# 11. IDs and URLs

Use UUIDs internally.

Do not expose sequential database IDs.

Public URLs use human-readable slugs.

Examples:

```text
/trips/china-winter-2026
/locations/mutianyu-great-wall
/photos/forbidden-city-sunset
/stays/grand-hyatt-beijing
```

The exact URL structure can be refined during implementation, but URLs should be human-readable.

---

# 12. Admin Architecture

Admin is part of the same Next.js application.

```text
/admin
```

Supabase Auth protects the Admin.

V1 has one private administrator.

No public registration.

No complicated role system.

## 12.1 Admin sections

- Dashboard
- Photos
- Trips
- Locations
- Hotels
- Stays
- Imports

Settings can be added later.

## 12.2 Trip as the natural starting point

The normal workflow is:

```text
Create Trip
    ↓
Add Cities / Locations
    ↓
Add Hotels / Stays
    ↓
Import Photos
    ↓
Review
    ↓
Publish
```

However, every entity remains independently editable.

The user can later create a Location without reopening the entire Trip workflow.

## 12.3 Trip dashboard

Example:

```text
China Winter 2026

4 Cities
12 Locations
3 Stays
327 Photos

Locations       + Add
Hotels / Stays  + Add
Photos          Import Photos

View Public Trip
```

---

# 13. Lightroom Importer

The importer does not interact directly with Lightroom.

Workflow:

```text
Lightroom
   ↓
Export JPG folder
   ↓
Browser drag-and-drop
   ↓
Importer
   ↓
R2
   ↓
Image derivatives
```

If something goes wrong, the user can simply re-export from Lightroom.

No desktop application is required.

## 13.1 Lightroom export standard

Recommended standard:

- JPEG
- sRGB
- Full-resolution JPEG dimensions; no 4000px resize requirement
- Quality 88
- Screen sharpening: Standard
- EXIF retained

Folder structure:

```text
01 Nice/
02 Record Shots/
03 Personal/
```

The website imports only Nice and Record.

---

# 14. Importer Workflow

## Stage 1 — Drop

User drags an export folder into the browser.

The importer scans before uploading.

Example:

> 412 photos found  
> 327 eligible  
> 85 Personal skipped

## Stage 2 — Automatic grouping

The importer reads:

- filename
- file type
- capture date/time
- GPS
- camera
- lens
- dimensions
- folder classification

It compares against existing:

- Trips
- Cities
- Locations
- Stays

It suggests groupings.

Example:

```text
Zhengzhou
23 photos

Luoyang
71 photos

Kaifeng
42 photos

Beijing
191 photos
```

Where possible, it should go beyond City and suggest actual existing Locations.

## Stage 3 — Exceptions

Only uncertain photos require attention.

Example:

> 7 photos need your attention

The user can select all seven and batch assign:

- Trip
- Location
- Context
- Stay
- Classification

The importer should avoid requiring individual tagging wherever possible.

## Stage 4 — Import

Example:

```text
Ready to import

327 photos

Nice       94
Record    233
Personal   85 skipped

Travel    286
Hotel      41

[ Import 327 Photos ]
```

The importer then:

1. Uploads source JPGs to R2
2. Generates derivatives
3. Creates Photo records
4. Applies relationships
5. Records import history

---

# 15. Importer Intelligence

The importer should be a **smart librarian, not an AI photographer**.

It should:

- organise
- group
- match
- suggest
- identify exceptions

It should NOT:

- generate captions
- generate descriptions
- judge photographic quality
- automatically decide Hotel vs Travel
- invent Locations
- invent Trip information
- automatically publish everything
- reorganise Lightroom files

Basic metadata processing should be deterministic.

AI should only be introduced later if a real ambiguity problem warrants it.

---

# 16. Import Matching Philosophy

Location matching is more important than city-radius matching.

The importer should prioritize:

1. Existing Locations
2. GPS proximity to existing Locations
3. Date/time
4. Existing Trip context
5. Other metadata/context

City is a broad geographic hint.

The importer should **not automatically create a new Location solely because unfamiliar GPS coordinates are detected**.

It can flag:

> Possible new location detected

and let the user decide.

If a published photo's meaningful Location cannot be established, it should remain unpublished.

---

# 17. Re-import / Replacement

**Not V1.**

There is no complicated:

- re-import reconciliation
- photo versioning
- replacement workflow
- Lightroom sync
- duplicate reconciliation system

The intended V1 workflow is:

> Export once → Import once → Done.

This can be revisited in Phase 2.

---

# 18. R2 Image Storage

Cloudflare R2 is the website's image warehouse.

Supabase stores metadata.

R2 stores image files.

Example namespace:

```text
photos/
  8f/
    8f3a2c.../
      source.jpg
      large.webp
      medium.webp
      thumbnail.webp
      tiny.webp
```

The database stores the `storage_key`.

It does not need to store five separate URLs.

---

# 19. Image Derivatives

Source:

- Unchanged full-resolution sRGB Lightroom JPEG, subject to bounded byte/pixel safety limits

Derivatives:

- Large — approximately 3200px
- Medium — approximately 1920px
- Thumbnail — approximately 960px
- Tiny — approximately 480px

All preserve the original aspect ratio.

No forced square crops.

Exact dimensions can be tuned during implementation/testing.

WebP is the V1 derivative format.

AVIF is deferred.

## Source philosophy

The exported JPEG in R2 is the **website publishing source**, not the photographic master.

Lightroom remains the photographic master.

No RAW, PSD, TIFF or Lightroom catalog storage in R2.

---

# 20. Image Delivery

Next.js determines which representation is appropriate.

Typical usage:

```text
Gallery
→ thumbnail / medium

Desktop gallery
→ medium / large

Photo detail
→ large

Fullscreen
→ large metadata-free derivative; source is administrator-only
```

Responsive image delivery should avoid sending unnecessarily large derivatives to small screens unnecessarily.

The exact responsive breakpoints can be tuned after visual testing.

---

# 21. Public Site Navigation

Primary navigation:

```text
PHOTOS
TRIPS
SINGAPORE
STAYS
MAP
ABOUT
```

Brand/logo on the left.

Desktop:

```text
[ FOUND ALONG ]            PHOTOS TRIPS SINGAPORE STAYS MAP ABOUT
```

Mobile:

```text
[ BRAND ]                              ☰
```

Locations and Cities are not primary navigation items.

They are contextual discovery entities.

Search is Phase 2.

---

# 22. Photos UX

The Photos page uses an **editorial masonry layout**.

It should feel like a photographic archive, not a social media feed.

Default:

- Nice photos only
- Curated/editorial ordering
- Native image proportions

Do not force all images into identical cards.

Photo detail includes:

- Large photograph
- Location
- City/Country
- Date
- Trip if relevant
- Camera/lens
- Optional caption
- Optional description
- Related photography

Record Shots are not shown on the main Photos page by default.

They can appear in Trips under **The Record**.

---

# 23. Trip UX

Trips are visual journeys, not blog posts.

Trip cards can show:

- Cover photo
- Dates if known
- Country/Cities
- Optional short text

Trip detail can show:

- Title
- Dates if known
- Cities
- Hero/Featured photography
- Optional About this Trip
- Locations/geographic chapters
- Optional chronology
- Map
- Where I Stayed
- The Record
- Generated statistics

Generated statistics may include:

- Number of days, if dates are known
- Cities
- Locations
- Photos
- Stays

Do not manually store these statistics.

---

# 24. Stays UX

STAYS presents each Published Hotel once. `/stays/[hotelSlug]` is the primary public property/current-opinion page: identity, City/Country, current rating/recommendations/review, eligible Hotel photography and understated published visit history/Trip links. Nice photographs lead; Record remains a separate documentary section.

Individual Stay pages are no longer a core public concept. Existing `/stays/[hotelSlug]/[stayId]` URLs verify public visit membership, then redirect to the Hotel. Hidden/missing/wrong-Hotel visits return 404. New public links target Hotel, not individual visits.

---

# 25. Map UX

## Map V1

Keep the map deliberately small.

Features:

- Location pins
- Basic clustering
- Pan/zoom
- Location preview
- Location page
- Optional Hotel layer

No:

- Trip routes
- Chronological playback
- Animated journeys
- Photo clustering
- Advanced geographic storytelling

The map reads existing relational data.

It does not require a separate map database.

## Map V2

Potential future capabilities:

- Trip overlays
- Chronological exploration
- Photo clusters
- Hotel/stay layers
- Advanced filters
- Exploratory "wander around my travels" experience

---

# 26. Homepage

The homepage is minimal and photography-led.

Proposed structure:

1. Featured photograph / hero
2. Selected photography
3. Recent Trips
4. Recent Stays
5. Map preview / Where I've Been
6. About

It should not feel like a blog feed.

Avoid:

- Popular destinations
- Generic travel tips
- "Latest articles"
- SEO blocks
- Rankings
- Generic travel widgets

The homepage should communicate:

> **This is my archive. Come explore it.**

---

# 27. About

The About page answers:

> Who is behind this archive, and why does it exist?

Potential content:

- Person behind the archive
- Large photograph
- Short introduction
- Optional longer explanation
- Optional travel/photography/stay statistics
- Social links

It should not become:

- A CV
- A gear database
- A long autobiography
- A generic mission statement

Brand identity remains separate from the personal name.

---

# 28. Visual Design Direction

Overall direction:

> **Editorial Archive**

A combination of:

- Editorial Photography Archive
- Minimalist Digital Archive

The site should feel:

- contemporary
- quiet
- visual
- editorial
- photographic
- structured without looking like a database

## Core principle

> The website should feel designed around photographs, not designed around components.

---

# 29. Theme

V1 uses a **light theme**.

Working palette direction:

- Warm off-white / light neutral background
- Dark charcoal text
- Soft grey secondary metadata
- Very light grey borders
- Slightly different warm-white surfaces where useful
- Restrained muted terracotta / burnt-orange accent

Photography supplies most of the colour.

Avoid making the UI itself overly colourful.

Avoid:

- bright blue as primary brand colour
- green-heavy nature styling
- gold luxury-hotel styling
- purple/pink brand styling
- black/red dramatic styling

Exact hex values remain a visual prototyping decision.

---

# 30. Typography

Use a hybrid system:

### Sans-serif

For:

- Navigation
- Metadata
- UI
- Body text
- Filters
- Controls

### Restrained serif

For major editorial titles where appropriate.

Potential sans direction:

- Inter
- Geist
- similar contemporary grotesk

A restrained editorial serif should be selected during implementation/prototyping.

Exact typography is not a reason to block architecture.

---

# 31. Image Presentation

Never crop a photograph simply to make a grid tidy.

Respect native compositions:

- 3:2 stays 3:2
- 4:3 stays 4:3
- Portrait stays portrait
- Panorama stays panorama

Editorial masonry should adapt to image proportions.

Hero presentations may use controlled framing when appropriate, but should avoid aggressive cropping.

If manual focal points become necessary, that can be added later.

---

# 32. Motion

The user does not like animation-heavy websites.

Default:

**No animation.**

If motion genuinely improves usability:

- very small fades
- approximately 150–300ms
- restrained transitions only

Avoid:

- parallax
- flying photographs
- scroll theatrics
- animated counters
- elaborate page transitions

The site should feel deliberate rather than animated.

---

# 33. Navigation Interaction

Navigation should be persistent but quiet.

Breadcrumbs are contextual and visually restrained.

Example:

```text
Photos / China / Beijing / Mutianyu Great Wall
```

Back navigation should preserve context where possible.

If a photo was opened from a Location, returning should ideally return to that Location rather than always dumping the user back on the Photos page.

---

# 34. Technical Architecture

V1 uses **one Next.js application**.

```text
Internet
   ↓
Cloudflare
   ↓
Vercel
   ↓
Next.js
   ├── Public website
   └── /admin
        ↓
      Supabase
      ├── PostgreSQL
      └── Auth

Next.js
   ↓
Cloudflare R2
   ↓
Images
```

## Responsibilities

### Cloudflare

- DNS
- Network/security layer
- R2

### Vercel

- Hosting
- Deployment
- Next.js runtime

### Next.js

- Public website
- Admin
- Application logic
- Data fetching
- Publishing logic
- Importer
- Image delivery orchestration

### Supabase

- PostgreSQL
- Structured data
- Relationships
- Authentication
- Row Level Security

### R2

- Image storage
- Source JPEG
- WebP derivatives

### GitHub

- Source control
- Deployment source

---

# 35. Frontend Architecture

Use the Next.js App Router.

Conceptual structure:

```text
app/
├── page
├── photos/
├── trips/
├── stays/
├── map/
├── about/
└── admin/
```

Use server-side data fetching where appropriate.

Do not introduce unnecessary architecture such as:

- Redux
- GraphQL
- Separate backend
- Microservices
- Multiple applications

unless a real V1 requirement emerges.

---

# 36. Data Fetching

Public pages are primarily read-only.

Example:

```text
/trips/china-winter-2026
```

Next.js retrieves:

- Trip
- Cities
- Locations
- Photos
- Stays

and constructs the page.

Visitors cannot modify content.

Admin requests are authenticated and can perform mutations.

---

# 37. Publishing and Security

Use Supabase Auth for Admin authentication.

Use Row Level Security.

Public users can read published content.

Public users cannot create, edit or delete archive data.

Draft content remains private.

Admin can create/edit/publish content.

There is no public registration in V1.

---

# 38. Caching

Public archive content changes relatively infrequently.

Use Next.js caching/revalidation where appropriate.

A published Trip should not require a database query for every individual visitor request if the page can safely be cached.

When content changes, relevant pages should be revalidated.

Do not build a complicated custom caching system for V1.

---

# 39. Map Data

The map reads existing Location and Hotel coordinates from Supabase.

There is no separate map database.

V1 map queries published geographic records and renders them through the selected map library.

---

# 40. Admin Safety Rules

The system should protect the archive from accidental relationship destruction.

Examples:

- Don't allow deletion of a Location that still has dependent published content without explicit handling.
- Don't allow deletion of a Hotel that still has Stays without explicit handling.
- Handle dependent Photos/Stays/Trips safely before destructive operations.
- Prefer archival/unpublishing over destructive deletion where appropriate.

Deletion should never affect the Lightroom master archive.

---

# 41. V1 Scope

## Must have

### Public

- Home
- Photos
- Photo detail
- Trips
- Trip detail
- Stays
- Hotel detail
- Hotel visit history and safe old-Stay redirects
- Map V1
- About

### Admin

- Authentication
- Dashboard
- Trip management
- City creation/selection
- Location management
- Hotel management
- Stay management
- Photo management
- Lightroom importer
- Import history
- Draft/Published status
- Featured photography

### Infrastructure

- Next.js
- Vercel
- Supabase
- Supabase Auth
- PostgreSQL
- Cloudflare R2
- GitHub
- Image derivatives
- RLS

---

# 42. Explicitly Phase 2 / Out of Scope

Do not implement these merely because they could be useful.

## Photography

- Lightroom direct integration
- Desktop importer
- Re-import/replacement workflow
- Photo versioning
- RAW storage
- AI captions
- AI quality judgement
- Automatic photo publishing

## Discovery

- Full search
- Advanced filtering
- Public accounts
- Comments
- Likes
- Follows
- Social network functionality

## Maps

- Trip routes
- Animated journeys
- Chronological map playback
- Photo clustering
- Advanced geographic storytelling
- Map V2 exploratory mode

## Content

- Story entity
- Blog CMS
- Long-form article workflow
- Generic travel guides
- SEO content system

## Hotels

- Detailed category scoring
- Separate Review entity
- Booking functionality
- Price tracking
- Affiliate system

## Infrastructure

- Separate backend
- Microservices
- GraphQL
- Complex roles
- Multiple admin applications

---

# 43. Historical Archive Principle

The system must make incomplete truth easier than fabricated completeness.

Examples:

```text
Trip date unknown
→ leave dates empty

Stay date unknown
→ leave dates empty

Camera unknown
→ leave EXIF field empty

Location unknown
→ don't publish the photo

Description not remembered
→ leave description empty
```

Never invent historical information simply to satisfy a field requirement.

---

# 44. Implementation Philosophy

The coding agent should prioritize:

1. Correct data relationships
2. Simple maintainable architecture
3. Good photography presentation
4. Reliable importer
5. Safe publishing workflow
6. Performance
7. Clear admin experience

Do not over-engineer for hypothetical future requirements.

The V1 should be a strong foundation rather than an attempt to build the eventual maximum version of the product.

---

# 45. Suggested Engineering Documentation

The project should eventually contain:

```text
/docs/
  01-product.md
  02-data-model.md
  03-design-system.md
  04-photo-import-workflow.md
  05-technical-architecture.md
  06-v1-scope.md
```

The Build Bible is the source material for these implementation documents.

---

# 46. First Engineering Milestone

The first development milestone should not attempt to build the entire site.

Recommended sequence:

### Milestone 1

- Next.js application shell
- Supabase project
- Database schema
- Supabase Auth
- RLS
- Basic Admin
- Basic Trip/Location/Hotel/Stay CRUD
- Sample data

### Milestone 2

- R2 integration
- Photo storage
- Image derivative generation
- Photo records
- Basic public Photos page
- Photo detail

### Milestone 3

- Lightroom importer
- EXIF extraction
- Folder classification
- Batch grouping
- Exception handling
- Import history

### Milestone 4

- Public Trips
- Locations
- Stays
- Hotel pages
- Relationships

### Milestone 5

- Homepage
- Map V1
- About
- Final visual refinement
- Responsive/mobile refinement
- Performance pass

This sequence allows the data model and importer to be proven before the full editorial layer is built.

---

# 47. Branding

The public identity is **FOUND ALONG**.

Supporting line: **Photography and places by Alex Lim**.

Typography provides the wordmark: restrained editorial serif with clean sans-serif navigation and metadata. FA is utility branding only. Photographs supply visual colour. The existing `lexphotos.com` domain is not an architectural dependency; domain work remains deferred.

The homepage leads with the identity, Featured photography, real context, recent photographs and restrained Trips / Singapore / Stays entry points. `/singapore` is a permanent Home view of ordinary geographic records and eligible Travel photography. Map and Search are not part of Milestone 7.
---

# 48. Final Product Definition

The completed V1 should feel like:

> **A personal visual travel archive with the structure of a geographic database, presented with the restraint and visual quality of an editorial photography publication.**

The visitor should primarily experience:

**photographs → places → trips → stays → exploration**

rather than:

**database → records → fields → CMS**

The underlying architecture should be structured, relational and technically robust.

The visible product should remain simple, quiet and photographic.

---

# 49. Non-Negotiable V1 Decisions

The following decisions are considered locked unless deliberately revisited:

- PostgreSQL/Supabase rather than MongoDB
- One Next.js application
- `/admin` inside the same application
- Supabase Auth for Admin
- RLS
- Cloudflare R2 for image storage
- Lightroom remains photographic source of truth
- Full-resolution sRGB JPEG publishing source, unchanged and private
- WebP derivatives
- Native photo aspect ratios
- Nice / Record / Personal Lightroom workflow
- Personal photos never imported
- Record Shots available in Trip archive but not main Photos page
- Travel photos require Location when published; Trip is required outside Singapore
- Hotel photos require Hotel, not Stay/Trip/Location
- Hotel is distinct from Location
- Stay requires Trip outside Singapore; Singapore Hotel Stays may omit it
- Hotel persists independently across multiple Stays
- Trip dates optional
- Stay dates optional
- 1–5 whole-star ratings
- Hotel recommendations: Family / Business / Personal-Leisure
- No separate Review entity in V1
- Trip is the natural Admin starting point
- Browser drag-and-drop importer
- No Lightroom direct integration
- No re-import/replacement workflow in V1
- Map V1 deliberately simple
- Search is Phase 2
- No Story entity
- No social functionality
- Light editorial visual direction
- Minimal/no animation
- Found Along identity is established; domain remains TBD
- V1 prioritizes a strong archive over feature breadth

# 50. Guiding Rule

When a future feature request conflicts with the simplicity of V1, ask:

> **Does this make the archive meaningfully better, or does it merely make the system more complicated?**

If it is the latter, defer it to Phase 2.

## Milestone 7 owner-approved refinements (2026-10-02)

These rules supersede the earlier Trip-required, 4000px-source and undecided-brand rules. Singapore is ordinary geography, not another entity. Nice / Record / Personal and Travel / Hotel meanings are unchanged. Public sources and exact GPS remain inaccessible. Current ingestion is bounded to ten JPEGs, 25 MiB each and 80 megapixels; no upscaling. New derivatives use 3200/1920/960/480; existing derivatives keep their legacy profile without automatic replacement. Public delivery re-checks effective visibility on every request and has no shared cache that could outlive unpublication.

## Milestone 7.1 owner-approved consolidation (2026-10-03)

Hotel owns current opinion and photography; Stay is a lightweight visit. Existing Stay rating/review/room/purpose data is intentionally discarded, without inferring Hotel content. Photo Hotel assignments derive safely from existing Stay relationships; UUID/storage objects remain unchanged. Previously hidden Published Hotel photos are demoted to Draft before removing the old parent, avoiding accidental exposure. Only Hotel now gates Hotel-photo visibility; Travel rules remain unchanged. RLS, private sources/GPS/notes and per-request no-store authorization remain release requirements. Map/Search remain deferred.
