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
database access; `apps/server` is the only thing that talks to Postgres. It
also runs the anomaly model in process with onnxruntime for Java (decision 0028).

## Prerequisites

| Tool | Why |
| --- | --- |
| **Java 25** | Runs the Spring Boot API. Maven itself comes from the wrapper. |
| **pnpm 12** | Workspace package manager (version pinned by `packageManager` in `package.json`). |
| **Node 22+** | Required by Vite 8 and Vitest 5. |
| **Docker** | Runs Postgres. Nothing else in the dev loop needs it. |

Maven is *not* a prerequisite - use `./mvnw` at the repo root. It lives at the
root rather than in `apps/server` because `@nx/maven` runs Maven from the
workspace root.

VS Code users: accept the recommended extensions prompt (see
`.vscode/extensions.json`) for Java, Spring Boot, Prisma, Tailwind, Nx and
Biome support.

## Getting started

The team develops against a shared **Neon** dev database, so no local Postgres
is needed. The generated code (`packages/api/src/schema.ts`, the jOOQ classes)
is committed, so a fresh clone needs no generation step either.

**1. Copy the env files, then fill them in.**

```bash
cp packages/db/.env.example packages/db/.env
cp apps/server/.env.example apps/server/.env
cp apps/web/.env.example apps/web/.env
```

