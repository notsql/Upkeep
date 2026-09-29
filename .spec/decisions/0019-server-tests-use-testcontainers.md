# 0019 - Server context tests start their own Postgres with Testcontainers

**Status:** accepted

## Context

`@SpringBootTest` boots the full context, so `./mvnw -pl com.proj:server test`
needs a database. The main `application.yaml` reads `SPRING_DATASOURCE_*`,
which locally only Infisical supplies (0018) - and `test` is deliberately not
Infisical-wrapped, so locally the context failed with `'url' must start with
"jdbc"`. CI works because it runs its own ephemeral Postgres (0012). Pointing
local tests at Neon would repeat the problem 0012 exists to avoid.

## Decision

- **Context tests `@Import(TestcontainersConfiguration.class)`**
  (`apps/server/src/test/java/com/proj/server/`). It declares a
  `@ServiceConnection` `PostgreSQLContainer` on `postgres:18-alpine`, so
  Spring points the datasource at the container, outranking any
  `SPRING_DATASOURCE_*` in the environment. Only tests that need the full
  context import it; sliced and unit tests stay database-free.
- **Migrated with Prisma's own SQL.** Each
  `packages/db/prisma/migrations/*/migration.sql` is copied into
  `/docker-entrypoint-initdb.d` with a zero-padded prefix, so the image applies
  them in folder (timestamp) order on start. The folder is found by walking up
  from the working directory; a missing folder fails with a clear message.
  Prisma still owns the schema (0001) - nothing here generates DDL.
- **Throwaway and fast:** data on tmpfs, `fsync`, `synchronous_commit` and
  `full_page_writes` off. Testcontainers' Ryuk removes the container when the
  JVM exits. It adds roughly a second to the suite.
- `spring-boot-testcontainers` and `testcontainers-postgresql` are test-scope,
  versions managed by the Spring Boot parent.

Rejected:

- **A `test-db` compose service plus `pnpm test:db:up`** - works, but someone
  has to remember to start it and to re-migrate it after pulling a migration,
  and it needs port 5432 free.
- **An Nx `dependsOn` target that starts that service before `test`** -
  automatic under `pnpm test`, but not under `./mvnw` or an IDE's test runner,
  and it leaves a container running.
- **H2 in-memory** - not Postgres, so migrations and jOOQ's SQL would not be
  exercised.

## Consequences

- **Docker must be running** for server tests, locally and in CI (GitHub's
  Ubuntu runners have it).
- `_prisma_migrations` does not exist in the test database, since Prisma does
  not apply the migrations. Nothing in the server reads it (jOOQ excludes it).
- CI's `postgres` service and `SPRING_DATASOURCE_*` are now redundant for the
  server tests; `pnpm db:deploy` there still uses them, which keeps checking
  that the migrations apply through Prisma itself.
