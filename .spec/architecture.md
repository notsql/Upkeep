# Architecture

## Shape

```
Browser
   |
   |  fetch, typed by packages/api (generated from OpenAPI)
   v
apps/web            TanStack Start (React 19, Vite) on :3001
   |
   |  HTTP + CORS + bearer token
   v
apps/server         Spring Boot 4 (Java 25) on :8080  <-- all business logic
   |
   |  JDBC
   v
Postgres 18         schema owned by Prisma (packages/db)
```

The browser talks to Spring **directly**. TanStack Start is not a proxy for the
API; it renders the app. That means Spring owns CORS (`SecurityConfig`) and the
API is independently testable with `curl` or the Swagger UI.

On the web side, React Query sits over the generated client. The `QueryClient`
is built per request inside `getRouter()` and passed through router context -
never at module scope, because this app server-side renders and a shared client
would leak one user's cache into another's response.

`packages/db` is deliberately **not** imported by any running application. It
exists for schema, migrations and Studio. At runtime, Postgres is
reached only by Spring over JDBC; `packages/db` reaches it through Prisma's
`@prisma/adapter-pg` driver adapter when you run its scripts.

## The three rules

These are the load-bearing constraints. Everything else is detail.

1. **Only `apps/server` touches the database at runtime.** `apps/web` has no
   `@prisma/client` dependency and must never gain one.
2. **Only Prisma changes the database's shape.** Tables are defined in
   `packages/db/prisma/schema/schema.prisma` and applied with `pnpm db:migrate`.
   Spring reads and writes rows; it never migrates.
3. **The frontend's types come from the backend's code.** Never hand-write a
   request or response type in `apps/web` - regenerate the contract instead.

See `decisions/0001` and `decisions/0002` for why.

## Workspace

| Path | What it is | Nx project |
| --- | --- | --- |
| `apps/web` | TanStack Start app, port 3001 | `web` |
| `apps/server` | Spring Boot API, port 8080 | `server` |
| `packages/api` | Generated OpenAPI types + typed fetch client | `@proj/api` |
| `packages/db` | Prisma schema, migrations, client | `@proj/db` |
| `packages/ui` | Shared shadcn/ui primitives | `@proj/ui` |
| `packages/env` | Validated env vars (`@t3-oss/env-core`) | `@proj/env` |
| `packages/config` | Shared `tsconfig.base.json` | `@proj/config` |
| `pom.xml` (root) | Maven aggregator so Nx can see the Java module | `com.proj:proj` |

## Dependency conventions

Shared versions live in the `catalog:` block of `pnpm-workspace.yaml`; packages
reference them as `"catalog:"`. Bump the catalog, not individual manifests.

Each package declares exactly what its own source imports - nothing more, and
nothing borrowed from a sibling package's tree. `packages/ui` owns `sonner` and
`next-themes` because its components import them; `apps/web` declares them too,
because it imports them itself.

## The contract loop

This is the workflow that keeps the two languages in agreement:

```
1. Change a @RestController in apps/server
2. pnpm api:generate             # boots the app, writes packages/api/openapi.json,
                                 # regenerates packages/api/src/schema.ts
3. apps/web now type-errors wherever the contract changed. Fix those.
4. Commit the generated files alongside the Java change.
```

`openapi.json` and `schema.ts` are committed on purpose: a fresh clone
type-checks without a running server, and every contract change is visible in
review.

**A DTO must be a real type.** `Map<String, Object>` or a bare `Object` return
type generates as `unknown` and destroys type safety on the frontend.

## Authentication

WorkOS AuthKit (OAuth2 / OIDC), wired but dormant on both sides.

AuthKit issues standard OIDC tokens, so the server is a plain Spring resource
server - no vendor starter. `SecurityConfig` reads
`spring.security.oauth2.resourceserver.jwt.issuer-uri`. While it is unset - the
default - the API is fully open, so local development needs no WorkOS tenant.
Set it to the AuthKit domain and the same config switches to validating JWTs on
every request except the OpenAPI and health endpoints, discovering the JWKS
from the issuer. Set `spring.security.oauth2.resourceserver.jwt.audiences` to
the API URI in the WorkOS JWT template so Spring also rejects tokens minted for
another resource. Turning auth on is a config change, not a code change.

The property must not be given an empty default in `application.yaml`: Spring's
resource-server auto-configuration keys off the property merely being present,
so a blank value builds a `JwtDecoder` against no issuer and fails at startup.

On the web side `AuthProvider` (`apps/web/src/components/auth-provider.tsx`)
mounts AuthKit only when `VITE_WORKOS_CLIENT_ID` is set, and `AuthTokenBridge`
hands the token resolver to the generated client's `getToken` callback. The
resolver is installed browser-side only - the app server-side renders, and a
module-scope resolver on the server would be shared across requests, so SSR
fetches go out unauthenticated by design.

Registration uses AuthKit's hosted sign-up flow. The local `/register` page
collects only an email hint before redirecting; WorkOS collects the user's name
and password, applies the configured password policy, sends the verification
email, and does not complete authentication until verification succeeds.

Sign-in follows the same hosted model. `/login` initiates AuthKit, and the
pathless `_authenticated` route layout prevents protected pages such as
`/account` from rendering until AuthKit has restored a valid user session.
OAuth return locations are reduced to same-origin paths before navigation.
Terminal refresh failures start authentication again; transient API failures
do not create a separate local session.

