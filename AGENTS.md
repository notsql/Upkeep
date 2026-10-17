# AGENTS.md

Guide for coding agents and new teammates working in this repository.
Read `.spec/architecture.md` before making structural changes.

---

## 1. Hard rules

Non-negotiable. Breaking one of these is a bug even if the code works.

1. **Never install anything.** Do not run `pnpm add`, `npm install`, `brew
   install`, or add a dependency on your own initiative. If a task genuinely
   needs a new package, add the entry to the relevant `package.json` (and to
   the `catalog:` in `pnpm-workspace.yaml`) and *tell the human to install it*.
   The same goes for Maven: edit `pom.xml`, don't fetch tools.
2. **Never use `git stash`.** It hides work and loses it silently. If you need
   a clean tree, commit to a branch instead.
3. **Follow YAGNI.** Build exactly what was asked. No speculative abstractions,
   no config for cases that don't exist yet, no "while I'm here" refactors.
   The smallest change that fully solves the problem is the correct one.
4. **Only `apps/server` touches the database.** `apps/web` must never gain a
   `@prisma/client` dependency.
5. **Only Prisma changes the database's shape.** Schema lives in
   `packages/db/prisma/schema/schema.prisma`. Spring never migrates.
6. **Never hand-write API types in the frontend.** Regenerate the contract.
7. **Tests first (TDD).** Every behaviour change - web, server or ml - starts
   with a failing test that you run and see fail, then the implementation.
   See §5 "Tests" and `.spec/testing.md`.
8. **Folder-based routing.** Web routes nest as directories under
   `apps/web/src/routes`, not dot-separated file names:
   `_auth/admin/users/index.tsx`, not `_auth/admin.users.tsx`. A
   segment's root is its `index.tsx`; components used by one route only live
   beside it in a `-components/` folder.
9. **Build UI from shadcn.** Use the components in `packages/ui` rather than
   hand-rolling buttons, inputs, dialogs, cards and the like. If the one you
   need is missing, add it with the shadcn CLI (§4), never by hand.
10. **Refactor the UI you touch.** When you change a screen, move it onto
    shadcn components and folder-based routes (rules 8-9) as part of the same
    change. This is the one sanctioned exception to rule 3 - but stay within
    the screen you were asked to change.
11. **Document for AI in `.docs/`.** `.docs/` describes the system *as built*,
    written so an agent can work from it without reading the code
    (`.spec/features/` is the plan made *before* building). One file per
    feature on each side:
    - `.docs/api/<feature>.md` - the API contract: every endpoint's method,
      path, request and response DTOs (fields and types), status codes,
      auth, and a short example. It must agree with
      `packages/api/openapi.json`, which stays the source of truth.
    - `.docs/frontend/<feature>.md` - the routes and their folders, the
      screens and shadcn components they use, and which endpoints each
      screen calls (query keys, mutations, invalidations).
    - `.docs/README.md` - an index linking every file above.

    Update the matching `.docs/` files in the same change as the code.
12. **Plan before building anything non-trivial.** A new feature, a new
    endpoint or table, or any change spanning more than one app starts with a
    spec in `.spec/features/` (the `/new-feature-spec` command). Stop and get
    it agreed by a human before writing code. Bug fixes and changes confined
    to one file skip this, but still start with a failing test (rule 7).
13. **Never commit.** Humans make every commit. Leave your changes uncommitted
    in the working tree and tell the human what is ready to commit. This
    also means no `git commit`, `git commit --amend`, `git merge`,
    `git rebase`, `git cherry-pick`, `git revert` or `git push` on your own
    initiative. Where a workflow below says "commit", that is the human's step.

Rules 4-6 are explained in `.spec/decisions/`.

**Shared dependency versions live in the `catalog:` block of
`pnpm-workspace.yaml`**, and packages reference them as `"catalog:"`. Bump the
catalog, not the individual `package.json`.

**Declare what you import.** A package's `package.json` must list every module
its own source imports - do not rely on another workspace package having pulled
something in. Equally, do not leave dependencies behind that nothing imports.

---

## 2. The stack

| Layer | Tech | Location | Port |
| --- | --- | --- | --- |
| Frontend | TanStack Start, React 19, Vite, Tailwind 4 | `apps/web` | 3001 |
| Backend | Spring Boot 4, Java 25, Maven | `apps/server` | 8080 |
| Inference | FastAPI, onnxruntime, uv | `apps/ml` | 8000 |
| Contract | springdoc -> `openapi-typescript` -> `openapi-fetch` | `packages/api` | - |
| Database | Postgres 18, Prisma 7 | `packages/db` | 5432 |
| Orchestration | Nx 23 + `@nx/maven`, pnpm workspaces | root | - |
| Testing | Vitest + Testing Library (web), JUnit (server), pytest (ml) | - | - |
| Data fetching | React Query over the generated client | `apps/web` | - |

