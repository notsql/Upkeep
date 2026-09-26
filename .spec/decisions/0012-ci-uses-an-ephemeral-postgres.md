# 0012 - CI runs against an ephemeral Postgres, never Neon

**Status:** accepted

## Context

CI (`.github/workflows/ci.yml`) runs `pnpm check-types`, `pnpm test` and
`pnpm build` on every push to any branch and on every PR targeting `main`.

`pnpm build` needs no database: the jOOQ classes and `schema.ts` are committed
(0008). `pnpm test` does - `@SpringBootTest` boots the full context against
`SPRING_DATASOURCE_URL`, so CI has to run migrations somewhere first.

The team's dev database is a shared Neon branch. CI runs on unmerged
branches, so `pnpm db:deploy` there would apply work-in-progress migrations to
everyone's database - the exact thing the README's "migrate on your own Neon
branch" rule exists to prevent.

## Decision

- **Each CI run gets a fresh `postgres:18` service container** (the version in
  the stack table), migrated with `pnpm db:deploy`. No database secrets are
  stored in GitHub.
- **CI never connects to Neon.** Not the shared branch, not a per-run branch.
- WorkOS variables are left unset, so the API runs in its open, unauthenticated
  mode for tests.

A Neon branch per run (via Neon's GitHub Action) was considered. It gives
exact production parity but needs an API key secret, spends branch quota and
needs cleanup when a run fails. Not worth it until we hit a Neon-specific bug.

## Consequences

- CI does not exercise Neon's pooler (`-pooler` / PgBouncer) or its
  scale-to-zero cold start. A bug that only shows up there will pass CI.
- Every migration is replayed from empty on every run, so a migration that
  only works against existing data will pass CI and can still fail on Neon.
- Tests must not depend on data that exists only in the shared database.
- Anyone adding a database-backed test gets a real Postgres in CI for free;
  anyone tempted to "simplify" CI by pointing it at Neon should read this first.