The session policy is 5-minute access tokens, a 30-minute inactivity timeout,
and an 8-hour maximum session length, configured in the WorkOS application.
While a user is signed in, the global web guard also signs out after 30 minutes
without meaningful browser input, including on public routes;
`VITE_AUTH_IDLE_TIMEOUT_MINUTES` keeps that UI policy configurable. WorkOS
remains the session authority. Hosted AuthKit's rate limits and adaptive
brute-force protection are used as provided: AuthKit does not expose a fixed
per-account "N consecutive failures" lockout setting, and this application does
not duplicate credential handling to manufacture one.

The WorkOS dashboard must have public sign-up, Email + Password, and automated
verification emails enabled. Configure first and last name as required fields,
register the web redirect URI and allowed origin, and add the Spring API URI as
the JWT template's `aud` claim. The issuer and audience configured in Spring
must exactly match the resulting access token.

## Environment

Each app reads its own `.env`; see the `.env.example` next to each one.

| Variable | Used by | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `packages/db` | Prisma only. |
| `SPRING_DATASOURCE_*` | `apps/server` | JDBC URL, not the Prisma URL. |
| `VITE_API_URL` | `apps/web` | **Baked in at build time**, so it must be the URL the *browser* uses - never a Docker-internal hostname. |
| `CORS_ALLOWED_ORIGINS` | `apps/server` | Must include the web app's origin. |
| `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_ISSUER_URI` | `apps/server` | WorkOS AuthKit domain. Unset disables auth; never set it blank. |
| `SPRING_SECURITY_OAUTH2_RESOURCESERVER_JWT_AUDIENCES` | `apps/server` | API audience also configured in the WorkOS JWT template. |
| `VITE_WORKOS_CLIENT_ID` | `apps/web` | Unset means the app runs unauthenticated. |
| `VITE_WORKOS_REDIRECT_URI` | `apps/web` | Must be registered in the WorkOS dashboard. Defaults to the dev origin. |
| `VITE_AUTH_IDLE_TIMEOUT_MINUTES` | `apps/web` | Browser inactivity before AuthKit sign-out. Defaults to `30`; keep it aligned with the WorkOS Sessions policy. |
| `ANTHROPIC_API_KEY` | `apps/server` | Only if the Spring AI integration is used. |
| `WORKOS_API_KEY` | `apps/server` | Secret. Only for server-to-WorkOS calls (`GET /users`); never in `apps/web`. Blank makes `/users` return 503. |
| `SERVER_PORT` | `apps/server` | Defaults to `8080`. |
| `ML_API_URL` | `apps/server` | Where Spring reaches `apps/ml`. Set by `docker-compose.yml`; not read by any code until the ML client exists. |
| `ML_MODEL_PATH` | `apps/ml` | Defaults to `models/model.onnx`. |
| `VITE_API_URL`, `CORS_ALLOWED_ORIGINS` | root `.env` | Compose interpolation only, for `pnpm docker:up`. |

Nx loads each project's `.env` into its tasks (`pnpm dev`, `api:generate`,
...). Running `./mvnw` directly does **not**, so Spring falls back to the
defaults in `application.yaml`.

## Testing

| Side | Tooling | Run |
| --- | --- | --- |
| `apps/web` | Vitest + Testing Library, jsdom | `pnpm test`, `pnpm --filter web test:watch` |
| `apps/server` | JUnit via Surefire | `pnpm test` |

`pnpm test` runs both through Nx, with caching. Web tests live in
`apps/web/tests/`, mirroring `src/`. **See `testing.md` for the TDD workflow.**

Web tests use `apps/web/vitest.config.ts`, which is intentionally *not*
`vite.config.ts`: the app config loads the TanStack Start and Nitro plugins to
build an SSR server, which component tests neither need nor should depend on.

## Known sharp edges

- **Spring AI's Anthropic auto-configuration is disabled.** Version 2.0.1
  cannot bind `spring.ai.anthropic.chat.thinking` under Spring Boot 4.1.1 and
  brings the whole context down. It is excluded in `application.yaml`; the
  dependency is still on the classpath. Remove the exclusion and re-run the
  tests once Spring AI ships a fix.
- **`@nx/maven` is experimental upstream.** See `decisions/0003` for the
  fallback if it breaks.
- **React Query is not wired into SSR hydration.** `QueryClientProvider` is set
  up in `__root.tsx` and the client lives in router context (created per
  request, so nothing leaks between users), but data fetched in a route loader
  is not dehydrated into the HTML - the browser refetches on mount. If loader
  prefetching becomes important, add `@tanstack/react-router-with-query`.
- **Java and Prisma drift.** Nothing mechanically checks that Java persistence
  code matches the Prisma schema. A migration is only half the task.
- **`openapi-typescript` wants TypeScript 5.** It declares `typescript: ^5.x`
  as a peer and uses the compiler API, which TypeScript 7 rewrote. The
  workspace is on 7 and it resolves anyway, but if `pnpm api:generate` breaks
  around the compiler API, pin `packages/api` to `typescript: ^5.9.3` in its
  own `package.json` - pnpm isolates it per package.
- **`apps/web` has no `check-types` target.** `src/routeTree.gen.ts` is
  generated by Vite and gitignored, so `tsc --noEmit` fails on a fresh clone
  until something has run `vite dev` or `vite build`. Type errors in the web
  app therefore only surface in the editor and at build time.
