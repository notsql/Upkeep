# 0001 - Prisma owns the schema, Spring owns runtime data access

**Status:** accepted

## Context

The scaffold arrived with two things pointed at the same Postgres database:
Prisma (via `packages/db`) and Spring Boot's JDBC starter. Left alone, that is
two writers, two migration stories, and two places to define a table.

## Decision

Split the two responsibilities rather than the data:

- **Prisma is the single source of truth for schema and migrations.** Every
  table starts in `packages/db/prisma/schema/schema.prisma`. `pnpm db:migrate`
  is the only thing that changes the database's shape.
- **Spring Boot is the only thing that reads and writes rows at runtime**, via
  JDBC. It never migrates and never owns a schema definition.
- **The web app has no database access at all.** `@prisma/client` was removed
  from `apps/web`; it reaches data only through the API.

## Consequences

- One API surface, one auth path, one place to put business logic.
- Java persistence code must be kept in line with the Prisma schema by hand.
  A schema change is therefore a two-step task: migrate, then update the Java
  side. `features/` specs should call this out explicitly.
- Prisma Client stays available to `packages/db` for scripts, seeding and
  Studio - convenient, and outside the request path.
- If the Java/Prisma drift ever becomes painful, the escape hatch is to
  generate JPA entities or jOOQ classes from the migrated database. We are not
  doing that yet.
