# proj

Monorepo: a TanStack Start frontend, a Spring Boot API, and Postgres with a
Prisma-owned schema, orchestrated by Nx.

> **Read [`AGENTS.md`](AGENTS.md) and [`.spec/architecture.md`](.spec/architecture.md) before contributing.**
> They cover the rules that keep the two languages in sync.

## Stack

| Layer | Tech | Location | Port |
| --- | --- | --- | --- |
| Frontend | TanStack Start, React 19, Vite, Tailwind 4 | `apps/web` | 3001 |
| Backend | Spring Boot 4, Java 25, Maven | `apps/server` | 8080 |
| Contract | springdoc -> OpenAPI -> typed TS client | `packages/api` | - |
| Database | Postgres 18, Prisma 7 | `packages/db` | 5432 |

The browser calls the Spring API directly over CORS. The web app has no
database access; `apps/server` is the only thing that talks to Postgres.

## Prerequisites

| Tool | Why |
| --- | --- |
| **Java 25** | Runs the Spring Boot API. Maven itself comes from the wrapper. |
| **pnpm 10** | Workspace package manager. |
| **Node 22+** | Required by Vite 8 and Vitest 5. |
| **Docker** | Runs Postgres. Nothing else in the dev loop needs it. |

Maven is *not* a prerequisite - use `./mvnw` at the repo root. It lives at the
root rather than in `apps/server` because `@nx/maven` runs Maven from the
workspace root.

VS Code users: accept the recommended extensions prompt (see
`.vscode/extensions.json`) for Java, Spring Boot, Prisma, Tailwind, Nx and
Biome support.

## Nx and Docker do different jobs

A common point of confusion, so to be explicit:

- **Nx runs your tasks.** `dev`, `build`, `test`, `check-types` - across both
  TypeScript and Java, with caching. This is the dev loop.
- **Docker runs your services.** Nx cannot give you a Postgres server, so
  Postgres always comes from Docker.

In day-to-day development you run **Postgres in Docker and everything else
natively through Nx**. The `web` and `server` services in
`docker-compose.yml` exist for deployment and production parity - you do not
need them to develop, and `pnpm dev` does not use them.

## Getting started

**1. Install dependencies.**

```bash
pnpm install
```

This also generates Prisma Client via a `postinstall` hook.

**2. Create your env files.**

```bash
cp apps/web/.env.example apps/web/.env
cp apps/server/.env.example apps/server/.env
cp packages/db/.env.example packages/db/.env
```

The defaults work out of the box: the API is open (no Okta tenant needed) and
points at the local Postgres.

**3. Start Postgres and apply the schema.**

```bash
pnpm db:start      # Postgres 18 in Docker, on :5432
pnpm db:migrate    # applies the Prisma schema
```

**4. Generate the API contract.**

```bash
pnpm api:generate
```

`packages/api/src/schema.ts` ships as an empty seed, so run this once after
cloning to build the real typed client from the Spring controllers.

**5. Run everything.**

```bash
pnpm dev
```

| | |
| --- | --- |
| App | <http://localhost:3001> |
| API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui> |

## Day-to-day development

Postgres only needs starting once per session; it keeps running in the
background until you stop it.

```bash
pnpm db:start                  # once per session
pnpm dev                       # web + API, with reload on both sides
```

Working on one side only:

```bash
pnpm dev:web                   # TanStack Start on :3001
pnpm dev:server                # Spring Boot on :8080
```

Before committing:

```bash
pnpm fix                       # Biome format + autofix
pnpm check-types               # TypeScript across the workspace
pnpm test                      # web (Vitest) and server (JUnit) tests
```

## Testing

| Side | Tooling |
| --- | --- |
| `apps/web` | Vitest + Testing Library, jsdom |
| `apps/server` | JUnit via Surefire |

```bash
pnpm test                          # everything, cached by Nx
pnpm --filter web test:watch       # web tests in watch mode
```

Web tests live in `apps/web/tests/`, mirroring `src/`: a test for
`src/routes/thing.tsx` goes at `tests/routes/thing.test.tsx`. Use
`renderWithProviders` from `tests/test-utils.tsx` for components that touch
data fetching or the theme.

**We work test-first — see [`.spec/testing.md`](.spec/testing.md)** for the
workflow, what not to test, and the rules that keep tests trustworthy.

Configuration is in `apps/web/vitest.config.ts`, deliberately separate from
`vite.config.ts` so tests don't load the SSR plugins.

Nx caches all of these, so re-running an unchanged project is close to
instant. To bypass the cache, add `--skip-nx-cache`.

Stopping Postgres:

```bash
pnpm db:stop                   # stop, keep the data
pnpm db:down                   # stop and remove the container
```

## The contract loop

The frontend's types are generated from the backend's code, so after changing
any controller:

```bash
pnpm db:start        # the export boots the app, so Postgres must be up
pnpm api:generate    # writes packages/api/openapi.json + src/schema.ts
pnpm check-types     # the web app fails wherever the contract moved
```

Commit the generated files alongside the Java change. Full workflow in
[`AGENTS.md`](AGENTS.md) §4.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | Web + API |
| `pnpm dev:web` / `pnpm dev:server` | One side only |
| `pnpm build` | Everything, Java included |
| `pnpm test` | web (Vitest) + server (JUnit) tests |
| `pnpm --filter web test:watch` | Web tests in watch mode |
| `pnpm check-types` | TypeScript across the workspace |
| `pnpm check` / `pnpm fix` | Ultracite (Biome) lint + format |
| `pnpm api:generate` | Regenerate the API contract |
| `pnpm db:start` / `pnpm db:stop` / `pnpm db:down` | Postgres container |
| `pnpm db:migrate` / `pnpm db:push` / `pnpm db:studio` | Prisma |
| `pnpm docker:up` / `pnpm docker:down` / `pnpm docker:logs` | Full stack in Docker |

Java directly: `./mvnw -pl com.proj:server <phase>` from the repo root.

## Authentication

Okta is wired but dormant. While `OKTA_OAUTH2_ISSUER` is unset the API is open,
so local development needs no Okta tenant; set it and `SecurityConfig` starts
validating JWTs. Turning auth on is a config change, not a code change.

## Project structure

```
proj/
├── apps/
│   ├── web/          # TanStack Start frontend
│   └── server/       # Spring Boot API
├── packages/
│   ├── api/          # generated OpenAPI types + typed client
│   ├── db/           # Prisma schema, migrations, client
│   ├── ui/           # shared shadcn/ui primitives
│   ├── env/          # validated environment variables
│   └── config/       # shared tsconfig
├── .spec/            # architecture, decisions, feature specs
├── pom.xml           # Maven aggregator (Nx reads the Java module through this)
└── docker-compose.yml
```

## UI

Shared primitives live in `packages/ui`:

```bash
pnpm dlx shadcn@latest add dialog table -c packages/ui
```

```tsx
import { Button } from "@proj/ui/components/button";
```

Design tokens are in `packages/ui/src/styles/globals.css`.

## Docker

For local development you only ever need `pnpm db:start`, which runs Postgres
alone. The full stack is for deployment and production parity:

```bash
pnpm docker:up      # build and start web + server + postgres
pnpm docker:logs
pnpm docker:down
```

`VITE_API_URL` is baked into the web bundle at build time, so it must be the
URL the **browser** will use - never a Docker-internal hostname.
