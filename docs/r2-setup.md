# Private R2 photo import setup — Milestone 3

The bucket already exists. These are owner-operated setup steps; Codex has not changed Cloudflare, applied hosted SQL or used production storage credentials. Lightroom remains the master archive. Supabase stores metadata/Auth; R2 stores the exported JPEG and four WebPs.

## 1. Keep the bucket private

Sign in to the Cloudflare dashboard, select the correct account, and open **R2 Object Storage** → your existing bucket → **Settings**. Keep the public `r2.dev` URL disabled and do not attach a public custom domain. Do not grant anonymous writes. No Cloudflare Worker or public CDN is needed now. See [Cloudflare public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/).

## 2. Create bucket-scoped S3 credentials

1. Open **R2 Object Storage → Overview**. Under **Account Details**, select **Manage** beside **API Tokens**.
2. Select **Create Account API token**. If your account only offers **Create User API token**, that also works; a user token depends on that user's continued account access.
3. Name it `travelogue-private-photo-storage`.
4. Select **Object Read & Write**. Scope it to **only the existing archive bucket**. Do not select Admin Read & Write; the application does not create buckets or change their configuration.
5. Create the token. Copy the displayed **Access Key ID** and **Secret Access Key** to your password manager. The secret is shown only once. Use these S3 credentials, not your Cloudflare Global API Key or an unrelated API token.
6. Copy the **Account ID** from R2 Overview's Account Details. This is the account identifier, not a zone ID. Copy the exact bucket name.

