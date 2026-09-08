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
| Contract | springdoc -> `openapi-typescript` -> `openapi-fetch` | `packages/api` | - |
| Database | Postgres 18, Prisma 7 | `packages/db` | 5432 |
| Orchestration | Nx 23 + `@nx/maven`, pnpm workspaces | root | - |
| Testing | Vitest + Testing Library (web), JUnit (server) | - | - |
| Data fetching | React Query over the generated client | `apps/web` | - |

The browser calls Spring **directly** (CORS, not a proxy).

---

## 3. Commands

Run everything from the repo root.

| Command | Does |
| --- | --- |
| `pnpm dev` | Web + API together |
| `pnpm dev:web` / `pnpm dev:server` | One side only |
| `pnpm build` | Builds everything, Java included |
| `pnpm test` | All tests |
| `pnpm check-types` | TypeScript across the workspace |
| `pnpm check` / `pnpm fix` | Ultracite (Biome) lint + format |
| `pnpm db:start` / `pnpm db:stop` | Postgres container |
| `pnpm db:migrate` | Create + apply a Prisma migration |
| `pnpm db:studio` | Prisma Studio |
| `pnpm api:generate` | **Regenerate the API contract** (see §4) |
| `pnpm docker:up` | Full stack in Docker |

Java directly, when you need it: `./mvnw -pl com.proj:server <phase>` from the
repo root. The wrapper is at the root, not in `apps/server` - `@nx/maven`
requires it there.

**Nx runs tasks; Docker runs services.** The dev loop is Postgres in Docker
(`pnpm db:start`) and everything else natively through Nx (`pnpm dev`). The
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
3. `pnpm db:start` - the export boots the app, so Postgres must be up.
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

### Adding or changing a database table

1. Edit `packages/db/prisma/schema/schema.prisma`.
2. `pnpm db:migrate` - creates the migration and applies it.
3. Update the Java persistence code in `apps/server` to match. **Nothing checks
   this for you**; the migration is only half the task.
4. Commit the migration directory with the code.

### Adding a shared UI component

```bash
pnpm dlx shadcn@latest add <component> -c packages/ui
```

Import as `@proj/ui/components/<component>`. App-specific blocks that will
never be reused belong in `apps/web/src/components` instead.

### Turning on authentication

Set `OKTA_OAUTH2_ISSUER` in `apps/server/.env`. `SecurityConfig` switches from
open to JWT-validating on its own - do not add conditional logic for this.

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

- Assertions inside `it()`/`test()` blocks; `async`/`await`, no done callbacks.
- No `.only` or `.skip` in committed code.
- **Web:** Vitest + Testing Library, jsdom. Tests live in `apps/web/tests/`,
  mirroring `src/` - a test for `src/routes/thing.tsx` goes at
  `tests/routes/thing.test.tsx`. Import the subject via `@/`, not a relative
  path.
  - **Write the failing test first, and run it.** A test you never saw fail is
    a test you have no reason to trust. Show the failure before implementing.
  - **Never edit a test to make an implementation pass.** If a test is
    genuinely wrong, say so and fix it as a change of its own.
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
  context-level tests, plain unit tests for logic.

---

## 6. Where things live

| You want to... | Go to |
| --- | --- |
| Understand the system | `.spec/architecture.md` |
| Know why something is the way it is | `.spec/decisions/` |
| Write a feature spec | `.spec/features/TEMPLATE.md` |
| Learn how we test | `.spec/testing.md` |
| Change the DB schema | `packages/db/prisma/schema/schema.prisma` |
| Change API security or CORS | `apps/server/.../config/SecurityConfig.java` |
| Change the API's OpenAPI metadata | `apps/server/.../config/OpenApiConfig.java` |
| Add an env var | `packages/env/src/*.ts` **and** the matching `.env.example` |
| Change Nx targets for Java | `apps/server/project.json` |
| Write a web test | `apps/web/tests/`, mirroring `src/` |
| Configure web tests | `apps/web/vitest.config.ts`, `apps/web/tests/setup.ts` |
| Bump a shared dependency version | the `catalog:` in `pnpm-workspace.yaml` |

---

## 7. Before you finish

- `pnpm check-types` and `pnpm test` pass.
- `pnpm fix` has been run.
- If you touched a controller: `pnpm api:generate` was run and the generated
  files are committed.
- If you touched the Prisma schema: the migration is committed and the Java
  side was updated.
- If you made a structural or architectural choice: a note in `.spec/decisions/`.