The browser calls Spring **directly** (CORS, not a proxy). `apps/ml` is
internal: only `apps/server` calls it, so the browser's API surface stays the
generated contract. See `.spec/decisions/0007-*`.

---

## 3. Commands

Run everything from the repo root.

| Command | Does |
| --- | --- |
| `pnpm dev` | web + API + inference together (no database setup) |
| `pnpm db:migrate` | Create a migration from the schema and apply it |
| `pnpm db:deploy` | Apply pending migrations to whatever `DATABASE_URL` points at |
| `pnpm db:generate` | Regenerate the Prisma client and the jOOQ classes |
| `pnpm dev:web` / `pnpm dev:server` / `pnpm dev:ml` | One side only |
| `pnpm build` | Builds everything, Java included |
| `pnpm test` | All tests |
| `pnpm check-types` | TypeScript across the workspace |
| `pnpm check` / `pnpm fix` | Lint + format: Ultracite (TS), Ruff (ml), Spotless (server) |
| `pnpm db:reset` | Drop, recreate, replay migrations |
| `pnpm db:studio` | Prisma Studio |
| `pnpm api:generate` | **Regenerate the API contract** (see §4) |
| `pnpm docker:up` | Full stack in Docker |

Java directly, when you need it: `./mvnw -pl com.proj:server <phase>` from the
repo root. The wrapper is at the root, not in `apps/server` - `@nx/maven`
requires it there.

**Secrets come from Infisical.** Each project wraps its own commands that need
secrets in `infisical run --env=dev --path=<its folder>`: `dev` in
`apps/web/package.json`; `db:migrate`, `db:reset` and `db:studio` in
`packages/db/package.json`; `dev`, `openapi` and `db:generate` in
`apps/server/project.json`. Root scripts stay plain Nx calls, so
`pnpm nx run <project>:<target>` gets secrets too. Infisical's
folders mirror the repo (`/apps/web`, `/apps/server`, `/packages/db`) and each
script loads only the folders it needs. One-time setup per machine:
install the Infisical CLI, then `infisical login`. `.infisical.json` links the
repo to the project and is committed. `build`, `test`, `check-types` and
`db:deploy` are not wrapped, because CI supplies its own environment. Do not
create secrets with empty values - a blank
`SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI` takes the API down (§4).
See `.spec/decisions/0018-*`.

**Nx runs tasks; Docker runs services.** The dev database is Neon; everything else
runs natively through Nx (`pnpm dev`). The
`web` and `server` services in `docker-compose.yml` are for deployment parity -
do not `docker compose up` the full stack just to develop or to check a change.

---

## 4. Workflows

### Adding or changing an API endpoint

The single most important loop in this repo. Do not skip step 4.

1. Write the `@RestController` method in `apps/server`. Return a **real DTO
   type** - a `record` is ideal. `Map<String, Object>` generates as `unknown`
   on the frontend and defeats the whole setup.
2. Annotate anything the generated types can't infer (`@RequestParam`
   requiredness, response codes via `@ApiResponse`).
3. The export boots the app, so the Neon database in `apps/server/.env` must be
   reachable.
4. `pnpm api:generate` - rewrites `packages/api/openapi.json` and
   `packages/api/src/schema.ts`.
5. `pnpm check-types` - the web app now fails wherever the contract moved. Fix
   those call sites.
6. Commit the generated files **in the same commit** as the Java change.

Call the endpoint from the web app through the typed client, wrapped in React
Query - never with a raw `fetch`:

```ts
import { useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";

const { data } = useQuery({
  queryKey: ["thing", id],
  queryFn: async () => {
    const { data, error } = await api.GET("/things/{id}", {
      params: { path: { id } },
    });
    if (error) {
      throw new Error("Failed to load thing");
    }
    return data;
  },
});
```

`openapi-fetch` returns errors rather than throwing, so throw explicitly in
`queryFn` - otherwise React Query treats a failed request as success.

Put a feature's query and mutation hooks in `apps/web/src/lib/<feature>.ts`
(see `lib/assets.ts`) and have components call those hooks, not `api`
directly. Query keys for per-user data start with the user's ID, so one user's
cache is never served to the next.

### Adding or changing a database table

1. Edit `packages/db/prisma/schema/schema.prisma`.
2. `pnpm db:migrate` - creates the migration and applies it.
3. `pnpm db:generate` - regenerates the Prisma client **and** the jOOQ classes
   in `com.proj.server.db` from the migrated Neon database.
4. `./mvnw -pl com.proj:server compile` - the Java side now fails wherever the
   schema moved. Fix those call sites. Never hand-edit `com.proj.server.db`;
   it is generated output and the generator overwrites it.
