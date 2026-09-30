# Milestone 1 setup and verification

The application and versioned migration are local source changes. No hosted project settings, database, administrator account, Vercel deployment or R2 resources have been changed by this milestone.

## Local application

Use Node.js 24 and pnpm 11.19.0 (package.json pins the package manager). Install pnpm using your normal Node toolchain, then:

```sh
pnpm install --frozen-lockfile
cp .env.example .env.local
pnpm dev
```

Set only the following in the ignored .env.local:

- NEXT_PUBLIC_SUPABASE_URL: your project's HTTPS URL.
- NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: your project's `sb_publishable_…` key, not a secret/service-role key.

The names are already configured in Vercel according to the owner. Confirm values and desired Preview/Production scopes there, and select Node.js 24. No additional environment variables, R2 credentials, service-role key, ADMIN_USER_ID or password in environment variables are required. The administrator identity belongs in the protected database row, not in a browser-exposed variable.

The homepage builds without environment values. Missing/invalid configuration disables the login form and makes /admin redirect to login; it never grants development access. Only /, /admin/login and protected /admin are implemented. No public registration or password-reset UI is provided; password changes/recovery remain operator-managed in Supabase for this foundation milestone.

## Hosted Supabase steps

1. Inspect the existing project's public schema and migration history; preserve any existing data and confirm a current backup before schema changes. The migration creates V1 tables and functions; it intentionally fails on conflicting existing objects rather than overwriting them. Resolve actual conflicts with a reviewed migration, not destructive resets.
2. In Auth settings disable **Allow new users to sign up**. Disable unused OAuth/anonymous providers. Keep email/password sign-in enabled; set the Site URL to the real application origin and allow only necessary localhost/preview redirect URLs. Do not use broad production redirect wildcards. The local config's disabled signup does not configure the hosted project.
3. Apply `supabase/migrations/20260930000100_v1_foundation.sql` using the Supabase CLI migration workflow. Example with the CLI installed and authenticated:

   ```sh
   supabase link --project-ref YOUR_PROJECT_REF
   supabase migration list
   supabase db push --dry-run
   supabase db push
   ```

   Review the dry run first. Never run `db reset --linked` on the archive. The migration is atomic: schema, revocation of default privileges, RLS and policies land together. If using the SQL editor instead, execute the whole migration and explicitly reconcile its migration-history entry before later CLI pushes; do not blindly apply it twice.
4. In Authentication → Users deliberately create/invite the one owner account. For the initial email/password flow, ensure the email is confirmed and a strong password is set. The application has no signup endpoint. Do not commit the account password or invitation tokens.
5. Copy the actual user's UUID and provision its singleton identity through the trusted SQL editor/operator connection:

   ```sql
   insert into private.admin_identity(singleton, user_id)
   values (true, 'REPLACE_WITH_ACTUAL_AUTH_USER_UUID'::uuid);
   ```

   A missing identity denies all administrator access. The singleton constraint prevents a second administrator. Browser/API users, including the administrator, cannot edit this private table. Any intentional transfer later must be a trusted operator update.
6. Keep the Data API limited to intended schemas (public; private must not be exposed). Check the project's security advisor. The application uses the public `is_admin()` RPC which returns a boolean only; it does not expose the identity table.
7. Verify production/preview sign-in, reload/session refresh, sign-out, and access in an incognito browser. Anonymous /admin access must redirect. A valid Supabase account other than the provisioned owner must be refused. Revoke/remove the identity through trusted access and confirm the old session loses admin access. Do not weaken RLS for setup convenience.
8. Verify hosted REST behavior using the publishable key: safe photo projections work; selecting photo latitude/longitude/storage fields, Stay internal_notes and import_batches must fail. Anonymous mutations must fail. Published child records under Draft required parents must not appear. These hosted tests are distinct from the embedded SQL tests; use synthetic staging data, never upload Personal photos or production fixtures from the test directory.

Do not run `supabase/tests/bootstrap.sql` or `fixtures.sql` against a hosted project. They are exclusively test harness input and include deliberately hidden Published child states to exercise RLS.

## Verification commands

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm db:types:check
pnpm build
pnpm test:smoke
pnpm start
```

Tests apply the real migration to a fresh embedded PostgreSQL (PGlite) with test-only Auth objects and roles. They execute actual CHECK/FK/grant/RLS rules as anon, unrelated authenticated user and administrator. This does not simulate Supabase Auth infrastructure, its JWT gateway, PostgREST, hosted settings, Vercel or R2. Those need the hosted smoke checks above. CI runs the same secret-free checks on Linux. The production smoke script starts the built server with synthetic or missing configuration, checks fail-closed admin access/no-store responses and absent registration routes, then shuts it down; it does not sign into a hosted account. Typecheck first generates Next route declarations, so a fresh checkout needs no prior build.

`pnpm db:types` regenerates standard Supabase table types from the migrated PostgreSQL catalog, including FK relationships. `db:types:check` detects drift. This avoids installing Docker or needing a hosted database password to generate types. A future hosted type generation comparison can verify the deployed schema matches migrations; GitHub migrations remain authoritative.

For full local Supabase, the committed config supports a separately installed Supabase CLI + Docker. `supabase start` and `supabase db reset` are for that disposable local environment only. They were not required or run here. Copy the local publishable key (not the legacy JWT anon key) into .env.local if using this setup.

## Public/private access contract

- Anonymous readers receive explicit public columns and parent-aware RLS.
- Authenticated database roles receive full columns only on rows authorized by singleton-admin RLS. Unrelated authenticated users get zero archive rows, no writes, no identity management. Public rendering uses a cookie-free anonymous client.
- Exact photo GPS is retained in photos but unavailable through anonymous SELECT grants; Travel/Hotel presentation will use the destination's public coordinates instead.
- stays.internal_notes is private; review_text and other deliberately public editorial fields are separate.
- Featured must be Published + Nice. Demoting/unpublishing that photo must clear Featured in the same update. Unpublishing a required parent does not cascade photo status, but public RLS hides the child regardless of its stored status.
- Covers have safe foreign keys. Cross-record eligibility helpers exist for future selection/publishing workflows; no cover mutation endpoints or UI exist yet. Later public presentation must resolve cover photos with anonymous RLS, not blindly use a pointer.
- Auth cookies are HttpOnly, SameSite=Lax and Secure in production. All current auth runs server-side. A future importer can call authenticated same-origin server endpoints; do not introduce a browser Auth client that assumes it can read these cookies without revisiting that design explicitly.
- Admin responses are dynamic/private/no-store, including refreshed session responses. Next.js Server Actions retain their default same-origin protection; no wildcard allowedOrigins exception is configured. Supabase Auth handles login rate controls; review its rate-limit configuration before public deployment.
