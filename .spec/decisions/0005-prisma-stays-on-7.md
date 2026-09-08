# 0005 - Prisma stays on version 7

**Status:** accepted

## Context

An attempted upgrade to Prisma 8 (`8.0.0-rc.13`) left `packages/db`
non-functional: the package entrypoint `src/index.ts` had been deleted,
`@prisma/client`, `@prisma/adapter-pg`, `pg` and `@types/pg` had been removed
from the manifest, `@prisma/client` had been dropped from the workspace
catalog, and `prisma/migrations/` held an empty `0000_init/` directory from a
migration run that never completed.

Prisma 8 was still a release candidate.

## Decision

Revert to Prisma 7 (`^7.10.0`) across `prisma`, `@prisma/client` and
`@prisma/adapter-pg`, and restore the driver-adapter setup: `PrismaPg` built
from `DATABASE_URL`, wrapped by `createPrismaClient()` in
`packages/db/src/index.ts`.

`prisma.config.ts` and `schema.prisma` were untouched by the upgrade and are
valid version 7 as they stand. The schema deliberately has no `url` on its
`datasource` block - the connection string comes from `prisma.config.ts`.

## Consequences

- The generated client lives at `packages/db/prisma/generated`, is gitignored,
  and is rebuilt by the `postinstall` hook.
- Prisma 8 folds the client into the generated output and no longer needs
  `@prisma/client`. Any future upgrade must therefore change the dependency set
  and `src/index.ts` together - removing one without the other is what broke
  this package the first time.
- Revisit once Prisma 8 has a stable release, and treat it as a real migration
  with its own decision record rather than a version bump.
