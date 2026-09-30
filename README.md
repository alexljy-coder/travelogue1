# Personal travel archive

Product source of truth: [Build Bible](docs/buildbible.md).

Milestone 1 provides the Next.js/TypeScript application foundation, a public placeholder,
private administrator login/shell, versioned PostgreSQL schema, constraints and RLS.
Content management and image import/storage are future milestones.

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

No R2 credentials are required. No public signup exists. Missing configuration or a missing
administrator identity fails closed. See [technical plan](docs/technical-plan.md),
[decisions](docs/decisions.md) and [implementation status](docs/implementation-status.md).
