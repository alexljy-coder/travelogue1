# Found Along

Product source of truth: [Build Bible](docs/buildbible.md).

One Next.js/TypeScript application provides the public photographic archive, Singapore home view, Trips/Places and Hotels, plus a private singleton-administrator CMS and Lightroom JPEG ingestion. Supabase provides relational data/Auth/RLS; private R2 holds unchanged sources and WebP derivatives.

Use Node.js 24 and pnpm 11.19.0. Follow [setup instructions](docs/supabase-setup.md)
for local environment values, hosted Supabase migration/account provisioning and smoke checks.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
pnpm lint
pnpm typecheck
pnpm test
pnpm db:types:check
pnpm build
pnpm test:smoke
```

Photo ingestion/delivery requires the server-only R2 variables in [r2-setup.md](docs/r2-setup.md). No public signup exists. Missing configuration or a missing
administrator identity fails closed. See [technical plan](docs/technical-plan.md),
[decisions](docs/decisions.md) and [implementation status](docs/implementation-status.md).

M7.3 removes Stay entirely. See [current acceptance/rollout](docs/m73-acceptance.md). Hotels own current opinion and direct Hotel photography; /hotels is canonical.
