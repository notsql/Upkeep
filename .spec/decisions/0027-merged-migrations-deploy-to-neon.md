# 0027 - Merged migrations are applied to Neon automatically

**Status:** accepted, amended by 0029 (pushes to `dev` migrate Neon `dev`;
pushes to `main` migrate Neon `prd`)

## Context

Migrations were applied to the shared Neon database by hand with
`pnpm db:migrate`. Once a PR with a migration merged, the database lagged
`main` until someone remembered to run it. CI itself only runs on PRs and must
never touch Neon (0012).

## Decision

- **`.github/workflows/migrate.yml` runs `pnpm db:deploy` on every push to
  `main` that changes `packages/db/prisma/**`**, and can be run manually.
- It uses `prisma migrate deploy`, never `migrate dev` (`pnpm db:migrate`),
  which would author new migrations and may reset the database.
- `DATABASE_URL` comes from Infisical (`dev` env, `/packages/db`), the same
  secret `pnpm db:migrate` uses locally (0018), and must be Neon's direct
  (non-pooler) host. The workflow logs in with GitHub OIDC as an Infisical
  machine identity, so GitHub stores no credentials - only the identity ID and
  project slug, as repository variables. The PR checks job holds no database
  secrets.
- Runs are serialised with a `concurrency` group so two merges cannot migrate
  at once.

## Consequences

- A migration that replays fine on the empty CI database but fails on existing
  Neon data fails this workflow after merge. Fix forward with a new migration.
- Anyone with write access to `main` can change what runs against Neon.
