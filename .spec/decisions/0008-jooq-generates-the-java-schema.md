# 0008 - jOOQ generates the Java side of the schema

**Status:** accepted

## Context

Decision 0001 split schema ownership from runtime access: Prisma owns the
shape, Spring only reads and writes rows. It also named the cost - "Java
persistence code must be kept in line with the Prisma schema by hand" - and
the escape hatch: "generate JPA entities or jOOQ classes from the migrated
database. We are not doing that yet."

We are doing that now. The project is being built in short iterations with a
schema that is expected to change often, and hand-maintained JDBC code would
drift silently: a renamed column stays compiling and fails at runtime, in
whichever request happens to touch it first.

`packages/api` already solves the same problem across the other boundary. A
generator reads the source of truth and emits typed code, so drift becomes a
compile error. This applies that pattern to the database boundary.

## Decision

- **jOOQ generates `com.proj.server.db` from the live database.** The
  generator reads whatever `pnpm db:migrate` last applied. It never changes
  the database, so Prisma remains the only writer of schema (rule 5 holds).
- **Prisma stays deliberately outside the application.** Migrations are an
  explicit operator step (`pnpm db:migrate`, or `db:migrate:deploy` in
  deployment), not a side effect of the server booting. This keeps DDL out of
  the request path, avoids two instances racing to migrate during a rolling
  deploy, and allows the Spring datasource user to hold DML privileges only.
- **Codegen lives in a Maven profile** (`-Pjooq`), exposed as the Nx target
  `db:generate` and folded into the root `pnpm db:generate`. An ordinary
  `mvn package` does not need a database.
- **Generated sources are committed**, under `apps/server/src/main/java`, for
  the same reason `packages/api/src/schema.ts` is: a fresh clone and CI build
  without Postgres running.
- `spring-boot-starter-jdbc` is replaced by `spring-boot-starter-jooq`, which
  brings it transitively.

## Consequences

- Changing the schema is still a two-step task, but the second step is now
  mechanical and checked: migrate, regenerate, compile. The compiler lists the
  call sites that moved instead of leaving them to be found at runtime.
- `com.proj.server.db` is generated output. Never hand-edit it; the generator
  overwrites the directory.
- Regenerating requires Postgres to be up, the same precondition
  `pnpm api:generate` already has.
- Queries are written as jOOQ DSL rather than object graphs. There is no lazy
  loading and no cascading save - relations are traversed by joining, which
  suits a schema whose relations are defined in Prisma rather than in Java.
- The generated classes follow the database, so a migration that is wrong
  produces Java that is confidently wrong. Review the migration, not just the
  code that compiles against it.
