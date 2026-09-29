# 0018 - Dev secrets come from Infisical

**Status:** accepted

## Context

Local secrets lived in three hand-copied `.env` files (`apps/server`,
`apps/web`, `packages/db`). Sharing and rotating them meant passing values
around by hand, with no single source of truth.

## Decision

- **Infisical holds the dev secrets, in folders that mirror the repo**:
  `/apps/web`, `/apps/server` and `/packages/db` in the `dev` environment each
  hold what that project's `.env.example` lists. `apps/ml` has no secrets yet.
- **Each project wraps its own commands** in `infisical run --env=dev
  --path=<its folder>`, and root scripts stay plain Nx calls: web's `dev`
  (`apps/web/package.json`), db's `db:migrate`, `db:reset` and `db:studio`
  (`packages/db/package.json`), and the server's `dev`, `openapi` and
  `db:generate` (`apps/server/project.json`). Every entry point - root script,
  `nx run`, `nx affected` - gets the same secrets, and each process sees only
  its own folder.
- The `@nx/maven` executor does not pass the calling environment through to
  the forked JVM, so `server:dev` runs `./mvnw spring-boot:run` via
  `nx:run-commands`, the same way `openapi` and `db:generate` already did.
- `prisma.config.ts` reads `process.env.DATABASE_URL` rather than Prisma's
  `env()`, which throws when unset: `prisma generate` runs on install, needs
  no database, and would otherwise break `pnpm install` without a `.env`.
- The secrets arrive as real environment variables, which every consumer
  already prefers over its `.env` file (Spring's `optional:file:.env` import,
  Prisma's and `@proj/env`'s `dotenv`, Vite, Nx), so no application code
  changed.
- **`build`, `test`, `check-types` and `db:deploy` stay unwrapped.** CI calls
  them with its own ephemeral-Postgres environment (0012) and has no Infisical
  access.

Rejected: `infisical export` into the existing `.env` files (keeps secrets on
disk and needs a manual re-pull after every change).

## Consequences

- Every developer needs the Infisical CLI and `infisical login` before
  `pnpm dev` works. `.infisical.json` (project ID only) is committed.
- A new env var needs its value added in the matching Infisical folder as well
  as its key in `packages/env` and `.env.example`. A new app with secrets needs
  a new folder and its own `--path` in its `dev:*` script.
- Never store an empty value: as a real environment variable, a blank
  `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI` counts as present and
  takes the API context down. Leave optional secrets out entirely.
- Existing `.env` files still load but are overridden by Infisical's values;
  delete them to avoid confusion.
- `docker-compose.yml` still reads the `.env` files; it is for deployment
  parity, not development, and is unchanged.