5. Commit the migration directory **and the regenerated jOOQ sources** with the
   code, the same way the generated API contract is committed.

### Adding a shared UI component

```bash
pnpm dlx shadcn@latest add <component> -c packages/ui
```

Import as `@proj/ui/components/<component>`. App-specific blocks that will
never be reused belong in `apps/web/src/components` instead.

### Turning on authentication

Authentication is WorkOS AuthKit, and both sides stay dormant until configured
- do not add conditional logic for this.

- **Server:** set `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI` in
  `apps/server/.env` to your AuthKit domain (`https://<tenant>.authkit.app`).
  `SecurityConfig` switches from open to JWT-validating on its own. Do **not**
  give this property an empty default in `application.yaml` - Spring's
  resource-server auto-configuration keys off the property merely being
  present, and a blank value takes the context down at startup.
- **Web:** set `VITE_WORKOS_CLIENT_ID` (and `VITE_WORKOS_REDIRECT_URI` if not
  `http://localhost:3001`) in `apps/web/.env`. While the client ID is unset,
  `AuthProvider` and `AuthButton` render straight through and the app runs
  unauthenticated.

The bearer token reaches the API through `createApiClient`'s `getToken`, wired
by `AuthTokenBridge` in `apps/web/src/components/auth-provider.tsx`. Never
attach the header by hand.

---

## 5. Code standards

Biome/Ultracite auto-fixes formatting and most lint issues: run `pnpm fix`
before committing. What follows is what tooling cannot check.

### TypeScript

- Explicit types on function parameters and return values where they aid
  clarity; `unknown` over `any`, always.
- `const` by default; `for...of` over `.forEach`; optional chaining and `??`.
- Early returns over nested conditionals. Extract complex conditions into
  named booleans.
- No barrel files. Import from the specific module.
- No `console.log` or `debugger` in committed code.
- Throw `Error` objects with useful messages, never strings.

### React

- Function components. Hooks at the top level, never conditionally.
- Complete hook dependency arrays.
- Stable `key` props - IDs, not array indices.
- Never define a component inside another component.
- `ref` as a prop (React 19), not `forwardRef`.
- Semantic HTML and real ARIA: labelled inputs, alt text, proper heading order,
  keyboard handlers alongside mouse handlers.
- `rel="noopener"` on `target="_blank"`. Avoid `dangerouslySetInnerHTML`.

### TypeScript version

The whole workspace is on **TypeScript 7** (the native compiler), via the
`catalog:` entry.

One thing to watch: `openapi-typescript` declares `typescript: ^5.x` as a peer
and drives the compiler API to emit `schema.ts`. It currently resolves against
TypeScript 7 anyway. **If `pnpm api:generate` starts failing in a way that
points at the compiler API, this is why** - the fix is to pin
`packages/api` to `typescript: ^5.9.3` in its own `package.json`, which is
supported because pnpm isolates each package's `node_modules`.

### Python (`apps/ml`)

- `uv` manages the environment; dependencies go in `apps/ml/pyproject.toml`,
  **not** the pnpm `catalog:`. As with everything else, edit the manifest and
  tell the human to run `uv sync` - do not install on your own initiative.
- Pydantic models for request and response bodies. Configuration through
  `pydantic-settings` (`ML_*`), never bare `os.environ`.
- Keep the service model-agnostic: `/predict` reads the loaded session's
  signature. Swapping the `.onnx` should not need a code change.
- Tests in `apps/ml/tests`, run with `uv run pytest`. Build fixture models in
  the test rather than checking a binary in.

### Java

- Constructor injection. No `@Autowired` on fields.
- `record` for DTOs. Keep entities and DTOs separate - never return a
  persistence type from a controller.
- Controllers stay thin: validate, delegate to a service, map the result.
- Validate request bodies with `@Valid` and Jakarta constraints.
- Package by feature (`com.proj.server.<feature>`), not by layer.
- Let exceptions reach a `@RestControllerAdvice`. Don't catch to rethrow.

### Tests

**Read `.spec/testing.md` before writing tests.** It carries the TDD workflow
and what not to test. The essentials:

- **Write the failing test first, and run it.** A test you never saw fail is
  a test you have no reason to trust. Show the failure before implementing.
- **Never edit a test to make an implementation pass.** If a test is
  genuinely wrong, say so and fix it as a change of its own.