These steps and permission names follow [Cloudflare R2 authentication](https://developers.cloudflare.com/r2/api/tokens/). Object access covers reading, writing, listing and deletion; bucket configuration stays manual.

## 3. Configure local and Vercel environment variables

Add these to ignored `.env.local`. `.env.example` contains empty names only; never put actual values in it or commit them.

| Name | Value | Sensitivity |
| --- | --- | --- |
| `R2_ACCOUNT_ID` | Cloudflare's 32-character account ID | Non-secret identifier |
| `R2_BUCKET_NAME` | Exact existing bucket name | Non-secret configuration |
| `R2_ACCESS_KEY_ID` | S3 Access Key ID created above | Credential identifier; configure server-side |
| `R2_SECRET_ACCESS_KEY` | S3 Secret Access Key created above | Secret; server-only |
| `R2_JURISDICTION` | Optional; leave empty for normal/global buckets | Non-secret configuration |

For a jurisdiction-restricted bucket, check its displayed S3 endpoint: `.eu.r2.cloudflarestorage.com` requires `eu`, `.us...` requires `us`, and `.fedramp...` requires `fedramp`. A normal `<account-id>.r2.cloudflarestorage.com` endpoint needs no value. This optional variable is the only configuration beyond the four required names. See [jurisdiction endpoints](https://developers.cloudflare.com/r2/api/tokens/).

In **Vercel → project → Settings → Environment Variables**, add the same required variables for **Production**. Add them to **Preview** only if you intend to test that deployment and allow its exact origin in CORS below. Treat both S3 credential values as sensitive configuration. Do not prefix any R2 variable with `NEXT_PUBLIC_`. Retain the two existing public Supabase variables. Restart the local dev server after changes; redeploy Vercel after updating hosted variables. The project builds without R2 secrets, but import/storage operations fail closed until configured.

## 4. Add narrow bucket CORS

Source-image bytes travel directly to R2 using a server-issued, two-minute capability for **one part of one upload**. The server alone uses the S3 SDK and reusable credentials, completes/aborts uploads, generates derivatives and reads/deletes stored objects. Signed URLs contain the non-secret key identifier and an expiring signature; never share them. This avoids [Vercel's 4.5 MB request limit](https://vercel.com/docs/functions/limitations) without changing the Lightroom source.

In the bucket's **Settings → CORS policy**, add a policy like:

```json
[
  {
    "AllowedOrigins": [
      "http://localhost:3000",
      "https://YOUR-EXACT-DEPLOYMENT-HOST"
    ],
    "AllowedMethods": ["PUT"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

Replace the example deployment origin with the actual application origin, including `https://`, without a path or trailing slash. Use the actual local port if it differs. Include a custom application domain or current preview origin only when you use it. Do not use `*`; dynamic preview URLs require an explicit new origin. No exposed ETag header is needed: the server lists/verifies the uploaded part. Image previews/downloads go through authenticated same-origin Next.js routes, so no R2 GET CORS policy is needed. CORS does not grant bucket permissions. See [Cloudflare CORS configuration](https://developers.cloudflare.com/r2/buckets/cors/).

## 5. Apply the new Supabase migration manually

Review `supabase/migrations/20261001000100_private_photo_ingestion.sql`. Apply **only this new migration** through your existing migration process. If using the SQL editor, execute this file once against the correct project and reconcile CLI migration history before a later CLI push. Do not reset hosted data or rerun Milestones 1/2.

It adds `import_items` (admin-only per-file operation/recovery records) and ten invoker-rights RPCs. Photo columns/public grants/RLS and previously applied migrations are unchanged. RPCs keep authenticated singleton-admin checks and fixed search paths. No service-role key is required.

## 6. Verify connectivity

Start the local app, sign in as the provisioned administrator and open **Photos → Import Lightroom JPEGs**. Click **Check R2 connectivity**. This reads bucket access only and writes/deletes no test objects. A controlled import/deletion proves write/delete access. A failure response deliberately does not reveal secret values or raw provider errors. Check exact account/bucket/jurisdiction, credential values and bucket-scoped permission. A successful connectivity check does not prove CORS is configured.

## 7. Controlled ten-photo test

1. Use a test Trip and Location associated through Milestone 2. Dates may remain unknown. Set both to Published when testing Photo publication.
2. Export about ten eligible JPEGs from Lightroom: sRGB, full resolution (no resize required), Quality 88, Screen Sharpening Standard, EXIF retained. Include landscape/portrait/small images, known EXIF/GPS where available and a JPEG without EXIF. Add a separate Personal test file to the export tree.
3. Arrange `01 Nice`, `02 Record Shots`, `03 Personal` beneath an export root. Choose that root using the folder picker. Confirm the scan reports Nice/Record and Personal skipped **before** importing. Keep at most ten eligible JPEGs and 25 MiB per file. Personal does not count toward the ten-file limit.
4. Import with the page open. Each file reports success/failure independently; processing is sequential. Every newly created Photo is Travel, Draft, unfeatured and initially unassigned. A retry of identical source bytes returns the existing Photo/request, without replacing objects or editorial fields.
5. In the R2 dashboard, inspect one successful UUID prefix. It must contain exactly `source.jpg`, `large.webp`, `medium.webp`, `thumbnail.webp`, `tiny.webp`. Compare the downloaded source SHA-256 with the exported file: bytes must match. WebPs have approximately 3200/1920/960/480 long edges for new M7 imports, native proportions and no upscaling or GPS EXIF.
6. Confirm Photo rows and import history in Supabase. Confirm no Personal Photo, source object or multipart upload exists. Browser Network should show no hash/read/upload request for the Personal file. The importer does not inspect pixels to recognize personal content.
7. Open Photos and a Photo detail. Thumbnails/preview/source download must work while signed in. Compare orientation and EXIF values; unknown EXIF stays null. GPS is labeled private.
8. Assign Trip + Location, save, refresh and verify persistence. A selected Trip limits Location choices to its existing memberships. Try publication without assignments, below a Draft parent and with Record + Featured: each must fail clearly. Publish one valid Nice Photo and optionally mark Featured. Public Photo pages/images are implemented and must obey parent-aware anonymous visibility.
9. Retry the same JPEG/batch to confirm one Photo and stable UUID. For an upload failure, fix CORS/connectivity, then retry. For an interrupted browser/process, refresh Recent import status and wait for the displayed lease to expire before Retry cleanup. Cleaned failures can be reselected; identical bytes reuse their request. Do not assume a network error proves the Photo was not committed.
10. Delete one test Photo using its confirmation. Verify the Photo row is gone and all five UUID objects and incomplete uploads are absent. A failed deletion retains a hidden, non-ready Photo and Retry deletion; never delete Photo rows directly in SQL as a substitute for this storage-aware workflow.
11. Sign out and visit private image/source/import endpoints: they must return no image/capability. An unrelated Auth user must be forbidden. Anonymous Supabase queries for `photos.latitude`, `photos.longitude`, `storage_key` or `import_items` must be denied, including after publication. Generated WebPs must have no EXIF/GPS. Raw source JPEGs are administrator-only.

## Limits and recovery

- Folder selection uses `webkitRelativePath` where supported. Drag/drop supports loose files, not recursive directory traversal. Without reliable folder metadata, choose Nice/Record explicitly and confirm Personal files were excluded. The application cannot recognize a Personal photo from its pixels or lost path; do not mix Personal files into loose selections.
- This is a ten-photo proof, not a background queue or full reconciliation/replacement system. Identical **source bytes** (SHA-256) count as duplicates; another export with different bytes is not detected as the same image. Deleting a Photo and later selecting its bytes again creates a new request/UUID, not a replacement version.
- Upload URLs expire in two minutes. Upload leases last ten minutes; processing/preparation/deletion leases five minutes. Stale multipart sessions are aborted before cleanup/retry, so old part URLs cannot resurrect deleted objects. Hard interruptions may temporarily leave tracked objects/parts until manual recovery; no automatic orphan sweeper is introduced.
- The Node route requests a 120-second Vercel duration. Confirm actual plan/runtime resources with this batch; Sharp processing is bounded to 80 megapixels and 15 seconds per derivative. Sources above 80 megapixels or 25 MiB, CMYK or invalid JPEGs fail rather than being silently rewritten. Export quality/sharpening and an untagged JPEG's exact source color profile cannot be verified retrospectively; follow the Lightroom export settings.
- WebP quality: Large 85, Medium 82, Thumbnail 80, Tiny 75, effort 4. Sources stay untouched. Only metadata-free derivatives are candidates for future public delivery; do not make raw GPS-bearing sources public.
- Public media authorization re-checks anonymous RLS per request, streams only WebPs and prohibits shared caching. Private routes stream through authenticated Next.js with `private, no-store`; no public bucket, shared image optimization or CDN cache is added.


## Milestone 7 compatibility and acceptance

Before deploying M7, confirm M1–M6 migration history and apply only `20261002000100_found_along_home.sql` manually. Existing objects stay at 2400/1600/600/300 (profile 1); new imports are profile 2 at 3200/1920/960/480. No R2/CORS/environment change or automatic regeneration. Small sources are never upscaled; duplicate-size output buffers are reused while all five object names remain present.

Test one actual full-resolution Lightroom export under 25 MiB/80MP before a ten-file batch. Compare source SHA-256, inspect WebP dimensions/GPS removal, check previews/detail and measure completion time on the actual Vercel plan. Try an oversized file: it must fail before upload. A trip-less Singapore Travel photo needs a Published SG Location; overseas photography still needs a Published Trip and membership. Singapore Hotel Stays may omit Trip; Hotel photographs still publish through Stay and do not appear in `/singapore`. Re-check image rejection after Photo/Location/Hotel/Stay/assigned-Trip unpublication, including while signed into admin.