Do this before installing: the `postinstall` hook reads `packages/db/.env`.
Get the Neon connection strings from the team (see
[Neon](#neon-the-dev-database)); each `.env.example` explains the rest. All
`.env` files are gitignored - never commit real credentials.

**2. Install dependencies.**

```bash
pnpm install         # also generates Prisma Client (postinstall)
```

**3. Run everything.**

```bash
pnpm dev
```

| | |
| --- | --- |
| App | <http://localhost:3001> |
| API | <http://localhost:8080> |
| Swagger UI | <http://localhost:8080/swagger-ui> |

## Day-to-day development

```bash
pnpm dev             # web + API
pnpm dev:web         # or one side only: :3001
pnpm dev:server      # :8080
```

After pulling, if someone added a migration, apply it:

```bash
pnpm db:deploy       # applies pending migrations; never creates one
```

### The lifecycle: database -> backend -> frontend

Types flow one way. Each step generates what the next one compiles against, so
work top to bottom and stop at the first step your change doesn't touch.

```
schema.prisma --migrate----> database --db:generate--> jOOQ (Java)
                                                          |
                              Spring controller <---------+
                                     |
                              --api:generate--> schema.ts (TypeScript) --> web
```

**1. Database** - only when a table or column changes:

```bash
# edit packages/db/prisma/schema/schema.prisma
pnpm --filter @proj/db db:migrate --name <what_changed>   # creates + applies a named migration
pnpm db:generate     # regenerates Prisma Client + the jOOQ classes
```

Migrating is a `packages/db` task, not a root script - name each migration
for what it changes (`add_user_email`, not `update`). It changes the database
it points at, so run it against your own
[Neon branch](#neon-the-dev-database), never the shared one.

**2. Backend** - write the service and `@RestController` in
`apps/server/src/main/java/com/proj/server/<feature>/`, returning a `record`
DTO. `./mvnw -pl com.proj:server compile` shows anything the schema change
broke.

**3. Contract** - whenever a controller or DTO changed:

```bash
pnpm api:generate    # boots the API, rewrites packages/api/openapi.json + src/schema.ts
pnpm check-types     # the web app now fails wherever the contract moved
```

**4. Frontend** - call the endpoint through `api` from `@/lib/api` inside
`useQuery`; the types come from step 3. `src/components/user-list.tsx` is a
worked example.

**5. Before committing**

```bash
pnpm fix && pnpm check-types && pnpm test
```

Commit the generated files with the code that caused them: the migration
folder and jOOQ classes with step 1, `openapi.json` and `schema.ts` with step
3. Full detail in [`AGENTS.md`](AGENTS.md) §4.

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
`vite.config.ts` so tests don't load the SSR plugins. Nx caches all of these;
add `--skip-nx-cache` to bypass it.

## Neon (the dev database)

Prisma owns the schema; Neon is just where it lives. Neon gives two hosts per
branch: a **direct** one and a **pooled** one (contains `-pooler`). Prisma
migrations need the direct host; Spring is fine with either.

`packages/db/.env`:

```bash
DATABASE_URL=postgresql://<user>:<password>@<endpoint>.<region>.aws.neon.tech/proj?sslmode=require
```

`apps/server/.env` (JDBC takes the credentials separately):

```bash
SPRING_DATASOURCE_URL=jdbc:postgresql://<endpoint>.<region>.aws.neon.tech/proj?sslmode=require
SPRING_DATASOURCE_USERNAME=<user>
SPRING_DATASOURCE_PASSWORD=<password>
```

**Changing the schema?** Create your own
[branch](https://neon.tech/docs/introduction/branching) of the dev database in
the Neon console and point both files at it while you work. Migrating
there cannot break anyone else; once your migration is merged, `pnpm db:deploy`
applies it to the shared database.

**jOOQ reads the same database as the app** - `pnpm db:generate` uses the
`SPRING_DATASOURCE_*` values in `apps/server/.env`, so point that file at your
Neon branch while changing the schema. Nothing in the dev loop needs Docker;
`docker-compose.yml` runs the image Cloud Run runs.

## Scripts

| Command | Does |
| --- | --- |
| `pnpm dev` | web + API |
| `pnpm dev:web` / `pnpm dev:server` | One side only |
| `pnpm build` | Everything, Java included |
| `pnpm test` | All tests: web (Vitest), server (JUnit) |
| `pnpm --filter web test:watch` | Web tests in watch mode |
| `pnpm check-types` | TypeScript across the workspace |
| `pnpm check` / `pnpm fix` | Lint + format: Ultracite (TS), Spotless (server) |
| `pnpm api:generate` | Regenerate the API contract |
| `pnpm db:deploy` | Apply pending migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm db:reset` | Drop and re-migrate |
| `pnpm docker:up` / `pnpm docker:down` / `pnpm docker:logs` | The API's container image in Docker |

Java directly: `./mvnw -pl com.proj:server <phase>` from the repo root.

## Authentication

WorkOS AuthKit handles registration, verification, and sessions through TanStack
Start; Spring validates API bearer tokens. Configure each app using
[web environment variables](apps/web/.env.example) and
[server environment variables](apps/server/.env.example). See
[authentication setup](.spec/architecture.md#authentication) for dashboard settings
and session policy. The API is open while its JWT issuer is unset.

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

Development needs no Docker (Neon). Compose builds and runs the API image that
Cloud Run runs, against Neon:

```bash
pnpm docker:up      # build and start server
pnpm docker:logs
pnpm docker:down
```

## Deployment

Decision
[0029](.spec/decisions/0029-deploy-web-to-workers-and-api-to-cloud-run.md):
`apps/web` is the Cloudflare Worker `web` (`*.workers.dev`, deployed by
Workers Builds), and Spring is the Cloud Run service `api` in
`asia-southeast1` (`*.run.app`, deployed by `.github/workflows/deploy.yml`).
Production data is Neon's `prd` branch.

Branch flow: `feat/*` -> PR into `dev` -> PR `dev` into `main`.

- A PR into `dev` or `main` runs the PR checks.
- A push to `dev` migrates Neon `dev`. Nothing deploys.
- A push to `main` migrates Neon `prd`; `deploy.yml` deploys `api` when
  `apps/server/**` or `pom.xml` changed, and Workers Builds deploys `web` when
  `apps/web/**` or `packages/{api,ui,env}/**` changed. There is no deploy
  command to run by hand (`deploy.yml` can be re-run manually, e.g. after a
  secret rotation).

`deploy.yml` logs in to GCP with Workload Identity Federation, so GitHub holds
no key, only these repository variables:

| Variable | Value |
| --- | --- |
| `GCP_PROJECT_ID` | The GCP project ID |
| `GCP_WIF_PROVIDER` | `projects/<number>/locations/global/workloadIdentityPools/<pool>/providers/<provider>` |
| `GCP_DEPLOY_SA` | Deployer service account email |
| `GCP_API_RUNTIME_SA` | Service account the `api` service runs as |
| `WEB_URL` | `https://web.<account>.workers.dev` (the API's CORS origin) |

Runtime secrets come from Infisical `prd`: `/apps/server` is synced to GCP
Secret Manager, `/apps/web` to the `web` Worker.

`VITE_API_URL` is baked into the web bundle at build time (a Workers Builds
build variable), so it must be the URL the **browser** uses.