- Assertions inside `it()`/`test()` blocks; `async`/`await`, no done callbacks.
- No `.only` or `.skip` in committed code.
- **Web:** Vitest + Testing Library, jsdom. Tests live in `apps/web/tests/`,
  mirroring `src/` - a test for `src/routes/thing.tsx` goes at
  `tests/routes/thing.test.tsx`. Import the subject via `@/`, not a relative
  path.
  - Import test globals explicitly (`import { describe, it, expect } from
    "vitest"`) - this project does not enable Vitest globals.
  - Use `renderWithProviders` from `tests/test-utils.tsx` for anything touching
    `useQuery` or `useTheme` - bare `render` throws without the providers.
  - **No `@testing-library/jest-dom`.** Matchers like `toBeInTheDocument` are
    not available; `getByRole` already throws when nothing matches, so the
    query is the assertion.
  - Query by **role and accessible name**, not by class or test id. If a
    component is hard to query accessibly, that is usually an accessibility
    bug in the component, not a reason to reach for `querySelector`.
  - Never assert on a fixed delay - use `findBy*` or `waitFor`.
  - `apps/web/vitest.config.ts` is deliberately separate from
    `vite.config.ts`: tests must not load the TanStack Start and Nitro SSR
    plugins.
- **Java:** tests live in `apps/server/src/test/java`. `@SpringBootTest` for
  context-level tests, plain unit tests for logic. Context tests start a
  migrated Postgres via Testcontainers (`@Import(TestcontainersConfiguration.class)`),
  so Docker must be running. See `.spec/decisions/0019-*`.

---

## 6. Where things live

| You want to... | Go to |
| --- | --- |
| Understand the system | `.spec/architecture.md` |
| Look up an endpoint or a screen as built | `.docs/` (start at `.docs/README.md`) |
| Know why something is the way it is | `.spec/decisions/` |
| Write a feature spec | `.spec/features/TEMPLATE.md`, or `/new-feature-spec` |
| Follow a workflow step by step | `.claude/commands/` (`/add-endpoint`, `/add-model`, `/new-feature-spec`) |
| Learn how we test | `.spec/testing.md` |
| Change the DB schema | `packages/db/prisma/schema/schema.prisma` |
| Change API security or CORS | `apps/server/.../config/SecurityConfig.java` |
| Change the API's OpenAPI metadata | `apps/server/.../config/OpenApiConfig.java` |
| Add an env var | `packages/env/src/*.ts`, the matching `.env.example`, **and** the matching Infisical `dev` folder, e.g. `/apps/server` (a human adds the value) |
| Change Nx targets for Java | `apps/server/project.json` |
| Serve or swap the ONNX model | `apps/ml/` (drop the file at `apps/ml/models/`) |
| Train, evaluate or explore a model | `ml-research/` - not `apps/` |
| Write a web test | `apps/web/tests/`, mirroring `src/` |
| Configure web tests | `apps/web/vitest.config.ts`, `apps/web/tests/setup.ts` |
| Bump a shared dependency version | the `catalog:` in `pnpm-workspace.yaml` |

---

## 7. Before you finish

- Non-trivial work had an agreed spec in `.spec/features/` before coding.
- Tests were written first and seen failing before the implementation.
- `pnpm check-types` and `pnpm test` pass.
- `pnpm fix` has been run.
- If you touched a controller: `pnpm api:generate` was run and the generated
  files are committed.
- If you touched the Prisma schema: `pnpm db:generate` was run, and the
  migration and the regenerated jOOQ sources are committed.
- `.docs/api/` and `.docs/frontend/` match what was built, and
  `.docs/README.md` links any new file.
- Any screen you touched uses shadcn components and folder-based routes.
- If you made a structural or architectural choice: a note in `.spec/decisions/`.


<!-- nx configuration start-->
<!-- Leave the start & end comments to automatically receive updates. -->

## General Guidelines for working with Nx

- For navigating/exploring the workspace, invoke the `nx-workspace` skill first - it has patterns for querying projects, targets, and dependencies
- When running tasks (for example build, lint, test, e2e, etc.), always prefer running the task through `nx` (i.e. `nx run`, `nx run-many`, `nx affected`) instead of using the underlying tooling directly
- Prefix nx commands with the workspace's package manager (e.g., `pnpm nx build`, `npm exec nx test`) - avoids using globally installed CLI
- You have access to the Nx MCP server and its tools, use them to help the user
- For Nx plugin best practices, check `node_modules/@nx/<plugin>/PLUGIN.md`. Not all plugins have this file - proceed without it if unavailable.
- NEVER guess CLI flags - always check nx_docs or `--help` first when unsure

## Scaffolding & Generators

- For scaffolding tasks (creating apps, libs, project structure, setup), ALWAYS invoke the `nx-generate` skill FIRST before exploring or calling MCP tools

## When to use nx_docs

- USE for: advanced config options, unfamiliar flags, migration guides, plugin configuration, edge cases
- DON'T USE for: basic generator syntax (`nx g @nx/react:app`), standard commands, things you already know
- The `nx-generate` skill handles generator discovery internally - don't call nx_docs just to look up generator syntax


<!-- nx configuration end-->